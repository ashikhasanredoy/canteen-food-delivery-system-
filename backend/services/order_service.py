from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend import crud, schemas, models
import random
import re
import time
from backend.services import otp_service

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"


def _get_setting(db: Session, key: str, default: float) -> float:
    """
    Reads a dynamic floating-point percentage value (like admin commission or rider share) from the database.
    Falls back cleanly to the provided default if the key is missing or unparseable.
    """
    s = db.query(models.Setting).filter(models.Setting.key == key).first()
    if s:
        try:
            return float(s.value)
        except ValueError:
            pass
    return default


def _log(db: Session, category: str, action: str, summary: str, detail: str = None):
    """
    Safe activity logger that writes a audit entry into the ActivityLog table.
    Rolls back silently on database hiccups so main customer operations are never blocked.
    """
    try:
        db.add(models.ActivityLog(category=category, action=action, summary=summary, detail=detail))
        db.commit()
    except Exception:
        db.rollback()


def place_order(db: Session, order: schemas.OrderCreate):
    """
    Handles single-item checkout for immediate food purchases.
    
    Step-by-step developer logic:
    1. Validate destination delivery address (room/building) to make sure riders know where to go.
    2. Check valid email format and domain reachability.
    3. Verify stock availability and decrement inventory.
    4. Compute platform admin fee cut and rider payout cut based on current policy settings.
    5. Generate a unique 4-digit numeric OTP for delivery verification.
    6. Dispatch an itemized order confirmation email to the student with the OTP.
    7. Commit transaction and log the placement event.
    """
    # 1. Clean and validate location input
    loc_clean = (order.delivery_location or "").strip()
    if not loc_clean or len(loc_clean) < 3:
        raise HTTPException(
            status_code=400,
            detail="Delivery location / address is too short. Please provide a clear building or room number."
        )

    # 2. Email verification
    email_clean = otp_service.validate_email_address(order.email)

    # 3. Retrieve food record
    food = crud.get_food(db, food_id=order.food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Requested food item could not be found.")

    # 4. Inventory check
    if food.quantity < order.quantity:
        raise HTTPException(status_code=400, detail="Not enough food stock available to fulfill this order.")

    # Decrement available quantity
    food.quantity -= order.quantity
    total_price = round(food.price * order.quantity, 2)

    # 5. Calculate commission and rider earnings split
    admin_pct = _get_setting(db, "admin_fee_percent", 1.0)
    delivery_pct = _get_setting(db, "delivery_fee_percent", 1.0)

    admin_fee = round(total_price * admin_pct / 100, 2)
    delivery_fee = round(total_price * delivery_pct / 100, 2)

    # 6. Generate 4-digit verification OTP and group reference
    order_otp = str(random.randint(1000, 9999))
    group_id = f"GRP-{int(time.time())}-{random.randint(100, 999)}"

    try:
        # Create database order record
        db_order = models.Order(
            student_name=order.student_name,
            student_id=order.student_id,
            email=email_clean,
            otp_code=order_otp,
            order_group_id=group_id,
            phone=order.phone,
            delivery_location=loc_clean,
            total_price=total_price,
            admin_fee=admin_fee,
            delivery_fee=delivery_fee,
            status="Pending",
            delivery_request_status="None",
        )
        db.add(db_order)
        db.flush()

        # Link order item detail
        order_item = models.OrderItem(
            order_id=db_order.id,
            food_id=food.id,
            food_name=food.food_name,
            shop_name=food.shop_name,
            price=food.price,
            quantity=order.quantity,
            total_price=total_price
        )
        db.add(order_item)

        # Send confirmation email with OTP to the student
        otp_service.send_order_confirmation_email(
            to_email=email_clean,
            student_name=order.student_name,
            student_id=order.student_id,
            otp_code=order_otp,
            order_items=[{
                "food_name": food.food_name,
                "shop_name": food.shop_name,
                "quantity": order.quantity,
                "price": total_price
            }],
            total_amount=total_price,
            delivery_location=loc_clean,
            phone=order.phone
        )

        db.commit()
        db.refresh(db_order)

        _log(
            db,
            "order",
            "placed",
            f"Order #{db_order.id} placed by {order.student_name} — {food.food_name} x{order.quantity} (OTP: {order_otp})",
            detail=f"total=৳{total_price}, shop={food.shop_name}"
        )

        return db_order
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Order could not be confirmed: {e}")


def place_cart_orders(db: Session, checkout: schemas.CartCheckoutCreate):
    """
    Handles multi-item shopping cart checkouts in a single atomic transaction.
    
    Why this is structured this way:
    - Verifies all items have sufficient stock before deducting anything.
    - Aggregates multi-item purchases into a unified order with multiple OrderItem children.
    - Computes platform revenue share and courier bounty across the combined total.
    - Emails a complete itemized bill and a single 4-digit handover OTP to the buyer.
    """
    if not checkout.items:
        raise HTTPException(status_code=400, detail="Cart is empty. Please add items before checking out.")

    # 1. Clean and validate location
    loc_clean = (checkout.delivery_location or "").strip()
    if not loc_clean or len(loc_clean) < 3:
        raise HTTPException(
            status_code=400,
            detail="Delivery location / address is missing. Please provide a room or campus building."
        )

    # 2. Email verification
    email_clean = otp_service.validate_email_address(checkout.email)

    admin_pct = _get_setting(db, "admin_fee_percent", 1.0)
    delivery_pct = _get_setting(db, "delivery_fee_percent", 1.0)

    # 3. Pre-flight stock check: make sure all cart items are available
    prepared = []
    for item in checkout.items:
        food = crud.get_food(db, food_id=item.food_id)
        if not food:
            raise HTTPException(status_code=404, detail=f"Food item #{item.food_id} not found in canteen inventory.")
        if food.quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for '{food.food_name}'. Available: {food.quantity}, Requested: {item.quantity}"
            )
        prepared.append((food, item))

    # 4. Generate shared 4-digit Delivery OTP and Group ID
    order_otp = str(random.randint(1000, 9999))
    group_id = f"GRP-{int(time.time())}-{random.randint(100, 999)}"

    try:
        # Create parent order header
        db_order = models.Order(
            student_name=checkout.student_name,
            student_id=checkout.student_id,
            email=email_clean,
            otp_code=order_otp,
            order_group_id=group_id,
            phone=checkout.phone,
            delivery_location=loc_clean,
            total_price=0.0,
            admin_fee=0.0,
            delivery_fee=0.0,
            status="Pending",
            delivery_request_status="None",
        )
        db.add(db_order)
        db.flush()

        items_summary = []
        total_amount = 0.0

        # Deduct stock and attach line items
        for food, item in prepared:
            food.quantity -= item.quantity
            line_total = round(food.price * item.quantity, 2)
            total_amount += line_total

            order_item = models.OrderItem(
                order_id=db_order.id,
                food_id=food.id,
                food_name=food.food_name,
                shop_name=food.shop_name,
                price=food.price,
                quantity=item.quantity,
                total_price=line_total,
            )
            db.add(order_item)
            items_summary.append({
                "food_name": food.food_name,
                "shop_name": food.shop_name,
                "quantity": item.quantity,
                "price": line_total
            })

        # Finalize fee distributions
        total_amount_round = round(total_amount, 2)
        db_order.total_price = total_amount_round
        db_order.admin_fee = round(total_amount_round * admin_pct / 100, 2)
        db_order.delivery_fee = round(total_amount_round * delivery_pct / 100, 2)

        # Dispatch confirmation email with OTP before committing
        otp_service.send_order_confirmation_email(
            to_email=email_clean,
            student_name=checkout.student_name,
            student_id=checkout.student_id,
            otp_code=order_otp,
            order_items=items_summary,
            total_amount=total_amount_round,
            delivery_location=loc_clean,
            phone=checkout.phone
        )

        db.commit()
        db.refresh(db_order)

        _log(
            db,
            "order",
            "placed",
            f"Order #{db_order.id} ({len(items_summary)} items) placed by {checkout.student_name} (OTP: {order_otp})",
            detail=f"total=৳{db_order.total_price}, shops={db_order.shop_name}, email={email_clean}",
        )

        order_dict = {
            **{c.name: getattr(db_order, c.name) for c in db_order.__table__.columns},
            "food_id": db_order.food_id,
            "quantity": db_order.quantity,
            "food_name": db_order.food_name,
            "shop_name": db_order.shop_name,
            "items": [
                {
                    "id": it.id,
                    "food_id": it.food_id,
                    "food_name": it.food_name,
                    "shop_name": it.shop_name,
                    "price": it.price,
                    "quantity": it.quantity,
                    "total_price": it.total_price
                }
                for it in db_order.items
            ]
        }

        return {
            "order": order_dict,
            "orders": [order_dict],
            "total_amount": total_amount_round,
            "order_count": 1,
            "otp_code": order_otp,
            "email_sent": True,
            "message": f"Order confirmed! 4-digit delivery OTP has been sent to {email_clean}"
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Order could not be confirmed: {e}")

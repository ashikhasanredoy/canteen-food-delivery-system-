from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend import crud, schemas, models

def _get_setting(db: Session, key: str, default: float) -> float:
    s = db.query(models.Setting).filter(models.Setting.key == key).first()
    if s:
        try:
            return float(s.value)
        except ValueError:
            pass
    return default

def _log(db, category, action, summary, detail=None):
    try:
        db.add(models.ActivityLog(category=category, action=action, summary=summary, detail=detail))
        db.commit()
    except Exception:
        db.rollback()

import random
import re
import time
from backend.services import otp_service

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

def place_order(db: Session, order: schemas.OrderCreate):
    # Validate delivery location
    loc_clean = (order.delivery_location or "").strip()
    if not loc_clean or len(loc_clean) < 3:
        raise HTTPException(status_code=400, detail="Delivery location / address not found. Please provide a valid room or building location.")

    # Validate email and check domain existence
    email_clean = otp_service.validate_email_address(order.email)

    # Get the food item
    food = crud.get_food(db, food_id=order.food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")

    # Check stock
    if food.quantity < order.quantity:
        raise HTTPException(status_code=400, detail="Not enough stock available")

    # Deduct stock
    food.quantity -= order.quantity

    total_price = round(food.price * order.quantity, 2)

    # Read fee percentages from settings (default 1%)
    admin_pct = _get_setting(db, "admin_fee_percent", 1.0)
    delivery_pct = _get_setting(db, "delivery_fee_percent", 1.0)

    admin_fee = round(total_price * admin_pct / 100, 2)
    delivery_fee = round(total_price * delivery_pct / 100, 2)

    # Generate 4-digit OTP and unique group ID for this confirmed order
    order_otp = str(random.randint(1000, 9999))
    group_id = f"GRP-{int(time.time())}-{random.randint(100, 999)}"

    try:
        # Create single order object
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

        # Dispatch email confirmation with 4-digit OTP
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

        _log(db, "order", "placed",
             f"Order #{db_order.id} placed by {order.student_name} — {food.food_name} x{order.quantity} (OTP: {order_otp})",
             detail=f"total=৳{total_price}, shop={food.shop_name}")

        return db_order
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Order could not be confirmed: {e}")


def place_cart_orders(db: Session, checkout: schemas.CartCheckoutCreate):
    if not checkout.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    # Validate delivery location / address
    loc_clean = (checkout.delivery_location or "").strip()
    if not loc_clean or len(loc_clean) < 3:
        raise HTTPException(status_code=400, detail="Delivery location / address not found. Please provide a valid location (e.g. Room 402 / Library).")

    # Validate email address and check domain existence
    email_clean = otp_service.validate_email_address(checkout.email)

    admin_pct = _get_setting(db, "admin_fee_percent", 1.0)
    delivery_pct = _get_setting(db, "delivery_fee_percent", 1.0)

    prepared = []
    for item in checkout.items:
        food = crud.get_food(db, food_id=item.food_id)
        if not food:
            raise HTTPException(status_code=404, detail=f"Food item #{item.food_id} not found")
        if food.quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough stock for {food.food_name}. Available: {food.quantity}"
            )
        prepared.append((food, item))

    # Generate unified 4-digit Delivery OTP and shared group ID for this checkout
    order_otp = str(random.randint(1000, 9999))
    group_id = f"GRP-{int(time.time())}-{random.randint(100, 999)}"

    try:
        # Create ONE single unified order
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

        total_amount_round = round(total_amount, 2)
        db_order.total_price = total_amount_round
        db_order.admin_fee = round(total_amount_round * admin_pct / 100, 2)
        db_order.delivery_fee = round(total_amount_round * delivery_pct / 100, 2)

        # Send confirmation email with 4-digit OTP to buyer's email BEFORE committing!
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

        # Commit when email delivery succeeds
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


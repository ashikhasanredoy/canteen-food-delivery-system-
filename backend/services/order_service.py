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

def place_order(db: Session, order: schemas.OrderCreate):
    # Get the food item
    food = crud.get_food(db, food_id=order.food_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food item not found")

    if food.quantity < order.quantity:
        raise HTTPException(status_code=400, detail="Not enough quantity available")

    # Reduce quantity
    food.quantity -= order.quantity

    # Calculate total price
    total_price = round(food.price * order.quantity, 2)

    # Read fee percentages from settings (default 1%)
    admin_pct = _get_setting(db, "admin_fee_percent", 1.0)
    delivery_pct = _get_setting(db, "delivery_fee_percent", 1.0)

    admin_fee = round(total_price * admin_pct / 100, 2)
    delivery_fee = round(total_price * delivery_pct / 100, 2)

    # Create order with fees locked in
    db_order = crud.create_order(
        db, order,
        total_price=total_price,
        admin_fee=admin_fee,
        delivery_fee=delivery_fee
    )

    _log(db, "order", "placed",
         f"Order #{db_order.id} placed by {order.student_name} — {food.food_name} x{order.quantity}",
         detail=f"total=${total_price}, shop={food.shop_name}")

    return db_order


def place_cart_orders(db: Session, checkout: schemas.CartCheckoutCreate):
    if not checkout.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

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

    created_orders = []
    total_amount = 0.0

    try:
        for food, item in prepared:
            food.quantity -= item.quantity
            total_price = round(food.price * item.quantity, 2)
            admin_fee = round(total_price * admin_pct / 100, 2)
            delivery_fee = round(total_price * delivery_pct / 100, 2)
            total_amount += total_price

            db_order = models.Order(
                food_id=item.food_id,
                student_name=checkout.student_name,
                student_id=checkout.student_id,
                phone=checkout.phone,
                delivery_location=checkout.delivery_location,
                quantity=item.quantity,
                total_price=total_price,
                admin_fee=admin_fee,
                delivery_fee=delivery_fee,
            )
            db.add(db_order)
            created_orders.append((db_order, food))

        db.commit()

        response_orders = []
        for db_order, food in created_orders:
            db.refresh(db_order)
            _log(
                db,
                "order",
                "placed",
                f"Order #{db_order.id} placed by {checkout.student_name} — {food.food_name} x{db_order.quantity}",
                detail=f"total={db_order.total_price}, shop={food.shop_name}",
            )
            response_orders.append({
                **{c.name: getattr(db_order, c.name) for c in db_order.__table__.columns},
                "food_name": food.food_name,
                "shop_name": food.shop_name,
            })

        return {
            "orders": response_orders,
            "total_amount": round(total_amount, 2),
            "order_count": len(response_orders),
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to place cart order")


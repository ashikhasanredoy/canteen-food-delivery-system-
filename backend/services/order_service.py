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


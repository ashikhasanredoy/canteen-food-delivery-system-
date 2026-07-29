from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend import crud, schemas, models

def _log(db, category, action, summary, detail=None):
    try:
        db.add(models.ActivityLog(category=category, action=action, summary=summary, detail=detail))
        db.commit()
    except Exception:
        db.rollback()


def accept_delivery(db: Session, payload: schemas.DeliveryRequestPayload):
    """
    Instantly lock an order to a delivery boy.
    Uses row-level locking (with_for_update) to prevent two boys
    from accepting the same order simultaneously.
    """
    # Row-lock the order so concurrent requests are serialised
    order = (
        db.query(models.Order)
        .filter(models.Order.id == payload.order_id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "Delivered":
        raise HTTPException(status_code=400, detail="Order has already been delivered")

    # Already accepted by ANOTHER boy → 409 Conflict
    if order.delivery_boy_id and order.delivery_boy_id != payload.delivery_boy_id:
        raise HTTPException(
            status_code=409,
            detail="This order has already been accepted by another delivery boy."
        )

    # Already accepted by THIS boy → idempotent success
    if order.delivery_boy_id == payload.delivery_boy_id and order.delivery_request_status == "Accepted":
        return order

    # Not yet accepted → assign and lock
    order.delivery_boy_id = payload.delivery_boy_id
    order.delivery_request_status = "Accepted"
    db.commit()
    db.refresh(order)

    _log(db, "delivery", "accepted",
         f"Order #{order.id} accepted by delivery boy {payload.delivery_boy_id}")
    return order


def cancel_delivery(db: Session, payload: schemas.DeliveryRequestPayload):
    """
    Release an order back to the pool.
    Only the delivery boy who accepted the order can cancel it.
    """
    order = (
        db.query(models.Order)
        .filter(models.Order.id == payload.order_id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.delivery_request_status == "None" or not order.delivery_boy_id:
        raise HTTPException(status_code=400, detail="This order has not been accepted yet")

    if order.delivery_boy_id != payload.delivery_boy_id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to cancel this order — you did not accept it."
        )

    if order.status == "Delivered":
        raise HTTPException(status_code=400, detail="Cannot cancel a delivered order")

    # Reset order to available state
    order.delivery_boy_id = None
    order.delivery_request_status = "None"
    order.status = "Pending"
    db.commit()
    db.refresh(order)

    _log(db, "delivery", "cancelled",
         f"Order #{order.id} delivery cancelled by {payload.delivery_boy_id} — back to pool")
    return order


def verify_and_deliver(db: Session, delivery: schemas.DeliveryVerify):
    order = crud.get_order(db, order_id=delivery.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in ["Pending", "On Road"]:
        raise HTTPException(status_code=400, detail="Order is not in a deliverable state")

    if order.delivery_request_status != "Accepted":
        raise HTTPException(status_code=400, detail="Order has not been accepted for delivery")

    if order.delivery_boy_id != delivery.delivery_boy_id:
        raise HTTPException(status_code=403, detail="Not authorized to deliver this order")

    if order.student_id != delivery.student_id:
        raise HTTPException(status_code=400, detail="Invalid Student ID")

    order.status = "Delivered"
    db.commit()
    db.refresh(order)

    _log(db, "delivery", "delivered",
         f"Order #{order.id} delivered to student {order.student_id}",
         detail=f"delivery_boy={delivery.delivery_boy_id}, amount=৳{order.total_price}")
    return order


def pickup_order(db: Session, payload: schemas.DeliveryRequestPayload):
    order = crud.get_order(db, order_id=payload.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status not in ["Pending"]:
        raise HTTPException(status_code=400, detail="Order is already picked up or delivered")

    if order.delivery_request_status != "Accepted":
        raise HTTPException(status_code=400, detail="Order has not been accepted for delivery")

    if order.delivery_boy_id != payload.delivery_boy_id:
        raise HTTPException(status_code=403, detail="Not authorized to pick up this order")

    order.status = "On Road"
    db.commit()
    db.refresh(order)

    _log(db, "delivery", "pickup",
         f"Order #{order.id} picked up (On Road) by {payload.delivery_boy_id}")
    return order

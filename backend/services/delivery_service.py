from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend import crud, schemas, models
from backend.services import otp_service

def _log(db, category, action, summary, detail=None):
    try:
        db.add(models.ActivityLog(category=category, action=action, summary=summary, detail=detail))
        db.commit()
    except Exception:
        db.rollback()


def accept_delivery(db: Session, payload: schemas.DeliveryRequestPayload):
    """
    Lock a single order to a delivery boy.
    Uses row-level locking to prevent race conditions.
    """
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

    order.delivery_boy_id = payload.delivery_boy_id
    order.delivery_request_status = "Accepted"

    db.commit()
    db.refresh(order)

    _log(db, "delivery", "accepted",
         f"Order #{order.id} ({len(order.items)} items) accepted by delivery boy {payload.delivery_boy_id}")
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

    order.delivery_boy_id = None
    order.delivery_request_status = "None"
    order.status = "Pending"

    db.commit()
    db.refresh(order)

    _log(db, "delivery", "cancelled",
         f"Order #{order.id} cancelled by {payload.delivery_boy_id} — returned to pool")
    return order


def verify_and_deliver(db: Session, delivery: schemas.DeliveryVerify):
    order = crud.get_order(db, order_id=delivery.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "Delivered":
        return order

    if order.status not in ["Pending", "On Road"]:
        raise HTTPException(status_code=400, detail="Order is not in a deliverable state")

    # If assigned, only the assigned rider can complete delivery
    if delivery.delivery_boy_id and order.delivery_boy_id and str(order.delivery_boy_id) != str(delivery.delivery_boy_id):
        raise HTTPException(status_code=403, detail="Not authorized to deliver this order")

    order.status = "Delivered"
    total_amt = order.total_price or 0.0

    items_summary = [
        {
            "food_name": it.food_name or "Food Item",
            "shop_name": it.shop_name or "Canteen",
            "quantity": it.quantity or 1,
            "price": it.total_price or 0.0
        }
        for it in order.items
    ]

    db.commit()
    db.refresh(order)

    # Send 'Order Delivered' email to buyer
    buyer_email = order.email
    if buyer_email:
        otp_service.send_order_delivered_email(
            to_email=buyer_email,
            student_name=order.student_name,
            order_id_display=str(order.id),
            items=items_summary,
            total_amount=total_amt,
            delivery_location=order.delivery_location,
            delivery_boy_id=delivery.delivery_boy_id or order.delivery_boy_id
        )

    _log(db, "delivery", "delivered",
         f"Order #{order.id} delivered to {order.student_name}",
         detail=f"delivery_boy={delivery.delivery_boy_id or order.delivery_boy_id}, total=৳{round(total_amt, 2)}")
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


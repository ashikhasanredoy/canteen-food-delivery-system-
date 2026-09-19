from sqlalchemy.orm import Session
from fastapi import HTTPException
from backend import crud, schemas, models
from backend.services import otp_service

def _log(db: Session, category: str, action: str, summary: str, detail: str = None):
    """
    Helper function to record delivery audit logs in the background.
    If logging fails for any reason, we roll back silently so the main delivery flow is never interrupted.
    """
    try:
        db.add(models.ActivityLog(category=category, action=action, summary=summary, detail=detail))
        db.commit()
    except Exception:
        db.rollback()


def accept_delivery(db: Session, payload: schemas.DeliveryRequestPayload):
    """
    Assigns an order to a delivery partner when they claim it from the available pool.
    
    How it works:
    - We acquire a row lock using `.with_for_update()` to prevent two riders claiming the same order at the exact same split second.
    - If another rider already claimed it, we return a 409 Conflict error with a clear message.
    - If the same rider re-submits (e.g. fast double click), we return the existing assignment safely.
    - Otherwise, we stamp the order with the rider's ID and change request status to 'Accepted'.
    """
    # 1. Fetch the order with row-level locking for concurrency protection
    order = (
        db.query(models.Order)
        .filter(models.Order.id == payload.order_id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found in system.")

    # 2. Make sure the order hasn't already finished delivery
    if order.status == "Delivered":
        raise HTTPException(status_code=400, detail="This order has already been completed and delivered.")

    # 3. Guard against race conditions: check if someone else beat us to it
    if order.delivery_boy_id and order.delivery_boy_id != payload.delivery_boy_id:
        raise HTTPException(
            status_code=409,
            detail="This order has already been claimed by another delivery rider."
        )

    # 4. Handle double-click / idempotent requests gracefully
    if order.delivery_boy_id == payload.delivery_boy_id and order.delivery_request_status == "Accepted":
        return order

    # 5. Lock in this rider as the delivery handler
    order.delivery_boy_id = payload.delivery_boy_id
    order.delivery_request_status = "Accepted"

    db.commit()
    db.refresh(order)

    # 6. Audit log for admin visibility
    _log(
        db,
        "delivery",
        "accepted",
        f"Order #{order.id} ({len(order.items)} items) accepted by delivery boy {payload.delivery_boy_id}",
        detail=f"rider={payload.delivery_boy_id}"
    )
    return order


def cancel_delivery(db: Session, payload: schemas.DeliveryRequestPayload):
    """
    Allows a delivery partner to release a claimed order back to the open pool.
    
    Human business rules:
    - Only the rider currently assigned to the order can cancel their own delivery assignment.
    - Delivered orders can never be cancelled.
    - When cancelled, the order is reset back to 'Pending' so other riders on campus can pick it up immediately.
    """
    order = (
        db.query(models.Order)
        .filter(models.Order.id == payload.order_id)
        .with_for_update()
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    # Check if the order was even claimed
    if order.delivery_request_status == "None" or not order.delivery_boy_id:
        raise HTTPException(status_code=400, detail="This order has not been accepted by anyone yet.")

    # Security check: prevent unauthorized rider from cancelling someone else's trip
    if order.delivery_boy_id != payload.delivery_boy_id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to cancel this order because it is assigned to a different rider."
        )

    # Once handed over, it's done for good
    if order.status == "Delivered":
        raise HTTPException(status_code=400, detail="Cannot cancel an order that has already been delivered.")

    # Reset assignment so it reappears in the public rider queue
    order.delivery_boy_id = None
    order.delivery_request_status = "None"
    order.status = "Pending"

    db.commit()
    db.refresh(order)

    _log(
        db,
        "delivery",
        "cancelled",
        f"Order #{order.id} cancelled by rider {payload.delivery_boy_id} — released back to pool"
    )
    return order


def pickup_order(db: Session, payload: schemas.DeliveryRequestPayload):
    """
    Transitions an order state to 'On Road' after the rider physically collects the food from the canteen kitchen.
    
    Why this matters:
    - Gives live visual confirmation to the student buyer that their food is now travelling across campus.
    - Ensures only the assigned courier can flag the pickup.
    """
    order = crud.get_order(db, order_id=payload.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    # Ensure the order hasn't already skipped ahead
    if order.status not in ["Pending"]:
        raise HTTPException(status_code=400, detail="Order has already been picked up or delivered.")

    if order.delivery_request_status != "Accepted":
        raise HTTPException(status_code=400, detail="You must accept this order before marking it as picked up.")

    # Verify courier identity
    if order.delivery_boy_id != payload.delivery_boy_id:
        raise HTTPException(status_code=403, detail="Not authorized: this order is assigned to another delivery partner.")

    # Transition status to 'On Road'
    order.status = "On Road"
    db.commit()
    db.refresh(order)

    _log(
        db,
        "delivery",
        "pickup",
        f"Order #{order.id} picked up (On Road) by rider {payload.delivery_boy_id}"
    )
    return order


def verify_and_deliver(db: Session, delivery: schemas.DeliveryVerify):
    """
    Finalizes the delivery handshake once the courier arrives at the student's campus location.
    
    What this step does:
    1. Validates order status is active ('Pending' or 'On Road').
    2. Marks the order as 'Delivered'.
    3. Triggers an automated receipt confirmation email to the buyer with order item details.
    4. Records the completion in the system activity log for rider earnings calculations.
    """
    order = crud.get_order(db, order_id=delivery.order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")

    # Idempotent return if already marked delivered
    if order.status == "Delivered":
        return order

    if order.status not in ["Pending", "On Road"]:
        raise HTTPException(status_code=400, detail="Order is not in a deliverable state.")

    # Verify courier authorization
    if delivery.delivery_boy_id and order.delivery_boy_id and str(order.delivery_boy_id) != str(delivery.delivery_boy_id):
        raise HTTPException(status_code=403, detail="Not authorized to deliver this order.")

    # Transition order state to completed
    order.status = "Delivered"
    total_amt = order.total_price or 0.0

    # Build clean item summary list for receipt email
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

    # Send confirmation delivery receipt email to student
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

    _log(
        db,
        "delivery",
        "delivered",
        f"Order #{order.id} delivered to {order.student_name}",
        detail=f"delivery_boy={delivery.delivery_boy_id or order.delivery_boy_id}, total=৳{round(total_amt, 2)}"
    )
    return order

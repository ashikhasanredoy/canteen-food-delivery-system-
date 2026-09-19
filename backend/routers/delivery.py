from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend import schemas, models
from backend.database import get_db
from backend.services import delivery_service

router = APIRouter(prefix="/delivery", tags=["delivery"])

@router.get("/stats/{delivery_boy_id}")
def get_delivery_boy_stats(delivery_boy_id: str, db: Session = Depends(get_db)):
    completed_count = db.query(models.Order).filter(
        models.Order.delivery_boy_id == delivery_boy_id,
        models.Order.status == "Delivered"
    ).count()

    pending_count = db.query(models.Order).filter(
        models.Order.delivery_boy_id == delivery_boy_id,
        models.Order.status.in_(["Pending", "On Road"])
    ).count()

    total_income = db.query(func.sum(models.Order.delivery_fee)).filter(
        models.Order.delivery_boy_id == delivery_boy_id,
        models.Order.status == "Delivered"
    ).scalar() or 0.0

    return {
        "completed_count": completed_count,
        "pending_count": pending_count,
        "total_income": round(total_income, 2)
    }

@router.get("/profile/{delivery_boy_id}")
def get_delivery_boy_profile(delivery_boy_id: str, db: Session = Depends(get_db)):
    boy = db.query(models.DeliveryBoy).filter(models.DeliveryBoy.delivery_boy_id == delivery_boy_id.strip()).first()
    if not boy:
        raise HTTPException(status_code=404, detail="Delivery boy not found")
    return {
        "id": boy.id,
        "name": boy.name,
        "delivery_boy_id": boy.delivery_boy_id,
        "status": boy.status
    }

from datetime import datetime

@router.post("/register")
def register_delivery_boy(payload: schemas.DeliveryBoyAuth, db: Session = Depends(get_db)):
    name_clean = payload.name.strip()
    db_id_clean = payload.delivery_boy_id.strip()

    existing = db.query(models.DeliveryBoy).filter(models.DeliveryBoy.delivery_boy_id == db_id_clean).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Delivery Boy ID '{db_id_clean}' is already registered to '{existing.name}'."
        )

    now = datetime.utcnow()
    new_boy = models.DeliveryBoy(name=name_clean, delivery_boy_id=db_id_clean, status="Online", last_seen=now)
    db.add(new_boy)
    try:
        db.commit()
        db.refresh(new_boy)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error during registration.")

    try:
        db.add(models.ActivityLog(
            category="delivery",
            action="registered",
            summary=f"Delivery Boy '{name_clean}' registered",
            detail=f"delivery_boy_id={db_id_clean}",
        ))
        db.commit()
    except Exception:
        db.rollback()

    return {
        "message": "Registration successful",
        "name": new_boy.name,
        "delivery_boy_id": new_boy.delivery_boy_id,
        "status": new_boy.status
    }


@router.post("/login")
def login_delivery_boy(payload: schemas.DeliveryBoyAuth, db: Session = Depends(get_db)):
    name_clean = payload.name.strip()
    db_id_clean = payload.delivery_boy_id.strip()
    now = datetime.utcnow()

    boy = db.query(models.DeliveryBoy).filter(models.DeliveryBoy.delivery_boy_id == db_id_clean).first()
    if not boy:
        boy = models.DeliveryBoy(name=name_clean, delivery_boy_id=db_id_clean, status="Online", last_seen=now)
        db.add(boy)
        db.commit()
        db.refresh(boy)
    else:
        boy.status = "Online"
        boy.last_seen = now
        if name_clean:
            boy.name = name_clean
        db.commit()
        db.refresh(boy)

    return {
        "message": "Login successful",
        "name": boy.name or name_clean or "Rider",
        "delivery_boy_id": boy.delivery_boy_id,
        "status": boy.status
    }


@router.post("/heartbeat")
def heartbeat(payload: schemas.DeliveryBoyStatusUpdate, db: Session = Depends(get_db)):
    db_id_clean = payload.delivery_boy_id.strip()
    boy = db.query(models.DeliveryBoy).filter(models.DeliveryBoy.delivery_boy_id == db_id_clean).first()
    if boy:
        boy.status = payload.status or "Online"
        boy.last_seen = datetime.utcnow()
        db.commit()
        return {"status": boy.status}
    return {"status": "Offline"}


@router.post("/status")
def update_status(payload: schemas.DeliveryBoyStatusUpdate, db: Session = Depends(get_db)):
    db_id_clean = payload.delivery_boy_id.strip()
    boy = db.query(models.DeliveryBoy).filter(models.DeliveryBoy.delivery_boy_id == db_id_clean).first()
    if not boy:
        raise HTTPException(status_code=404, detail="Delivery boy not found")

    boy.status = payload.status
    boy.last_seen = datetime.utcnow() if payload.status == "Online" else None
    db.commit()
    db.refresh(boy)
    return {"message": "Status updated successfully", "status": boy.status}


@router.post("/accept")
def accept_delivery(payload: schemas.DeliveryRequestPayload, db: Session = Depends(get_db)):
    """Instantly lock an order to the delivery boy who clicks Accept first."""
    updated_order = delivery_service.accept_delivery(db, payload)
    return {
        "message": "Order accepted successfully! You are now assigned to this delivery.",
        "order_id": updated_order.id,
        "delivery_request_status": updated_order.delivery_request_status,
        "status": updated_order.status,
    }


@router.post("/cancel")
def cancel_delivery(payload: schemas.DeliveryRequestPayload, db: Session = Depends(get_db)):
    """Release an accepted order back to the pool. Only the accepting boy can cancel."""
    updated_order = delivery_service.cancel_delivery(db, payload)
    return {
        "message": "Delivery cancelled. Order is now available for other delivery boys.",
        "order_id": updated_order.id,
        "delivery_request_status": updated_order.delivery_request_status,
        "status": updated_order.status,
    }


@router.post("/pickup")
def pickup_delivery(payload: schemas.DeliveryRequestPayload, db: Session = Depends(get_db)):
    updated_order = delivery_service.pickup_order(db, payload)
    return {
        "message": "Order picked up! Drive safe 🛵",
        "status": updated_order.status
    }


@router.post("/complete")
@router.post("/verify")
def complete_delivery(delivery: schemas.DeliveryVerify, db: Session = Depends(get_db)):
    updated_order = delivery_service.verify_and_deliver(db, delivery)
    return {
        "message": "Order Delivered Successfully! Buyer has been notified via email. ✅",
        "status": updated_order.status
    }


# Legacy: Keep /request endpoint for backward compatibility (maps to accept)
@router.post("/request")
def request_delivery_legacy(payload: schemas.DeliveryRequestPayload, db: Session = Depends(get_db)):
    """Deprecated: Use /accept instead. Kept for backward compatibility."""
    updated_order = delivery_service.accept_delivery(db, payload)
    return {
        "message": "Delivery Accepted Successfully",
        "status": updated_order.delivery_request_status
    }

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend import schemas, models
from backend.database import get_db

router = APIRouter(prefix="/shops", tags=["shops"])

@router.post("/login")
def shop_login(payload: schemas.ShopLogin, db: Session = Depends(get_db)):
    shop_name_clean = payload.shop_name.strip()
    shop_id_clean = payload.shop_id.strip()

    # Find the shop by ID
    shop = db.query(models.Shop).filter(models.Shop.shop_id == shop_id_clean).first()
    if not shop:
        raise HTTPException(
            status_code=400,
            detail="Shop ID is not registered. Please register your shop first."
        )

    if shop.shop_name != shop_name_clean:
        raise HTTPException(
            status_code=400,
            detail="Invalid shop name for this Shop ID."
        )

    return {
        "message": "Login successful",
        "shop_name": shop.shop_name,
        "shop_id": shop.shop_id
    }

@router.post("/register")
def shop_register(payload: schemas.ShopLogin, db: Session = Depends(get_db)):
    shop_name_clean = payload.shop_name.strip()
    shop_id_clean = payload.shop_id.strip()

    # Check if Shop ID is already registered
    existing_by_id = db.query(models.Shop).filter(models.Shop.shop_id == shop_id_clean).first()
    if existing_by_id:
        raise HTTPException(
            status_code=400,
            detail=f"Shop ID '{shop_id_clean}' is already registered to '{existing_by_id.shop_name}'."
        )

    # Check if Shop Name is already registered
    existing_by_name = db.query(models.Shop).filter(models.Shop.shop_name == shop_name_clean).first()
    if existing_by_name:
        raise HTTPException(
            status_code=400,
            detail=f"Shop Name '{shop_name_clean}' is already registered to a different ID."
        )

    # Register new shop
    new_shop = models.Shop(shop_name=shop_name_clean, shop_id=shop_id_clean)
    db.add(new_shop)
    try:
        db.commit()
        db.refresh(new_shop)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error during registration.")

    # Log the activity
    try:
        db.add(models.ActivityLog(
            category="shop",
            action="registered",
            summary=f"Shop '{shop_name_clean}' registered",
            detail=f"shop_id={shop_id_clean}",
        ))
        db.commit()
    except Exception:
        db.rollback()

    return {
        "message": "Registration successful",
        "shop_name": new_shop.shop_name,
        "shop_id": new_shop.shop_id
    }

@router.get("/{shop_id}/notifications")
def get_shop_notifications(shop_id: str, db: Session = Depends(get_db)):
    """Sellers poll this to get their unread notifications."""
    notifs = db.query(models.Notification).filter(
        models.Notification.shop_id == shop_id,
        models.Notification.is_read == 0
    ).order_by(models.Notification.created_at.desc()).all()
    return [
        {
            "id": n.id,
            "message": n.message,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]

@router.post("/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    """Mark a notification as read."""
    notif = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = 1
    db.commit()
    return {"detail": "Marked as read"}


@router.get("/public")
def get_public_shops(db: Session = Depends(get_db)):
    """Public endpoint for home page to display active canteen shops."""
    shops = db.query(models.Shop).all()
    result = []
    for s in shops:
        item_count = db.query(models.Food).filter(models.Food.shop_name == s.shop_name).count()
        result.append({
            "id": s.id,
            "shop_name": s.shop_name,
            "shop_id": s.shop_id,
            "item_count": item_count,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    return result



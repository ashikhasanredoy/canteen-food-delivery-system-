from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend import schemas, models
from backend.database import get_db

router = APIRouter(prefix="/shops", tags=["shops"])

from sqlalchemy import func

@router.post("/login")
def shop_login(payload: schemas.ShopLogin, db: Session = Depends(get_db)):
    shop_name_clean = (payload.shop_name or "").strip()
    shop_id_clean = (payload.shop_id or "").strip()

    if not shop_name_clean and not shop_id_clean:
        raise HTTPException(status_code=400, detail="Please enter Shop Name or Shop ID.")

    shop = None

    # 1. Match by Shop ID
    if shop_id_clean:
        shop = db.query(models.Shop).filter(
            func.lower(models.Shop.shop_id) == shop_id_clean.lower()
        ).first()
        if not shop:
            # Maybe user entered shop name in ID field
            shop = db.query(models.Shop).filter(
                func.lower(models.Shop.shop_name) == shop_id_clean.lower()
            ).first()

    # 2. Match by Shop Name (exact or case-insensitive)
    if not shop and shop_name_clean:
        shop = db.query(models.Shop).filter(
            func.lower(models.Shop.shop_name) == shop_name_clean.lower()
        ).first()
        if not shop:
            # Maybe user entered shop id in Name field
            shop = db.query(models.Shop).filter(
                func.lower(models.Shop.shop_id) == shop_name_clean.lower()
            ).first()

    # 3. Substring matching for convenience (e.g. "Royal Biryani" for "Royal Biryani & Kebab House")
    if not shop and shop_name_clean:
        shop = db.query(models.Shop).filter(
            models.Shop.shop_name.ilike(f"%{shop_name_clean}%")
        ).first()

    # 4. Check Food inventory for matching shop
    if not shop and (shop_name_clean or shop_id_clean):
        query_term = shop_name_clean or shop_id_clean
        food_match = db.query(models.Food).filter(
            (func.lower(models.Food.shop_name) == query_term.lower()) |
            (models.Food.shop_name.ilike(f"%{query_term}%"))
        ).first()
        if food_match:
            shop = db.query(models.Shop).filter(
                models.Shop.shop_name == food_match.shop_name
            ).first()
            if not shop:
                new_id = shop_id_clean if (shop_id_clean and not shop_id_clean.isalpha()) else f"10{db.query(models.Shop).count() + 1:02d}"
                shop = models.Shop(shop_name=food_match.shop_name, shop_id=new_id)
                db.add(shop)
                try:
                    db.commit()
                    db.refresh(shop)
                except Exception:
                    db.rollback()
                    shop = db.query(models.Shop).filter(models.Shop.shop_name == food_match.shop_name).first()

    # 5. If found, return shop details
    if shop:
        return {
            "message": f"Welcome back, {shop.shop_name}!",
            "shop_name": shop.shop_name,
            "shop_id": shop.shop_id
        }

    # 6. Auto-register new shop if truly novel
    new_name = shop_name_clean or f"Shop {shop_id_clean}"
    new_id = shop_id_clean or f"10{db.query(models.Shop).count() + 1:02d}"

    new_shop = models.Shop(shop_name=new_name, shop_id=new_id)
    db.add(new_shop)
    try:
        db.commit()
        db.refresh(new_shop)
        _log_shop_activity(db, "registered", f"Shop '{new_name}' registered on login", f"shop_id={new_id}")
    except Exception:
        db.rollback()
        existing = db.query(models.Shop).filter(
            (models.Shop.shop_id == new_id) | (models.Shop.shop_name == new_name)
        ).first()
        if existing:
            return {
                "message": "Login successful",
                "shop_name": existing.shop_name,
                "shop_id": existing.shop_id
            }
        raise HTTPException(status_code=500, detail="Database error during shop authentication.")

    return {
        "message": f"Welcome, {new_shop.shop_name}!",
        "shop_name": new_shop.shop_name,
        "shop_id": new_shop.shop_id
    }


def _log_shop_activity(db, action, summary, detail=None):
    try:
        db.add(models.ActivityLog(
            category="shop",
            action=action,
            summary=summary,
            detail=detail,
        ))
        db.commit()
    except Exception:
        db.rollback()


@router.post("/register")
def shop_register(payload: schemas.ShopLogin, db: Session = Depends(get_db)):
    shop_name_clean = payload.shop_name.strip()
    shop_id_clean = payload.shop_id.strip()

    if not shop_name_clean or not shop_id_clean:
        raise HTTPException(status_code=400, detail="Shop Name and Shop ID are required.")

    # Check if already registered
    existing = db.query(models.Shop).filter(
        (func.lower(models.Shop.shop_id) == shop_id_clean.lower()) |
        (func.lower(models.Shop.shop_name) == shop_name_clean.lower())
    ).first()

    if existing:
        return {
            "message": f"Welcome back, {existing.shop_name}!",
            "shop_name": existing.shop_name,
            "shop_id": existing.shop_id
        }

    # Register new shop
    new_shop = models.Shop(shop_name=shop_name_clean, shop_id=shop_id_clean)
    db.add(new_shop)
    try:
        db.commit()
        db.refresh(new_shop)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error during registration.")

    _log_shop_activity(db, "registered", f"Shop '{shop_name_clean}' registered", f"shop_id={shop_id_clean}")

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
    ).order_by(models.Notification.created_at.desc()).limit(50).all()
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



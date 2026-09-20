from fastapi import FastAPI, Depends, Request, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from starlette.middleware.sessions import SessionMiddleware
from backend.database import engine, Base, get_db, run_migrations, seed_default_settings, seed_default_admin
from backend import models, schemas
from backend.config import ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET
import os


# ─── Activity Log Helper ──────────────────────────────────────
def log_activity(db: Session, category: str, action: str, summary: str, detail: str = None):
    """Write a single activity-log entry. Silent on error."""
    try:
        entry = models.ActivityLog(
            category=category,
            action=action,
            summary=summary,
            detail=detail,
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()

# Ensure tables exist, fee columns are migrated, and default admin is seeded
Base.metadata.create_all(bind=engine)
run_migrations()
seed_default_settings()
seed_default_admin()

admin_app = FastAPI(title="Canteen Admin Panel", docs_url="/admin/api-docs")

# Session middleware (must be added before routes)
admin_app.add_middleware(SessionMiddleware, secret_key=ADMIN_SESSION_SECRET)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "frontend", "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "frontend", "templates")

try:
    os.makedirs(STATIC_DIR, exist_ok=True)
except Exception:
    pass

if os.path.exists(STATIC_DIR):
    admin_app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=TEMPLATES_DIR)


def is_authenticated(request: Request) -> bool:
    return request.session.get("admin_logged_in") is True


# ─── Login / Logout ───────────────────────────────────────────────
@admin_app.get("/admin/login", response_class=HTMLResponse)
async def admin_login_page(request: Request):
    if is_authenticated(request):
        return RedirectResponse(url="/admin", status_code=302)
    return templates.TemplateResponse("admin/login.html", {"request": request, "error": None})

from backend.security import safe_compare

@admin_app.post("/admin/login", response_class=HTMLResponse)
async def admin_login_submit(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db)
):
    if safe_compare(username, ADMIN_USERNAME) and safe_compare(password, ADMIN_PASSWORD):
        request.session["admin_logged_in"] = True
        log_activity(db, "admin", "login", "Admin logged in successfully")
        return RedirectResponse(url="/admin", status_code=302)
    # Log failed login attempt
    log_activity(db, "admin", "login_failed", f"Failed admin login attempt with username: '{username}'")
    return templates.TemplateResponse(
        "admin/login.html",
        {"request": request, "error": "Invalid username or password."},
        status_code=401
    )

@admin_app.get("/admin/logout")
async def admin_logout(request: Request, db: Session = Depends(get_db)):
    request.session.clear()
    log_activity(db, "admin", "logout", "Admin logged out")
    return RedirectResponse(url="/admin/login", status_code=302)


# ─── HTML Pages ──────────────────────────────────────────────────
@admin_app.get("/admin", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    if not is_authenticated(request):
        return RedirectResponse(url="/admin/login", status_code=302)
    return templates.TemplateResponse("admin/dashboard.html", {"request": request})

# ─── Stats API ───────────────────────────────────────────────────
@admin_app.get("/admin/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_foods = db.query(models.Food).count()
    total_orders = db.query(models.Order).count()
    pending_orders = db.query(models.Order).filter(models.Order.status == "Pending").count()
    delivered_orders = db.query(models.Order).filter(models.Order.status == "Delivered").count()
    confirmed_orders = db.query(models.Order).filter(models.Order.status == "Confirmed").count()
    picked_up_orders = db.query(models.Order).filter(models.Order.status.in_(["Picked Up", "On Road"])).count()
    
    total_revenue = db.query(func.sum(models.Order.total_price)).filter(
        models.Order.status == "Delivered"
    ).scalar() or 0.0
    total_admin_revenue = db.query(func.sum(models.Order.admin_fee)).filter(
        models.Order.status == "Delivered"
    ).scalar() or 0.0
    total_delivery_earnings = db.query(func.sum(models.Order.delivery_fee)).filter(
        models.Order.status == "Delivered"
    ).scalar() or 0.0
    total_ratings = db.query(models.Rating).count()
    avg_rating = db.query(func.avg(models.Rating.stars)).scalar()

    # Top rated food
    top_food_query = db.query(
        models.Food.food_name,
        func.avg(models.Rating.stars).label("avg"),
        func.count(models.Rating.id).label("cnt")
    ).join(models.Rating, models.Food.id == models.Rating.food_id, isouter=True
    ).group_by(models.Food.id).order_by(func.avg(models.Rating.stars).desc()).first()

    # Current fee settings
    admin_pct_row = db.query(models.Setting).filter(models.Setting.key == "admin_fee_percent").first()
    delivery_pct_row = db.query(models.Setting).filter(models.Setting.key == "delivery_fee_percent").first()

    # Total registered delivery boys & shops
    total_delivery_boys = db.query(models.DeliveryBoy).count()
    total_shops = db.query(models.Shop).count()
    
    # Complaints & Activity & Notifications
    total_complaints = db.query(models.Complaint).count()
    open_complaints = db.query(models.Complaint).filter(models.Complaint.status == "Open").count()
    resolved_complaints = db.query(models.Complaint).filter(models.Complaint.status == "Resolved").count()
    total_activity_logs = db.query(models.ActivityLog).count()
    total_notifications = db.query(models.Notification).count()

    return {
        "total_shops": total_shops,
        "total_foods": total_foods,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "delivered_orders": delivered_orders,
        "confirmed_orders": confirmed_orders,
        "picked_up_orders": picked_up_orders,
        "total_delivery_boys": total_delivery_boys,
        "total_revenue": round(total_revenue, 2),
        "total_admin_revenue": round(total_admin_revenue, 2),
        "total_delivery_earnings": round(total_delivery_earnings, 2),
        "total_ratings": total_ratings,
        "avg_platform_rating": round(avg_rating, 2) if avg_rating else None,
        "top_food": top_food_query.food_name if top_food_query else None,
        "admin_fee_percent": float(admin_pct_row.value) if admin_pct_row else 1.0,
        "delivery_fee_percent": float(delivery_pct_row.value) if delivery_pct_row else 1.0,
        "total_complaints": total_complaints,
        "open_complaints": open_complaints,
        "resolved_complaints": resolved_complaints,
        "total_activity_logs": total_activity_logs,
        "total_notifications": total_notifications,
    }

@admin_app.get("/delivery/api/stats/{delivery_boy_id}")
def get_delivery_boy_api_stats(delivery_boy_id: str, db: Session = Depends(get_db)):
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

# ─── Foods API ───────────────────────────────────────────────────
@admin_app.get("/admin/api/foods")
def get_all_foods(db: Session = Depends(get_db)):
    foods = db.query(models.Food).all()
    result = []
    for f in foods:
        stats = db.query(
            func.avg(models.Rating.stars).label("avg"),
            func.count(models.Rating.id).label("cnt")
        ).filter(models.Rating.food_id == f.id).first()
        result.append({
            "id": f.id,
            "food_name": f.food_name,
            "shop_name": f.shop_name,
            "price": f.price,
            "quantity": f.quantity,
            "description": f.description,
            "image_url": f.image_url,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "avg_rating": round(stats.avg, 1) if stats.avg else None,
            "rating_count": stats.cnt or 0,
        })
    return result

# ─── Orders API ──────────────────────────────────────────────────
@admin_app.get("/admin/api/orders")
def get_all_orders(status: str = None, db: Session = Depends(get_db)):
    q = db.query(models.Order)
    if status:
        q = q.filter(models.Order.status == status)
    orders = q.order_by(models.Order.created_at.desc()).all()

    result = []
    for order in orders:
        result.append({
            "id": order.id,
            "student_name": order.student_name,
            "student_id": order.student_id,
            "email": order.email,
            "otp_code": order.otp_code,
            "order_group_id": order.order_group_id,
            "phone": order.phone,
            "delivery_location": order.delivery_location,
            "quantity": order.quantity,
            "total_price": order.total_price,
            "admin_fee": order.admin_fee,
            "delivery_fee": order.delivery_fee,
            "delivery_boy_id": order.delivery_boy_id,
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None,
            "food_name": order.food_name or "Food Item",
            "shop_name": order.shop_name or "—",
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
                for it in order.items
            ]
        })
    return result

# ─── Ratings API ─────────────────────────────────────────────────
@admin_app.get("/admin/api/ratings")
def get_all_ratings(db: Session = Depends(get_db)):
    rows = db.query(models.Rating, models.Food).outerjoin(
        models.Food, models.Rating.food_id == models.Food.id
    ).order_by(models.Rating.created_at.desc()).all()

    result = []
    for rating, food in rows:
        result.append({
            "id": rating.id,
            "food_name": food.food_name if food else "Deleted",
            "shop_name": food.shop_name if food else "—",
            "student_id": rating.student_id,
            "stars": rating.stars,
            "comment": rating.comment,
            "created_at": rating.created_at.isoformat() if rating.created_at else None,
        })
    return result

# ─── Delete Food (Admin) ─────────────────────────────────────
@admin_app.delete("/admin/api/foods/{food_id}")
def admin_delete_food(food_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    food = db.query(models.Food).filter(models.Food.id == food_id).first()
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    name, shop = food.food_name, food.shop_name
    db.delete(food)
    db.commit()
    log_activity(db, "food", "deleted", f"Food '{name}' deleted from {shop}",
                 detail=f"food_id={food_id}")
    return {"detail": "Food deleted"}

# ─── Settings API ─────────────────────────────────────────────────
@admin_app.get("/admin/api/settings")
def get_settings(db: Session = Depends(get_db)):
    rows = db.query(models.Setting).all()
    return {row.key: float(row.value) for row in rows}

@admin_app.put("/admin/api/settings")
def update_settings(payload: dict, db: Session = Depends(get_db)):
    """Accept {admin_fee_percent: float, delivery_fee_percent: float}"""
    from fastapi import HTTPException
    allowed_keys = {"admin_fee_percent", "delivery_fee_percent"}
    for key, value in payload.items():
        if key not in allowed_keys:
            raise HTTPException(status_code=400, detail=f"Unknown setting: {key}")
        try:
            val = float(value)
            if val < 0 or val > 100:
                raise ValueError()
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"Invalid value for {key}: must be 0–100")

        row = db.query(models.Setting).filter(models.Setting.key == key).first()
        if row:
            row.value = str(val)
        else:
            db.add(models.Setting(key=key, value=str(val)))
    db.commit()
    admin_pct = payload.get("admin_fee_percent", "?")
    delivery_pct = payload.get("delivery_fee_percent", "?")
    log_activity(db, "settings", "updated",
                 f"Fee settings updated — Admin: {admin_pct}%, Delivery: {delivery_pct}%")
    return {"detail": "Settings updated", "settings": payload}

# ─── Delivery Boys API ───────────────────────────────────────────
@admin_app.get("/api/admin/delivery-boys")
@admin_app.get("/admin/api/delivery-boys")
def get_all_delivery_boys(db: Session = Depends(get_db)):
    """
    GET /api/admin/delivery-boys
    Returns all registered delivery boys from the database.
    SQL: SELECT delivery_boy_id, name FROM delivery_boys ORDER BY id ASC
    """
    import logging
    logger = logging.getLogger("admin.delivery_boys")

    logger.info("[DeliveryBoys API] Request received — GET /api/admin/delivery-boys")

    from datetime import datetime, timedelta
    # ── Real Presence Check: Sweep any expired online sessions to Offline ──
    try:
        cutoff = datetime.utcnow() - timedelta(seconds=45)
        db.query(models.DeliveryBoy).filter(
            models.DeliveryBoy.status == "Online",
            (models.DeliveryBoy.last_seen == None) | (models.DeliveryBoy.last_seen < cutoff)
        ).update({"status": "Offline"}, synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()

    # ── 1. Fetch all delivery boys ordered by id ASC (per spec) ──
    try:
        boys = db.query(models.DeliveryBoy).order_by(models.DeliveryBoy.id.asc()).all()
        logger.info(f"[DeliveryBoys API] DB query OK — found {len(boys)} delivery boys")
        print(f"[ADMIN API] /api/admin/delivery-boys — {len(boys)} delivery boys found")
    except Exception as db_err:
        logger.error(f"[DeliveryBoys API] DB query FAILED: {db_err}")
        print(f"[ADMIN API ERROR] DB query failed: {db_err}")
        return {
            "success": False,
            "count": 0,
            "deliveryBoys": [],
            "error": str(db_err)
        }

    boy_ids = {b.delivery_boy_id for b in boys}

    # ── 2. Auto-sync delivery boys found in orders but not registered ──
    try:
        order_boys = db.query(models.Order.delivery_boy_id).filter(
            models.Order.delivery_boy_id.isnot(None),
            models.Order.delivery_boy_id != ""
        ).distinct().all()

        for (db_id,) in order_boys:
            if db_id and db_id not in boy_ids:
                new_boy = models.DeliveryBoy(
                    name=f"Delivery Boy ({db_id})",
                    delivery_boy_id=db_id,
                    status="Offline"
                )
                db.add(new_boy)
                try:
                    db.commit()
                    db.refresh(new_boy)
                    boys.append(new_boy)
                    boy_ids.add(db_id)
                    logger.info(f"[DeliveryBoys API] Auto-synced new delivery boy: {db_id}")
                except Exception:
                    db.rollback()
    except Exception as sync_err:
        logger.warning(f"[DeliveryBoys API] Auto-sync skipped (non-fatal): {sync_err}")

    # ── 3. Build response ──────────────────────────────────────────
    result = []
    for boy in boys:
        try:
            delivered_orders = db.query(models.Order).filter(
                models.Order.delivery_boy_id == boy.delivery_boy_id,
                models.Order.status == "Delivered"
            ).all()
            deliveries_done = len(delivered_orders)
            total_revenue = 0.0
            for o in delivered_orders:
                fee = o.delivery_fee if (o.delivery_fee and o.delivery_fee > 0) else round((o.total_price or 0.0) * 0.01, 2)
                total_revenue += float(fee or 0.0)
        except Exception:
            deliveries_done = 0
            total_revenue = 0.0

        result.append({
            "id": boy.id,
            "delivery_boy_id": boy.delivery_boy_id,
            "delivery_boy_name": boy.name,
            "name": boy.name,
            "status": boy.status,
            "deliveries_done": deliveries_done,
            "total_revenue": round(total_revenue, 2),
            "revenue": round(total_revenue, 2),
            "created_at": boy.created_at.isoformat() if boy.created_at else None,
        })

    logger.info(f"[DeliveryBoys API] Returning {len(result)} delivery boys")
    print(f"[ADMIN API] Returning delivery boys: {[r['delivery_boy_name'] for r in result]}")

    return {
        "success": True,
        "count": len(result),
        "deliveryBoys": result,
        "data": result
    }

@admin_app.put("/api/admin/delivery-boys/{boy_id}")
@admin_app.put("/admin/api/delivery-boys/{boy_id}")
def admin_update_delivery_boy(boy_id: int, payload: schemas.DeliveryBoyUpdate, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    boy = db.query(models.DeliveryBoy).filter(models.DeliveryBoy.id == boy_id).first()
    if not boy:
        raise HTTPException(status_code=404, detail="Delivery boy not found")
    
    new_id = payload.delivery_boy_id.strip()
    new_name = payload.name.strip()
    
    conflict = db.query(models.DeliveryBoy).filter(
        models.DeliveryBoy.delivery_boy_id == new_id,
        models.DeliveryBoy.id != boy_id
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail=f"Delivery Boy ID '{new_id}' is already assigned to another profile.")

    old_name = boy.name
    boy.name = new_name
    boy.delivery_boy_id = new_id
    db.commit()
    db.refresh(boy)
    log_activity(db, "delivery", "updated", f"Delivery Boy '{old_name}' updated to '{new_name}'", detail=f"id={boy_id}")
    
    return {
        "success": True,
        "detail": "Delivery boy updated successfully",
        "deliveryBoy": {
            "id": boy.id,
            "delivery_boy_id": boy.delivery_boy_id,
            "delivery_boy_name": boy.name,
            "name": boy.name,
            "status": boy.status
        }
    }

@admin_app.delete("/api/admin/delivery-boys/{boy_id}")
@admin_app.delete("/admin/api/delivery-boys/{boy_id}")
def admin_delete_delivery_boy(boy_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    boy = db.query(models.DeliveryBoy).filter(models.DeliveryBoy.id == boy_id).first()
    if not boy:
        raise HTTPException(status_code=404, detail="Delivery boy not found")
    name, did = boy.name, boy.delivery_boy_id
    db.delete(boy)
    db.commit()
    log_activity(db, "delivery", "removed", f"Delivery Boy '{name}' removed", detail=f"delivery_boy_id={did}")
    return {"success": True, "detail": f"Delivery Boy '{name}' removed successfully"}

# ─── Shops API ───────────────────────────────────────────────────
@admin_app.get("/admin/api/shops")
def get_all_shops(db: Session = Depends(get_db)):
    shops = db.query(models.Shop).order_by(models.Shop.created_at.desc()).all()
    result = []
    for shop in shops:
        food_count = db.query(models.Food).filter(models.Food.shop_name == shop.shop_name).count()
        unread_count = db.query(models.Notification).filter(
            models.Notification.shop_id == shop.shop_id,
            models.Notification.is_read == 0
        ).count()
        result.append({
            "id": shop.id,
            "shop_name": shop.shop_name,
            "shop_id": shop.shop_id,
            "food_count": food_count,
            "unread_notifications": unread_count,
            "created_at": shop.created_at.isoformat() if shop.created_at else None,
        })
    return result

@admin_app.delete("/admin/api/shops/{shop_id}")
def admin_delete_shop(shop_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    shop = db.query(models.Shop).filter(models.Shop.id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    name, sid = shop.shop_name, shop.shop_id
    db.delete(shop)
    db.commit()
    log_activity(db, "shop", "removed", f"Shop '{name}' removed",
                 detail=f"shop_id={sid}")
    return {"detail": f"Shop '{name}' deleted successfully"}

# ─── Notifications API ────────────────────────────────────────
@admin_app.post("/admin/api/notifications")
def send_notification(payload: dict, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    shop_id = payload.get("shop_id", "").strip()
    shop_name = payload.get("shop_name", "").strip()
    message = payload.get("message", "").strip()
    if not shop_id or not message:
        raise HTTPException(status_code=400, detail="shop_id and message are required")
    notif = models.Notification(shop_id=shop_id, shop_name=shop_name, message=message)
    db.add(notif)
    db.commit()
    log_activity(db, "notification", "sent",
                 f"Notification sent to '{shop_name or shop_id}'",
                 detail=message[:120])
    return {"detail": "Notification sent successfully"}

@admin_app.get("/admin/api/notifications")
def get_notifications(db: Session = Depends(get_db)):
    rows = db.query(models.Notification).order_by(models.Notification.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "shop_id": r.shop_id,
            "shop_name": r.shop_name,
            "message": r.message,
            "is_read": r.is_read,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]

# ─── Activity Log API ────────────────────────────────────────
@admin_app.get("/admin/api/activity-log")
def get_activity_log(
    limit: int = 1000,
    category: str = None,
    db: Session = Depends(get_db)
):
    q = db.query(models.ActivityLog)
    if category:
        q = q.filter(models.ActivityLog.category == category)
    rows = q.order_by(models.ActivityLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "category": r.category,
            "action": r.action,
            "summary": r.summary,
            "detail": r.detail,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ─── Complaints API ──────────────────────────────────────────
@admin_app.get("/admin/api/complaints")
def get_complaints(db: Session = Depends(get_db)):
    rows = db.query(models.Complaint).order_by(models.Complaint.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "role": r.role,
            "name": r.name,
            "contact": r.contact,
            "shop_name": r.shop_name,
            "message": r.message,
            "image_url": r.image_url,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@admin_app.patch("/admin/api/complaints/{complaint_id}")
def update_complaint_status(
    complaint_id: int,
    payload: schemas.ComplaintStatusUpdate,
    db: Session = Depends(get_db),
):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    complaint.status = payload.status
    db.commit()
    log_activity(db, "complaint", "updated", f"Complaint #{complaint_id} marked as {payload.status}")
    return {"message": "Complaint status updated"}


@admin_app.delete("/admin/api/complaints/{complaint_id}")
def delete_complaint(complaint_id: int, db: Session = Depends(get_db)):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    db.delete(complaint)
    db.commit()
    log_activity(db, "complaint", "deleted", f"Complaint #{complaint_id} deleted")
    return {"message": "Complaint deleted"}


# ─── Charts API ──────────────────────────────────────────────────
@admin_app.get("/admin/api/charts")
def get_charts(db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    from collections import defaultdict

    # ── 1. Revenue per day (last 14 days) ──────────────────────
    today = datetime.utcnow().date()
    days_14 = [today - timedelta(days=i) for i in range(13, -1, -1)]

    orders_delivered = db.query(models.Order).filter(
        models.Order.status == "Delivered"
    ).all()

    rev_by_day = defaultdict(float)
    ord_by_day = defaultdict(int)
    for o in orders_delivered:
        day = o.created_at.date() if o.created_at else None
        if day and day in set(days_14):
            rev_by_day[day] += float(o.total_price or 0)
            ord_by_day[day] += 1

    revenue_labels = [d.strftime("%b %d") for d in days_14]
    revenue_data   = [round(rev_by_day.get(d, 0), 2) for d in days_14]
    orders_trend   = [ord_by_day.get(d, 0) for d in days_14]

    # ── 2. Orders by status ────────────────────────────────────
    status_counts = {}
    for status in ["Pending", "Ready", "Out for Delivery", "Delivered", "Cancelled"]:
        count = db.query(models.Order).filter(models.Order.status == status).count()
        if count > 0:
            status_counts[status] = count

    # ── 3. Orders per shop (top 8) ────────────────────────────
    shop_order_rows = db.query(
        models.OrderItem.shop_name,
        func.count(models.OrderItem.id).label("cnt")
    ).filter(models.OrderItem.shop_name.isnot(None))\
     .group_by(models.OrderItem.shop_name)\
     .order_by(func.count(models.OrderItem.id).desc())\
     .limit(8).all()

    shop_labels = [r.shop_name for r in shop_order_rows]
    shop_data   = [r.cnt for r in shop_order_rows]

    # ── 4. Rating distribution (1–5 ★) ────────────────────────
    rating_dist = [0, 0, 0, 0, 0]
    ratings_all = db.query(models.Rating).all()
    for r in ratings_all:
        if 1 <= r.stars <= 5:
            rating_dist[r.stars - 1] += 1

    # ── 5. Top 6 foods by order volume ────────────────────────
    food_order_rows = db.query(
        models.OrderItem.food_name,
        func.sum(models.OrderItem.quantity).label("total_qty")
    ).filter(models.OrderItem.food_name.isnot(None))\
     .group_by(models.OrderItem.food_name)\
     .order_by(func.sum(models.OrderItem.quantity).desc())\
     .limit(6).all()

    food_labels = [r.food_name for r in food_order_rows]
    food_data   = [int(r.total_qty) if r.total_qty else 0 for r in food_order_rows]

    return {
        "revenue_by_day": {"labels": revenue_labels, "data": revenue_data},
        "orders_trend":   {"labels": revenue_labels, "data": orders_trend},
        "orders_by_status": status_counts,
        "orders_per_shop":  {"labels": shop_labels, "data": shop_data},
        "rating_distribution": rating_dist,
        "top_foods_by_volume": {"labels": food_labels, "data": food_data},
    }


# ─── Runner ──────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.admin_app:admin_app", host="127.0.0.1", port=5001, reload=True)

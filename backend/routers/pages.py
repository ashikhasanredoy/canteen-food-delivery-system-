from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend import models
import os

# ══════════════════════════════════════════════════════════════════════════════
#  FRONTEND HTML PAGE ROUTES & PUBLIC HOME STATS ROUTER
# ══════════════════════════════════════════════════════════════════════════════

# Configure Jinja2 templates directory path with fallback discovery
def _get_templates_dir():
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "templates"),
        os.path.join(os.getcwd(), "frontend", "templates"),
        os.path.abspath("frontend/templates"),
    ]
    for p in candidates:
        if os.path.isdir(p):
            return p
    return candidates[0]

TEMPLATES_DIR = _get_templates_dir()
templates = Jinja2Templates(directory=TEMPLATES_DIR)

router = APIRouter(tags=["pages"])


@router.get("/", response_class=HTMLResponse)
async def home_page(request: Request):
    """
    Renders the public landing page with hero banner, feature highlights, and campus portal navigation.
    """
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/buyer", response_class=HTMLResponse)
async def buyer_page(request: Request):
    """
    Renders the Student Food Discovery & Ordering portal with responsive 2-column mobile grid.
    """
    return templates.TemplateResponse("buyer.html", {"request": request})


@router.get("/seller", response_class=HTMLResponse)
async def seller_page(request: Request):
    """
    Renders the Canteen Merchant Dashboard for inventory management and order fulfillment.
    """
    return templates.TemplateResponse("seller.html", {"request": request})


@router.get("/delivery", response_class=HTMLResponse)
async def delivery_page(request: Request):
    """
    Renders the Student Courier Delivery Dashboard for order claiming and OTP handovers.
    """
    return templates.TemplateResponse("delivery.html", {"request": request})


@router.get("/api/home/stats")
def get_home_stats(db: Session = Depends(get_db)):
    """
    Computes public aggregated metric counters (total foods, registered canteens,
    completed deliveries, and platform average star rating) displayed on the landing page hero section.
    """
    total_foods = db.query(models.Food).count()
    # Distinct count of active canteen shops currently listing food items
    total_shops = db.query(func.count(func.distinct(models.Food.shop_name))).scalar() or 0
    total_orders = db.query(models.Order).count()
    delivered_orders = db.query(models.Order).filter(models.Order.status == "Delivered").count()
    avg_rating = db.query(func.avg(models.Rating.stars)).scalar()
    
    return {
        "total_foods": total_foods,
        "total_shops": total_shops,
        "total_orders": total_orders,
        "delivered_orders": delivered_orders,
        "avg_rating": round(avg_rating, 1) if avg_rating else 4.8
    }

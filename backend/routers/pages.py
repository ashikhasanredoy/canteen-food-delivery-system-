from fastapi import APIRouter, Request, Depends
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.database import get_db
from backend import models
import os

# Set up templates directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEMPLATES_DIR = os.path.join(BASE_DIR, "frontend", "templates")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

router = APIRouter(tags=["pages"])

@router.get("/", response_class=HTMLResponse)
async def home_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@router.get("/buyer", response_class=HTMLResponse)
async def buyer_page(request: Request):
    return templates.TemplateResponse("buyer.html", {"request": request})

@router.get("/seller", response_class=HTMLResponse)
async def seller_page(request: Request):
    return templates.TemplateResponse("seller.html", {"request": request})

@router.get("/delivery", response_class=HTMLResponse)
async def delivery_page(request: Request):
    return templates.TemplateResponse("delivery.html", {"request": request})

@router.get("/api/home/stats")
def get_home_stats(db: Session = Depends(get_db)):
    total_foods = db.query(models.Food).count()
    # Distinct active shops
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


from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
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

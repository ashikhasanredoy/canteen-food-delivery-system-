from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend import crud, schemas, models
from backend.database import get_db
from backend.services import order_service

router = APIRouter(prefix="/orders", tags=["orders"])

@router.post("", response_model=schemas.OrderResponse)
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    return order_service.place_order(db, order)

@router.get("", response_model=List[schemas.OrderResponse])
def read_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Join with Food to get names
    orders = db.query(models.Order, models.Food).outerjoin(models.Food, models.Order.food_id == models.Food.id).offset(skip).limit(limit).all()
    result = []
    for order, food in orders:
        order_dict = {c.name: getattr(order, c.name) for c in order.__table__.columns}
        if food:
            order_dict["food_name"] = food.food_name
            order_dict["shop_name"] = food.shop_name
        result.append(order_dict)
    return result

@router.get("/pending", response_model=List[schemas.OrderResponse])
def read_pending_orders(db: Session = Depends(get_db)):
    orders = db.query(models.Order, models.Food).outerjoin(models.Food, models.Order.food_id == models.Food.id).filter(models.Order.status.in_(["Pending", "On Road"])).all()
    result = []
    for order, food in orders:
        order_dict = {c.name: getattr(order, c.name) for c in order.__table__.columns}
        if food:
            order_dict["food_name"] = food.food_name
            order_dict["shop_name"] = food.shop_name
        result.append(order_dict)
    return result

@router.get("/{order_id}", response_model=schemas.OrderResponse)
def read_order(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_order(db, order_id=order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get food name
    food = crud.get_food(db, food_id=order.food_id)
    order_dict = {c.name: getattr(order, c.name) for c in order.__table__.columns}
    if food:
        order_dict["food_name"] = food.food_name
        order_dict["shop_name"] = food.shop_name
    return order_dict

@router.get("/shop/{shop_name}/delivery-requests", response_model=List[schemas.OrderResponse])
def get_shop_delivery_requests(shop_name: str, db: Session = Depends(get_db)):
    orders = db.query(models.Order, models.Food)\
        .join(models.Food, models.Order.food_id == models.Food.id)\
        .filter(models.Food.shop_name == shop_name)\
        .filter(models.Order.status == "Pending")\
        .filter(models.Order.delivery_request_status == "Requested")\
        .all()
    
    result = []
    for order, food in orders:
        order_dict = {c.name: getattr(order, c.name) for c in order.__table__.columns}
        order_dict["food_name"] = food.food_name
        order_dict["shop_name"] = food.shop_name
        result.append(order_dict)
    return result

@router.post("/{order_id}/approve_delivery")
def approve_delivery_request(order_id: int, db: Session = Depends(get_db)):
    order = crud.get_order(db, order_id=order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.delivery_request_status != "Requested":
        raise HTTPException(status_code=400, detail="No pending delivery request for this order")
        
    order.delivery_request_status = "Approved"
    db.commit()
    return {"message": "Delivery request approved"}

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

@router.post("/cart", response_model=schemas.CartCheckoutResponse)
def checkout_cart(checkout: schemas.CartCheckoutCreate, db: Session = Depends(get_db)):
    return order_service.place_cart_orders(db, checkout)

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


@router.get("/shop/{shop_name}/history")
def get_shop_order_history(shop_name: str, db: Session = Depends(get_db)):
    """Retrieve full present and previous order history and financial revenue summary for a shop."""
    shop_name_clean = shop_name.strip()
    
    orders_query = (
        db.query(models.Order, models.Food)
        .join(models.Food, models.Order.food_id == models.Food.id)
        .filter(models.Food.shop_name == shop_name_clean)
        .order_by(models.Order.created_at.desc())
        .all()
    )

    orders_list = []
    gross_revenue = 0.0
    total_admin_cut = 0.0
    total_delivery_cut = 0.0
    completed_count = 0
    total_items_sold = 0

    for order, food in orders_query:
        tot = order.total_price or 0.0
        adm = order.admin_fee if (order.admin_fee is not None and order.admin_fee > 0) else round(tot * 0.01, 2)
        dev = order.delivery_fee if (order.delivery_fee is not None and order.delivery_fee > 0) else round(tot * 0.01, 2)
        net = round(tot - adm - dev, 2)

        if order.status == "Delivered":
            completed_count += 1
            total_items_sold += order.quantity or 0
            gross_revenue += tot
            total_admin_cut += adm
            total_delivery_cut += dev

        orders_list.append({
            "id": order.id,
            "student_name": order.student_name,
            "student_id": order.student_id,
            "phone": order.phone,
            "delivery_location": order.delivery_location,
            "food_name": food.food_name,
            "quantity": order.quantity,
            "total_price": round(tot, 2),
            "admin_fee": round(adm, 2),
            "delivery_fee": round(dev, 2),
            "net_seller_revenue": round(net, 2),
            "delivery_boy_id": order.delivery_boy_id or "Unassigned",
            "delivery_request_status": order.delivery_request_status,
            "status": order.status,
            "created_at": order.created_at.isoformat() if order.created_at else None
        })

    net_revenue = round(gross_revenue - total_admin_cut - total_delivery_cut, 2)

    return {
        "summary": {
            "total_orders": len(orders_list),
            "completed_orders": completed_count,
            "total_items_sold": total_items_sold,
            "gross_revenue": round(gross_revenue, 2),
            "admin_fee_cut": round(total_admin_cut, 2),
            "delivery_fee_cut": round(total_delivery_cut, 2),
            "net_seller_revenue": net_revenue
        },
        "orders": orders_list
    }


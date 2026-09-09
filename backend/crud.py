from sqlalchemy.orm import Session
from sqlalchemy import func
from backend import models, schemas

# Food CRUD
def get_food(db: Session, food_id: int):
    return db.query(models.Food).filter(models.Food.id == food_id).first()

def get_foods(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Food).offset(skip).limit(limit).all()

def create_food(db: Session, food: schemas.FoodCreate):
    db_food = models.Food(**food.model_dump())
    db.add(db_food)
    db.commit()
    db.refresh(db_food)
    return db_food

def update_food(db: Session, food_id: int, food_update: schemas.FoodUpdate):
    db_food = get_food(db, food_id)
    if db_food:
        for key, value in food_update.model_dump().items():
            setattr(db_food, key, value)
        db.commit()
        db.refresh(db_food)
    return db_food

def delete_food(db: Session, food_id: int):
    db_food = get_food(db, food_id)
    if db_food:
        db.delete(db_food)
        db.commit()
    return db_food

# Order CRUD
def get_order(db: Session, order_id: int):
    return db.query(models.Order).filter(models.Order.id == order_id).first()

def create_order(db: Session, order: schemas.OrderCreate, total_price: float,
                 admin_fee: float = 0.0, delivery_fee: float = 0.0):
    db_order = models.Order(
        **order.model_dump(),
        total_price=total_price,
        admin_fee=admin_fee,
        delivery_fee=delivery_fee
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

# Rating CRUD
def get_ratings_for_food(db: Session, food_id: int):
    return db.query(models.Rating).filter(models.Rating.food_id == food_id).all()

def get_rating_stats(db: Session, food_id: int):
    result = db.query(
        func.avg(models.Rating.stars).label("avg_rating"),
        func.count(models.Rating.id).label("rating_count")
    ).filter(models.Rating.food_id == food_id).first()
    return {
        "avg_rating": round(result.avg_rating, 1) if result.avg_rating else None,
        "rating_count": result.rating_count or 0
    }

def get_student_rating_for_food(db: Session, food_id: int, student_id: str):
    return db.query(models.Rating).filter(
        models.Rating.food_id == food_id,
        models.Rating.student_id == student_id
    ).first()

def create_rating(db: Session, rating: schemas.RatingCreate):
    db_rating = models.Rating(**rating.model_dump())
    db.add(db_rating)
    db.commit()
    db.refresh(db_rating)
    return db_rating


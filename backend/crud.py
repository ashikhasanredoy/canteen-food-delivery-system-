from sqlalchemy.orm import Session
from sqlalchemy import func
from backend import models, schemas

# ══════════════════════════════════════════════════════════════════════════════
#  FOOD CATALOG & INVENTORY CRUD OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

def get_food(db: Session, food_id: int):
    """
    Fetches a single food dish by its primary key ID.
    Returns the Food ORM object if found, or None if it doesn't exist.
    """
    return db.query(models.Food).filter(models.Food.id == food_id).first()


def get_foods(db: Session, skip: int = 0, limit: int = 1000):
    """
    Retrieves a paginated list of all active dishes across all campus canteen shops.
    Default limit is 1000 items to support rich browsing grids without excessive queries.
    """
    return db.query(models.Food).offset(skip).limit(limit).all()


def create_food(db: Session, food: schemas.FoodCreate):
    """
    Inserts a newly registered food item created by a canteen seller.
    Automatically handles attribute unpacking, commits to SQLite, and refreshes the instance ID.
    """
    db_food = models.Food(**food.model_dump())
    db.add(db_food)
    db.commit()
    db.refresh(db_food)
    return db_food


def update_food(db: Session, food_id: int, food_update: schemas.FoodUpdate):
    """
    Updates existing food details (like price, description, image URL, stock count).
    Iterates through the modified fields dynamically, commits changes, and returns the updated model.
    """
    db_food = get_food(db, food_id)
    if db_food:
        for key, value in food_update.model_dump().items():
            setattr(db_food, key, value)
        db.commit()
        db.refresh(db_food)
    return db_food


def delete_food(db: Session, food_id: int):
    """
    Permanently removes a dish from the food menu.
    Returns the deleted instance if found and removed, or None if the ID was invalid.
    """
    db_food = get_food(db, food_id)
    if db_food:
        db.delete(db_food)
        db.commit()
    return db_food


# ══════════════════════════════════════════════════════════════════════════════
#  ORDER MANAGEMENT CRUD OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

def get_order(db: Session, order_id: int):
    """
    Looks up a complete order record by ID, including its associated child OrderItem records.
    """
    return db.query(models.Order).filter(models.Order.id == order_id).first()


def get_orders(db: Session, skip: int = 0, limit: int = 100):
    """
    Returns recent campus orders with offset pagination.
    """
    return db.query(models.Order).offset(skip).limit(limit).all()


def get_pending_orders(db: Session):
    """
    Retrieves all orders currently in 'Pending' status awaiting kitchen prep or courier pickup.
    """
    return db.query(models.Order).filter(models.Order.status == "Pending").all()


def create_order(db: Session, order: schemas.OrderCreate, total_price: float,
                 admin_fee: float = 0.0, delivery_fee: float = 0.0, otp_code: str = None):
    """
    Creates a standalone single-item order with its linked OrderItem record.
    Flushes the parent ID before adding the child item so foreign keys resolve cleanly.
    """
    food = get_food(db, order.food_id)
    db_order = models.Order(
        student_name=order.student_name,
        student_id=order.student_id,
        email=order.email,
        phone=order.phone,
        delivery_location=order.delivery_location,
        total_price=total_price,
        admin_fee=admin_fee,
        delivery_fee=delivery_fee,
        otp_code=otp_code,
        status="Pending",
        delivery_request_status="None"
    )
    db.add(db_order)
    db.flush()  # Generate db_order.id for the foreign key below

    if food:
        order_item = models.OrderItem(
            order_id=db_order.id,
            food_id=food.id,
            food_name=food.food_name,
            shop_name=food.shop_name,
            price=food.price,
            quantity=order.quantity,
            total_price=total_price
        )
        db.add(order_item)

    db.commit()
    db.refresh(db_order)
    return db_order


def update_order_status(db: Session, order_id: int, status: str):
    """
    Transitions an order's lifecycle state (e.g., 'Pending' -> 'Ready' -> 'On Road' -> 'Delivered').
    """
    db_order = get_order(db, order_id)
    if db_order:
        db_order.status = status
        db.commit()
        db.refresh(db_order)
    return db_order


# ══════════════════════════════════════════════════════════════════════════════
#  RATINGS & REVIEWS CRUD OPERATIONS
# ══════════════════════════════════════════════════════════════════════════════

def get_ratings_for_food(db: Session, food_id: int):
    """
    Returns all student reviews and star ratings left for a specific dish.
    """
    return db.query(models.Rating).filter(models.Rating.food_id == food_id).all()


def get_rating_stats(db: Session, food_id: int):
    """
    Aggregates average star rating (rounded to 1 decimal place) and total review count using SQL functions.
    """
    result = db.query(
        func.avg(models.Rating.stars).label("avg_rating"),
        func.count(models.Rating.id).label("rating_count")
    ).filter(models.Rating.food_id == food_id).first()
    return {
        "avg_rating": round(result.avg_rating, 1) if result.avg_rating else None,
        "rating_count": result.rating_count or 0
    }


def get_student_rating_for_food(db: Session, food_id: int, student_id: str):
    """
    Checks if a student has already submitted a rating for a particular food item to prevent spamming duplicate reviews.
    """
    return db.query(models.Rating).filter(
        models.Rating.food_id == food_id,
        models.Rating.student_id == student_id
    ).first()


def create_rating(db: Session, rating: schemas.RatingCreate):
    """
    Records a new 1-5 star review and student feedback in the database.
    """
    db_rating = models.Rating(**rating.model_dump())
    db.add(db_rating)
    db.commit()
    db.refresh(db_rating)
    return db_rating

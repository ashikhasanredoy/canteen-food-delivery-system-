from sqlalchemy import Column, Integer, String, Float, DateTime, UniqueConstraint
from datetime import datetime
from backend.database import Base

class Food(Base):
    __tablename__ = "foods"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String, index=True)
    food_name = Column(String, index=True)
    price = Column(Float)
    quantity = Column(Integer, default=0)
    description = Column(String)
    image_url = Column(String)
    meal_type = Column(String, default="both")  # breakfast, lunch, both
    created_at = Column(DateTime, default=datetime.utcnow)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    food_id = Column(Integer)
    student_name = Column(String)
    student_id = Column(String)
    phone = Column(String)
    delivery_location = Column(String)
    quantity = Column(Integer)
    total_price = Column(Float)
    admin_fee = Column(Float, default=0.0)       # admin's cut (%)
    delivery_fee = Column(Float, default=0.0)    # delivery boy's cut (%)
    delivery_boy_id = Column(String, nullable=True) # delivery boy's ID
    delivery_request_status = Column(String, default="None") # None, Requested, Approved
    status = Column(String, default="Pending")   # Pending, Delivered
    created_at = Column(DateTime, default=datetime.utcnow)

class Rating(Base):
    __tablename__ = "ratings"

    id = Column(Integer, primary_key=True, index=True)
    food_id = Column(Integer, index=True)
    student_id = Column(String, index=True)
    stars = Column(Integer)       # 1-5
    comment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # One rating per student per food
    __table_args__ = (UniqueConstraint("food_id", "student_id", name="uq_food_student"),)

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True)
    value = Column(String)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Shop(Base):
    __tablename__ = "shops"

    id = Column(Integer, primary_key=True, index=True)
    shop_name = Column(String, unique=True, index=True)
    shop_id = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    shop_id = Column(String, index=True)      # target shop_id
    shop_name = Column(String)                 # target shop_name (for display)
    message = Column(String)
    is_read = Column(Integer, default=0)       # 0 = unread, 1 = read
    created_at = Column(DateTime, default=datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    # Category: order | delivery | food | shop | notification | settings
    category = Column(String, index=True)
    # Action: placed | delivered | added | deleted | registered | removed | sent | updated
    action = Column(String)
    # Short human-readable summary
    summary = Column(String)
    # Optional extra detail (JSON string or plain text)
    detail = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class DeliveryBoy(Base):
    __tablename__ = "delivery_boys"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    delivery_boy_id = Column(String, unique=True, index=True)  # 10-digit ID
    status = Column(String, default="Offline")                 # Online | Offline
    created_at = Column(DateTime, default=datetime.utcnow)


class Admin(Base):
    """Stores admin credentials for secure login."""
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

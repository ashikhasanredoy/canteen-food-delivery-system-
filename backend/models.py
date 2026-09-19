from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
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
    student_name = Column(String)
    student_id = Column(String)
    email = Column(String, nullable=True)
    otp_code = Column(String, nullable=True)
    order_group_id = Column(String, nullable=True, index=True)
    phone = Column(String)
    delivery_location = Column(String)
    total_price = Column(Float, default=0.0)
    admin_fee = Column(Float, default=0.0)       # admin's cut (%)
    delivery_fee = Column(Float, default=0.0)    # delivery boy's cut (%)
    delivery_boy_id = Column(String, nullable=True) # delivery boy's ID
    delivery_request_status = Column(String, default="None") # None, Accepted
    status = Column(String, default="Pending")   # Pending, On Road, Delivered
    created_at = Column(DateTime, default=datetime.utcnow)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="joined")

    @property
    def food_id(self):
        return self.items[0].food_id if self.items else None

    @property
    def quantity(self):
        return sum(item.quantity for item in self.items) if self.items else 0

    @property
    def food_name(self):
        if not self.items:
            return ""
        if len(self.items) == 1:
            return self.items[0].food_name
        return ", ".join(f"{it.food_name} (x{it.quantity})" for it in self.items)

    @property
    def shop_name(self):
        if not self.items:
            return ""
        shops = list(dict.fromkeys(it.shop_name for it in self.items if it.shop_name))
        return ", ".join(shops)


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    food_id = Column(Integer, index=True)
    food_name = Column(String)
    shop_name = Column(String, index=True)
    price = Column(Float)
    quantity = Column(Integer, default=1)
    total_price = Column(Float)

    order = relationship("Order", back_populates="items")

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
    last_seen = Column(DateTime, nullable=True)                # Real-time activity heartbeat
    created_at = Column(DateTime, default=datetime.utcnow)


class Admin(Base):
    """Stores admin credentials for secure login."""
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Complaint(Base):
    __tablename__ = "complaints"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String, index=True)          # buyer | seller | delivery
    name = Column(String)
    contact = Column(String, nullable=True)    # phone, shop id, delivery id, etc.
    shop_name = Column(String, nullable=True)  # shop being complained about (buyer/delivery)
    message = Column(String)
    image_url = Column(String, nullable=True)
    status = Column(String, default="Open")    # Open | Reviewed | Resolved
    created_at = Column(DateTime, default=datetime.utcnow)

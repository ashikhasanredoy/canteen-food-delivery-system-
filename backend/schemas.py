import html
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import List, Optional

def sanitize_string(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    # Strip whitespace and escape HTML entities to prevent XSS / script injection
    cleaned = v.strip()
    return html.escape(cleaned)

# Food Schemas
class FoodBase(BaseModel):
    shop_name: str = Field(..., min_length=1, max_length=100)
    food_name: str = Field(..., min_length=1, max_length=120)
    price: float = Field(..., gt=0, le=50000)
    quantity: int = Field(..., ge=0, le=5000)
    description: Optional[str] = Field(None, max_length=1000)
    image_url: Optional[str] = Field(None, max_length=500)
    meal_type: Optional[str] = "both"  # breakfast | lunch | both

    @field_validator("food_name", "shop_name", "description", mode="before")
    @classmethod
    def sanitize_text(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

class FoodCreate(FoodBase):
    pass

class FoodUpdate(FoodBase):
    pass

class FoodResponse(FoodBase):
    id: int
    meal_type: Optional[str] = "both"
    created_at: datetime
    avg_rating: Optional[float] = None
    rating_count: Optional[int] = 0

    class Config:
        from_attributes = True

# Order Schemas
class OrderCreate(BaseModel):
    food_id: int
    student_name: str = Field(..., min_length=1, max_length=100)
    student_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    email: Optional[str] = Field(None, max_length=120)
    phone: str = Field(..., min_length=7, max_length=20)
    delivery_location: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(..., gt=0, le=100)

    @field_validator("student_name", "delivery_location", mode="before")
    @classmethod
    def sanitize_order_text(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

class OrderItemResponse(BaseModel):
    id: Optional[int] = None
    food_id: int
    food_name: str
    shop_name: str
    price: float
    quantity: int
    total_price: float

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    student_name: str
    student_id: str
    email: Optional[str] = None
    otp_code: Optional[str] = None
    order_group_id: Optional[str] = None
    phone: str
    delivery_location: str
    total_price: float
    admin_fee: Optional[float] = 0.0
    delivery_fee: Optional[float] = 0.0
    delivery_boy_id: Optional[str] = None
    delivery_request_status: str = "None"
    status: str
    created_at: datetime

    # Nested items belonging to this order
    items: List[OrderItemResponse] = []

    # Optional convenience/backward compatibility fields
    food_id: Optional[int] = None
    quantity: Optional[int] = 0
    food_name: Optional[str] = None
    shop_name: Optional[str] = None

    class Config:
        from_attributes = True

class OTPRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=120)

class OTPVerify(BaseModel):
    email: str = Field(..., min_length=5, max_length=120)
    otp: str = Field(..., min_length=4, max_length=4, pattern=r"^\d{4}$")

class CartItemCreate(BaseModel):
    food_id: int
    quantity: int = Field(..., gt=0, le=100)

class CartCheckoutCreate(BaseModel):
    student_name: str = Field(..., min_length=1, max_length=100)
    student_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    email: str = Field(..., min_length=5, max_length=120)
    phone: str = Field(..., min_length=7, max_length=20)
    delivery_location: str = Field(..., min_length=1, max_length=200)
    items: List[CartItemCreate] = Field(..., min_length=1, max_length=50)

    @field_validator("student_name", "delivery_location", mode="before")
    @classmethod
    def sanitize_checkout_text(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

class CartCheckoutResponse(BaseModel):
    order: Optional[OrderResponse] = None
    orders: List[OrderResponse] = []
    total_amount: float
    order_count: int = 1
    otp_code: Optional[str] = None
    email_sent: Optional[bool] = False
    message: Optional[str] = None

# Delivery Schemas
class DeliveryVerify(BaseModel):
    order_id: int
    student_id: Optional[str] = None
    delivery_boy_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")

class DeliveryRequestPayload(BaseModel):
    order_id: int
    delivery_boy_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")

# Rating Schemas
class RatingCreate(BaseModel):
    food_id: int
    student_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    stars: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)

    @field_validator("comment", mode="before")
    @classmethod
    def sanitize_comment(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

class RatingResponse(BaseModel):
    id: int
    food_id: int
    student_id: str
    stars: int
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# Shop Auth Schemas
class ShopLogin(BaseModel):
    shop_name: Optional[str] = Field("", max_length=100)
    shop_id: Optional[str] = Field("", max_length=50)

    @field_validator("shop_name", "shop_id", mode="before")
    @classmethod
    def sanitize_shop_login(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

# Delivery Boy Auth Schemas
class DeliveryBoyAuth(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    delivery_boy_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")

    @field_validator("name", mode="before")
    @classmethod
    def sanitize_boy_name(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

class DeliveryBoyStatusUpdate(BaseModel):
    delivery_boy_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    status: str = Field(..., pattern=r"^(Online|Offline)$")

class DeliveryBoyUpdate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    delivery_boy_id: str = Field(..., min_length=1, max_length=50)

    @field_validator("name", mode="before")
    @classmethod
    def sanitize_boy_name(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

# Complaint Schemas
class ComplaintCreate(BaseModel):
    role: str = Field(..., pattern=r"^(buyer|seller|delivery)$")
    name: str = Field(..., min_length=1, max_length=100)
    contact: Optional[str] = Field(None, max_length=100)
    shop_name: Optional[str] = Field(None, max_length=100)
    message: str = Field(..., min_length=5, max_length=3000)
    image_url: Optional[str] = Field(None, max_length=500)

    @field_validator("name", "contact", "shop_name", "message", mode="before")
    @classmethod
    def sanitize_complaint(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

class ComplaintResponse(BaseModel):
    id: int
    role: str
    name: str
    contact: Optional[str] = None
    shop_name: Optional[str] = None
    message: str
    image_url: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class ComplaintStatusUpdate(BaseModel):
    status: str = Field(..., pattern=r"^(Open|Reviewed|Resolved)$")


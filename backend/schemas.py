from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

# Food Schemas
class FoodBase(BaseModel):
    shop_name: str = Field(..., min_length=1)
    food_name: str = Field(..., min_length=1)
    price: float = Field(..., gt=0)
    quantity: int = Field(..., ge=0)
    description: Optional[str] = None
    image_url: Optional[str] = None
    meal_type: Optional[str] = "both"  # breakfast | lunch | both

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
    student_name: str = Field(..., min_length=1)
    student_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    phone: str = Field(..., min_length=1)
    delivery_location: str = Field(..., min_length=1)
    quantity: int = Field(..., gt=0)

class OrderResponse(BaseModel):
    id: int
    food_id: int
    student_name: str
    student_id: str
    phone: str
    delivery_location: str
    quantity: int
    total_price: float
    admin_fee: Optional[float] = 0.0
    delivery_fee: Optional[float] = 0.0
    delivery_boy_id: Optional[str] = None
    delivery_request_status: str = "None"
    status: str
    created_at: datetime

    # Optional fields for joined data when needed
    food_name: Optional[str] = None
    shop_name: Optional[str] = None

    class Config:
        from_attributes = True

class CartItemCreate(BaseModel):
    food_id: int
    quantity: int = Field(..., gt=0)

class CartCheckoutCreate(BaseModel):
    student_name: str = Field(..., min_length=1)
    student_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    phone: str = Field(..., min_length=1)
    delivery_location: str = Field(..., min_length=1)
    items: List[CartItemCreate] = Field(..., min_length=1)

class CartCheckoutResponse(BaseModel):
    orders: List[OrderResponse]
    total_amount: float
    order_count: int

# Delivery Schemas
class DeliveryVerify(BaseModel):
    order_id: int
    student_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    delivery_boy_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")

class DeliveryRequestPayload(BaseModel):
    order_id: int
    delivery_boy_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")

# Rating Schemas
class RatingCreate(BaseModel):
    food_id: int
    student_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    stars: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None

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
    shop_name: str = Field(..., min_length=1)
    shop_id: str = Field(..., min_length=1)


# Delivery Boy Auth Schemas
class DeliveryBoyAuth(BaseModel):
    name: str = Field(..., min_length=1)
    delivery_boy_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")

class DeliveryBoyStatusUpdate(BaseModel):
    delivery_boy_id: str = Field(..., min_length=9, max_length=11, pattern=r"^\d{9,11}$")
    status: str = Field(..., pattern=r"^(Online|Offline)$")

class DeliveryBoyUpdate(BaseModel):
    name: str = Field(..., min_length=1)
    delivery_boy_id: str = Field(..., min_length=1)


# Complaint Schemas
class ComplaintCreate(BaseModel):
    role: str = Field(..., pattern=r"^(buyer|seller|delivery)$")
    name: str = Field(..., min_length=1)
    contact: Optional[str] = None
    shop_name: Optional[str] = None
    message: str = Field(..., min_length=5)
    image_url: Optional[str] = None

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


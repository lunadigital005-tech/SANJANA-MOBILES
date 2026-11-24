from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field

class UserProfileResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=25)
    avatar_url: Optional[str] = None
    # Security requirement: 'role' cannot be passed or updated here

class AddressBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=6, max_length=25)
    address_line1: str = Field(..., min_length=3, max_length=150)
    address_line2: Optional[str] = Field(None, max_length=150)
    city: str = Field(..., min_length=2, max_length=80)
    state: str = Field(..., min_length=2, max_length=80)
    postal_code: str = Field(..., min_length=2, max_length=20)
    country: str = Field("United States", min_length=2, max_length=80)
    is_default: bool = False
    address_type: str = Field("home", pattern="^(home|work|other)$")

class AddressCreate(AddressBase):
    pass

class AddressUpdate(AddressBase):
    pass

class AddressResponse(AddressBase):
    id: str
    user_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class CustomerRewardsResponse(BaseModel):
    points: int
    tier: str
    lifetime_points: int
    available_coins: Optional[int] = 0
    monetary_value: Optional[float] = 0.0
    total_earned_coins: Optional[int] = 0
    total_redeemed_coins: Optional[int] = 0

class CustomerOrderItem(BaseModel):
    id: str
    order_number: str
    status: str
    total_amount: float
    items_count: int
    payment_status: str
    created_at: str

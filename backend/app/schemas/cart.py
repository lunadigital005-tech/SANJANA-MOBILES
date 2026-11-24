from typing import List, Optional
from pydantic import BaseModel, Field

class CartItemIn(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=50)
    variant: Optional[str] = None

class CartItemResponse(BaseModel):
    id: str
    product_id: str
    product_title: str
    product_slug: str
    image_url: str
    sku: str
    unit_price: float
    original_price: float
    quantity: int
    item_total: float
    is_available: bool
    available_stock: int

class CartCalculationRequest(BaseModel):
    items: List[CartItemIn]
    delivery_method: str = Field("HOME_DELIVERY", pattern="^(HOME_DELIVERY|STORE_PICKUP)$")
    promo_code: Optional[str] = None
    coins_to_redeem: Optional[int] = Field(0, ge=0)

class CartCalculationResponse(BaseModel):
    items: List[CartItemResponse]
    subtotal: float
    discount_amount: float
    delivery_charge: float
    final_total: float
    currency: str = "INR"
    currency_symbol: str = "₹"
    free_delivery_threshold: float
    delivery_method: str
    coins_redeemed: int = 0
    coin_discount: float = 0.0
    payable_after_coins: float = 0.0
    coins_earned_preview: int = 0
    has_unavailable_items: bool
    unavailable_reasons: List[str] = Field(default_factory=list)

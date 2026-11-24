from typing import List, Optional
from pydantic import BaseModel
from app.schemas.product import ProductResponse

class WishlistToggleRequest(BaseModel):
    product_id: str

class WishlistToggleResponse(BaseModel):
    product_id: str
    is_in_wishlist: bool
    total_count: int
    message: str

class WishlistResponse(BaseModel):
    product_ids: List[str]
    items: List[ProductResponse]
    total_count: int

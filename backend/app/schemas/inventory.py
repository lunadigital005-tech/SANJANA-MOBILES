from typing import Optional, List
from pydantic import BaseModel, Field

class StockAdjustmentRequest(BaseModel):
    product_id: str
    quantity_delta: int = Field(..., description="Positive to add stock, negative to deduct")
    movement_type: str = Field("adjustment", pattern="^(restock|adjustment|return)$")
    reason: str = Field(..., min_length=3, max_length=250)

class StockAdjustmentResponse(BaseModel):
    product_id: str
    previous_quantity: int
    quantity_changed: int
    new_quantity: int
    movement_type: str
    reason: str
    updated_at: str

class StockMovementItem(BaseModel):
    id: str
    product_id: str
    product_title: Optional[str] = None
    previous_quantity: int
    quantity_changed: int
    new_quantity: int
    movement_type: str
    reason: str
    admin_id: Optional[str] = None
    created_at: str

class InventoryOverviewItem(BaseModel):
    id: str
    product_id: str
    product_title: str
    sku: str
    category_name: str
    price: float
    available_quantity: int
    reserved_quantity: int
    total_stock: int
    low_stock_threshold: int
    status: str # 'in_stock', 'low_stock', 'out_of_stock'
    updated_at: str

class StockReservationRequest(BaseModel):
    product_id: str
    quantity: int = Field(..., gt=0, le=50)
    duration_minutes: int = Field(15, ge=1, le=60)

class StockReservationResponse(BaseModel):
    reservation_id: str
    product_id: str
    quantity: int
    expires_at: str
    status: str
    message: str

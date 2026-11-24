from typing import Optional
from pydantic import BaseModel, Field

class AdvertisementBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200, description="Product / headline title")
    headline: Optional[str] = Field(None, max_length=200, description="Promotional headline banner (e.g. Flash Deal of the Day)")
    description: Optional[str] = Field(None, max_length=1000, description="Short promotional description")
    original_price: Optional[float] = Field(None, ge=0, description="Original MRP price in INR")
    offer_price: Optional[float] = Field(None, ge=0, description="Promotional offer price in INR")
    discount_percent: Optional[int] = Field(None, ge=0, le=100, description="Calculated or manual discount %")
    image_url: str = Field(..., description="High-resolution promotional product image URL")
    storage_path: Optional[str] = None
    product_id: Optional[str] = Field(None, description="Linked catalog product ID if applicable")
    cta_text: str = Field("Shop Now", max_length=60)
    cta_link: str = Field("/products", max_length=255)
    badge: Optional[str] = Field(None, max_length=60, description="Visual badge e.g. LIMITED OFFER, BESTSELLER")
    start_date: Optional[str] = Field(None, description="ISO format start date when advertisement starts showing")
    end_date: Optional[str] = Field(None, description="ISO format end date when advertisement expires")
    display_order: int = Field(0, description="Display order sequence (lower numbers first)")
    is_active: bool = Field(True, description="Whether advertisement is active")

class AdvertisementCreate(AdvertisementBase):
    pass

class AdvertisementUpdate(BaseModel):
    title: Optional[str] = None
    headline: Optional[str] = None
    description: Optional[str] = None
    original_price: Optional[float] = None
    offer_price: Optional[float] = None
    discount_percent: Optional[int] = None
    image_url: Optional[str] = None
    storage_path: Optional[str] = None
    product_id: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    badge: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None

class AdvertisementResponse(AdvertisementBase):
    id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

# Backward compatibility alias for existing banner calls
BannerBase = AdvertisementBase
BannerCreate = AdvertisementCreate
BannerUpdate = AdvertisementUpdate
BannerResponse = AdvertisementResponse

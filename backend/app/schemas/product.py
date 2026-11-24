from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field

class ProductImageItem(BaseModel):
    id: Optional[str] = None
    image_url: str
    storage_path: Optional[str] = None
    is_primary: bool = False
    display_order: int = 0
    alt_text: Optional[str] = None

class ProductBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    slug: Optional[str] = Field(None, max_length=220)
    description: str = Field(..., min_length=5)
    price: float = Field(..., gt=0)
    sale_price: Optional[float] = Field(None, ge=0)
    original_price: Optional[float] = Field(None, ge=0)
    discount_percent: Optional[int] = Field(0, ge=0, le=100)
    sku: str = Field(..., min_length=2, max_length=100)
    brand: Optional[str] = Field("Generic", max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    category_ids: List[str] = Field(default_factory=list)
    subcategory_id: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    image_details: List[ProductImageItem] = Field(default_factory=list)
    primary_image: Optional[str] = None
    stock_quantity: int = Field(0, ge=0)
    low_stock_threshold: int = Field(5, ge=0)
    is_active: bool = True
    is_featured: bool = False
    is_best_seller: bool = False
    is_new_arrival: bool = False
    warranty: Optional[str] = Field("1 Year Brand Warranty", max_length=150)
    compatibility: List[str] = Field(default_factory=list)
    specifications: Dict[str, Any] = Field(default_factory=dict)
    materials: Optional[str] = None
    dimensions: Optional[str] = None
    tags: List[str] = Field(default_factory=list)

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=200)
    slug: Optional[str] = Field(None, max_length=220)
    description: Optional[str] = Field(None, min_length=5)
    price: Optional[float] = Field(None, gt=0)
    sale_price: Optional[float] = None
    original_price: Optional[float] = None
    discount_percent: Optional[int] = None
    sku: Optional[str] = Field(None, min_length=2, max_length=100)
    brand: Optional[str] = None
    model: Optional[str] = None
    category_ids: Optional[List[str]] = None
    subcategory_id: Optional[str] = None
    images: Optional[List[str]] = None
    image_details: Optional[List[ProductImageItem]] = None
    primary_image: Optional[str] = None
    stock_quantity: Optional[int] = Field(None, ge=0)
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_best_seller: Optional[bool] = None
    is_new_arrival: Optional[bool] = None
    warranty: Optional[str] = None
    compatibility: Optional[List[str]] = None
    specifications: Optional[Dict[str, Any]] = None
    materials: Optional[str] = None
    dimensions: Optional[str] = None
    tags: Optional[List[str]] = None

class ProductStatusUpdate(BaseModel):
    is_active: bool

class ProductResponse(BaseModel):
    id: str
    title: str
    slug: str
    description: str
    price: float
    sale_price: Optional[float] = None
    original_price: Optional[float] = None
    discount_percent: int = 0
    sku: str
    brand: str = "Generic"
    model: Optional[str] = None
    category_ids: List[str] = Field(default_factory=list)
    category_names: List[str] = Field(default_factory=list)
    category_slug: Optional[str] = None
    category_name: Optional[str] = None
    subcategory_id: Optional[str] = None
    subcategory_name: Optional[str] = None
    images: List[str] = Field(default_factory=list)
    image_details: List[ProductImageItem] = Field(default_factory=list)
    primary_image: Optional[str] = None
    stock_quantity: int = 0
    available_stock: int = 0
    reserved_stock: int = 0
    low_stock_threshold: int = 5
    is_low_stock: bool = False
    is_out_of_stock: bool = False
    is_active: bool = True
    is_featured: bool = False
    is_best_seller: bool = False
    is_new_arrival: bool = False
    warranty: Optional[str] = "1 Year Brand Warranty"
    compatibility: List[str] = Field(default_factory=list)
    specifications: Dict[str, Any] = Field(default_factory=dict)
    rating: float = 4.8
    reviews_count: int = 0
    materials: Optional[str] = None
    dimensions: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    limit: int
    total_pages: int

class SearchSuggestionItem(BaseModel):
    id: str
    title: str
    slug: str
    brand: Optional[str] = None
    category_name: Optional[str] = None
    price: float
    sale_price: Optional[float] = None
    primary_image: Optional[str] = None

class SearchSuggestionsResponse(BaseModel):
    products: List[SearchSuggestionItem]
    categories: List[Dict[str, str]]
    total_matches: int

class HomepageSectionsResponse(BaseModel):
    featured_phones: List[ProductResponse]
    charging_accessories: List[ProductResponse]
    audio_accessories: List[ProductResponse]
    mobile_protection: List[ProductResponse]
    smart_gadgets: List[ProductResponse]
    best_sellers: List[ProductResponse]
    new_arrivals: List[ProductResponse]
    special_offers: List[ProductResponse]

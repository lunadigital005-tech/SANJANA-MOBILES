from typing import Optional, List
from pydantic import BaseModel, Field

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = None
    image_url: Optional[str] = None
    storage_path: Optional[str] = None
    parent_id: Optional[str] = None
    icon_name: Optional[str] = "Smartphone"
    is_active: bool = True
    display_order: int = 0

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    slug: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = None
    image_url: Optional[str] = None
    storage_path: Optional[str] = None
    parent_id: Optional[str] = None
    icon_name: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    storage_path: Optional[str] = None
    parent_id: Optional[str] = None
    parent_name: Optional[str] = None
    icon_name: Optional[str] = "Smartphone"
    is_active: bool = True
    display_order: int = 0
    item_count: int = 0
    subcategories: List['CategoryResponse'] = Field(default_factory=list)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

CategoryResponse.model_rebuild()

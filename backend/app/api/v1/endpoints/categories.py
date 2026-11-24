from typing import List
from fastapi import APIRouter, Query
from app.services.catalog_store import catalog_store
from app.schemas.category import CategoryResponse

router = APIRouter()

@router.get("/", response_model=List[CategoryResponse])
async def list_public_categories():
    """
    Public customer endpoint: Lists all active product categories ordered by display_order.
    """
    return await catalog_store.list_categories(active_only=True)

@router.get("/{id_or_slug}", response_model=CategoryResponse)
async def get_public_category(id_or_slug: str):
    """
    Public customer endpoint: Retrieves single category details by ID or URL slug.
    """
    return await catalog_store.get_category(id_or_slug)

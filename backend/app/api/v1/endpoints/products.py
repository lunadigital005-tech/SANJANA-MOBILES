from typing import Optional
from fastapi import APIRouter, Query, Depends
from app.services.catalog_store import catalog_store
from app.schemas.product import (
    ProductResponse, 
    ProductListResponse, 
    SearchSuggestionsResponse, 
    HomepageSectionsResponse
)
from app.schemas.inventory import StockReservationRequest, StockReservationResponse
from app.core.security import get_current_user, security_scheme
from app.schemas.auth import AuthUser

router = APIRouter()

@router.get("/search/suggestions", response_model=SearchSuggestionsResponse)
async def get_search_suggestions(
    q: str = Query(..., min_length=1, description="Live search query string"),
    limit: int = Query(6, ge=1, le=20)
):
    """
    Instant search suggestions endpoint:
    Returns real-time matching products and categories as the customer types in the search bar.
    """
    return await catalog_store.search_suggestions(query=q, limit=limit)

@router.get("/homepage/sections", response_model=HomepageSectionsResponse)
async def get_homepage_sections():
    """
    Structured homepage showcase:
    Returns curated lists of products for featured phones, charging, audio, protection, smart gadgets, best sellers, new arrivals, and special offers.
    """
    return await catalog_store.get_homepage_sections()

@router.get("/", response_model=ProductListResponse)
async def list_customer_products(
    category_slug: Optional[str] = Query(None, description="Filter by category slug"),
    search: Optional[str] = Query(None, description="Search by title, brand, model, SKU, or keyword"),
    brand: Optional[str] = Query(None, description="Filter by brand (Apple, Samsung, OnePlus, boAt, Anker, etc.)"),
    is_featured: Optional[bool] = Query(None, description="Filter featured products"),
    is_best_seller: Optional[bool] = Query(None, description="Filter best selling products"),
    is_new_arrival: Optional[bool] = Query(None, description="Filter new arrival products"),
    compatibility: Optional[str] = Query(None, description="Filter by device compatibility (e.g. iPhone 15, Samsung)"),
    connector_type: Optional[str] = Query(None, description="Filter by connector type (e.g. Type-C, Lightning)"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price filter"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price filter"),
    in_stock_only: bool = Query(False, description="Filter out-of-stock items"),
    sort_by: str = Query("featured", description="Sorting: 'featured', 'price_asc', 'price_desc', 'latest'"),
    page: int = Query(1, ge=1),
    limit: int = Query(24, ge=1, le=100)
):
    """
    Public customer catalog: returns active mobile products matching search/filtering criteria.
    Only active products are visible to customers.
    """
    return await catalog_store.list_products(
        active_only=True,
        category_slug=category_slug,
        search=search,
        brand=brand,
        is_featured=is_featured,
        is_best_seller=is_best_seller,
        is_new_arrival=is_new_arrival,
        compatibility=compatibility,
        connector_type=connector_type,
        min_price=min_price,
        max_price=max_price,
        in_stock_only=in_stock_only,
        sort_by=sort_by,
        page=page,
        limit=limit
    )

@router.get("/{id_or_slug}", response_model=ProductResponse)
async def get_customer_product_detail(id_or_slug: str):
    """
    Public customer endpoint: Retrieves product details, mobile specifications, compatibility, and stock status.
    Inactive products return 404 to ensure public privacy.
    """
    return await catalog_store.get_product(id_or_slug, active_only=True)

@router.post("/reserve", response_model=StockReservationResponse)
async def reserve_stock_for_checkout(
    req: StockReservationRequest
):
    """
    Stock Reservation Endpoint:
    Atomically holds stock for a customer before payment to prevent simultaneous overselling.
    Stock is protected against race conditions and automatically released upon expiration.
    """
    return await catalog_store.reserve_stock(req)

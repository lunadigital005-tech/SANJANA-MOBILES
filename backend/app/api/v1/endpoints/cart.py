from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user
from app.schemas.auth import AuthUser
from app.schemas.cart import (
    CartItemIn,
    CartCalculationRequest,
    CartCalculationResponse
)
from app.services.order_store import order_store

router = APIRouter()

@router.get("", response_model=List[dict])
async def get_cart(current_user: AuthUser = Depends(get_current_user)):
    """
    Get the persisted cart for the authenticated customer.
    """
    return await order_store.get_user_cart(current_user.id)

@router.post("/items", response_model=List[dict])
async def add_item_to_cart(
    item: CartItemIn,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Add or increase quantity of an item in the customer's cart.
    """
    return await order_store.add_item_to_cart(current_user.id, item)

@router.delete("/items/{product_id}", response_model=List[dict])
async def remove_item_from_cart(
    product_id: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Remove an item from the customer's cart.
    """
    return await order_store.remove_item_from_cart(current_user.id, product_id)

@router.delete("/clear")
async def clear_cart(current_user: AuthUser = Depends(get_current_user)):
    """
    Clear all items in the customer's cart.
    """
    await order_store.clear_user_cart(current_user.id)
    return {"message": "Cart cleared successfully"}

@router.post("/calculate", response_model=CartCalculationResponse)
async def calculate_cart(
    req: CartCalculationRequest
):
    """
    Public / Authenticated Authoritative Price & Availability Calculation:
    - Never trusts client-submitted prices or totals.
    - Validates real-time catalog price and inventory stock.
    - Applies delivery charge rules and promo codes.
    """
    return await order_store.calculate_cart(
        items=req.items,
        delivery_method=req.delivery_method,
        promo_code=req.promo_code
    )

from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user
from app.schemas.auth import AuthUser
from app.schemas.user import (
    UserProfileResponse,
    UserProfileUpdate,
    CustomerRewardsResponse
)
from app.schemas.address import (
    AddressCreate,
    AddressUpdate,
    AddressResponse
)
from app.schemas.order import OrderDetailedResponse
from app.schemas.invoice import InvoiceResponse
from app.schemas.wishlist import (
    WishlistToggleRequest,
    WishlistToggleResponse,
    WishlistResponse
)
from app.services.order_store import order_store
from app.services.catalog_store import catalog_store
from app.services.invoice_service import invoice_service

router = APIRouter()

# In-memory customer state store for profile
CUSTOMER_STORE = {
    "profiles": {}
}

@router.get("/profile", response_model=UserProfileResponse)
async def get_customer_profile(current_user: AuthUser = Depends(get_current_user)):
    """
    Retrieve customer profile using verified token identity.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    saved = CUSTOMER_STORE["profiles"].get(current_user.id, {})
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=saved.get("full_name", current_user.full_name or "Valued Customer"),
        phone=saved.get("phone", getattr(current_user, "phone", "") or ""),
        avatar_url=saved.get("avatar_url", current_user.avatar_url),
        role=current_user.role,
        created_at=saved.get("created_at", getattr(current_user, "created_at", now_iso) or now_iso),
        updated_at=saved.get("updated_at", now_iso)
    )

@router.put("/profile", response_model=UserProfileResponse)
async def update_customer_profile(
    profile_data: UserProfileUpdate,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Update customer profile. Role changes are strictly forbidden and rejected.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    current_data = CUSTOMER_STORE["profiles"].get(current_user.id, {})
    if "created_at" not in current_data:
        current_data["created_at"] = now_iso
    
    if profile_data.full_name is not None:
        current_data["full_name"] = profile_data.full_name
    if profile_data.phone is not None:
        current_data["phone"] = profile_data.phone
    if profile_data.avatar_url is not None:
        current_data["avatar_url"] = profile_data.avatar_url
        
    current_data["updated_at"] = now_iso
    CUSTOMER_STORE["profiles"][current_user.id] = current_data
    
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_data.get("full_name", current_user.full_name or "Valued Customer"),
        phone=current_data.get("phone", getattr(current_user, "phone", "") or ""),
        avatar_url=current_data.get("avatar_url", current_user.avatar_url),
        role=current_user.role,
        created_at=current_data.get("created_at", now_iso),
        updated_at=current_data.get("updated_at", now_iso)
    )

@router.get("/addresses", response_model=List[AddressResponse])
async def get_customer_addresses(current_user: AuthUser = Depends(get_current_user)):
    """
    Retrieve saved delivery addresses for the authenticated user.
    """
    return await order_store.list_user_addresses(current_user.id)

@router.post("/addresses", response_model=AddressResponse, status_code=status.HTTP_201_CREATED)
async def create_customer_address(
    address_in: AddressCreate,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Add a new delivery address with Indian PIN and Mobile validation.
    """
    return await order_store.create_address(current_user.id, address_in)

@router.put("/addresses/{address_id}", response_model=AddressResponse)
async def update_customer_address(
    address_id: str,
    address_in: AddressUpdate,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Update an existing delivery address.
    """
    return await order_store.update_address(address_id, current_user.id, address_in)

@router.delete("/addresses/{address_id}")
async def delete_customer_address(
    address_id: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Delete a saved delivery address.
    """
    return await order_store.delete_address(address_id, current_user.id)

@router.post("/addresses/{address_id}/default", response_model=AddressResponse)
async def set_default_customer_address(
    address_id: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Set an address as the default delivery address.
    """
    return await order_store.set_default_address(address_id, current_user.id)

from app.services.rewards_store import rewards_store

@router.get("/rewards", response_model=CustomerRewardsResponse)
async def get_customer_rewards(current_user: AuthUser = Depends(get_current_user)):
    """
    Get customer loyalty points and wallet status.
    """
    wallet = await rewards_store.get_or_create_wallet(current_user.id)
    return CustomerRewardsResponse(
        points=wallet.available_coins,
        tier="Gold" if wallet.total_earned_coins > 500 else "Silver",
        lifetime_points=wallet.total_earned_coins,
        available_coins=wallet.available_coins,
        monetary_value=wallet.monetary_value,
        total_earned_coins=wallet.total_earned_coins,
        total_redeemed_coins=wallet.total_redeemed_coins
    )

@router.get("/orders", response_model=List[OrderDetailedResponse])
async def get_customer_orders(current_user: AuthUser = Depends(get_current_user)):
    """
    Get detailed order history for authenticated user.
    """
    return await order_store.list_customer_orders(current_user.id)

@router.get("/orders/{order_id_or_number}", response_model=OrderDetailedResponse)
async def get_customer_order_detail(
    order_id_or_number: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get individual order detail with tracking timeline and items.
    """
    if order_id_or_number.startswith("ord-"):
        return await order_store.get_order_by_id(order_id_or_number, current_user.id)
    else:
        return await order_store.get_order_by_number(order_id_or_number, current_user.id)

@router.get("/orders/{order_id_or_number}/invoice", response_model=InvoiceResponse)
async def get_customer_order_invoice(
    order_id_or_number: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Get official showroom invoice for authenticated customer.
    Enforces customer isolation (returns 403 if order does not belong to current user).
    """
    order = None
    if order_id_or_number.startswith("ord-"):
        order = order_store.orders.get(order_id_or_number)
    else:
        order_id = order_store.order_number_map.get(order_id_or_number)
        if order_id:
            order = order_store.orders.get(order_id)
        else:
            for oid, o in order_store.orders.items():
                if o.get("order_number", "").upper() == order_id_or_number.upper():
                    order = o
                    break

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id_or_number}' not found."
        )

    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role
    }
    return await invoice_service.get_or_create_invoice_for_order(order, user_dict)

# =============================================================================
# WISHLIST ENDPOINTS
# =============================================================================

@router.get("/wishlist", response_model=WishlistResponse)
async def get_customer_wishlist(current_user: AuthUser = Depends(get_current_user)):
    """
    Retrieve customer's saved wishlist items.
    """
    items = await catalog_store.get_user_wishlist(current_user.id)
    p_ids = [item.id for item in items]
    return WishlistResponse(
        product_ids=p_ids,
        items=items,
        total_count=len(items)
    )

@router.post("/wishlist/toggle", response_model=WishlistToggleResponse)
async def toggle_customer_wishlist_item(
    req: WishlistToggleRequest,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Add or remove a product from the customer's wishlist.
    """
    is_in, count = await catalog_store.toggle_wishlist_item(current_user.id, req.product_id)
    msg = "Added to wishlist" if is_in else "Removed from wishlist"
    return WishlistToggleResponse(
        product_id=req.product_id,
        is_in_wishlist=is_in,
        total_count=count,
        message=msg
    )

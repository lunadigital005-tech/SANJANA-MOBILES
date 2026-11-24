from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from app.core.security import get_current_admin
from app.schemas.auth import AuthUser
from app.schemas.banner import (
    BannerCreate,
    BannerUpdate,
    BannerResponse,
    AdvertisementCreate,
    AdvertisementUpdate,
    AdvertisementResponse
)
from app.services.catalog_store import catalog_store

router = APIRouter()

@router.get("", response_model=List[AdvertisementResponse])
async def get_active_advertisements():
    """
    Public endpoint to retrieve all active homepage advertisements in display order.
    Filters out advertisements outside of their scheduled start_date and end_date.
    """
    return await catalog_store.list_banners(active_only=True)

@router.get("/all", response_model=List[AdvertisementResponse])
async def get_all_advertisements_admin(current_admin: AuthUser = Depends(get_current_admin)):
    """
    Admin endpoint to retrieve all advertisements including inactive and scheduled ones.
    """
    return await catalog_store.list_banners(active_only=False)

@router.post("", response_model=AdvertisementResponse, status_code=status.HTTP_201_CREATED)
async def create_advertisement(
    ad_in: AdvertisementCreate,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin endpoint to create a new promotional product advertisement.
    """
    return await catalog_store.create_banner(ad_in)

@router.put("/{ad_id}", response_model=AdvertisementResponse)
async def update_advertisement(
    ad_id: str,
    ad_in: AdvertisementUpdate,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin endpoint to update an existing advertisement.
    """
    return await catalog_store.update_banner(ad_id, ad_in)

@router.delete("/{ad_id}")
async def delete_advertisement(
    ad_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin endpoint to delete an advertisement.
    """
    return await catalog_store.delete_banner(ad_id)


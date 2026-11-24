from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user, get_current_admin
from app.schemas.auth import AuthUser
from app.schemas.rewards import (
    RewardSettingsResponse,
    RewardSettingsUpdate,
    CustomerWalletResponse,
    ManualCoinAdjustmentRequest,
    RewardsOverviewStats
)
from app.services.rewards_store import rewards_store

router = APIRouter()

# =============================================================================
# CUSTOMER REWARDS ENDPOINTS
# =============================================================================

@router.get("/wallet", response_model=CustomerWalletResponse)
async def get_my_wallet(current_user: AuthUser = Depends(get_current_user)):
    """
    Retrieve the authenticated customer's private rewards wallet:
    - Available coin balance
    - Monetary rupee value
    - Lifetime earned and redeemed coins
    - Complete, immutable transaction ledger
    """
    return await rewards_store.get_or_create_wallet(current_user.id)

@router.get("/settings", response_model=RewardSettingsResponse)
async def get_public_reward_settings():
    """
    Retrieve active loyalty reward parameters for customer-facing display
    (earning ratios, redemption conversion values, minimum thresholds).
    """
    return await rewards_store.get_settings()


# =============================================================================
# ADMIN REWARDS & LOYALTY ENGINE MANAGEMENT
# =============================================================================

@router.get("/admin/overview", response_model=RewardsOverviewStats)
async def get_rewards_overview_stats(current_admin: AuthUser = Depends(get_current_admin)):
    """
    Admin dashboard overview:
    - Total coins issued across store
    - Total coins redeemed
    - Total active reward participants
    - Total monetary liability of outstanding wallet balances
    """
    return await rewards_store.get_overview_stats()

@router.get("/admin/settings", response_model=RewardSettingsResponse)
async def get_admin_reward_settings(current_admin: AuthUser = Depends(get_current_admin)):
    """
    Admin: Retrieve complete configurable reward rules.
    """
    return await rewards_store.get_settings()

@router.put("/admin/settings", response_model=RewardSettingsResponse)
async def update_admin_reward_settings(
    req: RewardSettingsUpdate,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin: Dynamically adjust earning ratio, monetary conversion,
    redemption thresholds, and payment policies.
    """
    return await rewards_store.update_settings(req)

@router.get("/admin/wallets", response_model=List[CustomerWalletResponse])
async def list_customer_wallets(current_admin: AuthUser = Depends(get_current_admin)):
    """
    Admin: List and inspect customer wallets across the platform.
    """
    return await rewards_store.list_all_wallets()

@router.get("/admin/wallets/{user_id}", response_model=CustomerWalletResponse)
async def get_customer_wallet_by_id(
    user_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin: Look up an individual customer's reward wallet and transaction ledger.
    """
    return await rewards_store.get_or_create_wallet(user_id)

@router.post("/admin/adjust", response_model=CustomerWalletResponse)
async def manual_coin_adjustment(
    req: ManualCoinAdjustmentRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin: Credit or debit customer coins manually.
    Requires mandatory administrative justification for the audit trail.
    """
    await rewards_store.manual_admin_adjustment(
        user_id=req.user_id,
        coins_delta=req.coins_delta,
        reason=req.reason,
        admin_id=current_admin.id
    )
    return await rewards_store.get_or_create_wallet(req.user_id)

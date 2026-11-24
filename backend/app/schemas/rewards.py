from typing import List, Optional
from pydantic import BaseModel, Field

class RewardSettingsBase(BaseModel):
    is_active: bool = True
    reward_per_100: float = Field(1.0, ge=0.0, description="Coins awarded per ₹100 spent (e.g. 1.0 = ₹1 reward per ₹100)")
    min_purchase_amount: float = Field(100.0, ge=0.0, description="Minimum purchase amount required to earn coins")
    earning_ratio: float = Field(0.01, ge=0.0001, le=1.0, description="Coins awarded per ₹1 purchase (e.g. 0.01 = 1 coin per ₹100)")
    coin_conversion_rate: float = Field(1.0, ge=0.01, description="Monetary value of 1 coin in INR (e.g. 1.0 = ₹1.00)")
    min_redemption_coins: int = Field(10, ge=1, description="Minimum coins needed before a customer can redeem")
    max_redemption_per_order: int = Field(500, ge=1, description="Maximum coins permitted per single order")
    allow_full_coin_payment: bool = Field(True, description="Whether coins can cover 100% of an order")
    allow_mixed_payment: bool = Field(True, description="Whether coins can be combined with Razorpay")
    coin_expiry_days: Optional[int] = Field(365, ge=1)

class RewardSettingsUpdate(BaseModel):
    is_active: Optional[bool] = None
    reward_per_100: Optional[float] = None
    min_purchase_amount: Optional[float] = None
    earning_ratio: Optional[float] = None
    coin_conversion_rate: Optional[float] = None
    min_redemption_coins: Optional[int] = None
    max_redemption_per_order: Optional[int] = None
    allow_full_coin_payment: Optional[bool] = None
    allow_mixed_payment: Optional[bool] = None
    coin_expiry_days: Optional[int] = None

class RewardSettingsResponse(RewardSettingsBase):
    id: str = "default"
    updated_at: str

class CoinTransactionItem(BaseModel):
    id: str
    user_id: str
    order_id: Optional[str] = None
    order_number: Optional[str] = None
    transaction_type: str # 'CREDIT_EARNED', 'DEBIT_REDEEMED', 'REVERSAL_REFUND', 'REVERSAL_CANCELLED', 'RESTORE_FAILED_PAYMENT', 'MANUAL_ADJUSTMENT'
    coins: int
    monetary_value: float
    balance_after: int
    reason: str
    admin_id: Optional[str] = None
    created_at: str

class CustomerWalletResponse(BaseModel):
    user_id: str
    available_coins: int
    monetary_value: float
    total_earned_coins: int
    total_redeemed_coins: int
    transactions: List[CoinTransactionItem] = Field(default_factory=list)
    can_redeem: bool = False
    min_redemption_coins: int = 10
    max_redemption_coins: int = 500

class ManualCoinAdjustmentRequest(BaseModel):
    user_id: str
    coins_delta: int = Field(..., description="Positive to credit coins, negative to debit coins")
    reason: str = Field(..., min_length=5, max_length=250, description="Mandatory administrative justification for audit trail")

class RewardsOverviewStats(BaseModel):
    total_coins_issued: int
    total_coins_redeemed: int
    active_reward_customers: int
    total_wallet_balance_value: float

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.cart import CartItemIn

class CheckoutInitiateRequest(BaseModel):
    items: List[CartItemIn]
    delivery_method: str = Field("HOME_DELIVERY", pattern="^(HOME_DELIVERY|STORE_PICKUP)$")
    payment_method: Optional[str] = "UPI" # 'UPI' | 'PAY_AT_STORE' | 'COINS'
    address_id: Optional[str] = None
    pickup_person_name: Optional[str] = None
    pickup_person_phone: Optional[str] = None
    pickup_details: Optional[Dict[str, Any]] = None
    promo_code: Optional[str] = None
    coins_to_redeem: Optional[int] = Field(0, ge=0)

class CheckoutInitiateResponse(BaseModel):
    order_id: str
    order_number: str
    razorpay_order_id: Optional[str] = None
    razorpay_key_id: Optional[str] = None
    amount_in_paise: int
    amount: float
    currency: str = "INR"
    customer_name: str
    customer_email: str
    customer_mobile: str
    delivery_method: str
    payment_method: str = "UPI"
    is_pay_at_store: bool = False
    expires_at: str
    coins_redeemed: int = 0
    coin_discount: float = 0.0
    is_full_coin_payment: bool = False
    # Official UPI Payment Fields
    upi_id: str = "REPLACE_WITH_REAL_SHOP_UPI_ID"
    merchant_name: str = "SANJANA MOBILES"
    upi_uri: Optional[str] = None
    qr_code_image_url: Optional[str] = None
    qr_code_url: Optional[str] = None
    payment_status: str = "PENDING"
    order_status: str = "PENDING"

class PaymentVerificationRequest(BaseModel):
    order_id: str
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None

class UpiPaymentSubmitRequest(BaseModel):
    order_id: str
    upi_utr: str = Field(..., min_length=6, max_length=35, description="UPI 12-digit transaction reference / UTR number")
    customer_notes: Optional[str] = None

class UpiPaymentSubmitResponse(BaseModel):
    success: bool
    order_id: str
    order_number: str
    upi_utr: str
    payment_status: str
    order_status: str
    message: str
    submitted_at: str

class AdminPaymentVerifyRequest(BaseModel):
    order_id: str
    action: str = Field(..., pattern="^(VERIFY|REJECT)$") # VERIFY or REJECT
    admin_notes: Optional[str] = None

class AdminPaymentVerifyResponse(BaseModel):
    success: bool
    order_id: str
    order_number: str
    payment_status: str
    order_status: str
    message: str
    verified_at: str

class PaymentSettingsSchema(BaseModel):
    upi_id: str = "REPLACE_WITH_REAL_SHOP_UPI_ID"
    merchant_name: str = "SANJANA MOBILES"
    qr_code_image_url: Optional[str] = None
    payment_instructions: str = (
        "1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app.\n"
        "2. Or tap 'Pay with UPI' on supported Android devices.\n"
        "3. Complete the transfer for the exact order amount.\n"
        "4. Enter the 12-digit UPI Reference Number / UTR below and submit for verification."
    )
    is_upi_enabled: bool = True
    require_manual_verification: bool = True
    updated_at: Optional[str] = None

class PaymentVerificationResponse(BaseModel):
    success: bool
    order_id: str
    order_number: str
    payment_status: str
    order_status: str
    message: str

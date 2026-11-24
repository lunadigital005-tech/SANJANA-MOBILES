from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user
from app.schemas.auth import AuthUser
from app.schemas.checkout import (
    CheckoutInitiateRequest,
    CheckoutInitiateResponse,
    PaymentVerificationRequest,
    PaymentVerificationResponse,
    UpiPaymentSubmitRequest,
    UpiPaymentSubmitResponse,
    PaymentSettingsSchema,
)
from app.services.order_store import order_store

router = APIRouter()

@router.post("/initiate", response_model=CheckoutInitiateResponse)
async def initiate_checkout(
    req: CheckoutInitiateRequest,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Initiate checkout session:
    1. Verifies server-side stock and pricing.
    2. Enforces delivery method parameters (Home Delivery vs Store Pickup).
    3. Atomically reserves stock.
    4. Generates dynamic UPI payment URI and QR parameters.
    5. Returns order details for Google Pay & UPI checkout.
    """
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "name": getattr(current_user, "full_name", None) or "SANJANA MOBILES Customer",
        "role": current_user.role
    }
    return await order_store.initiate_checkout(user=user_dict, req=req)

@router.post("/submit-upi", response_model=UpiPaymentSubmitResponse)
async def submit_upi_payment(
    req: UpiPaymentSubmitRequest,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Customer submits 12-digit UPI reference / UTR number:
    - Marks payment status as VERIFICATION_PENDING.
    - Prevents duplicate UTR submissions.
    - Notifies admin for independent bank verification.
    """
    return await order_store.submit_upi_payment(user_id=current_user.id, req=req)

@router.get("/payment-settings", response_model=PaymentSettingsSchema)
async def get_public_payment_settings():
    """
    Public customer endpoint to fetch active shop UPI ID, merchant name, and instructions.
    """
    settings_dict = await order_store.get_payment_settings()
    return PaymentSettingsSchema(**settings_dict)

@router.post("/verify", response_model=PaymentVerificationResponse)
async def verify_payment(
    req: PaymentVerificationRequest,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Legacy payment verification fallback:
    Kept for backwards compatibility with existing orders and automated tests.
    """
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role
    }
    return await order_store.verify_payment(user=user_dict, req=req)

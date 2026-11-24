from fastapi import APIRouter, Request, Header, HTTPException, status
from app.services.order_store import order_store

router = APIRouter()

@router.post("/webhook")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(..., alias="X-Razorpay-Signature")
):
    """
    Razorpay Webhook Handler:
    - Verifies webhook HMAC-SHA256 signature against settings.RAZORPAY_WEBHOOK_SECRET.
    - Ensures idempotency: duplicate events are safely ignored.
    - Synchronizes payment status updates.
    """
    body_bytes = await request.body()
    if not body_bytes:
        raise HTTPException(status_code=400, detail="Empty webhook payload")
        
    return await order_store.process_webhook(
        payload=body_bytes,
        signature=x_razorpay_signature
    )

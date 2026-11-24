from typing import Optional
from pydantic import BaseModel, Field

class RefundInitiateRequest(BaseModel):
    order_id: str
    amount: Optional[float] = Field(None, gt=0, description="Leave null for 100% full order refund")
    reason: str = Field(..., min_length=3, max_length=250)

class RefundRecordResponse(BaseModel):
    id: str
    order_id: str
    order_number: str
    razorpay_payment_id: str
    razorpay_refund_id: Optional[str] = None
    amount: float
    currency: str = "INR"
    reason: str
    status: str # 'NOT_REQUIRED', 'REFUND_PENDING', 'REFUND_PROCESSING', 'REFUNDED', 'REFUND_FAILED'
    admin_id: Optional[str] = None
    created_at: str
    updated_at: str

class PaymentTransactionItem(BaseModel):
    id: str
    order_id: str
    order_number: str
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    amount: float
    currency: str = "INR"
    status: str
    customer_email: str
    created_at: str

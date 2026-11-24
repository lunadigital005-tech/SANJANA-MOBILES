from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

ORDER_STATUS_FLOW = {
    "PENDING": ["ACCEPTED", "REJECTED", "CANCELLED"],
    "NEW": ["ACCEPTED", "REJECTED", "CANCELLED"],
    "ACCEPTED": ["PACKING", "READY_FOR_DELIVERY", "READY_FOR_PICKUP", "COLLECTED", "REJECTED", "CANCELLED"],
    "PACKING": ["PACKED", "REJECTED", "CANCELLED"],
    "PACKED": ["DELIVERY_PENDING", "READY_FOR_DELIVERY", "READY_FOR_PICKUP", "COURIER_ASSIGNED", "COLLECTED", "REJECTED", "CANCELLED"],
    "DELIVERY_PENDING": ["READY_FOR_DELIVERY", "COURIER_ASSIGNED", "REJECTED", "CANCELLED"],
    # Store Pickup branch:
    "READY_FOR_PICKUP": ["COLLECTED", "REJECTED", "CANCELLED"],
    "COLLECTED": ["COMPLETED"],
    # Direct Delivery branch:
    "READY_FOR_DELIVERY": ["OUT_FOR_DELIVERY", "DELIVERED", "REJECTED", "CANCELLED"],
    "OUT_FOR_DELIVERY": ["DELIVERED", "REJECTED"],
    # Courier Delivery branch:
    "COURIER_ASSIGNED": ["SHIPPED", "REJECTED", "CANCELLED"],
    "SHIPPED": ["COURIER_TRACKING", "DELIVERED", "REJECTED"],
    "COURIER_TRACKING": ["DELIVERED", "REJECTED"],
    "DELIVERED": ["COMPLETED"],
    "COMPLETED": [],
    "REJECTED": [],
    "CANCELLED": []
}

REJECTION_REASONS = [
    "Product Out of Stock",
    "Unable to Fulfil Order",
    "Incorrect Product Information",
    "Customer Request",
    "Payment Verification Failed",
    "Delivery Address Unserviceable",
    "Damaged / Quality Issue",
    "Pricing/listing error",
    "Product unavailable",
    "Product damaged",
    "Delivery unavailable",
    "Other"
]

class OrderItemSnapshot(BaseModel):
    id: str
    product_id: str
    title: str
    sku: str = "SKU-GEN"
    price_snapshot: float
    quantity: int
    subtotal: float
    image_url: Optional[str] = None
    variant: Optional[str] = None

class OrderStatusHistoryItem(BaseModel):
    id: str
    order_id: str
    previous_status: Optional[str] = None
    new_status: str
    comment: Optional[str] = None
    changed_by: Optional[str] = None
    created_at: str

class OrderRejectRequest(BaseModel):
    rejection_reason: str = Field(..., description="Must be one of the sanctioned reasons")
    rejection_notes: Optional[str] = None
    initiate_refund: bool = True

class OrderCancelRequest(BaseModel):
    cancellation_reason: str = Field(..., description="Reason for cancelling the order")
    cancellation_notes: Optional[str] = None

class OrderStatusUpdateRequest(BaseModel):
    new_status: str
    comment: Optional[str] = None

class AdminDeliveryAssignRequest(BaseModel):
    order_id: Optional[str] = None
    admin_notes: Optional[str] = None

class AdminDeliveryStatusUpdateRequest(BaseModel):
    order_id: Optional[str] = None
    status: str = Field(..., pattern="^(OUT_FOR_DELIVERY|DELIVERED)$")
    admin_notes: Optional[str] = None

class AdminStorePaymentConfirmRequest(BaseModel):
    order_id: Optional[str] = None
    admin_notes: Optional[str] = None

class OrderDetailedResponse(BaseModel):
    id: str
    order_number: str
    user_id: str
    customer_name: str
    customer_email: str
    customer_mobile: Optional[str] = None
    delivery_method: str = "HOME_DELIVERY" # 'HOME_DELIVERY' | 'STORE_PICKUP'
    payment_method: Optional[str] = "UPI" # 'UPI' | 'PAY_AT_STORE' | 'COINS' | 'RAZORPAY'
    internal_delivery_assignment: Optional[str] = "UNASSIGNED" # 'UNASSIGNED' | 'ADMIN' | 'COURIER'
    assigned_admin_id: Optional[str] = None
    assigned_admin_name: Optional[str] = None
    admin_delivery_status: Optional[str] = None # 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'DELIVERED'
    admin_delivery_assigned_at: Optional[str] = None
    admin_delivery_completed_at: Optional[str] = None
    admin_delivery_notes: Optional[str] = None
    delivery_address: Optional[Dict[str, Any]] = None
    pickup_details: Optional[Dict[str, Any]] = None
    items: List[OrderItemSnapshot] = Field(default_factory=list)
    items_count: int = 0
    subtotal: float = 0.0
    discount_amount: float = 0.0
    delivery_charge: float = 0.0
    total_amount: float = 0.0
    currency: str = "INR"
    status: str # 'NEW', 'ACCEPTED', 'PACKING', 'PACKED', 'DELIVERY_PENDING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'COLLECTED', 'COURIER_ASSIGNED', 'SHIPPED', 'COURIER_TRACKING', 'DELIVERED', 'REJECTED', 'CANCELLED'
    payment_status: str # 'PENDING', 'VERIFICATION_PENDING', 'VERIFIED', 'PAID', 'REJECTED', 'FAILED', 'REFUNDED'
    upi_id: Optional[str] = None
    upi_utr: Optional[str] = None
    upi_submission_time: Optional[str] = None
    admin_verification_notes: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    rejection_reason: Optional[str] = None
    rejection_notes: Optional[str] = None
    rejected_by: Optional[str] = None
    rejected_at: Optional[str] = None
    cancellation_reason: Optional[str] = None
    cancellation_notes: Optional[str] = None
    cancelled_by: Optional[str] = None
    cancelled_at: Optional[str] = None
    refunded_amount: Optional[float] = 0.0
    
    # Loyalty rewards fields
    coins_redeemed: int = 0
    coin_discount_amount: float = 0.0
    coins_earned: int = 0
    coins_credited: bool = False
    
    # Shipment record embedding
    shipment: Optional[Dict[str, Any]] = None

    status_history: List[OrderStatusHistoryItem] = Field(default_factory=list)
    created_at: str
    updated_at: str

class AdminOrdersSummaryResponse(BaseModel):
    todays_orders: List[OrderDetailedResponse]
    all_orders: List[OrderDetailedResponse]
    todays_count: int
    pending_action_count: int

from typing import List, Optional
from pydantic import BaseModel, Field

class DeliverySettingsResponse(BaseModel):
    store_name: str
    store_address: str
    store_latitude: float
    store_longitude: float
    direct_delivery_max_distance_km: float
    courier_suggested_min_distance_km: float
    enable_auto_distance_calc: bool

class DistanceCalculationResponse(BaseModel):
    order_id: str
    store_coordinates: dict
    customer_coordinates: Optional[dict] = None
    distance_km: Optional[float] = None
    suggested_method: str # 'DIRECT_DELIVERY', 'COURIER', 'ADMIN_DECISION', 'MANUAL_SELECTION_REQUIRED'
    explanation: str

class DeliveryMethodSelectionRequest(BaseModel):
    delivery_type: str = Field(..., pattern="^(DIRECT_DELIVERY|COURIER)$")
    assigned_to: Optional[str] = None
    notes: Optional[str] = None

class DirectDeliveryUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(READY_FOR_DELIVERY|OUT_FOR_DELIVERY|DELIVERED)$")
    delivery_proof_url: Optional[str] = None
    customer_acknowledgement: Optional[str] = None
    notes: Optional[str] = None

class CourierShipmentCreateRequest(BaseModel):
    courier_name: str = Field(..., min_length=2, max_length=100)
    tracking_number: str = Field(..., min_length=3, max_length=100, description="AWB / Consignment Tracking Number")
    shipment_date: Optional[str] = None
    tracking_url: Optional[str] = None
    receipt_image_url: Optional[str] = None
    receipt_storage_path: Optional[str] = None
    shipment_notes: Optional[str] = None
    estimated_delivery_date: Optional[str] = None

class CourierStatusUpdateRequest(BaseModel):
    status: str = Field(..., pattern="^(SHIPPED|COURIER_TRACKING|DELIVERED)$")
    location: Optional[str] = None
    event_description: Optional[str] = None

class CourierTrackingEventResponse(BaseModel):
    id: str
    status: str
    location: Optional[str] = None
    description: str
    event_timestamp: str

class ShipmentRecordResponse(BaseModel):
    id: str
    order_id: str
    order_number: str
    delivery_type: str # 'DIRECT_DELIVERY' | 'COURIER'
    status: str # 'PENDING_METHOD', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'COURIER_ASSIGNED', 'SHIPPED', 'COURIER_TRACKING', 'DELIVERED'
    calculated_distance_km: Optional[float] = None
    suggested_method: Optional[str] = None
    
    # Direct Delivery fields
    direct_assigned_to: Optional[str] = None
    direct_directions_url: Optional[str] = None
    direct_out_for_delivery_at: Optional[str] = None
    direct_delivered_at: Optional[str] = None
    direct_delivery_proof_url: Optional[str] = None
    direct_acknowledgement: Optional[str] = None

    # Courier Delivery fields
    courier_name: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    shipment_date: Optional[str] = None
    receipt_image_url: Optional[str] = None
    receipt_storage_path: Optional[str] = None
    shipment_notes: Optional[str] = None
    estimated_delivery_date: Optional[str] = None

    tracking_events: List[CourierTrackingEventResponse] = Field(default_factory=list)
    created_at: str
    updated_at: str

class WhatsAppMessageResponse(BaseModel):
    order_id: str
    order_number: str
    customer_mobile: str
    customer_name: str
    notification_event: str
    message_body: str
    whatsapp_share_url: str

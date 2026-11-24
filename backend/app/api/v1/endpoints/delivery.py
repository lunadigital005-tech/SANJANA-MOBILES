from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from app.core.security import get_current_user, get_current_admin
from app.schemas.auth import AuthUser
from app.schemas.delivery import (
    DeliverySettingsResponse,
    DistanceCalculationResponse,
    DeliveryMethodSelectionRequest,
    DirectDeliveryUpdateRequest,
    CourierShipmentCreateRequest,
    CourierStatusUpdateRequest,
    ShipmentRecordResponse,
    WhatsAppMessageResponse
)
from app.services.delivery_service import delivery_service
from app.services.order_store import order_store
from app.services.storage import validate_and_upload_image

router = APIRouter()

# =============================================================================
# ADMIN DELIVERY & SHIPMENT MANAGEMENT
# =============================================================================

@router.get("/settings", response_model=DeliverySettingsResponse)
async def get_delivery_settings(current_admin: AuthUser = Depends(get_current_admin)):
    """
    Retrieve store geographical coordinates and delivery threshold configurations.
    """
    return DeliverySettingsResponse(**delivery_service.store_settings)

@router.get("/orders/{order_id}/distance", response_model=DistanceCalculationResponse)
async def compute_order_distance(
    order_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Calculates Great-Circle distance via Haversine formula from store coordinates
    to customer address and outputs non-binding delivery suggestion.
    """
    order = await order_store.get_order_by_id(order_id)
    addr = order.delivery_address or {}
    cust_lat = addr.get("latitude")
    cust_lng = addr.get("longitude")

    dist, suggestion, explanation = delivery_service.evaluate_delivery_suggestion(cust_lat, cust_lng)

    return DistanceCalculationResponse(
        order_id=order_id,
        store_coordinates={
            "latitude": delivery_service.store_settings["store_latitude"],
            "longitude": delivery_service.store_settings["store_longitude"]
        },
        customer_coordinates={
            "latitude": cust_lat,
            "longitude": cust_lng
        } if cust_lat is not None and cust_lng is not None else None,
        distance_km=dist,
        suggested_method=suggestion,
        explanation=explanation
    )

@router.post("/orders/{order_id}/select-method", response_model=ShipmentRecordResponse)
async def select_delivery_method(
    order_id: str,
    req: DeliveryMethodSelectionRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin selects delivery fulfillment mode (DIRECT_DELIVERY or COURIER).
    Branches order status to:
    - DIRECT_DELIVERY -> READY_FOR_DELIVERY
    - COURIER -> COURIER_ASSIGNED
    """
    raw_order = order_store.orders.get(order_id)
    if not raw_order:
        raise HTTPException(status_code=404, detail="Order not found")

    shipment = await delivery_service.select_delivery_method(raw_order, req, admin_id=current_admin.id)

    # Transition order status to match shipment branch
    target_status = "READY_FOR_DELIVERY" if req.delivery_type == "DIRECT_DELIVERY" else "COURIER_ASSIGNED"
    if raw_order["status"] != target_status:
        raw_order["status"] = target_status
        raw_order["status_history"].append({
            "id": f"osh-dlv-{order_id[:6]}",
            "order_id": order_id,
            "previous_status": raw_order.get("status"),
            "new_status": target_status,
            "comment": f"Delivery method chosen: {req.delivery_type}. Notes: {req.notes or 'None'}",
            "changed_by": current_admin.id,
            "created_at": shipment.created_at
        })

    return shipment

@router.patch("/orders/{order_id}/direct-status", response_model=ShipmentRecordResponse)
async def update_direct_delivery_status(
    order_id: str,
    req: DirectDeliveryUpdateRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Direct delivery status progression:
    READY_FOR_DELIVERY -> OUT_FOR_DELIVERY -> DELIVERED.
    Updates order state, logs timestamps and optional delivery proof.
    """
    raw_order = order_store.orders.get(order_id)
    if not raw_order:
        raise HTTPException(status_code=404, detail="Order not found")

    shipment = await delivery_service.update_direct_delivery_status(order_id, req, admin_id=current_admin.id)
    
    # Sync with main order status transition engine
    await order_store.update_order_status(
        order_id=order_id,
        new_status=req.status,
        admin_id=current_admin.id,
        comment=f"Direct delivery updated to {req.status}"
    )

    return shipment

@router.post("/orders/{order_id}/courier-shipment", response_model=ShipmentRecordResponse)
async def create_courier_shipment(
    order_id: str,
    req: CourierShipmentCreateRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Creates/updates courier shipment record with AWB tracking number,
    courier company, receipt image URL, and dispatches order (SHIPPED).
    """
    raw_order = order_store.orders.get(order_id)
    if not raw_order:
        raise HTTPException(status_code=404, detail="Order not found")

    shipment = await delivery_service.create_courier_shipment(order_id, req, admin_id=current_admin.id)

    # Transition order status to SHIPPED
    if raw_order["status"] != "SHIPPED":
        await order_store.update_order_status(
            order_id=order_id,
            new_status="SHIPPED",
            admin_id=current_admin.id,
            comment=f"Shipped via {req.courier_name} (AWB: {req.tracking_number})"
        )

    return shipment

@router.patch("/orders/{order_id}/courier-status", response_model=ShipmentRecordResponse)
async def update_courier_status(
    order_id: str,
    req: CourierStatusUpdateRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Advances courier status: SHIPPED -> COURIER_TRACKING -> DELIVERED.
    """
    raw_order = order_store.orders.get(order_id)
    if not raw_order:
        raise HTTPException(status_code=404, detail="Order not found")

    shipment = await delivery_service.update_courier_status(order_id, req, admin_id=current_admin.id)

    # Sync with order status
    await order_store.update_order_status(
        order_id=order_id,
        new_status=req.status,
        admin_id=current_admin.id,
        comment=req.event_description or f"Courier shipment advanced to {req.status}"
    )

    return shipment

@router.post("/upload-receipt")
async def upload_courier_receipt(
    file: UploadFile = File(...),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Securely uploads courier consignment receipt photo to Supabase Storage.
    Validates file format and size.
    """
    public_url, storage_path = await validate_and_upload_image(file)
    return {
        "receipt_image_url": public_url,
        "receipt_storage_path": storage_path,
        "filename": file.filename
    }

@router.get("/orders/{order_id}/whatsapp", response_model=WhatsAppMessageResponse)
async def get_whatsapp_notification(
    order_id: str,
    event: str = Query("SHIPPED_COURIER", description="Notification event type"),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Generates pre-filled WhatsApp notification message and wa.me direct share link
    for 1-click customer dispatch notifications.
    """
    raw_order = order_store.orders.get(order_id)
    if not raw_order:
        raise HTTPException(status_code=404, detail="Order not found")

    shipment_resp = await delivery_service.get_order_shipment(order_id)
    shipment_dict = shipment_resp.model_dump() if shipment_resp else None

    return delivery_service.generate_whatsapp_notification(
        order=raw_order,
        event_type=event,
        shipment=shipment_dict
    )

# =============================================================================
# CUSTOMER SHIPMENT & TRACKING ENDPOINTS
# =============================================================================

@router.get("/orders/{order_id}/tracking", response_model=ShipmentRecordResponse)
async def get_order_tracking(
    order_id: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Customer views live shipment details, courier receipt image, tracking link,
    or direct delivery status.
    """
    raw_order = order_store.orders.get(order_id)
    if not raw_order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Authorize: user must own order unless admin
    if raw_order["user_id"] != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized access to order tracking")

    shipment = await delivery_service.get_order_shipment(order_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment information not yet available for this order.")

    return shipment

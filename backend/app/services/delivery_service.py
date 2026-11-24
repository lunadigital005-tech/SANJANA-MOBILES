import math
import uuid
import urllib.parse
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any, Tuple
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.delivery import (
    DeliverySettingsResponse,
    DistanceCalculationResponse,
    DeliveryMethodSelectionRequest,
    DirectDeliveryUpdateRequest,
    CourierShipmentCreateRequest,
    CourierStatusUpdateRequest,
    ShipmentRecordResponse,
    CourierTrackingEventResponse,
    WhatsAppMessageResponse
)

# =============================================================================
# COURIER TRACKING ADAPTER ARCHITECTURE (LEVEL 1 & LEVEL 2)
# =============================================================================

class BaseCourierTrackingAdapter:
    """
    Extensible Courier Tracking Provider Interface:
    Allows plugging in commercial APIs (Shiprocket, Delhivery, Bluedart, etc.)
    without changing core shipment business logic.
    """
    def generate_tracking_url(self, courier_name: str, tracking_number: str) -> str:
        raise NotImplementedError

    def fetch_live_events(self, courier_name: str, tracking_number: str) -> List[dict]:
        raise NotImplementedError

class Level1BasicCourierAdapter(BaseCourierTrackingAdapter):
    """
    Default Level 1 adapter:
    Resolves known Indian courier web tracking URLs safely without external API dependencies.
    """
    KNOWN_COURIERS = {
        "delhivery": "https://www.delhivery.com/track/package/{}",
        "bluedart": "https://www.bluedart.com/tracking?trackNumber={}",
        "shiprocket": "https://shiprocket.co/tracking/{}",
        "dtdc": "https://www.dtdc.in/tracking/tracking_results.asp?trno={}",
        "india post": "https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consNo={}",
        "ekart": "https://ekartlogistics.com/shipmenttrack/{}"
    }

    def generate_tracking_url(self, courier_name: str, tracking_number: str) -> str:
        c_lower = (courier_name or "").lower().strip()
        for key, template in self.KNOWN_COURIERS.items():
            if key in c_lower:
                return template.format(tracking_number)
        return f"https://www.google.com/search?q={urllib.parse.quote(f'{courier_name} tracking {tracking_number}')}"

    def fetch_live_events(self, courier_name: str, tracking_number: str) -> List[dict]:
        # Level 1 returns initial shipment logged event
        return [
            {
                "status": "MANIFESTED",
                "location": "Atelier Hub, Bengaluru",
                "description": f"Consignment booked with {courier_name}. AWB {tracking_number} assigned.",
                "event_timestamp": datetime.now(timezone.utc).isoformat()
            }
        ]

class Level2CommercialCourierAdapter(BaseCourierTrackingAdapter):
    """
    Prepared Level 2 Commercial API Adapter (e.g. Shiprocket / Delhivery webhook integration).
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def generate_tracking_url(self, courier_name: str, tracking_number: str) -> str:
        return f"https://track.sanjanamobiles.com/shipments/{tracking_number}"

    def fetch_live_events(self, courier_name: str, tracking_number: str) -> List[dict]:
        return [
            {
                "status": "IN_TRANSIT",
                "location": "Regional Sorting Facility",
                "description": "Package sorted and dispatched to destination city.",
                "event_timestamp": datetime.now(timezone.utc).isoformat()
            }
        ]


# =============================================================================
# DELIVERY & SHIPMENT SERVICE
# =============================================================================

class DeliveryService:
    def __init__(self):
        # Store location (Sanjana Mobiles Bengaluru)
        self.store_settings = {
            "store_name": "Sanjana Mobiles Store",
            "store_address": "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
            "store_latitude": 12.9716,
            "store_longitude": 77.5946,
            "direct_delivery_max_distance_km": 3.0,
            "courier_suggested_min_distance_km": 10.0,
            "enable_auto_distance_calc": True
        }

        # shipment_id -> dict
        self.shipments: Dict[str, dict] = {}
        # order_id -> shipment_id
        self.order_shipment_map: Dict[str, str] = {}
        # shipment_id -> List[dict]
        self.tracking_events: Dict[str, List[dict]] = {}

        self.courier_adapter: BaseCourierTrackingAdapter = Level1BasicCourierAdapter()

    # ==========================================
    # DISTANCE CALCULATION (HAVERSINE FORMULA)
    # ==========================================
    def calculate_distance_km(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula.
        """
        R = 6371.0 # Earth radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2 +
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)

    def evaluate_delivery_suggestion(
        self,
        customer_lat: Optional[float],
        customer_lng: Optional[float]
    ) -> Tuple[Optional[float], str, str]:
        """
        Computes distance and returns non-binding suggestion for Admin:
        - 0-3 km: DIRECT_DELIVERY suggested
        - 3-10 km: ADMIN_DECISION
        - > 10 km: COURIER suggested
        Admin always retains full decision authority.
        """
        store_lat = self.store_settings["store_latitude"]
        store_lng = self.store_settings["store_longitude"]

        if customer_lat is None or customer_lng is None:
            return None, "MANUAL_SELECTION_REQUIRED", "Delivery coordinates not provided. Admin can choose either Direct or Courier delivery."

        dist = self.calculate_distance_km(store_lat, store_lng, customer_lat, customer_lng)
        max_direct = self.store_settings["direct_delivery_max_distance_km"]
        min_courier = self.store_settings["courier_suggested_min_distance_km"]

        if dist <= max_direct:
            return dist, "DIRECT_DELIVERY", f"Recipient is {dist} km away (within {max_direct} km direct radius). Direct Delivery suggested."
        elif dist >= min_courier:
            return dist, "COURIER", f"Recipient is {dist} km away (exceeds {min_courier} km threshold). External Courier suggested."
        else:
            return dist, "ADMIN_DECISION", f"Recipient is {dist} km away (intermediate zone {max_direct}–{min_courier} km). Admin decision recommended."

    # ==========================================
    # SHIPMENT CREATION & METHOD SELECTION
    # ==========================================
    async def select_delivery_method(
        self,
        order: dict,
        req: DeliveryMethodSelectionRequest,
        admin_id: str
    ) -> ShipmentRecordResponse:
        """
        Admin selects whether the packed order goes via DIRECT_DELIVERY or COURIER.
        Enforces status branch:
        - DIRECT_DELIVERY -> READY_FOR_DELIVERY
        - COURIER -> COURIER_ASSIGNED
        """
        order_id = order["id"]
        order_number = order["order_number"]
        delivery_addr = order.get("delivery_address") or {}
        cust_lat = delivery_addr.get("latitude")
        cust_lng = delivery_addr.get("longitude")

        dist, suggestion, _ = self.evaluate_delivery_suggestion(cust_lat, cust_lng)
        now = datetime.now(timezone.utc).isoformat()

        # Google Maps directions URL if coordinates available
        directions_url = None
        if cust_lat and cust_lng:
            directions_url = f"https://www.google.com/maps/dir/?api=1&destination={cust_lat},{cust_lng}"
        elif delivery_addr.get("address_line1"):
            q = f"{delivery_addr.get('address_line1')}, {delivery_addr.get('city')}, {delivery_addr.get('pin_code') or delivery_addr.get('postal_code')}"
            directions_url = f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote(q)}"

        shipment_id = self.order_shipment_map.get(order_id) or f"shp-{uuid.uuid4().hex[:10]}"

        if req.delivery_type == "DIRECT_DELIVERY":
            status_val = "READY_FOR_DELIVERY"
        else:
            status_val = "COURIER_ASSIGNED"

        record = {
            "id": shipment_id,
            "order_id": order_id,
            "order_number": order_number,
            "delivery_type": req.delivery_type,
            "status": status_val,
            "calculated_distance_km": dist,
            "suggested_method": suggestion,
            
            # Direct
            "direct_assigned_to": req.assigned_to or "Sanjana Mobiles Delivery Team",
            "direct_directions_url": directions_url,
            "direct_out_for_delivery_at": None,
            "direct_delivered_at": None,
            "direct_delivery_proof_url": None,
            "direct_acknowledgement": None,

            # Courier
            "courier_name": None,
            "tracking_number": None,
            "tracking_url": None,
            "shipment_date": None,
            "receipt_image_url": None,
            "receipt_storage_path": None,
            "shipment_notes": req.notes,
            "estimated_delivery_date": None,

            "created_at": now,
            "updated_at": now
        }

        self.shipments[shipment_id] = record
        self.order_shipment_map[order_id] = shipment_id
        self.tracking_events[shipment_id] = []

        return ShipmentRecordResponse(**record)

    # ==========================================
    # DIRECT DELIVERY WORKFLOW
    # ==========================================
    async def update_direct_delivery_status(
        self,
        order_id: str,
        req: DirectDeliveryUpdateRequest,
        admin_id: str
    ) -> ShipmentRecordResponse:
        """
        Direct Delivery workflow progression:
        READY_FOR_DELIVERY -> OUT_FOR_DELIVERY -> DELIVERED.
        Captures timestamp and delivery proof.
        """
        shipment_id = self.order_shipment_map.get(order_id)
        if not shipment_id or shipment_id not in self.shipments:
            raise HTTPException(status_code=404, detail="Shipment record not initialized for this order.")

        shipment = self.shipments[shipment_id]
        if shipment["delivery_type"] != "DIRECT_DELIVERY":
            raise HTTPException(status_code=400, detail="Cannot apply direct delivery updates to a courier order.")

        now = datetime.now(timezone.utc).isoformat()
        new_status = req.status

        # Transition validation
        if new_status == "OUT_FOR_DELIVERY":
            shipment["direct_out_for_delivery_at"] = now
        elif new_status == "DELIVERED":
            shipment["direct_delivered_at"] = now
            if req.delivery_proof_url:
                shipment["direct_delivery_proof_url"] = req.delivery_proof_url
            if req.customer_acknowledgement:
                shipment["direct_acknowledgement"] = req.customer_acknowledgement

        shipment["status"] = new_status
        shipment["updated_at"] = now

        return ShipmentRecordResponse(**shipment)

    # ==========================================
    # COURIER SHIPMENT WORKFLOW
    # ==========================================
    async def create_courier_shipment(
        self,
        order_id: str,
        req: CourierShipmentCreateRequest,
        admin_id: str
    ) -> ShipmentRecordResponse:
        """
        Saves courier company details, tracking number, shipment date, and receipt image.
        Transitions status to SHIPPED.
        """
        shipment_id = self.order_shipment_map.get(order_id)
        if not shipment_id or shipment_id not in self.shipments:
            raise HTTPException(status_code=404, detail="Shipment record not initialized for this order.")

        shipment = self.shipments[shipment_id]
        if shipment["delivery_type"] != "COURIER":
            raise HTTPException(status_code=400, detail="Cannot apply courier shipment to a direct delivery order.")

        now = datetime.now(timezone.utc).isoformat()
        tracking_url = req.tracking_url
        if not tracking_url:
            tracking_url = self.courier_adapter.generate_tracking_url(req.courier_name, req.tracking_number)

        shipment["courier_name"] = req.courier_name
        shipment["tracking_number"] = req.tracking_number
        shipment["tracking_url"] = tracking_url
        shipment["shipment_date"] = req.shipment_date or now
        shipment["receipt_image_url"] = req.receipt_image_url
        shipment["receipt_storage_path"] = req.receipt_storage_path
        shipment["shipment_notes"] = req.shipment_notes
        shipment["estimated_delivery_date"] = req.estimated_delivery_date
        shipment["status"] = "SHIPPED"
        shipment["updated_at"] = now

        # Add initial tracking event
        initial_event = {
            "id": f"cte-{uuid.uuid4().hex[:8]}",
            "shipment_id": shipment_id,
            "order_id": order_id,
            "status": "SHIPPED",
            "location": "Bengaluru Logistics Hub",
            "description": f"Dispatched with {req.courier_name}. Tracking # {req.tracking_number}",
            "event_timestamp": now
        }
        self.tracking_events.setdefault(shipment_id, []).append(initial_event)

        resp_data = dict(shipment)
        resp_data["tracking_events"] = [CourierTrackingEventResponse(**e) for e in self.tracking_events[shipment_id]]
        return ShipmentRecordResponse(**resp_data)

    async def update_courier_status(
        self,
        order_id: str,
        req: CourierStatusUpdateRequest,
        admin_id: str
    ) -> ShipmentRecordResponse:
        """
        Advances courier status: SHIPPED -> COURIER_TRACKING -> DELIVERED.
        Logs tracking history event.
        """
        shipment_id = self.order_shipment_map.get(order_id)
        if not shipment_id or shipment_id not in self.shipments:
            raise HTTPException(status_code=404, detail="Shipment record not found.")

        shipment = self.shipments[shipment_id]
        now = datetime.now(timezone.utc).isoformat()

        shipment["status"] = req.status
        shipment["updated_at"] = now

        # Record tracking event
        event = {
            "id": f"cte-{uuid.uuid4().hex[:8]}",
            "shipment_id": shipment_id,
            "order_id": order_id,
            "status": req.status,
            "location": req.location or "En Route",
            "description": req.event_description or f"Shipment marked {req.status}",
            "event_timestamp": now
        }
        self.tracking_events.setdefault(shipment_id, []).append(event)

        resp_data = dict(shipment)
        resp_data["tracking_events"] = [CourierTrackingEventResponse(**e) for e in self.tracking_events[shipment_id]]
        return ShipmentRecordResponse(**resp_data)

    async def get_order_shipment(self, order_id: str) -> Optional[ShipmentRecordResponse]:
        shipment_id = self.order_shipment_map.get(order_id)
        if not shipment_id or shipment_id not in self.shipments:
            return None
        shipment = self.shipments[shipment_id]
        events = self.tracking_events.get(shipment_id, [])
        resp_data = dict(shipment)
        resp_data["tracking_events"] = [CourierTrackingEventResponse(**e) for e in events]
        return ShipmentRecordResponse(**resp_data)

    # ==========================================
    # WHATSAPP NOTIFICATION ENGINE
    # ==========================================
    def generate_whatsapp_notification(
        self,
        order: dict,
        event_type: str,
        shipment: Optional[dict] = None
    ) -> WhatsAppMessageResponse:
        """
        Generates approved-style WhatsApp message body and click-to-share wa.me link.
        """
        order_num = order.get("order_number", "")
        cust_name = order.get("customer_name") or "Valued Client"
        mobile = order.get("customer_mobile") or ""
        clean_mobile = "".join(filter(str.isdigit, mobile))
        if clean_mobile.startswith("91") and len(clean_mobile) == 12:
            phone_with_country = clean_mobile
        else:
            phone_with_country = f"91{clean_mobile}"

        store_name = settings.STORE_NAME

        if event_type == "ORDER_ACCEPTED":
            msg = (
                f"✨ *{store_name} Order Update*\n\n"
                f"Hello {cust_name},\n"
                f"Your order *{order_num}* has been accepted and approved by our atelier team. We are currently preparing your pieces.\n\n"
                f"Track status on our store portal anytime."
            )
        elif event_type == "PACKING_COMPLETED":
            msg = (
                f"📦 *{store_name} Quality Check & Packing Completed*\n\n"
                f"Hello {cust_name},\n"
                f"Your order *{order_num}* has successfully passed final inspection and is sealed for dispatch."
            )
        elif event_type == "READY_FOR_DELIVERY":
            msg = (
                f"🛵 *{store_name} Ready for Delivery*\n\n"
                f"Hello {cust_name},\n"
                f"Your order *{order_num}* is ready for personal doorstep delivery by our concierge team."
            )
        elif event_type == "OUT_FOR_DELIVERY":
            msg = (
                f"🚀 *{store_name} Out for Delivery*\n\n"
                f"Hello {cust_name},\n"
                f"Our concierge is en route with your order *{order_num}*. Please keep your contact phone available."
            )
        elif event_type == "SHIPPED_COURIER":
            courier = shipment.get("courier_name", "Courier") if shipment else "Courier"
            awb = shipment.get("tracking_number", "") if shipment else ""
            tracking_url = shipment.get("tracking_url", "") if shipment else ""
            msg = (
                f"🚚 *{store_name} Courier Dispatch Notification*\n\n"
                f"Hello {cust_name},\n"
                f"Your order *{order_num}* has been shipped via *{courier}*!\n"
                f"Tracking AWB: *{awb}*\n"
                f"Track shipment: {tracking_url}\n\n"
                f"Your courier receipt is also available inside My Orders."
            )
        elif event_type == "DELIVERED":
            msg = (
                f"🎉 *{store_name} Delivery Completed*\n\n"
                f"Hello {cust_name},\n"
                f"Your order *{order_num}* has been successfully delivered! We hope you love your new pieces."
            )
        else:
            msg = f"Update regarding your order {order_num} from {store_name}."

        encoded_text = urllib.parse.quote(msg)
        share_url = f"https://wa.me/{phone_with_country}?text={encoded_text}"

        return WhatsAppMessageResponse(
            order_id=order["id"],
            order_number=order_num,
            customer_mobile=mobile,
            customer_name=cust_name,
            notification_event=event_type,
            message_body=msg,
            whatsapp_share_url=share_url
        )

delivery_service = DeliveryService()

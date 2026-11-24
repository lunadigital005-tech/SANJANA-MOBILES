# LUNA Delivery, Courier & Shipment Management Documentation

---

## 1. Overview & Fulfillment Models

LUNA provides three distinct fulfillment pathways to balance speed, cost, and geographical range:

1. **Store Pickup**: Customer collects their package directly at the retail outlet. No shipping address is required; customer provides pickup person name and mobile number.
2. **Direct Local Store Delivery**: For customers located within a configurable radius (e.g. 10 km) of the physical retail store. Fulfilled directly via internal delivery staff.
3. **Courier Partner Delivery**: For inter-city, state, and nationwide orders. Integrated with Indian logistics providers (Delhivery, BlueDart, DTDC, India Post).

---

## 2. Spatial Calculation: The Haversine Formula

To determine whether an order qualifies for Direct Local Store Delivery, the backend computes the great-circle distance between the store coordinates and the customer's delivery location using the Haversine formula:

$$\Delta\sigma = 2\arcsin\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1\cos\phi_2\sin^2\left(\frac{\Delta\lambda}{2}\right)}$$

$$d = R \cdot \Delta\sigma$$

Where $R = 6371.0\text{ km}$ (Earth's mean radius), $\phi$ is latitude in radians, and $\lambda$ is longitude in radians.

### Python Implementation (`services/delivery_service.py`)
```python
import math

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Earth's radius in kilometers
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    return round(R * c, 2)
```

If $d \le 10.0\text{ km}$, `delivery_type` is assigned as `DIRECT_DELIVERY` (same-day delivery). Otherwise, it defaults to `COURIER`.

---

## 3. Shipping Charges Policy

Shipping fees are calculated server-side during cart evaluation:
- **Store Pickup**: Always **₹0.00**.
- **Home Delivery**:
  - Free delivery threshold: Orders where `subtotal >= ₹500.00` qualify for **Free Delivery**.
  - Flat shipping fee: Orders below ₹500 incur a standard charge of **₹50.00**.

---

## 4. Courier Shipment Management & Receipt Upload

For orders fulfilled via third-party couriers, administrators assign shipment credentials in the admin console (`POST /api/v1/admin/delivery/assign-courier`):

- `order_id`: UUID of the order.
- `courier_partner`: e.g. "Delhivery", "BlueDart", "DTDC", "SpeedPost".
- `tracking_number`: Waybill / AWB tracking code.
- `tracking_url`: Direct public tracking link.
- `dispatch_receipt`: Optional uploaded image of the physical courier receipt (stored in Supabase Storage bucket `delivery-receipts`).

---

## 5. Order Milestones & Tracking Drawer

Customers can track their order status in real time from `OrdersPage.tsx`:

```
[1. NEW]         -> Order submitted, awaiting confirmation
      |
[2. CONFIRMED]   -> Payment verified, inventory committed
      |
[3. PACKED]      -> Parcel boxed and labeled at store/warehouse
      |
[4. DISPATCHED]  -> Out for direct delivery or handed over to courier
      |
[5. DELIVERED]   -> Package received by customer, loyalty coins awarded
```

Each transition is timestamped and recorded in `order_tracking`.

---

## 6. WhatsApp Notification Generator

To provide instant mobile updates, LUNA includes a notification generator that formats ready-to-send WhatsApp messages with encoded deep links:

```
Hello Aarav! 🌟
Your LUNA Order #ord-2026-9812 has been DISPATCHED via Delhivery.
Tracking Number: DEL987654321
Track your order here: https://luna-store.com/orders?id=ord-2026-9812

Thank you for shopping with LUNA!
```
Administrators can trigger WhatsApp dispatch alerts directly from the order operations drawer with a single click.

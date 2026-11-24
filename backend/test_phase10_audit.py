import uuid
import hmac
import hashlib
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.order_store import order_store
from app.services.catalog_store import catalog_store
from app.services.rewards_store import rewards_store
from app.services.delivery_service import delivery_service
from app.services.razorpay_service import razorpay_service

client = TestClient(app)

CUSTOMER_HEADERS = {"Authorization": "Bearer customer-audit-user"}
ADMIN_HEADERS = {"Authorization": "Bearer admin-audit-user"}
OTHER_CUSTOMER_HEADERS = {"Authorization": "Bearer customer-other-user"}


# =============================================================================
# 1. SECURITY & AUTHORIZATION AUDIT TESTS
# =============================================================================

def test_security_headers_present():
    """Verify that all API responses include essential HTTP security headers."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert "1; mode=block" in response.headers.get("x-xss-protection", "")


def test_authentication_guards_protected_endpoints():
    """Unauthenticated requests must be rejected with 401 Unauthorized."""
    endpoints = [
        ("GET", "/api/v1/cart"),
        ("GET", "/api/v1/customer/profile"),
        ("GET", "/api/v1/customer/addresses"),
        ("GET", "/api/v1/customer/orders"),
        ("GET", "/api/v1/rewards/wallet"),
        ("GET", "/api/v1/admin/orders/summary"),
        ("GET", "/api/v1/admin/inventory"),
        ("GET", "/api/v1/admin/refunds"),
        ("GET", "/api/v1/rewards/admin/overview"),
        ("GET", "/api/v1/delivery/settings")
    ]
    for method, ep in endpoints:
        res = client.request(method, ep)
        assert res.status_code == 401, f"Expected 401 for unauthenticated {method} {ep}"


def test_role_based_access_control_admin_privilege():
    """Customers attempting to access administrative endpoints must receive 403 Forbidden."""
    admin_endpoints = [
        ("GET", "/api/v1/admin/orders/summary"),
        ("GET", "/api/v1/admin/inventory"),
        ("GET", "/api/v1/admin/refunds"),
        ("GET", "/api/v1/rewards/admin/overview"),
        ("GET", "/api/v1/rewards/admin/settings"),
        ("GET", "/api/v1/delivery/settings")
    ]
    for method, ep in admin_endpoints:
        res = client.request(method, ep, headers=CUSTOMER_HEADERS)
        assert res.status_code == 403, f"Expected 403 Forbidden for customer on {method} {ep}"


def test_customer_data_isolation():
    """Customer A cannot view Customer B's order details."""
    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 20, "reserved_quantity": 0, "low_stock_threshold": 5}

    # Customer A places an order
    res = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Customer A",
        "pickup_person_phone": "+91 9123456789"
    }, headers=CUSTOMER_HEADERS)
    assert res.status_code == 200
    order_id = res.json()["order_id"]

    # Customer B attempts to access Customer A's order
    cross_access_res = client.get(f"/api/v1/customer/orders/{order_id}", headers=OTHER_CUSTOMER_HEADERS)
    assert cross_access_res.status_code == 403


# =============================================================================
# 2. END-TO-END CUSTOMER & CHECKOUT AUDIT
# =============================================================================

def test_full_customer_shopping_and_pricing_integrity():
    """Tests product listing, price calculation, server-side pricing verification, and checkout."""
    # 1. Product search & category check
    products_res = client.get("/api/v1/products?limit=5")
    assert products_res.status_code == 200
    assert len(products_res.json()["items"]) > 0

    # 2. Server-side cart calculation
    prod_id = list(catalog_store.products.keys())[0]
    product = catalog_store.products[prod_id]
    expected_unit = product.get("sale_price") or product.get("price")

    calc_res = client.post("/api/v1/cart/calculate", json={
        "items": [{"product_id": prod_id, "quantity": 2}],
        "delivery_method": "HOME_DELIVERY"
    })
    assert calc_res.status_code == 200
    calc_data = calc_res.json()
    assert calc_data["subtotal"] == round(expected_unit * 2, 2)
    assert calc_data["final_total"] >= calc_data["subtotal"]

    # 3. Customer Address Validation (Indian PIN & Mobile)
    addr_res = client.post("/api/v1/customer/addresses", json={
        "full_name": "Audit Customer",
        "mobile_number": "9876543210",
        "address_line1": "Atelier Residency, Indiranagar",
        "city": "Bengaluru",
        "district": "Bengaluru Urban",
        "state": "Karnataka",
        "pin_code": "560038",
        "country": "India",
        "latitude": 12.9716,
        "longitude": 77.5946
    }, headers=CUSTOMER_HEADERS)
    assert addr_res.status_code == 201
    addr_id = addr_res.json()["id"]

    # 4. Initiate checkout session
    checkout_res = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id
    }, headers=CUSTOMER_HEADERS)
    assert checkout_res.status_code == 200
    order_data = checkout_res.json()
    assert order_data["amount"] > 0
    assert order_data["razorpay_order_id"].startswith("order_")


# =============================================================================
# 3. PAYMENT GATEWAY, SIGNATURE & WEBHOOK AUDIT
# =============================================================================

def test_cryptographic_signature_verification_and_tampering_defense():
    """Verify cryptographic HMAC-SHA256 signature check rejects tampered payloads."""
    # Place order
    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 20, "reserved_quantity": 0, "low_stock_threshold": 5}

    co_res = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Sig Tester",
        "pickup_person_phone": "+91 9888877777"
    }, headers=CUSTOMER_HEADERS)
    assert co_res.status_code == 200
    order_info = co_res.json()
    order_id = order_info["order_id"]
    rzp_order_id = order_info["razorpay_order_id"]
    fake_payment_id = "pay_audit_test_99"

    # 1. Invalid / tampered signature must be rejected
    tampered_res = client.post("/api/v1/checkout/verify", json={
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": fake_payment_id,
        "razorpay_signature": "tampered_fake_signature_abc123"
    }, headers=CUSTOMER_HEADERS)
    assert tampered_res.status_code == 400

    # 2. Genuine cryptographic signature must be accepted
    secret = settings.RAZORPAY_KEY_SECRET.encode("utf-8")
    payload = f"{rzp_order_id}|{fake_payment_id}".encode("utf-8")
    valid_sig = hmac.new(secret, payload, hashlib.sha256).hexdigest()

    verify_res = client.post("/api/v1/checkout/verify", json={
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": fake_payment_id,
        "razorpay_signature": valid_sig
    }, headers=CUSTOMER_HEADERS)
    assert verify_res.status_code == 200
    assert verify_res.json()["payment_status"] == "PAID"
    assert verify_res.json()["order_status"] == "NEW"

    # 3. Idempotent check: submitting verification again returns recorded success
    idemp_res = client.post("/api/v1/checkout/verify", json={
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": fake_payment_id,
        "razorpay_signature": valid_sig
    }, headers=CUSTOMER_HEADERS)
    assert idemp_res.status_code == 200


def test_idempotent_webhook_processing():
    """Webhook events with identical event_id must be processed once and safely ignored on retransmission."""
    event_id = f"evt_audit_{uuid.uuid4().hex[:8]}"
    raw_payload = f'{{"id": "{event_id}", "event": "payment.captured", "payload": {{"payment": {{"entity": {{"id": "pay_wh_123", "order_id": "order_none"}}}}}}}}'.encode("utf-8")
    
    # Compute signature
    wh_secret = settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8")
    sig = hmac.new(wh_secret, raw_payload, hashlib.sha256).hexdigest()

    # First delivery
    res1 = client.post(
        "/api/v1/payments/webhook",
        content=raw_payload,
        headers={"X-Razorpay-Signature": sig}
    )
    assert res1.status_code == 200

    # Second delivery (duplicate retransmission)
    res2 = client.post(
        "/api/v1/payments/webhook",
        content=raw_payload,
        headers={"X-Razorpay-Signature": sig}
    )
    assert res2.status_code == 200
    assert "already processed" in res2.json().get("message", "")


# =============================================================================
# 4. INVENTORY CONCURRENCY & OVERSELLING PREVENTION
# =============================================================================

def test_inventory_overselling_and_conflict_defense():
    """Attempting to checkout more stock than available triggers a 409 Conflict."""
    prod_id = list(catalog_store.products.keys())[0]
    # Set strictly to 1 unit
    catalog_store.inventory[prod_id] = {"available_quantity": 1, "reserved_quantity": 0, "low_stock_threshold": 5}

    # Attempting to order 5 units must fail
    conflict_res = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": prod_id, "quantity": 5}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Greedy Buyer",
        "pickup_person_phone": "+91 9999988888"
    }, headers=CUSTOMER_HEADERS)
    assert conflict_res.status_code in [400, 409]


# =============================================================================
# 5. ORDER LIFECYCLE, STATUS FLOW & REFUND INTEGRITY
# =============================================================================

def test_order_rejection_restores_inventory_and_issues_refund():
    """Rejecting a paid order restores catalog stock, logs movements, and issues a full refund."""
    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 10, "reserved_quantity": 0, "low_stock_threshold": 5}

    co_res = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": prod_id, "quantity": 2}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Reject Tester",
        "pickup_person_phone": "+91 9777766666"
    }, headers=CUSTOMER_HEADERS)
    order_id = co_res.json()["order_id"]

    # Mark as PAID
    order_store.orders[order_id]["payment_status"] = "PAID"
    order_store.orders[order_id]["status"] = "NEW"
    order_store.orders[order_id]["razorpay_payment_id"] = "pay_for_refund_test"

    # Reject order
    reject_res = client.post(f"/api/v1/admin/orders/{order_id}/reject", json={
        "rejection_reason": "Product damaged",
        "rejection_notes": "Identified scratch during quality audit",
        "initiate_refund": True
    }, headers=ADMIN_HEADERS)
    assert reject_res.status_code == 200
    rejected_order = reject_res.json()
    assert rejected_order["status"] == "REJECTED"
    assert rejected_order["payment_status"] == "REFUNDED"
    assert rejected_order["rejection_reason"] == "Product damaged"

    # Verify inventory was restored
    assert catalog_store.inventory[prod_id]["available_quantity"] == 10


def test_partial_refund_limits():
    """Partial refunds cannot exceed the remaining order total."""
    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 10, "reserved_quantity": 0, "low_stock_threshold": 5}

    co_res = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Partial Refund Tester",
        "pickup_person_phone": "+91 9666655555"
    }, headers=CUSTOMER_HEADERS)
    order_id = co_res.json()["order_id"]
    order_total = order_store.orders[order_id]["total_amount"]

    order_store.orders[order_id]["payment_status"] = "PAID"
    order_store.orders[order_id]["razorpay_payment_id"] = "pay_partial_test"

    # Refund 50%
    half_refund = round(order_total / 2, 2)
    ref_res1 = client.post("/api/v1/admin/refunds/initiate", json={
        "order_id": order_id,
        "amount": half_refund,
        "reason": "Customer goodwill concession"
    }, headers=ADMIN_HEADERS)
    assert ref_res1.status_code == 200
    assert order_store.orders[order_id]["payment_status"] == "PARTIALLY_REFUNDED"

    # Attempting to refund more than remaining must fail
    exceed_res = client.post("/api/v1/admin/refunds/initiate", json={
        "order_id": order_id,
        "amount": order_total, # Exceeds remaining
        "reason": "Exceeding refund"
    }, headers=ADMIN_HEADERS)
    assert exceed_res.status_code == 400

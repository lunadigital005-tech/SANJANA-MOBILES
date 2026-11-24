import pytest
import hmac
import hashlib
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

CUSTOMER_HEADERS = {"Authorization": "Bearer mock-customer-token"}
ADMIN_HEADERS = {"Authorization": "Bearer mock-admin-token"}

def get_auth_headers():
    return CUSTOMER_HEADERS

def get_admin_headers():
    return ADMIN_HEADERS

# =============================================================================
# 1. CART TESTS & SERVER-SIDE PRICE CALCULATION
# =============================================================================

def test_cart_calculation_server_side_pricing():
    # Price is derived from catalog, never client
    payload = {
        "items": [
            {"product_id": "prod-01", "quantity": 1} # 890.0
        ],
        "delivery_method": "HOME_DELIVERY"
    }
    resp = client.post("/api/v1/cart/calculate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["subtotal"] == 890.0
    # 890 < 999 threshold -> delivery charge is settings.DEFAULT_DELIVERY_FEE
    assert data["delivery_charge"] == settings.DEFAULT_DELIVERY_FEE
    assert data["final_total"] == round(890.0 + settings.DEFAULT_DELIVERY_FEE, 2)
    assert data["has_unavailable_items"] is False

def test_cart_delivery_charge_threshold_and_store_pickup():
    # 4 units of prod-02 (sale price 320.0) = 1280.0 >= 999.0 (Free delivery)
    payload_free = {
        "items": [
            {"product_id": "prod-02", "quantity": 4}
        ],
        "delivery_method": "HOME_DELIVERY"
    }
    resp = client.post("/api/v1/cart/calculate", json=payload_free)
    assert resp.status_code == 200
    assert resp.json()["subtotal"] == 1280.0
    assert resp.json()["delivery_charge"] == 0.0
    assert resp.json()["final_total"] == 1280.0

    # Store pickup always has 0 delivery charge even under threshold
    payload_pickup = {
        "items": [
            {"product_id": "prod-01", "quantity": 1}
        ],
        "delivery_method": "STORE_PICKUP"
    }
    resp_pickup = client.post("/api/v1/cart/calculate", json=payload_pickup)
    assert resp_pickup.status_code == 200
    assert resp_pickup.json()["delivery_charge"] == 0.0
    assert resp_pickup.json()["final_total"] == 890.0

def test_cart_out_of_stock_detection():
    # prod-05 has 0 available quantity
    payload = {
        "items": [
            {"product_id": "prod-05", "quantity": 1}
        ],
        "delivery_method": "HOME_DELIVERY"
    }
    resp = client.post("/api/v1/cart/calculate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_unavailable_items"] is True
    assert len(data["unavailable_reasons"]) > 0

def test_cart_promo_code_application():
    payload = {
        "items": [
            {"product_id": "prod-01", "quantity": 1} # 890.0
        ],
        "delivery_method": "STORE_PICKUP",
        "promo_code": "LUNA10"
    }
    resp = client.post("/api/v1/cart/calculate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["discount_amount"] == 89.0 # 10% of 890
    assert data["final_total"] == 801.0

# =============================================================================
# 2. INDIAN ADDRESS VALIDATION TESTS
# =============================================================================

def test_valid_indian_address_creation():
    headers = get_auth_headers()
    valid_addr = {
        "full_name": "Rohan Sharma",
        "mobile_number": "9812345678", # 10-digit Indian mobile starting with 9
        "address_line1": "Suite 302, Green Glen Layout",
        "address_line2": "Bellandur Outer Ring Road",
        "city": "Bengaluru",
        "district": "Bengaluru Urban",
        "state": "Karnataka",
        "pin_code": "560103", # 6-digit Indian PIN code
        "country": "India",
        "is_default": False,
        "address_type": "home"
    }
    resp = client.post("/api/v1/customer/addresses", json=valid_addr, headers=headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["pin_code"] == "560103"
    assert data["mobile_number"] == "9812345678"
    assert "id" in data

def test_invalid_indian_mobile_and_pin_rejected():
    headers = get_auth_headers()
    # Invalid mobile (starts with 1)
    bad_mobile = {
        "full_name": "Test User",
        "mobile_number": "1234567890", # Invalid Indian mobile
        "address_line1": "123 Main Road",
        "city": "Mumbai",
        "district": "Mumbai",
        "state": "Maharashtra",
        "pin_code": "400001",
        "country": "India"
    }
    resp = client.post("/api/v1/customer/addresses", json=bad_mobile, headers=headers)
    assert resp.status_code == 422

    # Invalid PIN code (5 digits)
    bad_pin = {
        "full_name": "Test User",
        "mobile_number": "9876543210",
        "address_line1": "123 Main Road",
        "city": "Mumbai",
        "district": "Mumbai",
        "state": "Maharashtra",
        "pin_code": "40001", # Invalid PIN (must be 6 digits)
        "country": "India"
    }
    resp2 = client.post("/api/v1/customer/addresses", json=bad_pin, headers=headers)
    assert resp2.status_code == 422

# =============================================================================
# 3. CHECKOUT & RAZORPAY ORDER GENERATION TESTS
# =============================================================================

def test_checkout_initiation_home_delivery():
    headers = get_auth_headers()
    # First get or create an address
    addr_resp = client.get("/api/v1/customer/addresses", headers=headers)
    addresses = addr_resp.json()
    addr_id = addresses[0]["id"] if addresses else "addr-demo-01"

    checkout_payload = {
        "items": [
            {"product_id": "prod-04", "quantity": 1} # 78.0
        ],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id
    }
    resp = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "order_id" in data
    assert data["order_number"].startswith(("SANJANA-", "SNJ-", "LUNA-"))
    assert data["razorpay_order_id"].startswith("order_")
    # Subtotal 78 + 50 delivery = 128 -> 12800 paise
    assert data["amount_in_paise"] == int(round((78.0 + settings.DEFAULT_DELIVERY_FEE) * 100))
    assert data["currency"] == "INR"

def test_checkout_initiation_store_pickup_no_address_required():
    headers = get_auth_headers()
    checkout_payload = {
        "items": [
            {"product_id": "prod-04", "quantity": 1}
        ],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Aarav Sharma",
        "pickup_person_phone": "9876543210"
    }
    resp = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["delivery_method"] == "STORE_PICKUP"
    assert data["order_number"].startswith(("SANJANA-", "SNJ-", "LUNA-"))
    # Pickup -> 0 delivery charge -> 78.0 = 7800 paise
    assert data["amount_in_paise"] == 7800

# =============================================================================
# 4. PAYMENT SIGNATURE VERIFICATION TESTS
# =============================================================================

def test_payment_verification_success_and_tamper_rejection():
    headers = get_auth_headers()
    # 1. Initiate checkout
    checkout_payload = {
        "items": [{"product_id": "prod-04", "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Priya Nair",
        "pickup_person_phone": "9876543210"
    }
    init_resp = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=headers)
    assert init_resp.status_code == 200
    order_data = init_resp.json()
    
    order_id = order_data["order_id"]
    rzp_order_id = order_data["razorpay_order_id"]
    fake_payment_id = "pay_test_987654321"

    # Compute genuine HMAC-SHA256 signature
    msg = f"{rzp_order_id}|{fake_payment_id}".encode("utf-8")
    secret = settings.RAZORPAY_KEY_SECRET.encode("utf-8")
    valid_signature = hmac.new(secret, msg, hashlib.sha256).hexdigest()

    # Test A: Spoofed / Tampered signature must be rejected
    tampered_payload = {
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": fake_payment_id,
        "razorpay_signature": "tampered_invalid_signature_123"
    }
    tampered_resp = client.post("/api/v1/checkout/verify", json=tampered_payload, headers=headers)
    assert tampered_resp.status_code == 400

    # Test B: Valid signature confirms order
    valid_payload = {
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": fake_payment_id,
        "razorpay_signature": valid_signature
    }
    verify_resp = client.post("/api/v1/checkout/verify", json=valid_payload, headers=headers)
    assert verify_resp.status_code == 200
    verified_data = verify_resp.json()
    assert verified_data["success"] is True
    assert verified_data["payment_status"] == "PAID"
    assert verified_data["order_status"] == "NEW"

# =============================================================================
# 5. ORDER STATUS WORKFLOW TESTS (ADMIN)
# =============================================================================

def test_order_status_progression():
    headers = get_auth_headers()
    admin_headers = get_admin_headers()

    # Create & pay for an order
    init_resp = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": "prod-04", "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Vikram Das",
        "pickup_person_phone": "9876543210"
    }, headers=headers)
    order_data = init_resp.json()
    
    order_id = order_data["order_id"]
    rzp_order_id = order_data["razorpay_order_id"]
    pay_id = "pay_flow_123"
    msg = f"{rzp_order_id}|{pay_id}".encode("utf-8")
    sig = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    client.post("/api/v1/checkout/verify", json={
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": pay_id,
        "razorpay_signature": sig
    }, headers=headers)

    # 1. NEW -> ACCEPTED (via /accept endpoint)
    accept_resp = client.post(f"/api/v1/admin/orders/{order_id}/accept", headers=admin_headers)
    assert accept_resp.status_code == 200
    assert accept_resp.json()["status"] == "ACCEPTED"

    # 2. Invalid jump (ACCEPTED directly to DELIVERY_PENDING) must fail
    invalid_jump = client.patch(f"/api/v1/admin/orders/{order_id}/status", json={
        "new_status": "DELIVERY_PENDING"
    }, headers=admin_headers)
    assert invalid_jump.status_code == 400

    # 3. ACCEPTED -> PACKING
    pack_resp = client.patch(f"/api/v1/admin/orders/{order_id}/status", json={
        "new_status": "PACKING"
    }, headers=admin_headers)
    assert pack_resp.status_code == 200
    assert pack_resp.json()["status"] == "PACKING"

    # 4. PACKING -> PACKED
    packed_resp = client.patch(f"/api/v1/admin/orders/{order_id}/status", json={
        "new_status": "PACKED"
    }, headers=admin_headers)
    assert packed_resp.status_code == 200
    assert packed_resp.json()["status"] == "PACKED"

    # 5. PACKED -> DELIVERY_PENDING
    deliv_resp = client.patch(f"/api/v1/admin/orders/{order_id}/status", json={
        "new_status": "DELIVERY_PENDING"
    }, headers=admin_headers)
    assert deliv_resp.status_code == 200
    assert deliv_resp.json()["status"] == "DELIVERY_PENDING"

# =============================================================================
# 6. ORDER REJECTION & STOCK RESTORATION & REFUND TESTS
# =============================================================================

def test_order_rejection_restores_stock_and_initiates_refund():
    headers = get_auth_headers()
    admin_headers = get_admin_headers()

    # Check inventory before order
    inv_before = client.get("/api/v1/admin/inventory?search=Diffuser", headers=admin_headers).json()
    stock_before = inv_before[0]["available_quantity"]

    # Place order for 2 units
    init_resp = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": "prod-04", "quantity": 2}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Rejection Test",
        "pickup_person_phone": "9876543210"
    }, headers=headers)
    order_data = init_resp.json()
    order_id = order_data["order_id"]
    rzp_order_id = order_data["razorpay_order_id"]

    # Verify payment
    pay_id = "pay_reject_test_456"
    msg = f"{rzp_order_id}|{pay_id}".encode("utf-8")
    sig = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    client.post("/api/v1/checkout/verify", json={
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": pay_id,
        "razorpay_signature": sig
    }, headers=headers)

    # 1. Invalid rejection reason must be rejected
    bad_reason_resp = client.post(f"/api/v1/admin/orders/{order_id}/reject", json={
        "rejection_reason": "I don't feel like shipping this", # Not sanctioned
        "initiate_refund": True
    }, headers=admin_headers)
    assert bad_reason_resp.status_code == 400

    # 2. Sanctioned rejection reason
    reject_resp = client.post(f"/api/v1/admin/orders/{order_id}/reject", json={
        "rejection_reason": "Product damaged",
        "rejection_notes": "Identified damaged packaging during QC check",
        "initiate_refund": True
    }, headers=admin_headers)
    assert reject_resp.status_code == 200
    rejected_order = reject_resp.json()
    assert rejected_order["status"] == "REJECTED"
    assert rejected_order["payment_status"] == "REFUNDED"
    assert rejected_order["rejection_reason"] == "Product damaged"

    # 3. Verify stock was restored
    inv_after = client.get("/api/v1/admin/inventory?search=Diffuser", headers=admin_headers).json()
    stock_after = inv_after[0]["available_quantity"]
    assert stock_after == stock_before # Restored completely

# =============================================================================
# 7. REFUND MANAGEMENT TESTS
# =============================================================================

def test_refund_management_partial_and_duplicate_prevention():
    headers = get_auth_headers()
    admin_headers = get_admin_headers()

    # Create & pay order for 1 unit of prod-04 (78.0 INR)
    init_resp = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": "prod-04", "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Refund Tester",
        "pickup_person_phone": "9876543210"
    }, headers=headers)
    order_id = init_resp.json()["order_id"]
    rzp_order_id = init_resp.json()["razorpay_order_id"]
    pay_id = "pay_refund_789"
    msg = f"{rzp_order_id}|{pay_id}".encode("utf-8")
    sig = hmac.new(settings.RAZORPAY_KEY_SECRET.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    client.post("/api/v1/checkout/verify", json={
        "order_id": order_id,
        "razorpay_order_id": rzp_order_id,
        "razorpay_payment_id": pay_id,
        "razorpay_signature": sig
    }, headers=headers)

    # 1. Partial refund of ₹30.0
    partial_resp = client.post("/api/v1/admin/refunds/initiate", json={
        "order_id": order_id,
        "amount": 30.0,
        "reason": "Customer compensation for packaging scratch"
    }, headers=admin_headers)
    assert partial_resp.status_code == 200
    assert partial_resp.json()["amount"] == 30.0

    # Check order is PARTIALLY_REFUNDED
    order_detail = client.get(f"/api/v1/admin/orders/{order_id}", headers=admin_headers).json()
    assert order_detail["payment_status"] == "PARTIALLY_REFUNDED"

    # 2. Exceeding refund balance must fail (remaining is 48.0, requesting 60.0)
    excess_resp = client.post("/api/v1/admin/refunds/initiate", json={
        "order_id": order_id,
        "amount": 60.0,
        "reason": "Excessive refund"
    }, headers=admin_headers)
    assert excess_resp.status_code == 400

    # 3. Refund remaining balance (48.0)
    remain_resp = client.post("/api/v1/admin/refunds/initiate", json={
        "order_id": order_id,
        "amount": 48.0,
        "reason": "Final remaining refund"
    }, headers=admin_headers)
    assert remain_resp.status_code == 200

    # Now fully REFUNDED
    order_detail2 = client.get(f"/api/v1/admin/orders/{order_id}", headers=admin_headers).json()
    assert order_detail2["payment_status"] == "REFUNDED"

    # 4. Attempting another refund must be blocked
    dupe_resp = client.post("/api/v1/admin/refunds/initiate", json={
        "order_id": order_id,
        "amount": 10.0,
        "reason": "Duplicate refund attempt"
    }, headers=admin_headers)
    assert dupe_resp.status_code == 400

# =============================================================================
# 8. WEBHOOK IDEMPOTENCY TEST
# =============================================================================

def test_webhook_idempotency():
    payload_str = '{"event": "payment.captured", "event_id": "evt_test_101", "payload": {"payment": {"entity": {"id": "pay_test_001", "order_id": "order_non_existent"}}}}'
    payload_bytes = payload_str.encode("utf-8")
    secret = settings.RAZORPAY_WEBHOOK_SECRET.encode("utf-8")
    sig = hmac.new(secret, payload_bytes, hashlib.sha256).hexdigest()

    # First call: processed
    resp1 = client.post(
        "/api/v1/payments/webhook",
        content=payload_bytes,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    assert resp1.status_code == 200

    # Second call with same event_id: idempotent ignore
    resp2 = client.post(
        "/api/v1/payments/webhook",
        content=payload_bytes,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"}
    )
    assert resp2.status_code == 200
    assert "already processed" in resp2.json()["message"]

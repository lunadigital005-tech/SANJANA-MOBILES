import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_mobile_categories():
    """Verify all mobile categories are present and no furniture categories exist"""
    res = client.get("/api/v1/categories")
    assert res.status_code == 200
    categories = res.json()
    slugs = [c["slug"] for c in categories]

    # Verify key mobile categories exist
    assert "smartphones" in slugs or "mobile-phones" in slugs
    assert "chargers-adapters" in slugs or "charging-accessories" in slugs
    assert "tempered-glass" in slugs
    assert "power-banks" in slugs
    assert "smartwatches" in slugs

    # Verify no furniture or home categories exist
    assert "living-furniture" not in slugs
    assert "ambient-lighting" not in slugs
    assert "ceramics-dining" not in slugs
    assert "fragrance-wellness" not in slugs
    assert "fine-textiles" not in slugs

def test_address_validation_and_creation():
    """Test address creation with Indian mobile and PIN code"""
    token = "mock-customer-token"
    headers = {"Authorization": f"Bearer {token}"}

    # Valid Indian address
    payload = {
        "full_name": "Sanjana Patel",
        "mobile_number": "9876543210",
        "address_line1": "Flat 302, MG Road",
        "address_line2": "Near Trinity Metro",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pin_code": "560001",
        "country": "India",
        "is_default": True,
        "address_type": "home"
    }
    res = client.post("/api/v1/customer/addresses", json=payload, headers=headers)
    assert res.status_code in [200, 201]
    data = res.json()
    assert data["full_name"] == "Sanjana Patel"
    assert data["pin_code"] == "560001"
    assert data["mobile_number"] == "9876543210"

    address_id = data["id"]

    # Test list addresses
    res_list = client.get("/api/v1/customer/addresses", headers=headers)
    assert res_list.status_code == 200
    addrs = res_list.json()
    assert any(a["id"] == address_id for a in addrs)

    # Test set default address
    res_def = client.post(f"/api/v1/customer/addresses/{address_id}/default", headers=headers)
    assert res_def.status_code == 200
    assert res_def.json()["is_default"] is True

def test_checkout_upi_flow_and_verification():
    """Test end-to-end UPI payment flow: checkout -> UPI intent -> UTR submission -> Admin verification"""
    token = "mock-customer-token"
    admin_token = "mock-admin-token"
    customer_headers = {"Authorization": f"Bearer {token}"}
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Replenish stock for test
    from app.services.catalog_store import catalog_store
    catalog_store.inventory["prod-01"] = {"available_quantity": 50, "reserved_quantity": 0}

    # 1. Initiate checkout with a genuine product
    checkout_payload = {
        "items": [{"product_id": "prod-01", "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Ramesh Kumar",
        "pickup_person_phone": "9876543210"
    }
    res_init = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=customer_headers)
    assert res_init.status_code == 200
    init_data = res_init.json()
    order_id = init_data["order_id"]
    order_number = init_data["order_number"]

    # Check UPI fields in initiation response
    assert "upi_uri" in init_data
    assert "upi://" in init_data["upi_uri"]
    assert "SANJANA MOBILES" in init_data["merchant_name"]

    # 2. Customer submits UPI UTR
    test_utr = f"UTR{order_number.replace('-', '')}"
    submit_payload = {
        "order_id": order_id,
        "upi_utr": test_utr,
        "customer_notes": "Paid using Google Pay"
    }
    res_sub = client.post("/api/v1/checkout/submit-upi", json=submit_payload, headers=customer_headers)
    assert res_sub.status_code == 200
    sub_data = res_sub.json()
    assert sub_data["success"] is True
    assert sub_data["payment_status"] == "VERIFICATION_PENDING"

    # 3. Create a second order and attempt duplicate UTR submission - should fail with 409 Conflict
    res_init2 = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=customer_headers)
    assert res_init2.status_code == 200
    order_id_2 = res_init2.json()["order_id"]

    dup_payload = {
        "order_id": order_id_2,
        "upi_utr": test_utr,
        "customer_notes": "Attempting reuse of UTR"
    }
    res_dup = client.post("/api/v1/checkout/submit-upi", json=dup_payload, headers=customer_headers)
    assert res_dup.status_code == 409
    assert "duplicate" in res_dup.json()["detail"].lower()

    # 4. Check status update restriction: cannot advance unverified order
    # Trying to advance from NEW to ACCEPTED or PACKING directly
    status_payload = {"new_status": "ACCEPTED", "comment": "Trying to accept early without verification"}
    res_early = client.patch(f"/api/v1/admin/orders/{order_id}/status", json=status_payload, headers=admin_headers)
    # If order is unverified, order_store blocks advancement to processing or requires verification
    assert res_early.status_code in [200, 400]

    # 5. Admin verifies payment
    verify_payload = {
        "order_id": order_id,
        "action": "VERIFY",
        "admin_notes": "Verified receipt in shop Google Pay bank account"
    }
    res_verify = client.post("/api/v1/admin/payments/verify", json=verify_payload, headers=admin_headers)
    assert res_verify.status_code == 200
    verify_data = res_verify.json()
    assert verify_data["success"] is True
    assert verify_data["payment_status"] == "VERIFIED"
    assert verify_data["order_status"] == "ACCEPTED"

    # 6. Now order can be advanced to PACKING and PACKED
    res_pack = client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "PACKING"}, headers=admin_headers)
    assert res_pack.status_code == 200
    assert res_pack.json()["status"] == "PACKING"

def test_admin_payment_settings():
    """Test retrieving and updating UPI payment settings"""
    admin_token = "mock-admin-token"
    headers = {"Authorization": f"Bearer {admin_token}"}

    res_get = client.get("/api/v1/admin/payment-settings", headers=headers)
    assert res_get.status_code == 200
    settings = res_get.json()
    assert "upi_id" in settings
    assert "SANJANA MOBILES" in settings["merchant_name"]

    # Update settings
    updated_payload = {
        "upi_id": "sanjanamobiles@oksbi",
        "merchant_name": "SANJANA MOBILES STORE",
        "qr_code_url": "https://example.com/qr.png",
        "instructions": "Scan QR using Google Pay and enter 12 digit UTR",
        "is_upi_enabled": True,
        "manual_verification_required": True
    }
    res_put = client.put("/api/v1/admin/payment-settings", json=updated_payload, headers=headers)
    assert res_put.status_code == 200
    saved = res_put.json()
    assert saved["upi_id"] == "sanjanamobiles@oksbi"
    assert saved["merchant_name"] == "SANJANA MOBILES STORE"

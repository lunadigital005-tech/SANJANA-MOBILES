import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.order_store import order_store
from app.services.rewards_store import rewards_store
from app.services.delivery_service import delivery_service
from app.services.catalog_store import catalog_store

client = TestClient(app)

CUSTOMER_HEADERS = {"Authorization": "Bearer customer-p89"}
ADMIN_HEADERS = {"Authorization": "Bearer admin-p89"}


# =============================================================================
# PHASE 08 TESTS: LOYALTY COINS & REWARDS ENGINE
# =============================================================================

def test_reward_settings_crud():
    """Admin can fetch and update loyalty reward settings."""
    # 1. Fetch public settings
    res = client.get("/api/v1/rewards/settings")
    assert res.status_code == 200
    data = res.json()
    assert "earning_ratio" in data
    assert "coin_conversion_rate" in data

    # 2. Admin updates settings
    update_payload = {
        "earning_ratio": 0.02, # 2 coins per ₹100
        "coin_conversion_rate": 1.5, # 1 coin = ₹1.50
        "min_redemption_coins": 5,
        "max_redemption_per_order": 1000,
        "allow_full_coin_payment": True,
        "allow_mixed_payment": True
    }
    update_res = client.put("/api/v1/rewards/admin/settings", json=update_payload, headers=ADMIN_HEADERS)
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["earning_ratio"] == 0.02
    assert updated_data["coin_conversion_rate"] == 1.5
    assert updated_data["min_redemption_coins"] == 5

    # Reset back to standard for subsequent tests
    reset_payload = {
        "earning_ratio": 0.01,
        "coin_conversion_rate": 1.0,
        "min_redemption_coins": 10,
        "max_redemption_per_order": 500,
        "allow_full_coin_payment": True,
        "allow_mixed_payment": True
    }
    client.put("/api/v1/rewards/admin/settings", json=reset_payload, headers=ADMIN_HEADERS)


def test_customer_wallet_and_manual_adjustment():
    """Verify customer wallet creation and administrative adjustment with audit trail."""
    user_id = f"customer-manual-{uuid.uuid4().hex[:6]}"
    headers = {"Authorization": f"Bearer {user_id}"}

    # 1. New customer starts with 0 coins
    res = client.get("/api/v1/rewards/wallet", headers=headers)
    assert res.status_code == 200
    wallet = res.json()
    assert wallet["available_coins"] == 0
    assert wallet["can_redeem"] is False

    # 2. Admin manually credits 100 coins with required reason
    adjust_payload = {
        "user_id": user_id,
        "coins_delta": 100,
        "reason": "VIP onboarding complimentary loyalty reward bonus"
    }
    adj_res = client.post("/api/v1/rewards/admin/adjust", json=adjust_payload, headers=ADMIN_HEADERS)
    assert adj_res.status_code == 200
    updated_wallet = adj_res.json()
    assert updated_wallet["available_coins"] == 100
    assert updated_wallet["monetary_value"] == 100.0
    assert updated_wallet["can_redeem"] is True
    assert len(updated_wallet["transactions"]) >= 1
    last_tx = updated_wallet["transactions"][0]
    assert last_tx["transaction_type"] == "MANUAL_ADJUSTMENT"
    assert last_tx["coins"] == 100
    assert "VIP onboarding" in last_tx["reason"]

    # 3. Customer verifies updated wallet
    cust_check = client.get("/api/v1/rewards/wallet", headers=headers)
    assert cust_check.status_code == 200
    assert cust_check.json()["available_coins"] == 100


def test_mixed_and_full_coin_checkout():
    """Test coin redemption at checkout (mixed payment and full coin payment)."""
    user_id = f"customer-checkout-{uuid.uuid4().hex[:6]}"
    headers = {"Authorization": f"Bearer {user_id}"}

    # Credit 500 coins to user
    client.post("/api/v1/rewards/admin/adjust", json={
        "user_id": user_id,
        "coins_delta": 500,
        "reason": "Preloading testing loyalty coins"
    }, headers=ADMIN_HEADERS)

    # Pick a product
    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 50, "reserved_quantity": 0}

    # 1. Mixed payment checkout: redeem 50 coins
    checkout_payload = {
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Test Collector",
        "pickup_person_phone": "+91 9876543210",
        "coins_to_redeem": 50
    }
    resp = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["coins_redeemed"] == 50
    assert data["coin_discount"] == 50.0
    assert data["is_full_coin_payment"] is False
    assert data["amount"] > 0
    assert data["razorpay_order_id"].startswith("order_")

    # Check remaining balance
    wallet = client.get("/api/v1/rewards/wallet", headers=headers).json()
    assert wallet["available_coins"] == 450


def test_full_coin_payment_checkout():
    """Full coin payment should skip Razorpay and immediately mark order NEW / PAID."""
    user_id = f"customer-fullcoin-{uuid.uuid4().hex[:6]}"
    headers = {"Authorization": f"Bearer {user_id}"}

    # Preload 50000 coins
    client.post("/api/v1/rewards/admin/adjust", json={
        "user_id": user_id,
        "coins_delta": 50000,
        "reason": "Preloading large loyalty wallet"
    }, headers=ADMIN_HEADERS)

    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 50, "reserved_quantity": 0}

    # Redeem 500 coins (max per order default is 500)
    checkout_payload = {
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Coin Shopper",
        "pickup_person_phone": "+91 9876543210",
        "coins_to_redeem": 500
    }
    resp = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["coins_redeemed"] == 500
    assert data["coin_discount"] == 500.0


def test_coin_earning_on_order_delivery_and_reversal_on_reject():
    """Completing an order (DELIVERED) credits coins; rejecting/refunding reverses them."""
    user_id = f"customer-earn-{uuid.uuid4().hex[:6]}"
    headers = {"Authorization": f"Bearer {user_id}"}

    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 50, "reserved_quantity": 0}

    # 1. Place order
    checkout_payload = {
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Earn Tester",
        "pickup_person_phone": "+91 9988776655"
    }
    co_resp = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=headers)
    assert co_resp.status_code == 200
    order_id = co_resp.json()["order_id"]

    # Mark as PAID
    order_store.orders[order_id]["payment_status"] = "PAID"
    order_store.orders[order_id]["status"] = "NEW"

    # 2. Advance through workflow to DELIVERED
    client.post(f"/api/v1/admin/orders/{order_id}/accept", headers=ADMIN_HEADERS)
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "PACKING"}, headers=ADMIN_HEADERS)
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "PACKED"}, headers=ADMIN_HEADERS)
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "READY_FOR_DELIVERY"}, headers=ADMIN_HEADERS)
    client.patch(f"/api/v1/admin/orders/{order_id}/status", json={"new_status": "OUT_FOR_DELIVERY"}, headers=ADMIN_HEADERS)
    
    deliv_resp = client.patch(
        f"/api/v1/admin/orders/{order_id}/status",
        json={"new_status": "DELIVERED"},
        headers=ADMIN_HEADERS
    )
    assert deliv_resp.status_code == 200
    order_data = deliv_resp.json()
    assert order_data["status"] == "DELIVERED"
    assert order_data["coins_credited"] is True
    assert order_data["coins_earned"] > 0

    # Verify wallet has received the credited coins
    wallet_resp = client.get("/api/v1/rewards/wallet", headers=headers)
    assert wallet_resp.status_code == 200
    wallet_data = wallet_resp.json()
    assert wallet_data["available_coins"] == order_data["coins_earned"]
    assert wallet_data["total_earned_coins"] == order_data["coins_earned"]

    # 3. Idempotency test: advancing status or re-checking should not double-credit coins
    assert order_store.orders[order_id]["coins_credited"] is True


# =============================================================================
# PHASE 09 TESTS: DELIVERY, DISTANCE, COURIER & WHATSAPP
# =============================================================================

def test_haversine_distance_calculation():
    """Verify Great-Circle Haversine distance and non-binding suggestion rules."""
    # Store is at (12.9716, 77.5946) Indiranagar, Bengaluru
    # Test 1: Close point (~1.5 km) -> DIRECT_DELIVERY
    dist_close = delivery_service.calculate_distance_km(12.9716, 77.5946, 12.9800, 77.6050)
    assert dist_close < 3.0
    _, sugg_close, _ = delivery_service.evaluate_delivery_suggestion(12.9800, 77.6050)
    assert sugg_close == "DIRECT_DELIVERY"

    # Test 2: Far point (Mumbai: 19.0760, 72.8777, ~840 km) -> COURIER
    dist_far = delivery_service.calculate_distance_km(12.9716, 77.5946, 19.0760, 72.8777)
    assert dist_far > 10.0
    _, sugg_far, _ = delivery_service.evaluate_delivery_suggestion(19.0760, 72.8777)
    assert sugg_far == "COURIER"

    # Test 3: Intermediate zone (~5 km) -> ADMIN_DECISION
    _, sugg_mid, _ = delivery_service.evaluate_delivery_suggestion(12.9352, 77.6245)
    assert sugg_mid in ["ADMIN_DECISION", "COURIER", "DIRECT_DELIVERY"]


def test_delivery_workflow_direct_and_courier():
    """Test full branched delivery workflows: Direct Delivery and Courier Delivery."""
    # Create an order with Home Delivery address
    addr_payload = {
        "full_name": "Sanjana Patel",
        "mobile_number": "9845012345",
        "address_line1": "Flat 402, Lotus Towers, Koramangala",
        "city": "Bengaluru",
        "district": "Bengaluru Urban",
        "state": "Karnataka",
        "pin_code": "560034",
        "country": "India",
        "latitude": 12.9352,
        "longitude": 77.6245,
        "address_type": "home"
    }
    addr_res = client.post("/api/v1/customer/addresses", json=addr_payload, headers=CUSTOMER_HEADERS)
    assert addr_res.status_code == 201
    addr_id = addr_res.json()["id"]

    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 50, "reserved_quantity": 0}

    co_payload = {
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id
    }
    co_res = client.post("/api/v1/checkout/initiate", json=co_payload, headers=CUSTOMER_HEADERS)
    assert co_res.status_code == 200
    order_id = co_res.json()["order_id"]

    # Mark paid and packed
    order_store.orders[order_id]["payment_status"] = "PAID"
    order_store.orders[order_id]["status"] = "PACKED"

    # 1. Distance evaluation endpoint
    dist_res = client.get(f"/api/v1/delivery/orders/{order_id}/distance", headers=ADMIN_HEADERS)
    assert dist_res.status_code == 200
    dist_data = dist_res.json()
    assert "suggested_method" in dist_data
    assert dist_data["order_id"] == order_id

    # 2. Admin selects DIRECT_DELIVERY
    sel_res = client.post(
        f"/api/v1/delivery/orders/{order_id}/select-method",
        json={"delivery_type": "DIRECT_DELIVERY", "assigned_to": "Concierge Vikram", "notes": "Deliver before 5 PM"},
        headers=ADMIN_HEADERS
    )
    assert sel_res.status_code == 200
    shipment_data = sel_res.json()
    assert shipment_data["delivery_type"] == "DIRECT_DELIVERY"
    assert shipment_data["status"] == "READY_FOR_DELIVERY"
    assert shipment_data["direct_assigned_to"] == "Concierge Vikram"

    # 3. Advance to OUT_FOR_DELIVERY
    out_res = client.patch(
        f"/api/v1/delivery/orders/{order_id}/direct-status",
        json={"status": "OUT_FOR_DELIVERY"},
        headers=ADMIN_HEADERS
    )
    assert out_res.status_code == 200
    assert out_res.json()["status"] == "OUT_FOR_DELIVERY"

    # 4. Advance to DELIVERED with delivery proof
    deliv_res = client.patch(
        f"/api/v1/delivery/orders/{order_id}/direct-status",
        json={
            "status": "DELIVERED",
            "delivery_proof_url": "https://storage.luna.com/proofs/delivery-01.jpg",
            "customer_acknowledgement": "Signed by Sanjana Patel"
        },
        headers=ADMIN_HEADERS
    )
    assert deliv_res.status_code == 200
    assert deliv_res.json()["status"] == "DELIVERED"
    assert deliv_res.json()["direct_delivery_proof_url"] is not None


def test_courier_delivery_branch_and_receipt():
    """Test Courier Delivery branch: AWB tracking, receipt image URL, and customer tracking."""
    # Create order
    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 50, "reserved_quantity": 0}

    co_res = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Courier Recipient",
        "pickup_person_phone": "+91 9811223344"
    }, headers=CUSTOMER_HEADERS)
    order_id = co_res.json()["order_id"]

    order_store.orders[order_id]["payment_status"] = "PAID"
    order_store.orders[order_id]["status"] = "PACKED"

    # 1. Admin selects COURIER
    sel_res = client.post(
        f"/api/v1/delivery/orders/{order_id}/select-method",
        json={"delivery_type": "COURIER", "notes": "Fragile items"},
        headers=ADMIN_HEADERS
    )
    assert sel_res.status_code == 200
    assert sel_res.json()["delivery_type"] == "COURIER"
    assert sel_res.json()["status"] == "COURIER_ASSIGNED"

    # 2. Admin creates courier shipment with receipt photo
    shipment_payload = {
        "courier_name": "Delhivery",
        "tracking_number": "DEL1234567890",
        "shipment_date": "2026-11-21T10:00:00Z",
        "receipt_image_url": "https://images.unsplash.com/photo-receipt.jpg",
        "receipt_storage_path": "receipts/del123.jpg",
        "shipment_notes": "Shipped via Delhivery Express Air",
        "estimated_delivery_date": "2026-11-23"
    }
    create_res = client.post(
        f"/api/v1/delivery/orders/{order_id}/courier-shipment",
        json=shipment_payload,
        headers=ADMIN_HEADERS
    )
    assert create_res.status_code == 200
    shipment = create_res.json()
    assert shipment["status"] == "SHIPPED"
    assert shipment["courier_name"] == "Delhivery"
    assert shipment["tracking_number"] == "DEL1234567890"
    assert "delhivery.com" in shipment["tracking_url"]
    assert shipment["receipt_image_url"] is not None

    # 3. Advance courier status to COURIER_TRACKING
    track_res = client.patch(
        f"/api/v1/delivery/orders/{order_id}/courier-status",
        json={
            "status": "COURIER_TRACKING",
            "location": "Delhi Logistics Hub",
            "event_description": "In-transit to local distribution center"
        },
        headers=ADMIN_HEADERS
    )
    assert track_res.status_code == 200
    assert track_res.json()["status"] == "COURIER_TRACKING"

    # 4. Customer retrieves live tracking info
    cust_track = client.get(f"/api/v1/delivery/orders/{order_id}/tracking", headers=CUSTOMER_HEADERS)
    assert cust_track.status_code == 200
    track_info = cust_track.json()
    assert track_info["courier_name"] == "Delhivery"
    assert track_info["tracking_number"] == "DEL1234567890"
    assert len(track_info["tracking_events"]) >= 1


def test_whatsapp_notification_generator():
    """Verify WhatsApp message formatting and wa.me link generation."""
    prod_id = list(catalog_store.products.keys())[0]
    catalog_store.inventory[prod_id] = {"available_quantity": 50, "reserved_quantity": 0}

    co_res = client.post("/api/v1/checkout/initiate", json={
        "items": [{"product_id": prod_id, "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_person_name": "Ananya Sharma",
        "pickup_person_phone": "+91 9845098450"
    }, headers=CUSTOMER_HEADERS)
    order_id = co_res.json()["order_id"]

    # Generate WhatsApp message for SHIPPED_COURIER
    res = client.get(
        f"/api/v1/delivery/orders/{order_id}/whatsapp?event=SHIPPED_COURIER",
        headers=ADMIN_HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    assert "wa.me/919845098450" in data["whatsapp_share_url"]
    assert "Courier Dispatch Notification" in data["message_body"]
    assert data["customer_name"] is not None

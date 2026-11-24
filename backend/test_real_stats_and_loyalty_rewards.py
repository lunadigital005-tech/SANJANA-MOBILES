import pytest
import asyncio
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.services.catalog_store import catalog_store
from app.services.order_store import order_store
from app.services.rewards_store import rewards_store
from app.schemas.rewards import RewardSettingsUpdate
from app.core.security import MOCK_PROFILES
import uuid

client = TestClient(app)

ADMIN_HEADERS = {"Authorization": "Bearer mock-admin-token"}
CUSTOMER_HEADERS = {"Authorization": "Bearer mock-customer-token"}

def test_01_add_product_increments_total_products():
    """Test 1: Adding a product increases the real Total Products count."""
    res_before = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_before.status_code == 200
    total_before = res_before.json()["total_products"]

    # Add a new active product directly to catalog
    new_prod_id = f"test-prod-{uuid.uuid4().hex[:6]}"
    catalog_store.products[new_prod_id] = {
        "id": new_prod_id,
        "title": "Test OnePlus 12 Real Stats",
        "slug": f"test-oneplus-12-{new_prod_id}",
        "description": "Test product for live telemetry verification",
        "price": 64999.0,
        "is_active": True,
        "categories": ["cat-01"],
        "primary_category_id": "cat-01",
        "images": [],
        "sku": f"SKU-{uuid.uuid4().hex[:6].upper()}",
        "created_at": "2026-11-24T12:00:00Z",
        "updated_at": "2026-11-24T12:00:00Z"
    }

    res_after = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_after.status_code == 200
    total_after = res_after.json()["total_products"]
    assert total_after == total_before + 1

def test_02_register_customer_increments_total_customers_excluding_admins():
    """Test 2: Registering a customer increases Total Customers; admin accounts are excluded."""
    res_before = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_before.status_code == 200
    customers_before = res_before.json()["total_customers"]

    # Registering a new customer account
    new_cust_id = f"customer-{uuid.uuid4().hex[:8]}"
    MOCK_PROFILES[new_cust_id] = {
        "id": new_cust_id,
        "email": f"{new_cust_id}@test.com",
        "full_name": "Test Customer Sanjana",
        "role": "customer",
        "phone": "+91 91234 56789"
    }

    res_after = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_after.status_code == 200
    assert res_after.json()["total_customers"] == customers_before + 1

    # Adding an admin account should NOT increase customer count
    new_admin_id = f"admin-{uuid.uuid4().hex[:8]}"
    MOCK_PROFILES[new_admin_id] = {
        "id": new_admin_id,
        "email": f"{new_admin_id}@sanjanamobiles.com",
        "full_name": "Staff Admin",
        "role": "admin"
    }
    res_after_admin = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_after_admin.json()["total_customers"] == customers_before + 1

def test_03_place_order_increments_total_orders():
    """Test 3: Placing a new order increases real Total Orders count without hardcoding."""
    res_before = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_before.status_code == 200
    orders_before = res_before.json()["total_orders"]

    # Insert an order into order_store
    new_ord_id = f"ord-test-{uuid.uuid4().hex[:6]}"
    order_store.orders[new_ord_id] = {
        "id": new_ord_id,
        "order_number": f"SANJANA-{uuid.uuid4().hex[:6].upper()}",
        "user_id": "customer-user-id-001",
        "customer_name": "Sanjana Customer",
        "customer_email": "customer@example.com",
        "total_amount": 1499.0,
        "status": "NEW",
        "payment_status": "PAID",
        "items": [],
        "delivery_option": "doorstep",
        "created_at": "2026-11-24T12:00:00Z",
        "updated_at": "2026-11-24T12:00:00Z",
        "status_history": []
    }

    res_after = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_after.status_code == 200
    assert res_after.json()["total_orders"] == orders_before + 1

def test_04_product_stock_drops_to_2_units_appears_as_low_stock():
    """Test 4: Product stock drops to 2 units -> Appears in Low Stock Alerts as LOW STOCK."""
    prod_id = f"prod-low-{uuid.uuid4().hex[:6]}"
    catalog_store.products[prod_id] = {
        "id": prod_id,
        "title": "Low Stock Test Phone",
        "slug": f"low-stock-test-phone-{prod_id}",
        "price": 18999.0,
        "is_active": True,
        "categories": ["cat-01"],
        "sku": "SKU-LOW-2"
    }
    catalog_store.inventory[prod_id] = {
        "available_quantity": 2,
        "reserved_quantity": 0,
        "low_stock_threshold": 5,
        "updated_at": "2026-11-24T12:00:00Z"
    }

    res = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    alert_items = [it for it in data["low_stock_items"] if it["id"] == prod_id]
    assert len(alert_items) == 1
    assert alert_items[0]["status"] == "LOW STOCK"
    assert alert_items[0]["stock"] == 2

def test_05_product_stock_drops_to_0_units_appears_as_out_of_stock():
    """Test 5: Product stock drops to 0 units -> Appears in Low Stock Alerts as OUT OF STOCK."""
    prod_id = f"prod-zero-{uuid.uuid4().hex[:6]}"
    catalog_store.products[prod_id] = {
        "id": prod_id,
        "title": "Zero Stock Test Phone",
        "slug": f"zero-stock-test-phone-{prod_id}",
        "price": 25999.0,
        "is_active": True,
        "categories": ["cat-01"],
        "sku": "SKU-ZERO-0"
    }
    catalog_store.inventory[prod_id] = {
        "available_quantity": 0,
        "reserved_quantity": 0,
        "low_stock_threshold": 5,
        "updated_at": "2026-11-24T12:00:00Z"
    }

    res = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    alert_items = [it for it in data["low_stock_items"] if it["id"] == prod_id]
    assert len(alert_items) == 1
    assert alert_items[0]["status"] == "OUT OF STOCK"
    assert alert_items[0]["stock"] == 0

def test_06_product_stock_increased_above_threshold_disappears():
    """Test 6: Product stock increased above threshold -> Disappears from Low Stock Alerts."""
    prod_id = f"prod-restock-{uuid.uuid4().hex[:6]}"
    catalog_store.products[prod_id] = {
        "id": prod_id,
        "title": "Restocked Test Phone",
        "slug": f"restocked-test-phone-{prod_id}",
        "price": 29999.0,
        "is_active": True,
        "categories": ["cat-01"],
        "sku": "SKU-RESTOCK"
    }
    # Initially low
    catalog_store.inventory[prod_id] = {
        "available_quantity": 3,
        "reserved_quantity": 0,
        "low_stock_threshold": 5,
        "updated_at": "2026-11-24T12:00:00Z"
    }

    res1 = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert any(it["id"] == prod_id for it in res1.json()["low_stock_items"])

    # Now restock to 25 units
    catalog_store.inventory[prod_id]["available_quantity"] = 25

    res2 = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert not any(it["id"] == prod_id for it in res2.json()["low_stock_items"])

def test_07_pending_orders_count_matches_actionable_statuses():
    """Test 7: Pending orders count matches orders in actionable statuses (NEW, ACCEPTED, PACKING, etc.)."""
    res_initial = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_initial.status_code == 200
    pending_before = res_initial.json()["pending_orders"]

    # Add an actionable order (PACKING)
    actionable_id = f"ord-act-{uuid.uuid4().hex[:6]}"
    order_store.orders[actionable_id] = {
        "id": actionable_id,
        "order_number": f"SANJANA-{uuid.uuid4().hex[:6].upper()}",
        "user_id": "customer-user-id-001",
        "customer_name": "Sanjana Customer",
        "customer_email": "customer@example.com",
        "total_amount": 999.0,
        "status": "PACKING",
        "payment_status": "PAID",
        "items": [],
        "created_at": "2026-11-24T12:00:00Z",
        "updated_at": "2026-11-24T12:00:00Z",
        "status_history": []
    }

    res_after = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_after.json()["pending_orders"] == pending_before + 1

    # Add a completed order (DELIVERED) - should NOT increase pending count
    delivered_id = f"ord-deliv-{uuid.uuid4().hex[:6]}"
    order_store.orders[delivered_id] = {
        "id": delivered_id,
        "order_number": f"SANJANA-{uuid.uuid4().hex[:6].upper()}",
        "user_id": "customer-user-id-001",
        "customer_name": "Sanjana Customer",
        "customer_email": "customer@example.com",
        "total_amount": 999.0,
        "status": "DELIVERED",
        "payment_status": "PAID",
        "items": [],
        "created_at": "2026-11-24T12:00:00Z",
        "updated_at": "2026-11-24T12:00:00Z",
        "status_history": []
    }

    res_final = client.get("/api/v1/admin/overview", headers=ADMIN_HEADERS)
    assert res_final.json()["pending_orders"] == pending_before + 1

def test_08_eligible_100_rupees_purchase_awards_1_coin():
    """Test 8: Eligible ₹100 purchase -> exactly 1 coin awarded."""
    asyncio.run(rewards_store.update_settings(
        RewardSettingsUpdate(
            is_active=True,
            reward_per_100=1.0,
            min_purchase_amount=100.0
        )
    ))

    user_id = f"user-{uuid.uuid4().hex[:8]}"
    order_id = f"ord-100-{uuid.uuid4().hex[:6]}"
    order_number = f"SNJ-{uuid.uuid4().hex[:6].upper()}"

    tx = asyncio.run(rewards_store.credit_coins_for_completed_order(
        user_id=user_id,
        eligible_amount=100.0,
        order_id=order_id,
        order_number=order_number
    ))
    assert tx is not None
    assert tx.coins == 1

    wallet = asyncio.run(rewards_store.get_wallet(user_id))
    assert wallet.available_coins == 1

def test_09_eligible_500_rupees_purchase_awards_5_coins():
    """Test 9: Eligible ₹500 purchase -> exactly 5 coins awarded."""
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    order_id = f"ord-500-{uuid.uuid4().hex[:6]}"
    order_number = f"SNJ-{uuid.uuid4().hex[:6].upper()}"

    tx = asyncio.run(rewards_store.credit_coins_for_completed_order(
        user_id=user_id,
        eligible_amount=500.0,
        order_id=order_id,
        order_number=order_number
    ))
    assert tx is not None
    assert tx.coins == 5

    wallet = asyncio.run(rewards_store.get_wallet(user_id))
    assert wallet.available_coins == 5

def test_10_process_order_twice_no_duplicate_rewards():
    """Test 10: Processing completion twice does not award duplicate coins (idempotency)."""
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    order_id = f"ord-idem-{uuid.uuid4().hex[:6]}"
    order_number = f"SNJ-{uuid.uuid4().hex[:6].upper()}"

    # First completion
    tx1 = asyncio.run(rewards_store.credit_coins_for_completed_order(
        user_id=user_id,
        eligible_amount=300.0,
        order_id=order_id,
        order_number=order_number
    ))
    assert tx1 is not None
    assert tx1.coins == 3

    # Duplicate completion attempt
    tx2 = asyncio.run(rewards_store.credit_coins_for_completed_order(
        user_id=user_id,
        eligible_amount=300.0,
        order_id=order_id,
        order_number=order_number
    ))
    assert tx2 is None # Idempotently rejected

    wallet = asyncio.run(rewards_store.get_wallet(user_id))
    assert wallet.available_coins == 3 # Not doubled

def test_11_cancel_order_reverses_awarded_coins():
    """Test 11: Cancel or refund of order reverses awarded coins."""
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    order_id = f"ord-cancel-{uuid.uuid4().hex[:6]}"
    order_number = f"SNJ-REV-{uuid.uuid4().hex[:6].upper()}"

    # Credit 10 coins for a Rs 1000 order
    asyncio.run(rewards_store.credit_coins_for_completed_order(
        user_id=user_id,
        eligible_amount=1000.0,
        order_id=order_id,
        order_number=order_number
    ))
    wallet_before = asyncio.run(rewards_store.get_wallet(user_id))
    assert wallet_before.available_coins == 10

    # Reverse on cancellation/refund
    rev_tx = asyncio.run(rewards_store.reverse_earned_coins_for_order(
        user_id=user_id,
        order_id=order_id,
        order_number=order_number,
        reason="Customer cancellation request"
    ))
    assert rev_tx is not None
    assert rev_tx.coins == -10

    wallet_after = asyncio.run(rewards_store.get_wallet(user_id))
    assert wallet_after.available_coins == 0

def test_12_change_global_reward_rate_applies_to_future_orders():
    """Test 12: Changing reward rate in settings takes effect on future orders."""
    # Update rate to Rs 2 reward per Rs 100 spent (2% earning)
    res_update = client.put(
        "/api/v1/rewards/admin/settings",
        json={"reward_per_100": 2.0},
        headers=ADMIN_HEADERS
    )
    assert res_update.status_code == 200
    assert res_update.json()["reward_per_100"] == 2.0

    # New order for Rs 500 should now award 10 coins (500 * 2 / 100)
    user_id = f"user-{uuid.uuid4().hex[:8]}"
    order_id = f"ord-rate2-{uuid.uuid4().hex[:6]}"
    order_number = f"SNJ-NEW-{uuid.uuid4().hex[:6].upper()}"

    tx = asyncio.run(rewards_store.credit_coins_for_completed_order(
        user_id=user_id,
        eligible_amount=500.0,
        order_id=order_id,
        order_number=order_number
    ))
    assert tx is not None
    assert tx.coins == 10

    # Restore default rate back to 1.0
    client.put(
        "/api/v1/rewards/admin/settings",
        json={"reward_per_100": 1.0},
        headers=ADMIN_HEADERS
    )

def test_13_customer_cannot_arbitrarily_add_coins():
    """Test 13: Customer-facing endpoints cannot arbitrarily add coins; requires admin authorization."""
    # Customer trying to call admin adjustment must be rejected 403 Forbidden
    res_customer = client.post(
        "/api/v1/rewards/admin/adjust",
        json={
            "user_id": "customer-user-id-001",
            "coins_delta": 100,
            "reason": "Customer attempting unauthorized self-credit"
        },
        headers=CUSTOMER_HEADERS
    )
    assert res_customer.status_code in [401, 403]

    # Calling with Admin token with justification succeeds
    res_admin = client.post(
        "/api/v1/rewards/admin/adjust",
        json={
            "user_id": "customer-user-id-001",
            "coins_delta": 25,
            "reason": "Audited goodwill credit for delivery delay"
        },
        headers=ADMIN_HEADERS
    )
    assert res_admin.status_code == 200

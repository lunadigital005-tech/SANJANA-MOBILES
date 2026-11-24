import pytest
import concurrent.futures
from fastapi.testclient import TestClient
from app.main import app
from app.services.order_store import order_store
from app.services.catalog_store import catalog_store

client = TestClient(app)

CUSTOMER_HEADERS = {"Authorization": "Bearer mock-customer-token"}
CUSTOMER_B_HEADERS = {"Authorization": "Bearer customer-user-id-002"}
ADMIN_HEADERS = {"Authorization": "Bearer mock-admin-token"}

def setup_address():
    """Ensure a valid Indian address exists for testing"""
    valid_addr = {
        "full_name": "Ramesh Kumar",
        "mobile_number": "9840123456",
        "address_line1": "42 Anna Salai",
        "address_line2": "Opposite Post Office",
        "city": "Chennai",
        "district": "Chennai",
        "state": "Tamil Nadu",
        "pin_code": "600002",
        "country": "India",
        "is_default": True,
        "address_type": "home"
    }
    resp = client.post("/api/v1/customer/addresses", json=valid_addr, headers=CUSTOMER_HEADERS)
    if resp.status_code == 201:
        return resp.json()["id"]
    list_resp = client.get("/api/v1/customer/addresses", headers=CUSTOMER_HEADERS)
    if list_resp.status_code == 200 and list_resp.json():
        return list_resp.json()[0]["id"]
    return "addr-demo-01"

def test_1_order_with_two_products_admin_sees_both():
    """
    Test 1: Admin can see what the customer ordered.
    Order with two different products -> admin sees both products, quantities, prices, snapshots.
    """
    addr_id = setup_address()
    payload = {
        "items": [
            {"product_id": "prod-10", "quantity": 2, "variant": "20W White"},
            {"product_id": "prod-01", "quantity": 1, "variant": "Default"}
        ],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id,
        "payment_method": "DIRECT_UPI"
    }

    res = client.post("/api/v1/checkout/initiate", json=payload, headers=CUSTOMER_HEADERS)
    assert res.status_code == 200, res.text
    checkout_data = res.json()
    order_id = checkout_data["order_id"]
    order_number = checkout_data["order_number"]

    # Verify admin sees order details and all items
    admin_res = client.get(f"/api/v1/admin/orders/{order_id}", headers=ADMIN_HEADERS)
    assert admin_res.status_code == 200, admin_res.text
    admin_order = admin_res.json()

    assert admin_order["id"] == order_id
    assert admin_order["order_number"] == order_number
    assert len(admin_order["items"]) == 2

    # Verify first item
    item1 = next((i for i in admin_order["items"] if i["product_id"] == "prod-10"), None)
    assert item1 is not None
    assert item1["quantity"] == 2
    assert item1["price_snapshot"] > 0
    assert item1["subtotal"] == item1["price_snapshot"] * 2
    assert "Apple 20W" in item1["title"]
    assert item1["variant"] == "20W White"

    # Verify second item
    item2 = next((i for i in admin_order["items"] if i["product_id"] == "prod-01"), None)
    assert item2 is not None
    assert item2["quantity"] == 1
    assert item2["price_snapshot"] > 0
    assert item2["subtotal"] == item2["price_snapshot"] * 1
    assert "Sanjana Smart" in item2["title"]

def test_2_sequential_order_numbers():
    """
    Test 2: Professional Sequential Order Numbers.
    Create multiple orders -> verify sequential numbers (SANJANA-001, SANJANA-002, etc.)
    """
    addr_id = setup_address()
    order_numbers = []

    for _ in range(3):
        payload = {
            "items": [{"product_id": "prod-10", "quantity": 1}],
            "delivery_method": "STORE_PICKUP",
            "pickup_details": {
                "pickup_person_name": "Suresh",
                "pickup_person_phone": "9841234567"
            },
            "payment_method": "STORE_PICKUP"
        }
        res = client.post("/api/v1/checkout/initiate", json=payload, headers=CUSTOMER_HEADERS)
        assert res.status_code == 200, res.text
        order_numbers.append(res.json()["order_number"])

    # Verify format and strict increment
    for num in order_numbers:
        assert num.startswith("SANJANA-")
        digits = num.replace("SANJANA-", "")
        assert digits.isdigit()

    seq_ints = [int(num.replace("SANJANA-", "")) for num in order_numbers]
    assert seq_ints[1] == seq_ints[0] + 1
    assert seq_ints[2] == seq_ints[1] + 1

def test_3_concurrency_safe_order_numbers():
    """
    Test 3: Concurrency safety against simultaneous checkouts -> no duplicate order numbers.
    """
    addr_id = setup_address()

    def place_order():
        payload = {
            "items": [{"product_id": "prod-10", "quantity": 1}],
            "delivery_method": "STORE_PICKUP",
            "pickup_details": {
                "pickup_person_name": "Simultaneous Customer",
                "pickup_person_phone": "9841234567"
            },
            "payment_method": "STORE_PICKUP"
        }
        res = client.post("/api/v1/checkout/initiate", json=payload, headers=CUSTOMER_HEADERS)
        return res.json()["order_number"]

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        results = list(executor.map(lambda _: place_order(), range(5)))

    # All generated numbers must be distinct
    assert len(results) == len(set(results)), f"Duplicate order numbers found in concurrent run: {results}"
    for num in results:
        assert num.startswith("SANJANA-")

def test_4_reject_unpaid_order():
    """
    Test 4: Reject unpaid order -> status becomes REJECTED, reason saved, payment stays accurate.
    """
    addr_id = setup_address()
    payload = {
        "items": [{"product_id": "prod-10", "quantity": 1}],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id,
        "payment_method": "DIRECT_UPI"
    }
    res = client.post("/api/v1/checkout/initiate", json=payload, headers=CUSTOMER_HEADERS)
    order_id = res.json()["order_id"]

    # Reject order
    reject_res = client.post(
        f"/api/v1/admin/orders/{order_id}/reject",
        json={
            "rejection_reason": "Product Out of Stock",
            "rejection_notes": "All units depleted in morning rush",
            "initiate_refund": False
        },
        headers=ADMIN_HEADERS
    )
    assert reject_res.status_code == 200, reject_res.text
    rejected_order = reject_res.json()

    assert rejected_order["status"] == "REJECTED"
    assert rejected_order["rejection_reason"] == "Product Out of Stock"
    assert rejected_order["rejection_notes"] == "All units depleted in morning rush"
    assert rejected_order["rejected_by"] is not None
    assert rejected_order["rejected_at"] is not None
    assert rejected_order["payment_status"] == "PENDING"  # Payment status accurately preserved

def test_5_reject_paid_order_preserves_payment_record():
    """
    Test 5: Reject paid order -> payment is not silently marked refunded.
    """
    payload = {
        "items": [{"product_id": "prod-10", "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_details": {"pickup_person_name": "Priya", "pickup_person_phone": "9841112233"},
        "payment_method": "STORE_PICKUP"
    }
    res = client.post("/api/v1/checkout/initiate", json=payload, headers=CUSTOMER_HEADERS)
    order_id = res.json()["order_id"]

    # Mark as PAID at store counter
    pay_res = client.post(
        f"/api/v1/admin/orders/{order_id}/confirm-store-payment",
        json={"notes": "Cash received at counter"},
        headers=ADMIN_HEADERS
    )
    assert pay_res.status_code == 200
    assert pay_res.json()["payment_status"] == "PAID"

    # Reject order
    reject_res = client.post(
        f"/api/v1/admin/orders/{order_id}/reject",
        json={
            "rejection_reason": "Unable to Fulfil Order",
            "rejection_notes": "Defective item discovered during inspection",
            "initiate_refund": False
        },
        headers=ADMIN_HEADERS
    )
    assert reject_res.status_code == 200
    order_after = reject_res.json()
    assert order_after["status"] == "REJECTED"
    assert order_after["payment_status"] == "PAID"  # NOT silently marked refunded

def test_6_cancel_eligible_order():
    """
    Test 6: Cancel eligible order -> status becomes CANCELLED, audit notes preserved.
    """
    payload = {
        "items": [{"product_id": "prod-10", "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_details": {"pickup_person_name": "Karthik", "pickup_person_phone": "9841998877"},
        "payment_method": "STORE_PICKUP"
    }
    res = client.post("/api/v1/checkout/initiate", json=payload, headers=CUSTOMER_HEADERS)
    order_id = res.json()["order_id"]

    # Cancel order
    cancel_res = client.post(
        f"/api/v1/admin/orders/{order_id}/cancel",
        json={
            "cancellation_reason": "Customer Request",
            "cancellation_notes": "Customer requested cancellation before leaving home"
        },
        headers=ADMIN_HEADERS
    )
    assert cancel_res.status_code == 200, cancel_res.text
    cancelled_order = cancel_res.json()

    assert cancelled_order["status"] == "CANCELLED"
    assert cancelled_order["cancellation_reason"] == "Customer Request"
    assert cancelled_order["cancellation_notes"] == "Customer requested cancellation before leaving home"
    assert cancelled_order["cancelled_by"] is not None
    assert cancelled_order["cancelled_at"] is not None

def test_7_cancel_delivered_order_rejected():
    """
    Test 7: Cancel delivered or collected order -> rejected with 400 error.
    """
    payload = {
        "items": [{"product_id": "prod-10", "quantity": 1}],
        "delivery_method": "STORE_PICKUP",
        "pickup_details": {"pickup_person_name": "Anand", "pickup_person_phone": "9841554433"},
        "payment_method": "STORE_PICKUP"
    }
    res = client.post("/api/v1/checkout/initiate", json=payload, headers=CUSTOMER_HEADERS)
    order_id = res.json()["order_id"]

    # Confirm payment & mark collected
    client.post(f"/api/v1/admin/orders/{order_id}/confirm-store-payment", json={"notes": "Paid"}, headers=ADMIN_HEADERS)
    client.post(f"/api/v1/admin/orders/{order_id}/mark-collected", json={"notes": "Handed over"}, headers=ADMIN_HEADERS)

    # Attempt to cancel collected order
    cancel_res = client.post(
        f"/api/v1/admin/orders/{order_id}/cancel",
        json={"cancellation_reason": "Customer Request"},
        headers=ADMIN_HEADERS
    )
    assert cancel_res.status_code == 400
    assert "Cannot cancel an order that has already been delivered or collected" in cancel_res.json()["detail"]

def test_8_customer_access_isolation():
    """
    Test 8: Customer access isolation. Customer can only access their own order.
    """
    addr_id = setup_address()
    payload = {
        "items": [{"product_id": "prod-10", "quantity": 1}],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id,
        "payment_method": "DIRECT_UPI"
    }
    res = client.post("/api/v1/checkout/initiate", json=payload, headers=CUSTOMER_HEADERS)
    order_id = res.json()["order_id"]

    # Customer A accesses their order -> 200 OK
    res_a = client.get(f"/api/v1/customer/orders/{order_id}", headers=CUSTOMER_HEADERS)
    assert res_a.status_code == 200
    assert res_a.json()["id"] == order_id
    assert len(res_a.json()["items"]) == 1

    # Customer B accesses Customer A's order -> 404 (Not Found / Access Denied)
    res_b = client.get(f"/api/v1/customer/orders/{order_id}", headers=CUSTOMER_B_HEADERS)
    assert res_b.status_code in [403, 404]

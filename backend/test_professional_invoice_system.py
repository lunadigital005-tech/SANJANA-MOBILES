import pytest
import jwt
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings
from app.services.order_store import order_store
from app.services.catalog_store import catalog_store
from app.services.invoice_service import invoice_service


@pytest.fixture(autouse=True)
def setup_test_environment():
    # Ensure inventory has stock for test products
    catalog_store.inventory["prod-01"] = {"available_quantity": 50, "reserved_quantity": 0}
    catalog_store.inventory["prod-02"] = {"available_quantity": 50, "reserved_quantity": 0}


def create_customer_token(user_id: str, email: str = "customer@example.com", full_name: str = "Customer One"):
    secret = settings.SUPABASE_JWT_SECRET or "dev-secret-key-at-least-32-chars-long"
    payload = {
        "sub": user_id,
        "email": email,
        "role": "customer",
        "user_metadata": {"full_name": full_name}
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def create_admin_token(admin_id: str = "admin-root", email: str = "admin@sanjanamobiles.com"):
    return "mock-admin-token"


def create_test_address(client, token, state="Tamil Nadu"):
    addr_payload = {
        "full_name": "Test Customer",
        "mobile_number": "9876543210",
        "address_line1": "123 Main Street",
        "address_line2": "Near Bus Stand",
        "city": "Harur",
        "district": "Dharmapuri",
        "state": state,
        "pin_code": "636903",
        "country": "India",
        "is_default": True,
        "address_type": "home"
    }
    res = client.post("/api/v1/customer/addresses", json=addr_payload, headers={"Authorization": f"Bearer {token}"})
    if res.status_code == 201:
        return res.json()["id"]
    return None


def test_1_customer_view_receipt_returns_correct_invoice():
    client = TestClient(app)
    cust_id = "cust-inv-01"
    token = create_customer_token(cust_id, "sanjana.buyer@example.com", "Sanjana Buyer")
    addr_id = create_test_address(client, token)

    # 1. Place an order for this customer
    checkout_payload = {
        "items": [{"product_id": "prod-01", "quantity": 1}],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id,
        "payment_method": "UPI"
    }
    init_res = client.post(
        "/api/v1/checkout/initiate",
        json=checkout_payload,
        headers={"Authorization": f"Bearer {token}"}
    )
    assert init_res.status_code == 200, init_res.text
    order_data = init_res.json()
    order_id = order_data["order_id"]
    order_number = order_data["order_number"]

    # 2. Access invoice via /api/v1/orders/{order_number}/invoice
    res = client.get(
        f"/api/v1/orders/{order_number}/invoice",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200, res.text
    inv = res.json()

    assert inv["order_id"] == order_id
    assert inv["order_number"] == order_number
    assert inv["invoice_number"].startswith("SM/")
    assert inv["customer_info"]["full_name"] == "Sanjana Buyer"
    assert inv["customer_info"]["email"] == "sanjana.buyer@example.com"
    assert len(inv["items"]) == 1
    assert "SANJANA MOBILES" in inv["store_info"]["store_name"]

    # Also test via /api/v1/customer/orders/{order_id}/invoice
    res_customer = client.get(
        f"/api/v1/customer/orders/{order_id}/invoice",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res_customer.status_code == 200
    assert res_customer.json()["invoice_number"] == inv["invoice_number"]


def test_2_multiple_orders_unique_and_idempotent_invoice_numbers():
    client = TestClient(app)
    cust_id = "cust-inv-02"
    token = create_customer_token(cust_id, "buyer2@example.com", "Buyer Two")
    addr_id = create_test_address(client, token)

    # Create first order
    init1 = client.post(
        "/api/v1/checkout/initiate",
        json={"items": [{"product_id": "prod-01", "quantity": 1}], "delivery_method": "HOME_DELIVERY", "address_id": addr_id},
        headers={"Authorization": f"Bearer {token}"}
    ).json()

    # Create second order
    init2 = client.post(
        "/api/v1/checkout/initiate",
        json={"items": [{"product_id": "prod-02", "quantity": 2}], "delivery_method": "STORE_PICKUP", "pickup_person_name": "Buyer Two", "pickup_person_phone": "9876543210"},
        headers={"Authorization": f"Bearer {token}"}
    ).json()

    # Fetch invoice 1
    inv1_res = client.get(f"/api/v1/orders/{init1['order_number']}/invoice", headers={"Authorization": f"Bearer {token}"}).json()
    # Fetch invoice 2
    inv2_res = client.get(f"/api/v1/orders/{init2['order_number']}/invoice", headers={"Authorization": f"Bearer {token}"}).json()

    assert inv1_res["invoice_number"] != inv2_res["invoice_number"], "Invoice numbers must be distinct for different orders"
    assert inv1_res["invoice_number"].startswith("SM/")
    assert inv2_res["invoice_number"].startswith("SM/")

    # Idempotency check: fetching invoice 1 again returns the EXACT same invoice number
    inv1_again = client.get(f"/api/v1/orders/{init1['order_number']}/invoice", headers={"Authorization": f"Bearer {token}"}).json()
    assert inv1_again["invoice_number"] == inv1_res["invoice_number"]
    assert inv1_again["id"] == inv1_res["id"]


def test_3_cross_customer_access_denied_403():
    client = TestClient(app)
    token_a = create_customer_token("cust-alice", "alice@example.com", "Alice")
    token_b = create_customer_token("cust-bob", "bob@example.com", "Bob")
    addr_a = create_test_address(client, token_a)

    # Alice places order
    order_a = client.post(
        "/api/v1/checkout/initiate",
        json={"items": [{"product_id": "prod-01", "quantity": 1}], "delivery_method": "HOME_DELIVERY", "address_id": addr_a},
        headers={"Authorization": f"Bearer {token_a}"}
    ).json()

    # Bob tries to access Alice's invoice
    res = client.get(
        f"/api/v1/orders/{order_a['order_number']}/invoice",
        headers={"Authorization": f"Bearer {token_b}"}
    )
    assert res.status_code == 403, f"Expected 403 Forbidden, got {res.status_code}"
    assert "access denied" in res.json()["detail"].lower()


def test_4_invoice_pricing_and_gst_breakdown():
    client = TestClient(app)
    cust_id = "cust-inv-tax"
    token = create_customer_token(cust_id, "tax@example.com", "Tax Buyer")
    addr_id = create_test_address(client, token, state="Tamil Nadu")

    init_res = client.post(
        "/api/v1/checkout/initiate",
        json={"items": [{"product_id": "prod-01", "quantity": 1}], "delivery_method": "HOME_DELIVERY", "address_id": addr_id},
        headers={"Authorization": f"Bearer {token}"}
    ).json()

    inv = client.get(f"/api/v1/orders/{init_res['order_number']}/invoice", headers={"Authorization": f"Bearer {token}"}).json()
    pricing = inv["pricing"]

    # Verify retail pricing math
    assert pricing["grand_total"] > 0
    # Inclusive tax: taxable_amount + taxes == subtotal
    calculated_tax = pricing["cgst"] + pricing["sgst"] + pricing["igst"]
    assert round(pricing["taxable_amount"] + calculated_tax, 2) == round(pricing["subtotal"], 2)
    assert "Indian Rupees" in pricing["total_in_words"]
    assert "Only" in pricing["total_in_words"]


def test_5_admin_can_view_any_customer_invoice():
    client = TestClient(app)
    cust_token = create_customer_token("cust-any", "buyer@example.com", "Any Buyer")
    admin_token = create_admin_token()
    addr_id = create_test_address(client, cust_token)

    order = client.post(
        "/api/v1/checkout/initiate",
        json={"items": [{"product_id": "prod-01", "quantity": 1}], "delivery_method": "HOME_DELIVERY", "address_id": addr_id},
        headers={"Authorization": f"Bearer {cust_token}"}
    ).json()

    # Admin accesses via /admin/orders/{order_number}/invoice
    admin_res = client.get(
        f"/api/v1/admin/orders/{order['order_number']}/invoice",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_res.status_code == 200
    inv = admin_res.json()
    assert inv["order_number"] == order["order_number"]
    assert inv["customer_info"]["full_name"] == "Any Buyer"

    # Also admin accesses via common /orders/{order_number}/invoice
    common_res = client.get(
        f"/api/v1/orders/{order['order_number']}/invoice",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert common_res.status_code == 200


def test_6_delivered_and_completed_order_status_in_invoice():
    client = TestClient(app)
    cust_token = create_customer_token("cust-flow", "flow@example.com", "Flow Buyer")
    admin_token = create_admin_token()

    order = client.post(
        "/api/v1/checkout/initiate",
        json={"items": [{"product_id": "prod-01", "quantity": 1}], "delivery_method": "STORE_PICKUP", "pickup_person_name": "Flow Buyer", "pickup_person_phone": "9876543210"},
        headers={"Authorization": f"Bearer {cust_token}"}
    ).json()
    order_id = order["order_id"]

    # Admin confirms store payment -> ACCEPTED, PAID
    client.post(
        f"/api/v1/admin/orders/{order_id}/confirm-store-payment",
        json={"admin_notes": "Cash paid at counter"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    # Admin marks collected -> COLLECTED
    client.post(
        f"/api/v1/admin/orders/{order_id}/mark-collected",
        json={"admin_notes": "Handed to customer"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )

    # Admin advances to COMPLETED
    completed_res = client.patch(
        f"/api/v1/admin/orders/{order_id}/status",
        json={"new_status": "COMPLETED", "comment": "Order complete"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert completed_res.status_code == 200

    # Customer fetches invoice
    inv = client.get(
        f"/api/v1/orders/{order['order_number']}/invoice",
        headers={"Authorization": f"Bearer {cust_token}"}
    ).json()

    assert inv["order_status"] == "COMPLETED"
    assert inv["display_order_status"] == "Completed"
    assert inv["payment_info"]["payment_status"] == "PAID"
    assert inv["pricing"]["amount_paid"] == inv["pricing"]["grand_total"]
    assert inv["pricing"]["balance_due"] == 0.0

    # Verify viewing receipt NEVER accidentally modifies order status
    raw_order = order_store.orders[order_id]
    assert raw_order["status"] == "COMPLETED"


def test_7_unpaid_order_shows_pending_and_balance_due():
    client = TestClient(app)
    cust_token = create_customer_token("cust-unpaid", "unpaid@example.com", "Unpaid Buyer")

    order = client.post(
        "/api/v1/checkout/initiate",
        json={"items": [{"product_id": "prod-01", "quantity": 1}], "delivery_method": "STORE_PICKUP", "pickup_person_name": "Unpaid Buyer", "pickup_person_phone": "9876543210"},
        headers={"Authorization": f"Bearer {cust_token}"}
    ).json()

    inv = client.get(
        f"/api/v1/orders/{order['order_number']}/invoice",
        headers={"Authorization": f"Bearer {cust_token}"}
    ).json()

    assert inv["payment_info"]["payment_status"] == "PENDING"
    assert inv["payment_info"]["is_confirmed"] is False
    assert inv["pricing"]["amount_paid"] == 0.0
    assert inv["pricing"]["balance_due"] == inv["pricing"]["grand_total"]


def test_8_paid_order_shows_paid_and_zero_balance():
    client = TestClient(app)
    cust_token = create_customer_token("cust-paid", "paid@example.com", "Paid Buyer")
    admin_token = create_admin_token()
    addr_id = create_test_address(client, cust_token)

    order = client.post(
        "/api/v1/checkout/initiate",
        json={"items": [{"product_id": "prod-01", "quantity": 1}], "delivery_method": "HOME_DELIVERY", "address_id": addr_id},
        headers={"Authorization": f"Bearer {cust_token}"}
    ).json()
    order_id = order["order_id"]

    # Customer submits UPI UTR
    client.post(
        "/api/v1/checkout/submit-upi",
        json={"order_id": order_id, "upi_utr": "123456789012", "customer_notes": "Paid via GooglePay"},
        headers={"Authorization": f"Bearer {cust_token}"}
    )

    # Admin verifies payment
    verify_res = client.post(
        "/api/v1/admin/payments/verify",
        json={"order_id": order_id, "action": "VERIFY", "admin_notes": "Verified in SBI shop bank"},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert verify_res.status_code == 200, verify_res.text

    # Customer fetches invoice
    inv = client.get(
        f"/api/v1/orders/{order['order_number']}/invoice",
        headers={"Authorization": f"Bearer {cust_token}"}
    ).json()

    assert inv["payment_info"]["payment_status"] in ["PAID", "VERIFIED"]
    assert inv["payment_info"]["is_confirmed"] is True
    assert inv["payment_info"]["transaction_id"] == "123456789012"
    assert inv["pricing"]["amount_paid"] == inv["pricing"]["grand_total"]
    assert inv["pricing"]["balance_due"] == 0.0

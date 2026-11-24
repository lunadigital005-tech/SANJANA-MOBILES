import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

CUSTOMER_HEADERS = {"Authorization": "Bearer mock-customer-token"}
ADMIN_HEADERS = {"Authorization": "Bearer mock-admin-token"}

def setup_customer_address():
    """Ensure a valid Indian address exists for the customer"""
    valid_addr = {
        "full_name": "Elena Rostova",
        "mobile_number": "9876543211",
        "address_line1": "Flat 302, Green Meadows",
        "address_line2": "Mount Road",
        "city": "Chennai",
        "district": "Chennai",
        "state": "Tamil Nadu",
        "pin_code": "600001",
        "country": "India",
        "is_default": True,
        "address_type": "home"
    }
    resp = client.post("/api/v1/customer/addresses", json=valid_addr, headers=CUSTOMER_HEADERS)
    if resp.status_code == 201:
        return resp.json()["id"]
    
    # Retrieve existing
    list_resp = client.get("/api/v1/customer/addresses", headers=CUSTOMER_HEADERS)
    if list_resp.status_code == 200 and list_resp.json():
        return list_resp.json()[0]["id"]
    return "addr-demo-01"

def test_scenario_1_doorstep_delivery_order():
    """Test 1: Customer selects Doorstep Delivery -> Order created with delivery address and HOME_DELIVERY"""
    addr_id = setup_customer_address()

    checkout_payload = {
        "items": [
            {
                "product_id": "prod-01",
                "quantity": 1
            }
        ],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id,
        "payment_method": "DIRECT_UPI"
    }

    res = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=CUSTOMER_HEADERS)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["order_id"] is not None
    assert data["delivery_method"] == "HOME_DELIVERY"
    assert data["is_pay_at_store"] is False

    # Verify order state in admin orders
    order_id = data["order_id"]
    admin_res = client.get(f"/api/v1/admin/orders/{order_id}", headers=ADMIN_HEADERS)
    assert admin_res.status_code == 200
    order_data = admin_res.json()
    assert order_data["delivery_method"] == "HOME_DELIVERY"
    assert order_data["delivery_address"]["city"] == "Chennai"
    assert order_data["internal_delivery_assignment"] in ["UNASSIGNED", "STORE"]

def test_scenario_2_store_pickup_order_no_forced_online_payment():
    """Test 2: Customer selects Direct Store Pickup -> Pay at Store, payment_status PENDING, NO online payment forced"""
    checkout_payload = {
        "items": [
            {
                "product_id": "prod-02",
                "quantity": 1
            }
        ],
        "delivery_method": "STORE_PICKUP",
        "payment_method": "PAY_AT_STORE",
        "pickup_person_name": "Priya Sharma",
        "pickup_person_phone": "9840112233"
    }

    res = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=CUSTOMER_HEADERS)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["delivery_method"] == "STORE_PICKUP"
    assert data["payment_method"] == "PAY_AT_STORE"
    assert data["is_pay_at_store"] is True
    assert data["payment_status"] == "PENDING"
    assert "order_id" in data

    # Verify order in admin view
    order_id = data["order_id"]
    admin_res = client.get(f"/api/v1/admin/orders/{order_id}", headers=ADMIN_HEADERS)
    assert admin_res.status_code == 200
    order_data = admin_res.json()
    assert order_data["delivery_method"] == "STORE_PICKUP"
    assert order_data["payment_method"] == "PAY_AT_STORE"
    assert order_data["payment_status"] == "PENDING"
    assert order_data["status"] == "NEW"

def test_scenario_3_admin_store_pickup_confirm_payment_and_collected():
    """Test 3: Store Pickup actions: Admin confirms payment at counter (PAID) and marks collected (COLLECTED)"""
    # 1. Create a store pickup order
    checkout_payload = {
        "items": [
            {
                "product_id": "prod-01",
                "quantity": 1
            }
        ],
        "delivery_method": "STORE_PICKUP",
        "payment_method": "PAY_AT_STORE",
        "pickup_person_name": "Karthik Raja",
        "pickup_person_phone": "9940123456"
    }
    init_res = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=CUSTOMER_HEADERS)
    assert init_res.status_code == 200
    order_id = init_res.json()["order_id"]

    # 2. Admin confirms payment at store counter
    pay_res = client.post(
        f"/api/v1/admin/orders/{order_id}/confirm-store-payment",
        json={"notes": "Cash received at counter"},
        headers=ADMIN_HEADERS
    )
    assert pay_res.status_code == 200
    paid_order = pay_res.json()
    assert paid_order["payment_status"] == "PAID"

    # 3. Admin marks order as collected
    collect_res = client.post(
        f"/api/v1/admin/orders/{order_id}/mark-collected",
        json={"notes": "Customer physically collected parcel at store"},
        headers=ADMIN_HEADERS
    )
    assert collect_res.status_code == 200
    collected_order = collect_res.json()
    assert collected_order["status"] == "COLLECTED"

def test_scenario_4_admin_delivery_fulfillment_flow():
    """Test 4: Admin Can Deliver: Admin assigns order to self ('Admin Will Deliver') and updates progress to DELIVERED"""
    # 1. Create a doorstep order
    addr_id = setup_customer_address()
    checkout_payload = {
        "items": [
            {
                "product_id": "prod-01",
                "quantity": 1
            }
        ],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id,
        "payment_method": "DIRECT_UPI"
    }
    init_res = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=CUSTOMER_HEADERS)
    assert init_res.status_code == 200
    order_id = init_res.json()["order_id"]

    # 2. Admin assigns delivery to self ("Admin Will Deliver")
    assign_res = client.post(
        f"/api/v1/admin/orders/{order_id}/assign-delivery",
        json={"notes": "Admin will deliver personally on way home"},
        headers=ADMIN_HEADERS
    )
    assert assign_res.status_code == 200
    assigned_order = assign_res.json()
    assert assigned_order["internal_delivery_assignment"] == "ADMIN"
    assert assigned_order["admin_delivery_status"] == "ASSIGNED"
    assert assigned_order["admin_delivery_assigned_at"] is not None

    # 3. Admin marks Out for Delivery
    out_res = client.post(
        f"/api/v1/admin/orders/{order_id}/delivery-status",
        json={"status": "OUT_FOR_DELIVERY", "notes": "Admin is on the way"},
        headers=ADMIN_HEADERS
    )
    assert out_res.status_code == 200
    out_order = out_res.json()
    assert out_order["status"] == "OUT_FOR_DELIVERY"
    assert out_order["admin_delivery_status"] == "OUT_FOR_DELIVERY"

    # 4. Admin marks Delivered
    deliv_res = client.post(
        f"/api/v1/admin/orders/{order_id}/delivery-status",
        json={"status": "DELIVERED", "notes": "Handed over to customer safely"},
        headers=ADMIN_HEADERS
    )
    assert deliv_res.status_code == 200
    deliv_order = deliv_res.json()
    assert deliv_order["status"] == "DELIVERED"
    assert deliv_order["admin_delivery_status"] == "DELIVERED"
    assert deliv_order["admin_delivery_completed_at"] is not None

def test_scenario_5_admin_customers_list():
    """Test 5: Admin Customer Management returns customer records with total orders and total spent"""
    res = client.get("/api/v1/admin/customers", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    customers = res.json()
    assert isinstance(customers, list)
    assert len(customers) >= 1

    first = customers[0]
    assert "id" in first
    assert "full_name" in first
    assert "email" in first
    assert "role" in first
    assert "orders_count" in first
    assert "total_spent" in first

def test_scenario_6_admin_search_customer_by_mobile_and_name():
    """Test 6: Admin searches customers by name, email, and mobile number"""
    # Search by mobile or name for existing customer Elena
    res_name = client.get("/api/v1/admin/customers?search=Elena", headers=ADMIN_HEADERS)
    assert res_name.status_code == 200
    customers_name = res_name.json()
    assert any("Elena" in c.get("full_name", "") for c in customers_name)

    # Search by mobile number
    res_mobile = client.get("/api/v1/admin/customers?search=98765", headers=ADMIN_HEADERS)
    assert res_mobile.status_code == 200
    customers_mobile = res_mobile.json()
    assert len(customers_mobile) >= 1

def test_scenario_7_customer_forbidden_from_admin_customers():
    """Test 7: Normal customer access to /api/v1/admin/customers returns 403 Forbidden"""
    res = client.get("/api/v1/admin/customers", headers=CUSTOMER_HEADERS)
    assert res.status_code == 403
    assert "Administrative privileges required" in res.json().get("detail", "")

def test_scenario_8_customer_forbidden_from_customer_detail():
    """Test 8: Normal customer access to /api/v1/admin/customers/{id} returns 403 Forbidden"""
    res = client.get("/api/v1/admin/customers/customer-user-id-001", headers=CUSTOMER_HEADERS)
    assert res.status_code == 403
    assert "Administrative privileges required" in res.json().get("detail", "")

def test_scenario_8b_admin_can_access_customer_detail():
    """Bonus verification: Admin can access customer detail view with addresses, orders and WhatsApp link"""
    res = client.get("/api/v1/admin/customers/customer-user-id-001", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    detail = res.json()
    assert detail["id"] == "customer-user-id-001"
    assert "addresses" in detail
    assert "orders" in detail
    assert "whatsapp_url" in detail
    if detail.get("phone"):
        assert "wa.me/91" in detail["whatsapp_url"]

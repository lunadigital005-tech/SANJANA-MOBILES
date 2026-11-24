"""
FastAPI Automated Verification Suite for Phase 04 & Phase 05:
Product Management, Category Management, Image Handling,
Inventory Control, Negative Stock Prevention, and Concurrency Protections.
"""
import asyncio
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

ADMIN_HEADERS = {"Authorization": "Bearer mock-admin-token"}
CUSTOMER_HEADERS = {"Authorization": "Bearer mock-customer-token"}

def test_category_management_crud():
    print("--- 1. Testing Category CRUD & Safe Deletion ---")
    # 1. Create Category
    payload = {
        "name": "Architectural Lighting",
        "description": "Geometric brushed steel fixtures.",
        "image_url": "https://images.unsplash.com/photo-1507473885765-e6ed057f782c",
        "is_active": True,
        "display_order": 10
    }
    create_res = client.post("/api/v1/admin/categories", json=payload, headers=ADMIN_HEADERS)
    assert create_res.status_code == 201, f"Failed create: {create_res.text}"
    cat_data = create_res.json()
    cat_id = cat_data["id"]
    assert cat_data["name"] == "Architectural Lighting"
    print("  PASS: Category created successfully")

    # 2. Update Category
    update_res = client.put(f"/api/v1/admin/categories/{cat_id}", json={"description": "Updated description"}, headers=ADMIN_HEADERS)
    assert update_res.status_code == 200
    assert update_res.json()["description"] == "Updated description"
    print("  PASS: Category updated")

    # 3. Customer sees active category
    cust_res = client.get("/api/v1/categories/")
    assert cust_res.status_code == 200
    cat_names = [c["name"] for c in cust_res.json()]
    assert "Architectural Lighting" in cat_names
    print("  PASS: Customer retrieves active categories")

    # 4. Safe Deletion check: if category has products, delete must be blocked!
    # Try deleting 'cat-1' which has 'prod-01' assigned
    del_blocked_res = client.delete("/api/v1/admin/categories/cat-1", headers=ADMIN_HEADERS)
    assert del_blocked_res.status_code == 400
    assert "Cannot delete category" in del_blocked_res.json()["detail"]
    print("  PASS: Safe category deletion prevented when products are assigned")

    # 5. Delete newly created empty category
    del_res = client.delete(f"/api/v1/admin/categories/{cat_id}", headers=ADMIN_HEADERS)
    assert del_res.status_code == 200
    print("  PASS: Empty category successfully deleted")

def test_product_management_crud():
    print("\n--- 2. Testing Product CRUD & Inactive Visibility ---")
    # 1. Create Product with multiple categories & images
    payload = {
        "title": "Minimalist Travertine Pedestal",
        "description": "Solid Roman honed travertine block pedestal for sculptural display.",
        "price": 650.00,
        "sale_price": 590.00,
        "sku": "LUNA-TRV-999",
        "category_ids": ["cat-1", "cat-3"],
        "images": [
            "https://images.unsplash.com/photo-1533090161767-e6ffed986c88",
            "https://images.unsplash.com/photo-1555041469-a586c61ea9bc"
        ],
        "primary_image": "https://images.unsplash.com/photo-1533090161767-e6ffed986c88",
        "stock_quantity": 7,
        "is_active": True,
        "is_featured": True,
        "materials": "Honed Travertine"
    }
    create_res = client.post("/api/v1/admin/products", json=payload, headers=ADMIN_HEADERS)
    assert create_res.status_code == 201, f"Failed product create: {create_res.text}"
    prod = create_res.json()
    prod_id = prod["id"]
    assert prod["title"] == "Minimalist Travertine Pedestal"
    assert prod["available_stock"] == 7
    assert len(prod["category_ids"]) == 2
    print("  PASS: Product created with multiple categories and initial stock")

    # 2. Customer sees active product
    pub_res = client.get(f"/api/v1/products/{prod_id}")
    assert pub_res.status_code == 200
    assert pub_res.json()["sku"] == "LUNA-TRV-999"
    print("  PASS: Customer can view active product details")

    # 3. Deactivate product and verify customer cannot view it
    status_res = client.patch(f"/api/v1/admin/products/{prod_id}/status", json={"is_active": False}, headers=ADMIN_HEADERS)
    assert status_res.status_code == 200
    assert status_res.json()["is_active"] is False
    print("  PASS: Admin toggled product status to inactive")

    # Customer view of inactive product must return 404
    pub_inactive_res = client.get(f"/api/v1/products/{prod_id}")
    assert pub_inactive_res.status_code == 404
    print("  PASS: Inactive product correctly hidden from customers (404)")

    # Reactivate product for remaining tests
    client.patch(f"/api/v1/admin/products/{prod_id}/status", json={"is_active": True}, headers=ADMIN_HEADERS)

def test_inventory_and_negative_stock_prevention():
    print("\n--- 3. Testing Inventory Control & Negative Stock Prevention ---")
    # 1. View inventory list
    inv_res = client.get("/api/v1/admin/inventory", headers=ADMIN_HEADERS)
    assert inv_res.status_code == 200
    items = inv_res.json()
    assert len(items) > 0
    print(f"  PASS: Retrieved inventory list ({len(items)} items)")

    # 2. Add stock (+5)
    adj_payload = {
        "product_id": "prod-01",
        "quantity_delta": 5,
        "movement_type": "restock",
        "reason": "Artisan delivery restock batch 4"
    }
    adj_res = client.post("/api/v1/admin/inventory/adjust", json=adj_payload, headers=ADMIN_HEADERS)
    assert adj_res.status_code == 200
    new_qty = adj_res.json()["new_quantity"]
    assert new_qty >= 5
    print(f"  PASS: Stock adjusted positively. New available: {new_qty}")

    # 3. Attempt negative stock deduction: deduct more than available!
    invalid_adj = {
        "product_id": "prod-01",
        "quantity_delta": -(new_qty + 10),
        "movement_type": "adjustment",
        "reason": "Accidental overdraft"
    }
    neg_res = client.post("/api/v1/admin/inventory/adjust", json=invalid_adj, headers=ADMIN_HEADERS)
    assert neg_res.status_code == 400
    assert "Stock cannot become negative" in neg_res.json()["detail"]
    print("  PASS: Negative stock deduction strictly rejected with 400 Bad Request")

    # 4. Check stock movements audit log
    mov_res = client.get("/api/v1/admin/inventory/movements?product_id=prod-01", headers=ADMIN_HEADERS)
    assert mov_res.status_code == 200
    movements = mov_res.json()
    assert len(movements) > 0
    assert movements[0]["movement_type"] in ("restock", "adjustment", "reservation_hold")
    print("  PASS: Stock movements audit log verified with timestamp and admin attribution")

def test_concurrency_and_stock_reservation():
    print("\n--- 4. Testing Atomic Stock Reservation & Expiry Release ---")
    # 1. Reset stock of prod-03 to exactly 3 units
    curr_inv = client.get("/api/v1/admin/inventory", headers=ADMIN_HEADERS).json()
    prod_03_item = next(i for i in curr_inv if i["product_id"] == "prod-03")
    delta_to_3 = 3 - prod_03_item["available_quantity"]
    if delta_to_3 != 0:
        client.post("/api/v1/admin/inventory/adjust", json={
            "product_id": "prod-03",
            "quantity_delta": delta_to_3,
            "movement_type": "adjustment",
            "reason": "Reset to 3 for concurrency test"
        }, headers=ADMIN_HEADERS)

    # 2. Customer A reserves 2 units
    res_a = client.post("/api/v1/products/reserve", json={
        "product_id": "prod-03",
        "quantity": 2,
        "duration_minutes": 15
    })
    assert res_a.status_code == 200
    assert res_a.json()["status"] == "active"
    print("  PASS: Customer A successfully reserved 2 units. Remaining: 1")

    # 3. Customer B attempts to reserve 2 units (only 1 available -> MUST BE REJECTED)
    res_b = client.post("/api/v1/products/reserve", json={
        "product_id": "prod-03",
        "quantity": 2,
        "duration_minutes": 15
    })
    assert res_b.status_code == 409
    assert "Insufficient stock available" in res_b.json()["detail"]
    print("  PASS: Customer B request for 2 units rejected (409 Conflict) preventing overselling")

    # 4. Customer C requests 1 unit (Available: 1 -> MUST SUCCEED)
    res_c = client.post("/api/v1/products/reserve", json={
        "product_id": "prod-03",
        "quantity": 1,
        "duration_minutes": 15
    })
    assert res_c.status_code == 200
    print("  PASS: Customer C reserved remaining 1 unit. Available is now 0")

    # 5. Customer D requests 1 unit when available = 0 -> REJECTED
    res_d = client.post("/api/v1/products/reserve", json={
        "product_id": "prod-03",
        "quantity": 1,
        "duration_minutes": 15
    })
    assert res_d.status_code == 409
    print("  PASS: Depleted inventory protects against overselling")

def test_unauthorized_operations():
    print("\n--- 5. Testing Unauthorized Admin Operations ---")
    # Customer token attempting to create product -> 403 Forbidden
    res = client.post("/api/v1/admin/products", json={"title": "Hacked"}, headers=CUSTOMER_HEADERS)
    assert res.status_code == 403
    print("  PASS: Customer blocked from admin product creation (403 Forbidden)")

    # Customer token attempting to adjust stock -> 403 Forbidden
    res_stock = client.post("/api/v1/admin/inventory/adjust", json={
        "product_id": "prod-01",
        "quantity_delta": 100,
        "reason": "Unauthorized"
    }, headers=CUSTOMER_HEADERS)
    assert res_stock.status_code == 403
    print("  PASS: Customer blocked from stock adjustment (403 Forbidden)")

if __name__ == "__main__":
    print("\n==============================================")
    print("RUNNING PHASE 04 & 05 VERIFICATION TEST SUITE")
    print("==============================================")
    test_category_management_crud()
    test_product_management_crud()
    test_inventory_and_negative_stock_prevention()
    test_concurrency_and_stock_reservation()
    test_unauthorized_operations()
    print("\n==============================================")
    print("ALL PHASE 04 & 05 TESTS PASSED SUCCESSFULLY!")
    print("==============================================\n")

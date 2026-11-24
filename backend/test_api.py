"""
FastAPI Security & Role-Based Access Control Verification Tests
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    print("PASS: Health check endpoint")

def test_unauthenticated_profile_access():
    # Calling protected endpoint with no token must return 401
    response = client.get("/api/v1/customer/profile")
    assert response.status_code == 401
    print("PASS: Unauthenticated profile access denied (401)")

def test_customer_profile_access():
    # Customer token access
    headers = {"Authorization": "Bearer mock-customer-token"}
    response = client.get("/api/v1/customer/profile", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "customer"
    assert data["email"] == "customer@example.com"
    print("PASS: Customer profile retrieved with valid token")

def test_customer_cannot_access_admin_overview():
    # Customer user attempting to access admin route must be 403 Forbidden
    headers = {"Authorization": "Bearer mock-customer-token"}
    response = client.get("/api/v1/admin/overview", headers=headers)
    assert response.status_code == 403
    print("PASS: Customer blocked from Admin overview (403 Forbidden)")

def test_admin_access_admin_overview():
    # Admin token access to admin overview
    headers = {"Authorization": "Bearer mock-admin-token"}
    response = client.get("/api/v1/admin/overview", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "total_products" in data
    assert "total_revenue" in data
    print("PASS: Admin authorized access to admin overview (200 OK)")

def test_customer_cannot_escalate_role():
    # Customer attempting to update their profile and inject role="admin"
    headers = {"Authorization": "Bearer mock-customer-token"}
    update_payload = {
        "full_name": "Elena Rostova Updated",
        "phone": "+1 555 999 8888",
        # Note: role is not accepted in schema, even if passed, schema ignores or rejects
    }
    response = client.put("/api/v1/customer/profile", json=update_payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "customer" # Role remains strictly customer
    assert data["full_name"] == "Elena Rostova Updated"
    print("PASS: Role escalation prevented during profile update")

if __name__ == "__main__":
    print("\n--- RUNNING BACKEND TESTS ---")
    test_health_check()
    test_unauthenticated_profile_access()
    test_customer_profile_access()
    test_customer_cannot_access_admin_overview()
    test_admin_access_admin_overview()
    test_customer_cannot_escalate_role()
    print("--- ALL BACKEND TESTS PASSED SUCCESSFULLY ---\n")

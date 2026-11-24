import asyncio
import os
import httpx
from fastapi.testclient import TestClient

# Ensure environment variables are loaded
from app.core.config import settings
from app.main import app
from app.services.catalog_store import catalog_store

async def test_1_direct_supabase_fetch():
    print("\n--- TEST 1: Direct Supabase Product Fetch with SUPABASE_ANON_KEY ---")
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_ANON_KEY}",
        "Prefer": "return=representation"
    }
    url = f"{settings.SUPABASE_URL}/rest/v1/products?select=*,inventory(*),product_images(*),product_categories(*)"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=headers)
        print(f"Status Code: {resp.status_code}")
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
        rows = resp.json()
        print(f"Products in DB: {len(rows)}")
        for r in rows:
            print(f" - ID: {r.get('id')}")
            print(f"   Title: {r.get('title')}")
            print(f"   Price: {r.get('price')}")
            print(f"   Inventory: {r.get('inventory')}")
        assert len(rows) > 0, "Expected at least 1 product in Supabase"
        first = rows[0]
        assert "Minimalist Travertine Pedestal" in first.get("title", ""), f"Unexpected title: {first.get('title')}"
        assert float(first.get("price", 0)) == 650.0
    print("PASS: Direct Supabase fetch succeeded with 200 OK and accurate product data.")

async def test_2_local_fastapi_products_endpoint():
    print("\n--- TEST 2: Local FastAPI GET /api/v1/products/ with Anon Key Sync ---")
    client = TestClient(app)
    # Force a sync from Supabase
    await catalog_store._sync_from_supabase(force=True)
    resp = client.get("/api/v1/products/")
    print(f"Status Code: {resp.status_code}")
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
    data = resp.json()
    print(f"Total products returned: {data.get('total')}")
    print(f"Items count: {len(data.get('items', []))}")
    assert data.get("total") >= 1, "Expected at least 1 product in API response"
    item = data["items"][0]
    print(f"First item: Title='{item.get('title')}', Price={item.get('price')}, Stock={item.get('stock_quantity')}")
    assert "Minimalist Travertine Pedestal" in item.get("title", "")
    assert item.get("price") == 650.0
    assert item.get("stock_quantity") is not None
    print("PASS: Local FastAPI returned the real Supabase product and inventory correctly.")

async def test_3_error_handling_on_invalid_credentials():
    print("\n--- TEST 3: Safe Error Handling on Invalid Credentials / DB Error ---")
    # Temporarily corrupt the anon key in settings to simulate bad credentials
    original_key = settings.SUPABASE_ANON_KEY
    original_products = dict(catalog_store.products)
    try:
        settings.SUPABASE_ANON_KEY = "invalid_dummy_key_to_test_error_handling"
        catalog_store.products = {} # Clear local in-memory store
        catalog_store._synced_at = 0.0 # Force sync

        await catalog_store._sync_from_supabase(force=True)
        print(f"Last sync status: {catalog_store._last_sync_status}")
        print(f"Last sync error: {catalog_store._last_sync_error}")
        assert catalog_store._last_sync_status != 200, "Expected non-200 sync status"
        assert catalog_store._last_sync_error is not None
        # Verify secret key is NOT in the error message
        assert "invalid_dummy_key_to_test_error_handling" not in catalog_store._last_sync_error

        # Ensure that list_products raises HTTP 502 instead of returning { items: [], total: 0 } with 200 OK
        # Remove PYTEST_CURRENT_TEST if set so production error bubbling triggers
        pytest_env = os.environ.pop("PYTEST_CURRENT_TEST", None)
        try:
            client = TestClient(app)
            resp = client.get("/api/v1/products/")
            print(f"Products endpoint response under DB error: HTTP {resp.status_code} - {resp.json()}")
            assert resp.status_code == 502, f"Expected 502 Bad Gateway, got {resp.status_code}"
            assert "Failed to fetch products from database" in resp.json().get("detail", "")
        finally:
            if pytest_env is not None:
                os.environ["PYTEST_CURRENT_TEST"] = pytest_env
        print("PASS: Safe diagnostic error logged and HTTP 502 returned on DB auth failure.")
    finally:
        # Restore original settings and products
        settings.SUPABASE_ANON_KEY = original_key
        catalog_store.products = original_products
        await catalog_store._sync_from_supabase(force=True)

async def test_4_admin_write_security():
    print("\n--- TEST 4: Admin Write Security & Key Separation ---")
    # Verify _get_supabase_read_headers uses anon key
    read_headers = catalog_store._get_supabase_read_headers()
    assert read_headers["apikey"] == settings.SUPABASE_ANON_KEY
    print("Read headers correctly use SUPABASE_ANON_KEY.")

    # Verify _get_supabase_admin_headers strictly uses SUPABASE_SERVICE_ROLE_KEY
    # When SUPABASE_SERVICE_ROLE_KEY is empty or missing, admin headers must NOT fall back to anon key
    orig_srv_key = settings.SUPABASE_SERVICE_ROLE_KEY
    try:
        settings.SUPABASE_SERVICE_ROLE_KEY = ""
        admin_headers = catalog_store._get_supabase_admin_headers()
        assert admin_headers == {}, f"Admin headers should be empty when service role key is absent, got {admin_headers}"
        print("PASS: Admin headers strictly refuse to fall back to anonymous key.")
    finally:
        settings.SUPABASE_SERVICE_ROLE_KEY = orig_srv_key

async def main():
    await test_1_direct_supabase_fetch()
    await test_2_local_fastapi_products_endpoint()
    await test_3_error_handling_on_invalid_credentials()
    await test_4_admin_write_security()
    print("\nALL 4 INTEGRATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())

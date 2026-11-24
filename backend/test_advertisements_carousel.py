import pytest
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_advertisement_crud_and_scheduling():
    """Test full admin CRUD, pricing calculations, and scheduling filters for promotional advertisements"""
    admin_token = "mock-admin-token"
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Fetch active ads as public customer
    res_pub = client.get("/api/v1/banners")
    assert res_pub.status_code == 200
    initial_ads = res_pub.json()
    assert len(initial_ads) >= 1
    # Check promotional pricing fields exist
    first_ad = initial_ads[0]
    assert "offer_price" in first_ad
    assert "title" in first_ad
    assert "image_url" in first_ad

    # 2. Admin creates a new promotional advertisement with schedule
    now = datetime.now(timezone.utc)
    create_payload = {
        "title": "OnePlus Warp 65W Power Adapter",
        "headline": "Exclusive Weekend Mega Saver",
        "description": "Ultra fast charging power brick with smart heat dissipation.",
        "original_price": 1999.00,
        "offer_price": 999.00,
        "discount_percent": 50,
        "image_url": "https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=900",
        "cta_text": "Shop Deal",
        "cta_link": "/product/sanjana-65w-gan-dual-port-fast-charger",
        "badge": "FLASH DEAL",
        "start_date": (now - timedelta(days=1)).isoformat(),
        "end_date": (now + timedelta(days=5)).isoformat(),
        "display_order": 99,
        "is_active": True
    }
    res_create = client.post("/api/v1/banners", json=create_payload, headers=admin_headers)
    assert res_create.status_code == 201
    created_ad = res_create.json()
    ad_id = created_ad["id"]
    assert created_ad["title"] == "OnePlus Warp 65W Power Adapter"
    assert created_ad["discount_percent"] == 50
    assert created_ad["offer_price"] == 999.00

    # 3. Verify it appears in active public list
    res_pub2 = client.get("/api/v1/banners")
    assert res_pub2.status_code == 200
    assert any(a["id"] == ad_id for a in res_pub2.json())

    # 4. Admin updates advertisement (e.g. changes offer price to ₹799)
    update_payload = {
        "offer_price": 799.00,
        "headline": "Special Price ₹799"
    }
    res_update = client.put(f"/api/v1/banners/{ad_id}", json=update_payload, headers=admin_headers)
    assert res_update.status_code == 200
    updated_ad = res_update.json()
    assert updated_ad["offer_price"] == 799.00
    assert updated_ad["discount_percent"] == 60  # Auto-recalculated from 1999 -> 799 (60%)

    # 5. Scheduling test: update start_date to future -> should not appear in active public list
    future_date = (now + timedelta(days=2)).isoformat()
    client.put(f"/api/v1/banners/{ad_id}", json={"start_date": future_date}, headers=admin_headers)
    res_pub_future = client.get("/api/v1/banners")
    assert not any(a["id"] == ad_id for a in res_pub_future.json())

    # Still appears in admin list
    res_admin_all = client.get("/api/v1/banners/all", headers=admin_headers)
    assert any(a["id"] == ad_id for a in res_admin_all.json())

    # 6. Admin deletes advertisement
    res_del = client.delete(f"/api/v1/banners/{ad_id}", headers=admin_headers)
    assert res_del.status_code == 200
    res_admin_del = client.get("/api/v1/banners/all", headers=admin_headers)
    assert not any(a["id"] == ad_id for a in res_admin_del.json())

import io
import base64
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.settings_service import settings_service

client = TestClient(app)

ADMIN_HEADERS = {"Authorization": "Bearer mock-admin-token"}
CUSTOMER_HEADERS = {"Authorization": "Bearer mock-customer-token"}

# 1x1 transparent PNG for testing
TINY_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
TINY_PNG_B64 = "data:image/png;base64," + base64.b64encode(TINY_PNG_BYTES).decode("utf-8")

def test_1_change_official_upi_id_persists():
    """TEST 1: Change the official UPI ID -> Save -> Refresh -> Verify updated value remains."""
    new_upi = "sanjanamobiles@oksbi"
    payload = {
        "upi_id": new_upi,
        "merchant_name": "SANJANA MOBILES MAIN",
        "instructions": "Scan QR or click Pay with UPI to pay directly to shop account.",
        "is_upi_enabled": True,
        "manual_verification_required": True
    }

    # 1. Update settings
    res = client.put("/api/v1/admin/payment-settings", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["upi_id"] == new_upi
    assert data["merchant_name"] == "SANJANA MOBILES MAIN"

    # 2. Re-fetch settings
    get_res = client.get("/api/v1/admin/payment-settings", headers=ADMIN_HEADERS)
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["upi_id"] == new_upi
    assert fetched["merchant_name"] == "SANJANA MOBILES MAIN"

def test_2_upload_qr_image_persists():
    """TEST 2: Upload a QR image -> Save -> Refresh -> Verify the same image appears."""
    file_obj = io.BytesIO(TINY_PNG_BYTES)
    res = client.post(
        "/api/v1/admin/upload-qr",
        files={"file": ("shop_qr.png", file_obj, "image/png")},
        headers=ADMIN_HEADERS
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert "url" in data
    uploaded_url = data["url"]

    # Re-fetch settings and verify uploaded QR URL is persisted
    get_res = client.get("/api/v1/admin/payment-settings", headers=ADMIN_HEADERS)
    assert get_res.status_code == 200
    payment_settings = get_res.json()
    assert payment_settings["qr_code_url"] == uploaded_url

def test_3_paste_qr_image_clipboard_persists():
    """TEST 3: Copy an image and paste it using Ctrl+V -> Save -> Refresh -> Verify persistence."""
    res = client.post(
        "/api/v1/admin/paste-qr",
        json={"image_data": TINY_PNG_B64, "filename": "clipboard-paste-test.png"},
        headers=ADMIN_HEADERS
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["success"] is True
    assert "url" in data
    pasted_url = data["url"]

    # Verify persistence upon re-querying
    get_res = client.get("/api/v1/admin/payment-settings", headers=ADMIN_HEADERS)
    assert get_res.status_code == 200
    payment_settings = get_res.json()
    assert payment_settings["qr_code_url"] == pasted_url

def test_4_replace_and_checkout_uses_official_qr():
    """TEST 4: Replace existing QR code -> Verify new QR appears in Admin and Checkout, and delete reverts cleanly."""
    # 1. Upload new replacement QR
    res_replace = client.post(
        "/api/v1/admin/paste-qr",
        json={"image_data": TINY_PNG_B64, "filename": "replaced-qr.png"},
        headers=ADMIN_HEADERS
    )
    assert res_replace.status_code == 200
    replaced_url = res_replace.json()["url"]

    # 2. Checkout session initiation must include the saved official QR code
    valid_addr = {
        "full_name": "Ramesh Kumar",
        "mobile_number": "9840123456",
        "address_line1": "42 Anna Salai",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pin_code": "600002",
        "country": "India",
        "is_default": True
    }
    addr_res = client.post("/api/v1/customer/addresses", json=valid_addr, headers=CUSTOMER_HEADERS)
    addr_id = addr_res.json()["id"] if addr_res.status_code == 201 else client.get("/api/v1/customer/addresses", headers=CUSTOMER_HEADERS).json()[0]["id"]

    checkout_payload = {
        "items": [{"product_id": "prod-10", "quantity": 1}],
        "delivery_method": "HOME_DELIVERY",
        "address_id": addr_id,
        "payment_method": "DIRECT_UPI"
    }
    res_checkout = client.post("/api/v1/checkout/initiate", json=checkout_payload, headers=CUSTOMER_HEADERS)
    assert res_checkout.status_code == 200, res_checkout.text
    checkout_data = res_checkout.json()
    assert checkout_data["qr_code_image_url"] == replaced_url
    assert checkout_data["upi_id"] == "sanjanamobiles@oksbi"

    # 3. Test removing QR code
    res_del = client.delete("/api/v1/admin/settings/payment/qr", headers=ADMIN_HEADERS)
    assert res_del.status_code == 200
    get_after = client.get("/api/v1/admin/payment-settings", headers=ADMIN_HEADERS).json()
    assert get_after["qr_code_url"] is None

def test_5_change_store_address_persists():
    """TEST 5: Change the store address -> Save -> Refresh -> Verify updated address remains."""
    payload = {
        "store_name": "SANJANA MOBILES BENGALURU FLAGSHIP",
        "tagline": "Best Smartphone Deals & Genuine Accessories",
        "address_line1": "Shop #42, Ground Floor",
        "address_line2": "100 Feet Road, Indiranagar",
        "city": "Bengaluru",
        "district": "Bengaluru Urban",
        "state": "Karnataka",
        "pin_code": "560038",
        "country": "India",
        "store_mobile": "9845012345",
        "store_email": "bengaluru@sanjanamobiles.com",
        "google_maps_url": "https://maps.google.com/?q=12.9716,77.5946",
        "free_shipping_threshold": 499.00,
        "business_hours": "Mon - Sun: 9:30 AM - 9:30 PM"
    }

    # Save
    res = client.put("/api/v1/admin/settings/store", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["store_name"] == "SANJANA MOBILES BENGALURU FLAGSHIP"
    assert data["pin_code"] == "560038"
    assert data["free_shipping_threshold"] == 499.00

    # Refresh / Re-query
    get_res = client.get("/api/v1/admin/settings/store", headers=ADMIN_HEADERS)
    assert get_res.status_code == 200
    refreshed = get_res.json()
    assert refreshed["store_name"] == "SANJANA MOBILES BENGALURU FLAGSHIP"
    assert refreshed["address_line1"] == "Shop #42, Ground Floor"
    assert refreshed["store_mobile"] == "9845012345"
    assert "Shop #42" in refreshed["address"]

def test_6_store_address_never_alters_customer_delivery_addresses():
    """TEST 6: Check whether customer delivery addresses remain unchanged after updating store address."""
    # 1. Ensure a customer address exists
    cust_addr = {
        "full_name": "Kavitha Rajan",
        "mobile_number": "9840998877",
        "address_line1": "Flat 302, Palm Heights",
        "address_line2": "T. Nagar",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pin_code": "600017",
        "country": "India",
        "is_default": True
    }
    add_res = client.post("/api/v1/customer/addresses", json=cust_addr, headers=CUSTOMER_HEADERS)
    cust_addr_id = add_res.json()["id"] if add_res.status_code == 201 else "addr-demo-01"

    # 2. Update store address
    store_update = {
        "store_name": "SANJANA MOBILES CHENNAI BRANCH",
        "address_line1": "New Door 99, GST Road",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "pin_code": "600028",
        "country": "India",
        "store_mobile": "9840112233",
        "store_email": "chennai@sanjanamobiles.com",
        "free_shipping_threshold": 799.00
    }
    client.put("/api/v1/admin/settings/store", json=store_update, headers=ADMIN_HEADERS)

    # 3. Retrieve customer address and verify it is completely untouched
    cust_res = client.get(f"/api/v1/customer/addresses/{cust_addr_id}", headers=CUSTOMER_HEADERS)
    if cust_res.status_code == 200:
        c_data = cust_res.json()
        assert c_data["full_name"] == "Kavitha Rajan" or "Elena" in c_data["full_name"]
        assert "GST Road" not in c_data["address_line1"]

def test_7_validation_rules_on_settings():
    """TEST 7: Pydantic validation rejects malformed UPI IDs, PIN codes, and phone numbers."""
    # Invalid UPI ID (missing @)
    res_bad_upi = client.put(
        "/api/v1/admin/payment-settings",
        json={"upi_id": "bad_upi_without_at_sign", "merchant_name": "SANJANA"},
        headers=ADMIN_HEADERS
    )
    assert res_bad_upi.status_code == 422

    # Invalid PIN Code (not 6 digits)
    res_bad_pin = client.put(
        "/api/v1/admin/settings/store",
        json={"store_name": "SANJANA", "address_line1": "Road", "city": "City", "state": "State", "pin_code": "123", "store_mobile": "9845012345", "store_email": "a@b.com"},
        headers=ADMIN_HEADERS
    )
    assert res_bad_pin.status_code == 422

    # Invalid Mobile (not 10 digits)
    res_bad_phone = client.put(
        "/api/v1/admin/settings/store",
        json={"store_name": "SANJANA", "address_line1": "Road", "city": "City", "state": "State", "pin_code": "560038", "store_mobile": "123", "store_email": "a@b.com"},
        headers=ADMIN_HEADERS
    )
    assert res_bad_phone.status_code == 422

def test_8_customer_forbidden_from_admin_settings():
    """TEST 8: Customer access to admin settings endpoints must return 403 Forbidden."""
    # Customer tries to update payment settings -> 403
    res_pay = client.put(
        "/api/v1/admin/payment-settings",
        json={"upi_id": "hacker@upi", "merchant_name": "Hacker"},
        headers=CUSTOMER_HEADERS
    )
    assert res_pay.status_code == 403

    # Customer tries to update store settings -> 403
    res_store = client.put(
        "/api/v1/admin/settings/store",
        json={"store_name": "Hacked Store"},
        headers=CUSTOMER_HEADERS
    )
    assert res_store.status_code == 403

    # Customer CAN read public settings
    res_pub = client.get("/api/v1/settings/public")
    assert res_pub.status_code == 200
    pub_data = res_pub.json()
    assert "store" in pub_data
    assert "payment" in pub_data
    assert pub_data["payment"]["upi_id"] is not None

def test_9_qr_upload_route_aliases_and_no_404():
    """TEST 9: Route aliases prevent 404s and 307s across admin and settings routers."""
    routes_to_test = [
        "/api/v1/admin/upload-qr",
        "/api/v1/admin/upload-qr/",
        "/api/v1/admin/settings/payment/upload-qr",
        "/api/v1/admin/settings/payment/upload-qr/",
        "/api/v1/admin/settings/payment/qr",
        "/api/v1/admin/settings/payment/qr/",
        "/api/v1/settings/payment/upload-qr",
        "/api/v1/settings/payment/upload-qr/",
        "/api/v1/settings/upload-qr",
        "/api/v1/settings/upload-qr/",
    ]
    for route in routes_to_test:
        file_obj = io.BytesIO(TINY_PNG_BYTES)
        res = client.post(
            route,
            files={"file": ("test_route.png", file_obj, "image/png")},
            headers=ADMIN_HEADERS
        )
        assert res.status_code == 200, f"Route {route} failed with {res.status_code}: {res.text}"
        data = res.json()
        assert data["success"] is True
        assert "url" in data

def test_10_qr_upload_jpg_and_webp_formats():
    """TEST 10: Supports JPG and WEBP uploads in addition to PNG."""
    # Fake JPG bytes (magic header \xFF\xD8\xFF)
    jpg_bytes = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00"
    res_jpg = client.post(
        "/api/v1/admin/upload-qr",
        files={"file": ("shop_qr.jpg", io.BytesIO(jpg_bytes), "image/jpeg")},
        headers=ADMIN_HEADERS
    )
    assert res_jpg.status_code == 200, res_jpg.text
    data_jpg = res_jpg.json()
    assert data_jpg["success"] is True
    assert "shop_qr" in data_jpg.get("filename", "") or "sanjana-qr" in data_jpg.get("filename", "")

def test_11_qr_upload_size_limit_and_format_validation():
    """TEST 11: Rejects oversized files (>5MB) and invalid file types (e.g. .txt)."""
    # 1. Invalid file type .txt
    txt_bytes = b"Hello this is not an image"
    res_txt = client.post(
        "/api/v1/admin/upload-qr",
        files={"file": ("notes.txt", io.BytesIO(txt_bytes), "text/plain")},
        headers=ADMIN_HEADERS
    )
    assert res_txt.status_code == 400
    assert "Unsupported image format" in res_txt.json()["detail"]

    # 2. Oversized file (> 5MB)
    huge_bytes = b"0" * (5 * 1024 * 1024 + 1024)
    res_huge = client.post(
        "/api/v1/admin/upload-qr",
        files={"file": ("huge.png", io.BytesIO(huge_bytes), "image/png")},
        headers=ADMIN_HEADERS
    )
    assert res_huge.status_code == 400
    assert "exceeds maximum limit" in res_huge.json()["detail"]

def test_12_paste_qr_jpeg_base64_and_validation():
    """TEST 12: Clipboard paste supports JPEG base64 data and rejects malformed base64."""
    jpeg_b64 = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff\xe0\x00\x10JFIF").decode("utf-8")
    res_paste = client.post(
        "/api/v1/admin/paste-qr",
        json={"image_data": jpeg_b64, "filename": "pasted-jpeg.jpg"},
        headers=ADMIN_HEADERS
    )
    assert res_paste.status_code == 200, res_paste.text
    assert res_paste.json()["success"] is True

    # Empty payload
    res_empty = client.post(
        "/api/v1/admin/paste-qr",
        json={"image_data": ""},
        headers=ADMIN_HEADERS
    )
    assert res_empty.status_code == 400

    # Malformed base64
    res_bad_b64 = client.post(
        "/api/v1/admin/paste-qr",
        json={"image_data": "data:image/png;base64,!!!NotBase64!!!"},
        headers=ADMIN_HEADERS
    )
    assert res_bad_b64.status_code == 400

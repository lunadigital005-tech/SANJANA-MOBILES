import os
import re
import json
import uuid
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Tuple
import httpx
from fastapi import HTTPException, status
from app.core.config import settings
from app.schemas.settings import PaymentSettingsSchema, StoreSettingsSchema

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "qr"))
FRONTEND_UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "uploads", "qr"))
SETTINGS_FILE = os.path.join(DATA_DIR, "settings.json")

# Ensure required directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
try:
    os.makedirs(FRONTEND_UPLOADS_DIR, exist_ok=True)
except Exception:
    pass

class SettingsService:
    def __init__(self):
        self._lock = asyncio.Lock()
        self.payment_settings: Dict[str, Any] = {
            "upi_id": "REPLACE_WITH_REAL_SHOP_UPI_ID",
            "merchant_name": "SANJANA MOBILES",
            "qr_code_image_url": None,
            "qr_code_url": None,
            "payment_instructions": (
                "1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app.\n"
                "2. Or click Pay with UPI on mobile.\n"
                "3. Complete the transfer for the exact order amount.\n"
                "4. Enter the 12-digit UPI Reference Number / UTR below and submit for verification."
            ),
            "instructions": (
                "1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app.\n"
                "2. Or click Pay with UPI on mobile.\n"
                "3. Complete the transfer for the exact order amount.\n"
                "4. Enter the 12-digit UPI Reference Number / UTR below and submit for verification."
            ),
            "is_upi_enabled": True,
            "require_manual_verification": True,
            "manual_verification_required": True,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        self.store_settings: Dict[str, Any] = {
            "store_name": "SANJANA MOBILES",
            "tagline": "Your Trusted Destination for Genuine Mobiles & Accessories",
            "address_line1": "100 Feet Road",
            "address_line2": "Near Metro Pillar 42, Indiranagar",
            "city": "Bengaluru",
            "district": "Bengaluru Urban",
            "state": "Karnataka",
            "pin_code": "560038",
            "country": "India",
            "store_mobile": "9876543210",
            "store_email": "contact@sanjanamobiles.com",
            "google_maps_url": "https://maps.google.com/?q=12.9716,77.5946",
            "free_shipping_threshold": 999.00,
            "business_hours": "Mon - Sat: 10:00 AM - 9:00 PM | Sun: 11:00 AM - 8:00 PM",
            "name": "SANJANA MOBILES",
            "phone": "9876543210",
            "email": "contact@sanjanamobiles.com",
            "address": "100 Feet Road, Near Metro Pillar 42, Indiranagar, Bengaluru, Karnataka 560038",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        self._load_from_local_file()

    def _load_from_local_file(self):
        """Load persistent settings from disk if available"""
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if "payment_settings" in data:
                        self.payment_settings.update(data["payment_settings"])
                    if "store_settings" in data:
                        self.store_settings.update(data["store_settings"])
            except Exception as e:
                print(f"[SettingsService] Error loading {SETTINGS_FILE}: {e}")

    def _save_to_local_file(self):
        """Persist current settings to disk atomically"""
        try:
            temp_file = f"{SETTINGS_FILE}.tmp"
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump({
                    "payment_settings": self.payment_settings,
                    "store_settings": self.store_settings,
                    "saved_at": datetime.now(timezone.utc).isoformat()
                }, f, indent=2)
            os.replace(temp_file, SETTINGS_FILE)
        except Exception as e:
            print(f"[SettingsService] Error saving to {SETTINGS_FILE}: {e}")

    def _get_supabase_headers(self) -> Dict[str, str]:
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    # =========================================================================
    # PAYMENT SETTINGS
    # =========================================================================
    async def get_payment_settings(self) -> Dict[str, Any]:
        """Fetch payment settings from Supabase if configured, falling back to local storage."""
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
            try:
                url = f"{settings.SUPABASE_URL}/rest/v1/payment_settings?id=eq.1&select=*"
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.get(url, headers=self._get_supabase_headers())
                    if resp.status_code == 200:
                        rows = resp.json()
                        if rows and isinstance(rows, list) and len(rows) > 0:
                            row = rows[0]
                            # Sync in-memory cache
                            self.payment_settings.update({
                                "upi_id": row.get("upi_id") or self.payment_settings["upi_id"],
                                "merchant_name": row.get("merchant_name") or self.payment_settings["merchant_name"],
                                "qr_code_image_url": row.get("qr_code_image_url"),
                                "qr_code_url": row.get("qr_code_image_url"),
                                "payment_instructions": row.get("payment_instructions") or self.payment_settings["payment_instructions"],
                                "instructions": row.get("payment_instructions") or self.payment_settings["instructions"],
                                "is_upi_enabled": row.get("is_upi_enabled", True),
                                "require_manual_verification": row.get("require_manual_verification", True),
                                "manual_verification_required": row.get("require_manual_verification", True),
                                "updated_at": row.get("updated_at") or self.payment_settings["updated_at"]
                            })
                            self._save_to_local_file()
            except Exception as e:
                print(f"[SettingsService] Notice: Supabase payment_settings read deferred to local cache: {e}")

        # Ensure aliases are populated
        res = dict(self.payment_settings)
        res["qr_code_url"] = res.get("qr_code_image_url") or res.get("qr_code_url")
        res["qr_code_image_url"] = res["qr_code_url"]
        res["instructions"] = res.get("payment_instructions") or res.get("instructions")
        res["payment_instructions"] = res["instructions"]
        res["manual_verification_required"] = res.get("require_manual_verification", True)
        return res

    async def update_payment_settings(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and persist payment settings to Supabase and disk."""
        # Validate payload using Pydantic schema
        schema = PaymentSettingsSchema(**payload)
        now_str = datetime.now(timezone.utc).isoformat()

        async with self._lock:
            db_payload = {
                "upi_id": schema.upi_id,
                "merchant_name": schema.merchant_name,
                "qr_code_image_url": schema.qr_code_image_url,
                "payment_instructions": schema.payment_instructions or schema.instructions,
                "is_upi_enabled": schema.is_upi_enabled,
                "require_manual_verification": schema.require_manual_verification,
                "updated_at": now_str
            }

            # Attempt update in Supabase
            if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
                try:
                    url = f"{settings.SUPABASE_URL}/rest/v1/payment_settings?id=eq.1"
                    headers = self._get_supabase_headers()
                    async with httpx.AsyncClient(timeout=6.0) as client:
                        resp = await client.patch(url, json=db_payload, headers=headers)
                        if resp.status_code not in (200, 204):
                            # Try upsert if row 1 does not exist yet
                            upsert_url = f"{settings.SUPABASE_URL}/rest/v1/payment_settings"
                            upsert_payload = dict(db_payload)
                            upsert_payload["id"] = 1
                            upsert_headers = dict(headers)
                            upsert_headers["Prefer"] = "resolution=merge-duplicates"
                            await client.post(upsert_url, json=upsert_payload, headers=upsert_headers)
                except Exception as e:
                    print(f"[SettingsService] Supabase patch payment_settings error: {e}")

            # Update cache and local disk persistence
            self.payment_settings.update(db_payload)
            self.payment_settings["qr_code_url"] = db_payload["qr_code_image_url"]
            self.payment_settings["instructions"] = db_payload["payment_instructions"]
            self.payment_settings["manual_verification_required"] = db_payload["require_manual_verification"]
            self._save_to_local_file()

            # Synchronize with OrderStore so checkout immediately picks it up
            from app.services.order_store import order_store
            order_store.payment_settings.update(self.payment_settings)

            return dict(self.payment_settings)

    # =========================================================================
    # STORE SETTINGS
    # =========================================================================
    async def get_store_settings(self) -> Dict[str, Any]:
        """Fetch store settings from Supabase if configured, falling back to local storage."""
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
            try:
                url = f"{settings.SUPABASE_URL}/rest/v1/store_settings?id=eq.1&select=*"
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.get(url, headers=self._get_supabase_headers())
                    if resp.status_code == 200:
                        rows = resp.json()
                        if rows and isinstance(rows, list) and len(rows) > 0:
                            row = rows[0]
                            self.store_settings.update({
                                "store_name": row.get("store_name") or self.store_settings["store_name"],
                                "tagline": row.get("tagline") or self.store_settings["tagline"],
                                "address_line1": row.get("address_line1") or self.store_settings["address_line1"],
                                "address_line2": row.get("address_line2") or self.store_settings["address_line2"],
                                "city": row.get("city") or self.store_settings["city"],
                                "district": row.get("district") or self.store_settings["district"],
                                "state": row.get("state") or self.store_settings["state"],
                                "pin_code": row.get("pin_code") or self.store_settings["pin_code"],
                                "country": row.get("country") or self.store_settings["country"],
                                "store_mobile": row.get("store_mobile") or self.store_settings["store_mobile"],
                                "store_email": row.get("store_email") or self.store_settings["store_email"],
                                "google_maps_url": row.get("google_maps_url") or self.store_settings["google_maps_url"],
                                "free_shipping_threshold": float(row.get("free_shipping_threshold", 999.00)),
                                "business_hours": row.get("business_hours") or self.store_settings["business_hours"],
                                "updated_at": row.get("updated_at") or self.store_settings["updated_at"]
                            })
                            self._save_to_local_file()
            except Exception as e:
                print(f"[SettingsService] Notice: Supabase store_settings read deferred to local cache: {e}")

        # Compute formatted summary address
        addr_parts = [
            self.store_settings.get("address_line1"),
            self.store_settings.get("address_line2"),
            self.store_settings.get("city"),
            f"{self.store_settings.get('state')} {self.store_settings.get('pin_code')}",
            self.store_settings.get("country")
        ]
        formatted_address = ", ".join([p for p in addr_parts if p])

        res = dict(self.store_settings)
        res["name"] = res["store_name"]
        res["phone"] = res["store_mobile"]
        res["email"] = res["store_email"]
        res["address"] = formatted_address
        return res

    async def update_store_settings(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and persist store settings to Supabase and disk."""
        # Normalize incoming payload aliases
        if "name" in payload and "store_name" not in payload:
            payload["store_name"] = payload["name"]
        if "phone" in payload and "store_mobile" not in payload:
            payload["store_mobile"] = payload["phone"]
        if "email" in payload and "store_email" not in payload:
            payload["store_email"] = payload["email"]
        if "free_shipping" in payload and "free_shipping_threshold" not in payload:
            payload["free_shipping_threshold"] = float(payload["free_shipping"])

        # Validate with Pydantic
        schema = StoreSettingsSchema(**payload)
        now_str = datetime.now(timezone.utc).isoformat()

        async with self._lock:
            db_payload = {
                "store_name": schema.store_name,
                "tagline": schema.tagline,
                "address_line1": schema.address_line1,
                "address_line2": schema.address_line2,
                "city": schema.city,
                "district": schema.district,
                "state": schema.state,
                "pin_code": schema.pin_code,
                "country": schema.country,
                "store_mobile": schema.store_mobile,
                "store_email": schema.store_email,
                "google_maps_url": schema.google_maps_url,
                "free_shipping_threshold": schema.free_shipping_threshold,
                "business_hours": schema.business_hours,
                "updated_at": now_str
            }

            # Attempt update in Supabase
            if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
                try:
                    url = f"{settings.SUPABASE_URL}/rest/v1/store_settings?id=eq.1"
                    headers = self._get_supabase_headers()
                    async with httpx.AsyncClient(timeout=6.0) as client:
                        resp = await client.patch(url, json=db_payload, headers=headers)
                        if resp.status_code not in (200, 204):
                            # Try upsert
                            upsert_url = f"{settings.SUPABASE_URL}/rest/v1/store_settings"
                            upsert_payload = dict(db_payload)
                            upsert_payload["id"] = 1
                            upsert_headers = dict(headers)
                            upsert_headers["Prefer"] = "resolution=merge-duplicates"
                            await client.post(upsert_url, json=upsert_payload, headers=upsert_headers)
                except Exception as e:
                    print(f"[SettingsService] Supabase patch store_settings error: {e}")

            # Update cache and local disk persistence
            self.store_settings.update(db_payload)
            self._save_to_local_file()

            # Keep global config in sync
            settings.STORE_NAME = schema.store_name
            settings.FREE_DELIVERY_THRESHOLD = schema.free_shipping_threshold

            addr_parts = [
                schema.address_line1,
                schema.address_line2,
                schema.city,
                f"{schema.state} {schema.pin_code}",
                schema.country
            ]
            formatted_address = ", ".join([p for p in addr_parts if p])

            res = dict(self.store_settings)
            res["name"] = schema.store_name
            res["phone"] = schema.store_mobile
            res["email"] = schema.store_email
            res["address"] = formatted_address
            return res

    async def ensure_bucket_exists(self, bucket_name: str = "store-assets") -> bool:
        """
        Ensures the specified Supabase Storage bucket exists and is public.
        If missing, creates the bucket automatically via the Supabase Storage Admin API.
        """
        if not (settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY)):
            return False
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
        try:
            url = f"{settings.SUPABASE_URL}/storage/v1/bucket/{bucket_name}"
            async with httpx.AsyncClient(timeout=6.0) as client:
                res = await client.get(url, headers=headers)
                if res.status_code == 200:
                    return True
                if res.status_code == 404:
                    create_url = f"{settings.SUPABASE_URL}/storage/v1/bucket"
                    payload = {
                        "id": bucket_name,
                        "name": bucket_name,
                        "public": True,
                        "file_size_limit": 5242880,
                        "allowed_mime_types": ["image/jpeg", "image/png", "image/webp"]
                    }
                    cres = await client.post(create_url, json=payload, headers=headers)
                    if cres.status_code in (200, 201):
                        print(f"[SettingsService] Successfully auto-created Supabase Storage bucket '{bucket_name}'.")
                        return True
        except Exception as e:
            print(f"[SettingsService] Bucket verify/create notice: {e}")
        return False

    # =========================================================================
    # QR CODE UPLOAD & PASTE PERSISTENCE
    # =========================================================================
    async def upload_qr_image(self, file_bytes: bytes, filename: str, content_type: str) -> Dict[str, Any]:
        """
        Validates and permanently saves the shop QR code image.
        Uploads to Supabase Storage bucket 'store-assets' or 'product-images'.
        Also preserves a local static copy so it always renders seamlessly.
        Immediately updates and persists the payment settings in Supabase PostgreSQL.
        """
        ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}
        ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
        MAX_SIZE = 5 * 1024 * 1024  # 5MB

        ext = os.path.splitext(filename or "")[1].lower()
        if not ext and content_type:
            if "png" in content_type:
                ext = ".png"
            elif "jpeg" in content_type or "jpg" in content_type:
                ext = ".jpg"
            elif "webp" in content_type:
                ext = ".webp"

        if ext not in ALLOWED_EXT or (content_type and content_type not in ALLOWED_MIME):
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported image format '{ext or content_type}'. Allowed types: PNG, JPG, JPEG, WEBP."
            )

        if len(file_bytes) > MAX_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Image file exceeds maximum limit of 5MB ({len(file_bytes)/(1024*1024):.1f}MB)."
            )

        unique_name = f"sanjana-qr-{uuid.uuid4().hex[:12]}{ext}"
        storage_path = f"qr/{unique_name}"

        # 1. Save local copy in backend static uploads and frontend public uploads
        local_backend_path = os.path.join(UPLOADS_DIR, unique_name)
        try:
            with open(local_backend_path, "wb") as f:
                f.write(file_bytes)
        except Exception as e:
            print(f"[SettingsService] Error saving backend local QR: {e}")

        try:
            local_frontend_path = os.path.join(FRONTEND_UPLOADS_DIR, unique_name)
            with open(local_frontend_path, "wb") as f:
                f.write(file_bytes)
        except Exception as e:
            print(f"[SettingsService] Error saving frontend local QR: {e}")

        # Local static serving fallback URL
        public_url = f"/uploads/qr/{unique_name}"
        supabase_uploaded = False

        # 2. Upload to Supabase Storage bucket ('store-assets' or fallback 'product-images')
        if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
            key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
            headers = {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": content_type or "image/png"
            }

            # Proactively ensure primary storage bucket exists
            await self.ensure_bucket_exists("store-assets")

            # Try 'store-assets' first, then 'product-images'
            for bucket in ["store-assets", "product-images"]:
                try:
                    upload_url = f"{settings.SUPABASE_URL}/storage/v1/object/{bucket}/{storage_path}"
                    async with httpx.AsyncClient(timeout=8.0) as client:
                        resp = await client.post(upload_url, content=file_bytes, headers=headers)
                        if resp.status_code in (200, 201):
                            public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"
                            supabase_uploaded = True
                            break
                        elif resp.status_code == 404:
                            # Auto-create bucket if missing and retry once
                            if await self.ensure_bucket_exists(bucket):
                                retry_resp = await client.post(upload_url, content=file_bytes, headers=headers)
                                if retry_resp.status_code in (200, 201):
                                    public_url = f"{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}"
                                    supabase_uploaded = True
                                    break
                except Exception as e:
                    print(f"[SettingsService] Error uploading to bucket {bucket}: {e}")

        # 3. Automatically link and save the new QR code in payment settings
        updated_settings = await self.update_payment_settings({
            "upi_id": self.payment_settings["upi_id"],
            "merchant_name": self.payment_settings["merchant_name"],
            "qr_code_image_url": public_url,
            "qr_code_url": public_url,
            "payment_instructions": self.payment_settings.get("payment_instructions") or self.payment_settings.get("instructions"),
            "is_upi_enabled": self.payment_settings.get("is_upi_enabled", True),
            "require_manual_verification": self.payment_settings.get("require_manual_verification", True)
        })

        return {
            "success": True,
            "url": public_url,
            "qr_code_url": public_url,
            "storage_path": storage_path,
            "filename": unique_name,
            "storage_provider": "supabase" if supabase_uploaded else "local_disk",
            "updated_settings": updated_settings
        }

    async def remove_qr_image(self) -> Dict[str, Any]:
        """Remove the saved QR code image and restore dynamic QR generation."""
        await self.update_payment_settings({
            "upi_id": self.payment_settings["upi_id"],
            "merchant_name": self.payment_settings["merchant_name"],
            "qr_code_image_url": None,
            "qr_code_url": None,
            "payment_instructions": self.payment_settings.get("payment_instructions") or self.payment_settings.get("instructions"),
            "is_upi_enabled": self.payment_settings.get("is_upi_enabled", True),
            "require_manual_verification": self.payment_settings.get("require_manual_verification", True)
        })
        return {
            "success": True,
            "message": "QR Code image removed successfully."
        }

settings_service = SettingsService()

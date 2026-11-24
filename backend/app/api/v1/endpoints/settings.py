import base64
from typing import Dict, Any
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.services.settings_service import settings_service
from app.core.security import get_current_admin, AuthUser

router = APIRouter()

@router.get("/public")
async def get_public_store_and_payment_settings():
    """
    Publicly accessible endpoint for customers and visitors.
    Returns official store identity, address, contact, and active UPI payment information.
    """
    store = await settings_service.get_store_settings()
    payment = await settings_service.get_payment_settings()
    return {
        "store": store,
        "payment": {
            "upi_id": payment.get("upi_id"),
            "merchant_name": payment.get("merchant_name"),
            "qr_code_url": payment.get("qr_code_url") or payment.get("qr_code_image_url"),
            "payment_instructions": payment.get("payment_instructions") or payment.get("instructions"),
            "is_upi_enabled": payment.get("is_upi_enabled", True)
        }
    }

@router.get("/store")
async def get_public_store_settings():
    """Returns official store branding and physical address."""
    return await settings_service.get_store_settings()

@router.get("/payment")
async def get_public_payment_settings():
    """Returns public UPI payment configuration for checkout."""
    return await settings_service.get_payment_settings()

@router.post("/payment/upload-qr")
@router.post("/payment/upload-qr/")
@router.post("/upload-qr")
@router.post("/upload-qr/")
async def upload_shop_qr_code(
    file: UploadFile = File(...),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Upload official shop QR code image via settings router.
    """
    content = await file.read()
    return await settings_service.upload_qr_image(
        file_bytes=content,
        filename=file.filename or "sanjana-qr.png",
        content_type=file.content_type or "image/png"
    )

@router.post("/payment/paste-qr")
@router.post("/payment/paste-qr/")
@router.post("/paste-qr")
@router.post("/paste-qr/")
async def paste_shop_qr_code(
    payload: Dict[str, Any],
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Accept clipboard pasted image via settings router.
    """
    image_data = payload.get("image_data", "")
    if not image_data:
        raise HTTPException(status_code=400, detail="No image data provided in paste payload.")

    content_type = "image/png"
    if "," in image_data:
        header, b64_data = image_data.split(",", 1)
        if "jpeg" in header or "jpg" in header:
            content_type = "image/jpeg"
        elif "webp" in header:
            content_type = "image/webp"
    else:
        b64_data = image_data

    try:
        file_bytes = base64.b64decode(b64_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image data: {e}")

    filename = payload.get("filename") or f"pasted-qr.{content_type.split('/')[-1]}"
    return await settings_service.upload_qr_image(
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type
    )

@router.delete("/payment/qr")
@router.delete("/payment/qr/")
async def remove_shop_qr_code(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Removes the official static shop QR code image.
    """
    return await settings_service.remove_qr_image()

import re
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

class PaymentSettingsSchema(BaseModel):
    upi_id: str = Field(default="REPLACE_WITH_REAL_SHOP_UPI_ID", description="Shop official UPI VPA")
    merchant_name: str = Field(default="SANJANA MOBILES", description="Business display name")
    qr_code_image_url: Optional[str] = None
    qr_code_url: Optional[str] = None
    payment_instructions: Optional[str] = Field(
        default="1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app.\n"
                "2. Or tap 'Pay with UPI' on supported Android devices.\n"
                "3. Complete the transfer for the exact order amount.\n"
                "4. Enter the 12-digit UPI Reference Number / UTR below and submit for verification."
    )
    instructions: Optional[str] = None
    is_upi_enabled: bool = True
    require_manual_verification: bool = True
    manual_verification_required: Optional[bool] = None
    updated_at: Optional[str] = None

    @field_validator("upi_id")
    @classmethod
    def validate_upi_id(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("UPI ID cannot be blank.")
        # Allow placeholder during initial boot, but validate actual UPI VPAs
        if v != "REPLACE_WITH_REAL_SHOP_UPI_ID":
            # UPI VPA pattern: username@bank
            if "@" not in v or len(v.split("@")) != 2 or not v.split("@")[0] or not v.split("@")[1]:
                raise ValueError("Invalid UPI ID format. Expected format: username@bank (e.g. sanjanamobiles@oksbi)")
            if not re.match(r"^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9.\-_]{2,64}$", v):
                raise ValueError("UPI ID contains invalid characters. Only alphanumeric, dots, hyphens, and underscores are allowed.")
        return v

    def model_post_init(self, __context: Any) -> None:
        # Cross-populate aliases for backward compatibility with frontend
        if not self.qr_code_image_url and self.qr_code_url:
            self.qr_code_image_url = self.qr_code_url
        elif not self.qr_code_url and self.qr_code_image_url:
            self.qr_code_url = self.qr_code_image_url

        if not self.instructions and self.payment_instructions:
            self.instructions = self.payment_instructions
        elif not self.payment_instructions and self.instructions:
            self.payment_instructions = self.instructions

        if self.manual_verification_required is None:
            self.manual_verification_required = self.require_manual_verification
        else:
            self.require_manual_verification = self.manual_verification_required

class StoreSettingsSchema(BaseModel):
    store_name: str = Field(default="SANJANA MOBILES", min_length=2, max_length=100)
    tagline: Optional[str] = Field(default="Your Trusted Destination for Genuine Mobiles & Accessories", max_length=255)
    address_line1: str = Field(default="100 Feet Road", min_length=3, max_length=255)
    address_line2: Optional[str] = Field(default="Near Metro Pillar 42, Indiranagar", max_length=255)
    city: str = Field(default="Bengaluru", min_length=2, max_length=100)
    district: Optional[str] = Field(default="Bengaluru Urban", max_length=100)
    state: str = Field(default="Karnataka", min_length=2, max_length=100)
    pin_code: str = Field(default="560038", min_length=6, max_length=6)
    country: str = Field(default="India", min_length=2, max_length=60)
    store_mobile: str = Field(default="9876543210", min_length=10, max_length=15)
    store_email: str = Field(default="contact@sanjanamobiles.com", min_length=5, max_length=120)
    google_maps_url: Optional[str] = Field(default="https://maps.google.com/?q=12.9716,77.5946")
    free_shipping_threshold: float = Field(default=999.00, ge=0.0)
    business_hours: Optional[str] = Field(default="Mon - Sat: 10:00 AM - 9:00 PM | Sun: 11:00 AM - 8:00 PM")
    gstin: Optional[str] = Field(default=None, description="Official GSTIN (optional)")

    # Frontend aliases
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    updated_at: Optional[str] = None

    @field_validator("pin_code")
    @classmethod
    def validate_pin_code(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^\d{6}$", v):
            raise ValueError("PIN code must be a valid 6-digit Indian postal code.")
        return v

    @field_validator("store_mobile")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if len(digits) != 10:
            raise ValueError("Store mobile number must be a valid 10-digit phone number.")
        return digits

    @field_validator("store_email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", v):
            raise ValueError("Invalid store email address format.")
        return v

    def model_post_init(self, __context: Any) -> None:
        if not self.name:
            self.name = self.store_name
        else:
            self.store_name = self.name

        if not self.phone:
            self.phone = self.store_mobile
        else:
            self.store_mobile = self.phone

        if not self.email:
            self.email = self.store_email
        else:
            self.store_email = self.email

        if not self.address:
            self.address = f"{self.address_line1}, {self.city}, {self.state} {self.pin_code}"

class SettingsUpdateResponse(BaseModel):
    success: bool = True
    message: str = "Settings saved successfully."
    data: Dict[str, Any]

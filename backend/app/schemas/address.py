from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator
import re

INDIAN_MOBILE_REGEX = re.compile(r"^[6-9]\d{9}$")
INDIAN_PIN_REGEX = re.compile(r"^[1-9][0-9]{5}$")

class AddressBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    mobile_number: str = Field(..., description="10-digit Indian Mobile Number")
    address_line1: str = Field(..., min_length=3, max_length=150)
    address_line2: Optional[str] = Field(None, max_length=150)
    city: str = Field(..., min_length=2, max_length=80)
    district: Optional[str] = Field(None, max_length=80)
    state: str = Field(..., min_length=2, max_length=80)
    pin_code: str = Field(..., description="6-digit Indian PIN Code")
    country: str = Field("India", max_length=50)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: bool = False
    address_type: str = Field("home", pattern="^(home|work|other)$")

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases_and_defaults(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Support phone alias
            if not data.get("mobile_number") and data.get("phone"):
                data["mobile_number"] = data["phone"]
            # Support postal_code alias
            if not data.get("pin_code") and data.get("postal_code"):
                data["pin_code"] = data["postal_code"]
            # Default district to city if not provided
            if not data.get("district") and data.get("city"):
                data["district"] = data["city"]
            # Default country to India
            if not data.get("country"):
                data["country"] = "India"
        return data

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, v: str) -> str:
        # Strip spaces or +91 prefix
        cleaned = re.sub(r"[\s\-\+]", "", str(v))
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        if not INDIAN_MOBILE_REGEX.match(cleaned):
            raise ValueError("Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.")
        return cleaned

    @field_validator("pin_code")
    @classmethod
    def validate_pin_code(cls, v: str) -> str:
        cleaned = str(v).strip()
        if not INDIAN_PIN_REGEX.match(cleaned):
            raise ValueError("Enter a valid 6-digit PIN code.")
        return cleaned

class AddressCreate(AddressBase):
    pass

class AddressUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    mobile_number: Optional[str] = None
    address_line1: Optional[str] = Field(None, min_length=3, max_length=150)
    address_line2: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    country: Optional[str] = "India"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_default: Optional[bool] = None
    address_type: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("mobile_number") and data.get("phone"):
                data["mobile_number"] = data["phone"]
            if not data.get("pin_code") and data.get("postal_code"):
                data["pin_code"] = data["postal_code"]
        return data

    @field_validator("mobile_number")
    @classmethod
    def validate_mobile(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = re.sub(r"[\s\-\+]", "", v)
        if cleaned.startswith("91") and len(cleaned) == 12:
            cleaned = cleaned[2:]
        if not INDIAN_MOBILE_REGEX.match(cleaned):
            raise ValueError("Invalid Indian mobile number.")
        return cleaned

    @field_validator("pin_code")
    @classmethod
    def validate_pin_code(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        cleaned = v.strip()
        if not INDIAN_PIN_REGEX.match(cleaned):
            raise ValueError("Invalid Indian PIN code.")
        return cleaned

class AddressResponse(AddressBase):
    id: str
    user_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

import os
from typing import List
from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Pre-load .env from root and backend directories
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
_backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(_root_dir, ".env"))
load_dotenv(os.path.join(_backend_dir, ".env"))
load_dotenv(".env")

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", os.path.join(_backend_dir, ".env")),
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "SANJANA MOBILES API"
    API_V1_STR: str = "/api/v1"
    
    # Store settings
    STORE_NAME: str = "SANJANA MOBILES"
    CURRENCY: str = "INR"
    CURRENCY_SYMBOL: str = "₹"
    FREE_DELIVERY_THRESHOLD: float = 999.00
    STANDARD_DELIVERY_FEE: float = 99.00
    DEFAULT_DELIVERY_FEE: float = 99.00
    STORE_CURRENCY: str = "INR"
    STORE_CURRENCY_SYMBOL: str = "₹"
    
    # Supabase Credentials
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")
    
    # Razorpay Credentials (Test mode default for safe development & verification)
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_sanjana_default_key")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "rzp_test_sanjana_default_secret")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "rzp_webhook_secret_sanjana")
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    def get_cors_origins(self) -> List[str]:
        env_cors = os.getenv("CORS_ORIGINS", "").strip()
        if not env_cors:
            return self.CORS_ORIGINS
        if env_cors == "*":
            return ["*"]
        return [origin.strip() for origin in env_cors.split(",") if origin.strip()]

settings = Settings()

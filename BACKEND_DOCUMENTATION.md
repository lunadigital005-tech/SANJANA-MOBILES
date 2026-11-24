# LUNA Backend Architecture & Service Layer Documentation

---

## 1. Overview & Technology Stack

The LUNA backend is a high-performance REST API service built with:
- **Python 3.14**: Latest stable Python runtime.
- **FastAPI**: Modern, fast web framework built on Starlette and Pydantic.
- **Pydantic v2**: Type enforcement and data validation via compiled Rust core (`pydantic-core`).
- **Uvicorn**: Lightning-fast ASGI web server implementation.
- **PyJWT & Cryptography**: Standard-compliant JSON Web Token parsing and HMAC-SHA256 signature verification.
- **HTTPX**: Async HTTP client for external service communication and automated testing via `TestClient`.

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── admin.py        # Privileged inventory, categories, orders, refunds
│   │       │   ├── auth.py         # Registration, login, profile, role validation
│   │       │   ├── categories.py   # Public category listing and navigation
│   │       │   ├── customer.py     # Customer address book and order lookups
│   │       │   ├── delivery.py     # Distance calculation, courier milestones, WhatsApp
│   │       │   ├── orders.py       # Server pricing, checkout, Razorpay, webhooks
│   │       │   ├── products.py     # Public product search, filtering, pagination
│   │       │   └── rewards.py      # Loyalty wallet, coin history, admin rules
│   │       └── api.py              # Main V1 router assembly
│   ├── core/
│   │   ├── config.py               # Pydantic SettingsConfigDict configuration
│   │   └── security.py             # JWT decoding and auth dependency guards
│   ├── schemas/                    # Pydantic v2 models
│   │   ├── admin.py
│   │   ├── auth.py
│   │   ├── category.py
│   │   ├── delivery.py
│   │   ├── inventory.py
│   │   ├── order.py
│   │   ├── product.py
│   │   ├── rewards.py
│   │   └── user.py
│   ├── services/                   # Transactional domain logic
│   │   ├── catalog_store.py        # Products, categories, reservations, movements
│   │   ├── delivery_service.py     # Haversine distance, courier tracking, receipts
│   │   ├── order_store.py          # Cart calculations, order progression, refunds
│   │   ├── rewards_store.py        # Coin wallets, earning rules, ledger transactions
│   │   └── storage.py              # Supabase storage file upload & mime validation
│   └── main.py                     # App factory, security middleware, CORS
├── requirements.txt
└── test_*.py                       # Complete automated Pytest suites (43 tests)
```

---

## 3. Configuration Management (`core/config.py`)

Configuration is managed using Pydantic Settings v2 with automatic `.env` file parsing:

```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union

class Settings(BaseSettings):
    PROJECT_NAME: str = "LUNA E-Commerce Backend"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    
    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    
    # Razorpay Payment Gateway
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    
    # Security & CORS
    BACKEND_CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    ADMIN_SECRET_KEY: str = "luna-admin-secret-key-change-in-prod"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
```

---

## 4. Security Middleware & HTTP Hardening (`main.py`)

FastAPI includes a custom ASGI middleware that injects industry-standard security headers into every HTTP response:

```python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

---

## 5. Authentication & Role-Based Access Control (`core/security.py`)

FastAPI dependency injection is utilized to protect endpoints:

```python
# 1. Base user extraction & token verification
async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserResponse:
    # Decodes JWT, validates signature, checks expiration, and retrieves user profile
    ...

# 2. Strict Admin Role Guard
async def require_admin(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to perform this action"
        )
    return current_user
```

Endpoints tagged with `Depends(require_admin)` instantly reject non-admin users with HTTP 403 Forbidden.

---

## 6. Service Layer Architecture

### 6.1 `CatalogStore` (`services/catalog_store.py`)
- **Category & Product Management**: CRUD operations with slug generation, multi-category assignment, and primary image resolution.
- **Concurrency & Stock Reservations**: Utilizes an `asyncio.Lock` to ensure atomic stock reservations:
  - `create_reservation(product_id, quantity, user_id, order_id, ttl_minutes=15)`
  - `commit_reservation(reservation_id)`
  - `release_reservation(reservation_id)`
  - `cleanup_expired_reservations()`: Automatically runs to return expired stock to available inventory.
- **Stock Movements Audit**: Every restock, order commitment, damage write-off, or return is permanently recorded in `movements` with before/after quantities and admin user IDs.

### 6.2 `OrderStore` (`services/order_store.py`)
- **Server-Side Pricing Engine**: `calculate_cart_total(items, promo_code, coins_redeemed)` inspects live catalog prices and calculates:
  - `subtotal`
  - `delivery_charges` (Free if subtotal >= ₹500, else ₹50 default)
  - `discount_amount`
  - `final_payable_amount`
- **State Machine Progression**:
  - `NEW` -> `CONFIRMED` -> `PACKED` -> `DISPATCHED` -> `DELIVERED`
  - Cancellation & Rejection: Transitioning to `REJECTED` or `CANCELLED` automatically restores product stock and triggers a full refund.
- **Refund Engine**: Validates partial and full refunds against the order total, ensuring `sum(refunds) <= order.total_amount`.

### 6.3 `RewardsStore` (`services/rewards_store.py`)
- **Configurable Earning Parameters**:
  - `earning_ratio`: e.g., 1 coin per ₹100 spent.
  - `conversion_rate`: e.g., 1 coin = ₹1 discount.
  - `min_redemption_coins`: Minimum balance required to redeem.
  - `max_redemption_percent`: Maximum percentage of order total payable with coins (up to 100%).
- **Immutable Ledger**: Records `reward_transactions` with `coins`, `transaction_type`, and `order_id`.

### 6.4 `DeliveryService` (`services/delivery_service.py`)
- **Haversine Distance Calculator**: Computes great-circle distance between store coordinates (`12.9716, 77.5946`) and customer coordinates.
- **Local Radius Rules**: Orders within 10 km are eligible for direct store delivery; distant orders route via courier partners (Delhivery, BlueDart, DTDC).
- **Notification Formatter**: Generates ready-to-send WhatsApp notification messages with tracking links and customer names.

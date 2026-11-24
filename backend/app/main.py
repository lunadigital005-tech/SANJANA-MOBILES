import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1.endpoints import (
    auth,
    customer,
    admin,
    products,
    categories,
    cart,
    checkout,
    payments,
    rewards,
    delivery,
    banners,
    settings as settings_router,
    invoices
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="SANJANA MOBILES E-Commerce Architecture Backend — Smartphones & Mobile Accessories",
    version="1.3.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Set up CORS
cors_origins = settings.get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins else ["*"],
    allow_origin_regex=r"^https:\/\/.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Static files mount for uploaded assets (e.g. QR codes, banners)
uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# API Routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication & Session"])
app.include_router(customer.router, prefix=f"{settings.API_V1_STR}/customer", tags=["Customer Management & Orders"])
app.include_router(products.router, prefix=f"{settings.API_V1_STR}/products", tags=["Products & Catalog"])
app.include_router(categories.router, prefix=f"{settings.API_V1_STR}/categories", tags=["Categories"])
app.include_router(cart.router, prefix=f"{settings.API_V1_STR}/cart", tags=["Shopping Cart"])
app.include_router(checkout.router, prefix=f"{settings.API_V1_STR}/checkout", tags=["Checkout & Razorpay"])
app.include_router(payments.router, prefix=f"{settings.API_V1_STR}/payments", tags=["Payments & Webhooks"])
app.include_router(rewards.router, prefix=f"{settings.API_V1_STR}/rewards", tags=["Loyalty & Rewards Engine"])
app.include_router(delivery.router, prefix=f"{settings.API_V1_STR}/delivery", tags=["Delivery & Courier Shipments"])
app.include_router(banners.router, prefix=f"{settings.API_V1_STR}/banners", tags=["Promotional Banners"])
app.include_router(settings_router.router, prefix=f"{settings.API_V1_STR}/settings", tags=["Store & Payment Settings"])
app.include_router(invoices.router, prefix=f"{settings.API_V1_STR}", tags=["Invoices & Receipts"])
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin", tags=["Admin Operations & Order Management"])

@app.get("/")
def health_check():
    return {
        "status": "online",
        "platform": settings.PROJECT_NAME,
        "store": settings.STORE_NAME,
        "currency": settings.STORE_CURRENCY,
        "currency_symbol": settings.STORE_CURRENCY_SYMBOL,
        "api_version": "v1",
        "phases_active": [
            "Phase 01: Architecture",
            "Phase 02: Design & Token System",
            "Phase 03: Auth & User Management",
            "Phase 04: Product & Category Management",
            "Phase 05: Inventory & Real-time Stock Control",
            "Phase 06: Cart, Checkout & Razorpay Payment Integration",
            "Phase 07: Order Fulfillment & Refund Management",
            "Phase 08: Loyalty Coins & Rewards Engine",
            "Phase 09: Delivery, Courier & Shipment Management"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    reload = os.environ.get("ENVIRONMENT", "development").lower() == "development"
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=reload)

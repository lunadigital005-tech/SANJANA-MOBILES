from typing import List, Optional, Dict, Any
import time
import re
import urllib.parse
import httpx
from fastapi import APIRouter, Depends, Query, UploadFile, File, HTTPException, status
from app.core.config import settings
from app.core.security import get_current_admin
from app.schemas.auth import AuthUser
from app.schemas.admin import (
    AdminStatsOverview,
    LowStockAlertItem,
    AdminCustomerItem,
    AdminCustomerDetail,
    AdminCustomerAddress,
    AdminOrderItem
)
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductStatusUpdate,
    ProductResponse,
    ProductListResponse
)
from app.schemas.inventory import (
    StockAdjustmentRequest,
    StockAdjustmentResponse,
    StockMovementItem,
    InventoryOverviewItem
)
from app.schemas.order import (
    OrderDetailedResponse,
    AdminOrdersSummaryResponse,
    OrderRejectRequest,
    OrderCancelRequest,
    OrderStatusUpdateRequest,
    AdminDeliveryAssignRequest,
    AdminDeliveryStatusUpdateRequest,
    AdminStorePaymentConfirmRequest
)
from app.schemas.refund import (
    RefundInitiateRequest,
    RefundRecordResponse,
    PaymentTransactionItem
)
from app.schemas.checkout import (
    AdminPaymentVerifyRequest,
    AdminPaymentVerifyResponse,
    PaymentSettingsSchema as LegacyPaymentSettingsSchema
)
from app.schemas.settings import (
    PaymentSettingsSchema,
    StoreSettingsSchema,
    SettingsUpdateResponse
)
from app.services.settings_service import settings_service
from app.services.catalog_store import catalog_store
from app.services.order_store import order_store
from app.services.invoice_service import invoice_service
from app.schemas.invoice import InvoiceResponse
from app.services.storage import validate_and_upload_image

router = APIRouter()

# =============================================================================
# ADMIN DASHBOARD OVERVIEW & REPORTING
# =============================================================================

@router.get("/overview", response_model=AdminStatsOverview)
async def get_admin_overview(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Get dynamic, real KPI metrics calculated directly from the live catalog, inventory, profiles, and orders.
    Strictly protected: requires role in ['admin', 'super_admin'].
    """
    products = await catalog_store.list_products(active_only=True, limit=1000)
    inventory = await catalog_store.list_inventory()
    orders = await order_store.list_admin_orders()
    customers_map = await _fetch_aggregated_customers()
    
    total_products = products.total
    total_orders = len(orders)
    total_customers = sum(1 for c in customers_map.values() if c.get("role") == "customer")
    
    # Actionable pending orders requiring admin fulfillment/action
    pending_statuses = {
        "NEW", "ACCEPTED", "PACKING", "PACKED", 
        "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", 
        "DELIVERY_PENDING", "VERIFICATION_PENDING"
    }
    pending_orders = sum(1 for o in orders if o.status in pending_statuses)
    
    # Low stock and out of stock alerts
    low_stock_items: List[LowStockAlertItem] = []
    for item in inventory:
        threshold = item.low_stock_threshold if item.low_stock_threshold is not None else 5
        if item.available_quantity <= threshold or item.status in ["low_stock", "out_of_stock"]:
            alert_st = "OUT OF STOCK" if item.available_quantity <= 0 else "LOW STOCK"
            p_data = catalog_store.products.get(item.product_id, {})
            p_img = p_data.get("primary_image")
            if not p_img and p_data.get("images"):
                p_img = p_data["images"][0]
            low_stock_items.append(LowStockAlertItem(
                id=item.product_id,
                title=item.product_title,
                sku=item.sku or "",
                stock=item.available_quantity,
                image=p_img or "",
                category=item.category_name or "",
                price=item.price,
                status=alert_st
            ))
            
    # Sort: Out of stock first, then lowest stock
    low_stock_items.sort(key=lambda x: (x.stock > 0, x.stock, x.title))
    low_stock = len(low_stock_items)
    
    return AdminStatsOverview(
        total_products=total_products,
        total_orders=total_orders,
        total_customers=total_customers,
        total_revenue=0.0,
        low_stock=low_stock,
        pending_orders=pending_orders,
        low_stock_items=low_stock_items
    )

_SUPABASE_PROFILES_CACHE: Dict[str, Any] = {"time": 0.0, "rows": []}

async def _fetch_aggregated_customers() -> Dict[str, Dict[str, Any]]:
    """
    Safely retrieves customers from:
    1. In-memory orders & active sessions.
    2. Supabase public.profiles table (when configured, with resilient caching).
    3. Associated customer addresses to get reliable mobile numbers.
    Never exposes passwords, secrets, or internal auth hashes.
    """
    customers_map: Dict[str, Dict[str, Any]] = {}

    # 1. Base registered mock/development profiles
    from app.core.security import MOCK_PROFILES
    for u_id, p in MOCK_PROFILES.items():
        customers_map[u_id] = {
            "id": u_id,
            "full_name": p.get("full_name") or "Customer",
            "email": p.get("email", ""),
            "phone": p.get("phone") or "",
            "role": p.get("role", "customer"),
            "account_status": "active",
            "created_at": "2026-01-15T10:00:00Z",
            "last_login": "2026-11-20T08:00:00Z"
        }

    # 2. Extract customers from existing orders in order_store
    for ord_val in order_store.orders.values():
        u_id = ord_val.get("user_id")
        if u_id:
            if u_id not in customers_map:
                customers_map[u_id] = {
                    "id": u_id,
                    "full_name": ord_val.get("customer_name") or "Valued Customer",
                    "email": ord_val.get("customer_email") or "",
                    "phone": ord_val.get("customer_mobile") or "",
                    "role": "customer",
                    "account_status": "active",
                    "created_at": ord_val.get("created_at") or "2026-01-15T10:00:00Z",
                    "last_login": ord_val.get("created_at")
                }
            elif not customers_map[u_id].get("phone") and ord_val.get("customer_mobile"):
                customers_map[u_id]["phone"] = ord_val.get("customer_mobile")

    # 3. Query Supabase public.profiles if configured
    if settings.SUPABASE_URL and (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
        key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}"
        }
        rows = []
        now = time.time()
        if now - _SUPABASE_PROFILES_CACHE["time"] < 15.0 and _SUPABASE_PROFILES_CACHE["rows"]:
            rows = _SUPABASE_PROFILES_CACHE["rows"]
        else:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(
                        f"{settings.SUPABASE_URL}/rest/v1/profiles?select=*",
                        headers=headers
                    )
                    if resp.status_code == 200:
                        rows = resp.json()
                        _SUPABASE_PROFILES_CACHE["time"] = now
                        _SUPABASE_PROFILES_CACHE["rows"] = rows
                    elif _SUPABASE_PROFILES_CACHE["rows"]:
                        rows = _SUPABASE_PROFILES_CACHE["rows"]
            except Exception as e:
                if _SUPABASE_PROFILES_CACHE["rows"]:
                    rows = _SUPABASE_PROFILES_CACHE["rows"]
                else:
                    print(f"[AdminCustomers] Error querying profiles from Supabase: {e}")

        for r in rows:
            uid = r.get("id")
            if uid:
                customers_map[uid] = {
                    "id": uid,
                    "full_name": r.get("full_name") or "Valued Customer",
                    "email": r.get("email") or "",
                    "phone": r.get("phone") or customers_map.get(uid, {}).get("phone", ""),
                    "role": r.get("role") or "customer",
                    "account_status": "active",
                    "created_at": r.get("created_at") or "2026-01-15T10:00:00Z",
                    "last_login": r.get("updated_at")
                }

    # 4. Fill in missing phone numbers from user addresses
    for addr in order_store.addresses.values():
        u_id = addr.get("user_id")
        if u_id in customers_map and not customers_map[u_id].get("phone"):
            customers_map[u_id]["phone"] = addr.get("mobile_number") or addr.get("phone") or ""

    return customers_map

@router.get("/customers", response_model=List[AdminCustomerItem])
async def list_admin_customers(
    search: Optional[str] = Query(None, description="Search by customer name, email, or mobile number"),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    FEATURE 3: List registered customers with engagement stats:
    - Customer Name, Email, Mobile Number, Registration Date, Account Status, Total Orders, Total Spent.
    - Searchable by name, email, and mobile number.
    - Strictly authorized for administrators only (403 for normal customers).
    """
    customers_map = await _fetch_aggregated_customers()
    results: List[AdminCustomerItem] = []

    for cust in customers_map.values():
        u_id = cust["id"]
        # Calculate orders count and total spent
        user_orders = [o for o in order_store.orders.values() if o.get("user_id") == u_id]
        orders_count = len(user_orders)
        total_spent = sum(
            o.get("total_amount", 0.0) 
            for o in user_orders 
            if o.get("payment_status") in ["PAID", "VERIFIED"]
        )

        phone_val = cust.get("phone") or ""
        # Search filtering
        if search:
            q = search.lower().strip()
            name_match = q in cust.get("full_name", "").lower()
            email_match = q in cust.get("email", "").lower()
            phone_match = bool(phone_val and q in phone_val.replace(" ", "").replace("-", ""))
            if not (name_match or email_match or phone_match):
                continue

        results.append(
            AdminCustomerItem(
                id=u_id,
                full_name=cust.get("full_name") or "Valued Customer",
                email=cust.get("email", ""),
                phone=phone_val or None,
                role=cust.get("role", "customer"),
                account_status=cust.get("account_status", "active"),
                orders_count=orders_count,
                total_spent=round(total_spent, 2),
                created_at=cust.get("created_at") or "2026-01-15T10:00:00Z",
                last_login=cust.get("last_login")
            )
        )

    # Sort newest customers first
    results.sort(key=lambda c: c.created_at, reverse=True)
    return results

@router.get("/customers/{customer_id}", response_model=AdminCustomerDetail)
async def get_admin_customer_detail(
    customer_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    FEATURE 4: Detailed Customer Profile & Contact Information:
    - Customer full details, email, mobile number.
    - Saved delivery addresses.
    - Full customer order history.
    - Direct WhatsApp contact action URL.
    - Strictly forbidden to normal customers.
    """
    customers_map = await _fetch_aggregated_customers()
    cust = customers_map.get(customer_id)
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    # 1. Fetch saved addresses
    user_addresses: List[AdminCustomerAddress] = []
    # From order_store addresses
    for addr in order_store.addresses.values():
        if addr.get("user_id") == customer_id:
            user_addresses.append(
                AdminCustomerAddress(
                    id=addr.get("id", f"addr-{len(user_addresses)}"),
                    full_name=addr.get("full_name", cust.get("full_name")),
                    mobile_number=addr.get("mobile_number") or addr.get("phone") or "",
                    address_line1=addr.get("address_line1", ""),
                    address_line2=addr.get("address_line2"),
                    city=addr.get("city", ""),
                    district=addr.get("district"),
                    state=addr.get("state", ""),
                    pin_code=addr.get("pin_code") or addr.get("postal_code") or "",
                    country=addr.get("country", "India"),
                    is_default=bool(addr.get("is_default", False)),
                    address_type=addr.get("address_type", "home")
                )
            )

    # 2. Fetch customer order history
    user_orders_raw = [
        o for o in order_store.orders.values() 
        if o.get("user_id") == customer_id
    ]
    formatted_orders: List[Dict[str, Any]] = []
    for ord_dict in sorted(user_orders_raw, key=lambda x: x.get("created_at", ""), reverse=True):
        formatted_ord = await order_store._format_order(ord_dict)
        formatted_orders.append(formatted_ord.model_dump())

    orders_count = len(user_orders_raw)
    total_spent = sum(
        o.get("total_amount", 0.0) 
        for o in user_orders_raw 
        if o.get("payment_status") in ["PAID", "VERIFIED"]
    )

    phone_num = cust.get("phone") or (user_addresses[0].mobile_number if user_addresses else None)

    # Build WhatsApp URL
    whatsapp_url = None
    if phone_num:
        clean_digits = re.sub(r'[^0-9]', '', str(phone_num))
        if len(clean_digits) == 10:
            clean_digits = f"91{clean_digits}"
        if len(clean_digits) >= 10:
            greeting = urllib.parse.quote(f"Hello {cust.get('full_name', 'Customer')}, this is SANJANA MOBILES regarding your order.")
            whatsapp_url = f"https://wa.me/{clean_digits}?text={greeting}"

    return AdminCustomerDetail(
        id=customer_id,
        full_name=cust.get("full_name", "Valued Customer"),
        email=cust.get("email", ""),
        phone=phone_num,
        role=cust.get("role", "customer"),
        account_status=cust.get("account_status", "active"),
        orders_count=orders_count,
        total_spent=round(total_spent, 2),
        created_at=cust.get("created_at") or "2026-01-15T10:00:00Z",
        last_login=cust.get("last_login"),
        addresses=user_addresses,
        orders=formatted_orders,
        whatsapp_url=whatsapp_url
    )

# =============================================================================
# ORDER MANAGEMENT & STATUS WORKFLOW (PHASE 06 + 07)
# =============================================================================

@router.get("/orders/summary", response_model=AdminOrdersSummaryResponse)
async def get_orders_summary(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Returns today's orders and all orders summary for admin dashboard quick view.
    """
    return await order_store.get_admin_orders_summary()

@router.get("/orders/today", response_model=List[OrderDetailedResponse])
async def list_todays_orders(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Dedicated Today's Orders view for incoming order processing.
    """
    return await order_store.list_admin_orders(todays_only=True)

@router.get("/orders", response_model=List[OrderDetailedResponse])
async def list_all_admin_orders(
    status: Optional[str] = Query(None, description="Filter by order status: NEW, ACCEPTED, PACKING, PACKED, DELIVERY_PENDING, REJECTED, CANCELLED"),
    search: Optional[str] = Query(None, description="Search by order number, customer name, email, or mobile"),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Comprehensive admin order search, filtering, and inspection.
    """
    return await order_store.list_admin_orders(status_filter=status, search_query=search)

@router.get("/orders/{order_id}", response_model=OrderDetailedResponse)
async def get_order_detail(
    order_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Detailed order view including items snapshot, delivery details, status history timeline, and payment info.
    """
    return await order_store.get_order_by_id(order_id)

@router.get("/orders/{order_id_or_number}/invoice", response_model=InvoiceResponse)
async def get_admin_order_invoice(
    order_id_or_number: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Retrieve or reprint official showroom invoice for any order in the admin dashboard.
    """
    order = None
    if order_id_or_number.startswith("ord-"):
        order = order_store.orders.get(order_id_or_number)
    else:
        order_id = order_store.order_number_map.get(order_id_or_number)
        if order_id:
            order = order_store.orders.get(order_id)
        else:
            for oid, o in order_store.orders.items():
                if o.get("order_number", "").upper() == order_id_or_number.upper():
                    order = o
                    break

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id_or_number}' not found."
        )

    admin_dict = {
        "id": current_admin.id,
        "email": current_admin.email,
        "full_name": current_admin.full_name,
        "role": "admin"
    }
    return await invoice_service.get_or_create_invoice_for_order(order, admin_dict)

@router.post("/orders/{order_id}/accept", response_model=OrderDetailedResponse)
async def accept_order(
    order_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin accepts incoming NEW order:
    - Transitions status from NEW to ACCEPTED.
    - Updates order timeline and audit history.
    """
    return await order_store.accept_order(order_id=order_id, admin_id=current_admin.id)

@router.patch("/orders/{order_id}/status", response_model=OrderDetailedResponse)
async def update_order_status(
    order_id: str,
    req: OrderStatusUpdateRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Enforces strict status workflow:
    NEW -> ACCEPTED -> PACKING -> PACKED -> DELIVERY_PENDING.
    Rejects invalid state jumps.
    """
    return await order_store.update_order_status(
        order_id=order_id,
        new_status=req.new_status,
        admin_id=current_admin.id,
        comment=req.comment
    )

@router.post("/orders/{order_id}/reject", response_model=OrderDetailedResponse)
async def reject_order(
    order_id: str,
    req: OrderRejectRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin rejects order:
    - Requires sanctioned rejection reason.
    - Restores inventory stock back to store catalog.
    - If paid, automatically initiates Razorpay refund and updates payment_status to REFUNDED.
    - Updates order timeline and records internal notification.
    """
    return await order_store.reject_order(
        order_id=order_id,
        rejection_reason=req.rejection_reason,
        admin_id=current_admin.id,
        rejection_notes=req.rejection_notes,
        initiate_refund=req.initiate_refund
    )

@router.post("/orders/{order_id}/cancel", response_model=OrderDetailedResponse)
async def cancel_order(
    order_id: str,
    req: OrderCancelRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin cancels order:
    - Verifies order is not DELIVERED or COLLECTED.
    - Restores reserved stock back to catalog available quantity.
    - Preserves historical records, logs audit trail with admin ID and timestamp.
    """
    return await order_store.cancel_order(
        order_id=order_id,
        cancellation_reason=req.cancellation_reason,
        admin_id=current_admin.id,
        cancellation_notes=req.cancellation_notes
    )

# =============================================================================
# FEATURE 1, 2 & 5: STORE PICKUP PAYMENT & INTERNAL ADMIN FULFILLMENT
# =============================================================================

@router.post("/orders/{order_id}/confirm-store-payment", response_model=OrderDetailedResponse)
async def confirm_store_pickup_payment(
    order_id: str,
    req: Optional[AdminStorePaymentConfirmRequest] = None,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    FEATURE 1 & 5: Store Pickup: Admin confirms payment received at physical shop.
    Sets payment_status = PAID.
    """
    notes = req.admin_notes if req else None
    return await order_store.admin_confirm_store_payment(
        order_id=order_id,
        admin_id=current_admin.id,
        admin_notes=notes
    )

@router.post("/orders/{order_id}/mark-collected", response_model=OrderDetailedResponse)
async def mark_store_order_collected(
    order_id: str,
    req: Optional[AdminStorePaymentConfirmRequest] = None,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    FEATURE 1 & 5: Store Pickup: Admin marks the order as collected by customer.
    Order must be PAID before collection.
    """
    notes = req.admin_notes if req else None
    return await order_store.admin_mark_order_collected(
        order_id=order_id,
        admin_id=current_admin.id,
        admin_notes=notes
    )

@router.post("/orders/{order_id}/assign-delivery", response_model=OrderDetailedResponse)
async def assign_admin_delivery(
    order_id: str,
    req: Optional[AdminDeliveryAssignRequest] = None,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    FEATURE 2 & 5: Internal Admin Fulfillment:
    Admin accepts personal doorstep delivery assignment ("Admin Will Deliver").
    Stores internal delivery assignment, admin ID, name, and assignment timestamp.
    """
    notes = req.admin_notes if req else None
    admin_name = getattr(current_admin, "full_name", None) or "SANJANA Admin"
    return await order_store.admin_assign_delivery(
        order_id=order_id,
        admin_id=current_admin.id,
        admin_name=admin_name,
        admin_notes=notes
    )

@router.post("/orders/{order_id}/delivery-status", response_model=OrderDetailedResponse)
async def update_admin_delivery_status(
    order_id: str,
    req: AdminDeliveryStatusUpdateRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    FEATURE 2 & 5: Internal Admin Fulfillment:
    Admin updates personal delivery progress ('OUT_FOR_DELIVERY' or 'DELIVERED').
    """
    admin_name = getattr(current_admin, "full_name", None) or "SANJANA Admin"
    return await order_store.admin_update_delivery_status(
        order_id=order_id,
        new_delivery_status=req.status,
        admin_id=current_admin.id,
        admin_name=admin_name,
        admin_notes=req.admin_notes
    )

# =============================================================================
# REFUND MANAGEMENT & PAYMENT AUDIT (ADMIN ONLY)
# =============================================================================

@router.get("/refunds", response_model=List[RefundRecordResponse])
async def list_admin_refunds(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    List all processed and recorded refunds.
    """
    return await order_store.list_refunds()

@router.post("/refunds/initiate", response_model=RefundRecordResponse)
async def initiate_admin_refund(
    req: RefundInitiateRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Initiate full or partial refund for a customer order:
    - Checks remaining refundable balance to prevent duplicate/excess refunds.
    - Dispatches refund to Razorpay API.
    - Updates order payment status to REFUNDED or PARTIALLY_REFUNDED.
    """
    return await order_store.initiate_refund(req=req, admin_id=current_admin.id)

@router.get("/transactions", response_model=List[PaymentTransactionItem])
async def list_admin_transactions(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    List payment transactions and status history.
    """
    return await order_store.list_payment_transactions()

# =============================================================================
# INTERNAL NOTIFICATIONS (ADMIN ONLY)
# =============================================================================

@router.get("/notifications", response_model=List[dict])
async def list_admin_notifications(
    unread_only: bool = Query(False),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Get live admin notifications for incoming orders and status updates.
    """
    return await order_store.get_notifications(unread_only=unread_only)

@router.post("/notifications/mark-read")
async def mark_notifications_read(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Mark all unread admin notifications as read.
    """
    return await order_store.mark_notifications_read()

# =============================================================================
# CATEGORY MANAGEMENT (ADMIN ONLY)
# =============================================================================

@router.get("/categories", response_model=List[CategoryResponse])
async def list_admin_categories(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    List all categories (including inactive ones) with item counts for administration.
    """
    return await catalog_store.list_categories(active_only=False)

@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    cat_in: CategoryCreate,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Create a new product category.
    """
    return await catalog_store.create_category(cat_in)

@router.put("/categories/{cat_id}", response_model=CategoryResponse)
async def update_category(
    cat_id: str,
    cat_in: CategoryUpdate,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Update category metadata, display order, or active status.
    """
    return await catalog_store.update_category(cat_id, cat_in)

@router.delete("/categories/{cat_id}")
async def delete_category(
    cat_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Safe Category Deletion:
    Verifies that no active or existing products are assigned to this category before deleting.
    """
    return await catalog_store.delete_category(cat_id)

# =============================================================================
# PRODUCT MANAGEMENT (ADMIN ONLY)
# =============================================================================

@router.get("/products", response_model=ProductListResponse)
async def list_admin_products(
    search: Optional[str] = Query(None),
    category_slug: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    List all products (including inactive) with stock levels and category associations.
    """
    return await catalog_store.list_products(
        active_only=False,
        category_slug=category_slug,
        search=search,
        page=page,
        limit=limit
    )

@router.get("/products/{prod_id}", response_model=ProductResponse)
async def get_admin_product_detail(
    prod_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    return await catalog_store.get_product(prod_id, active_only=False)

@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    prod_in: ProductCreate,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Create a new product with multiple category assignments, image gallery, and initial stock.
    """
    return await catalog_store.create_product(prod_in, admin_id=current_admin.id)

@router.put("/products/{prod_id}", response_model=ProductResponse)
async def update_product(
    prod_id: str,
    prod_in: ProductUpdate,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Update product specifications, prices, images, and category associations.
    """
    return await catalog_store.update_product(prod_id, prod_in, admin_id=current_admin.id)

@router.patch("/products/{prod_id}/status", response_model=ProductResponse)
async def toggle_product_status(
    prod_id: str,
    status_in: ProductStatusUpdate,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Activate or deactivate a product. Inactive products are hidden from customers.
    """
    return await catalog_store.set_product_status(prod_id, status_in.is_active)

@router.delete("/products/{prod_id}")
async def delete_product(
    prod_id: str,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Delete a product and its associated inventory.
    """
    return await catalog_store.delete_product(prod_id)

# =============================================================================
# IMAGE MANAGEMENT (SUPABASE STORAGE UPLOAD)
# =============================================================================

@router.post("/upload-image")
async def upload_catalog_image(
    file: UploadFile = File(...),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Uploads an image to Supabase Storage bucket 'product-images'.
    Validates file format (JPG, PNG, WEBP, GIF) and size (<= 5MB).
    Returns the public image URL and storage path.
    """
    url, storage_path = await validate_and_upload_image(file)
    return {
        "url": url,
        "storage_path": storage_path,
        "filename": file.filename
    }

# =============================================================================
# INVENTORY MANAGEMENT & STOCK CONTROL (ADMIN ONLY)
# =============================================================================

@router.get("/inventory", response_model=List[InventoryOverviewItem])
async def list_admin_inventory(
    status_filter: Optional[str] = Query(None, description="'all', 'in_stock', 'low_stock', 'out_of_stock'"),
    search: Optional[str] = Query(None),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Returns inventory overview across all products with real-time stock levels.
    """
    return await catalog_store.list_inventory(status_filter=status_filter, search=search)

@router.post("/inventory/adjust", response_model=StockAdjustmentResponse)
async def adjust_stock(
    req: StockAdjustmentRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Manual Stock Adjustment:
    - Atomically updates product available stock.
    - Prevents stock from becoming negative.
    - Generates an immutable audit trail in stock_movements with admin identity.
    """
    return await catalog_store.adjust_stock(req, admin_id=current_admin.id)

@router.get("/inventory/movements", response_model=List[StockMovementItem])
async def list_stock_movements(
    product_id: Optional[str] = Query(None),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    View complete stock movement audit records (restocks, adjustments, holds, returns).
    """
    return await catalog_store.list_stock_movements(product_id=product_id)

@router.post("/inventory/reservations/cleanup")
async def cleanup_expired_reservations(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Runs cleanup to automatically release any expired checkout holds back to available stock.
    """
    count = await catalog_store.cleanup_expired_reservations()
    return {"released_reservations_count": count}

# =============================================================================
# UPI PAYMENT VERIFICATION & SETTINGS (ADMIN ONLY)
# =============================================================================

@router.post("/payments/verify", response_model=AdminPaymentVerifyResponse)
async def verify_payment(
    req: AdminPaymentVerifyRequest,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Admin independently verifies customer UPI payment submission against shop bank/UPI records.
    Action can be 'VERIFY' or 'REJECT'.
    """
    return await order_store.admin_verify_payment(admin_id=current_admin.id, req=req)

# =============================================================================
# ADMIN SETTINGS MANAGEMENT (UPI, QR CODE, STORE ADDRESS, BRANDING)
# =============================================================================

@router.get("/payment-settings", response_model=PaymentSettingsSchema)
@router.get("/settings/payment", response_model=PaymentSettingsSchema)
async def get_payment_settings(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Retrieve current shop UPI payment settings (UPI ID, QR code, payment instructions).
    """
    return await settings_service.get_payment_settings()

@router.put("/payment-settings", response_model=PaymentSettingsSchema)
@router.put("/settings/payment", response_model=PaymentSettingsSchema)
async def update_payment_settings(
    settings_in: PaymentSettingsSchema,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Update shop UPI payment settings with database and persistent storage.
    """
    return await settings_service.update_payment_settings(settings_in.model_dump())

@router.get("/settings/store", response_model=StoreSettingsSchema)
async def get_store_settings(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Retrieve official SANJANA MOBILES store settings and physical business address.
    """
    return await settings_service.get_store_settings()

@router.put("/settings/store", response_model=StoreSettingsSchema)
async def update_store_settings(
    settings_in: StoreSettingsSchema,
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Update official SANJANA MOBILES store settings (Address, Contact, Shipping thresholds).
    """
    return await settings_service.update_store_settings(settings_in.model_dump())

@router.post("/upload-qr")
@router.post("/upload-qr/")
@router.post("/settings/payment/upload-qr")
@router.post("/settings/payment/upload-qr/")
@router.post("/settings/payment/qr")
@router.post("/settings/payment/qr/")
async def upload_shop_qr_code(
    file: UploadFile = File(...),
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Upload official shop QR code image (PNG, JPG, WEBP).
    Persists to Supabase Storage and updates payment_settings record.
    """
    content = await file.read()
    return await settings_service.upload_qr_image(
        file_bytes=content,
        filename=file.filename or "sanjana-qr.png",
        content_type=file.content_type or "image/png"
    )

@router.post("/paste-qr")
@router.post("/paste-qr/")
@router.post("/settings/payment/paste-qr")
@router.post("/settings/payment/paste-qr/")
async def paste_shop_qr_code(
    payload: Dict[str, Any],
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Directly accept clipboard pasted image data (data:image/png;base64,...).
    Saves image permanently and updates payment_settings record.
    """
    import base64
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

@router.delete("/settings/payment/qr")
@router.delete("/settings/payment/qr/")
@router.delete("/payment-settings/qr")
@router.delete("/payment-settings/qr/")
async def remove_shop_qr_code(
    current_admin: AuthUser = Depends(get_current_admin)
):
    """
    Removes the official static shop QR code image and restores dynamic QR code generation.
    """
    return await settings_service.remove_qr_image()



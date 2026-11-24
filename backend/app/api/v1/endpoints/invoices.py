from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import get_current_user, get_current_admin
from app.schemas.auth import AuthUser
from app.schemas.invoice import InvoiceResponse
from app.services.order_store import order_store
from app.services.invoice_service import invoice_service

router = APIRouter()


@router.get("/orders/{order_id_or_number}/invoice", response_model=InvoiceResponse)
async def get_order_invoice(
    order_id_or_number: str,
    current_user: AuthUser = Depends(get_current_user)
):
    """
    Retrieve or generate the official showroom invoice for an order.
    Customers may only view invoices for their own orders (enforced 403 Forbidden on mismatch).
    Admins may view invoices for any order.
    Viewing or printing the invoice is completely idempotent and never modifies order status.
    """
    # 1. Fetch raw order dictionary
    order = None
    if order_id_or_number.startswith("ord-"):
        order = order_store.orders.get(order_id_or_number)
    else:
        order_id = order_store.order_number_map.get(order_id_or_number)
        if order_id:
            order = order_store.orders.get(order_id)
        else:
            # Case-insensitive / prefix fallback lookup
            for oid, o in order_store.orders.items():
                if o.get("order_number", "").upper() == order_id_or_number.upper():
                    order = o
                    break

    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{order_id_or_number}' not found."
        )

    # 2. Hand over to InvoiceService which enforces strict user_id isolation
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role
    }
    return await invoice_service.get_or_create_invoice_for_order(order, user_dict)


@router.get("/admin/orders/{order_id_or_number}/invoice", response_model=InvoiceResponse)
async def get_admin_order_invoice(
    order_id_or_number: str,
    admin_user: AuthUser = Depends(get_current_admin)
):
    """
    Admin-specific endpoint to view or reprint an order invoice.
    Strictly restricted to Admin role.
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
        "id": admin_user.id,
        "email": admin_user.email,
        "full_name": admin_user.full_name,
        "role": "admin"
    }
    return await invoice_service.get_or_create_invoice_for_order(order, admin_dict)

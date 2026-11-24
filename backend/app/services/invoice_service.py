import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import httpx
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.invoice import (
    InvoiceResponse,
    InvoiceItem,
    StoreInfo,
    CustomerInfo,
    PaymentInfo,
    InvoicePricing,
    amount_to_words_inr,
)
from app.services.settings_service import settings_service


STATUS_DISPLAY_MAP = {
    "NEW": "Order Placed",
    "ACCEPTED": "Order Confirmed",
    "PACKING": "Processing & Packing",
    "PACKED": "Packed & Ready",
    "DELIVERY_PENDING": "Ready for Handover",
    "READY_FOR_DELIVERY": "Ready for Delivery",
    "OUT_FOR_DELIVERY": "Out for Delivery",
    "READY_FOR_PICKUP": "Ready for Store Pickup",
    "COLLECTED": "Collected at Store",
    "COURIER_ASSIGNED": "Courier Assigned",
    "SHIPPED": "Dispatched with Courier",
    "COURIER_TRACKING": "In Transit",
    "DELIVERED": "Delivered",
    "COMPLETED": "Completed",
    "REJECTED": "Order Rejected",
    "CANCELLED": "Order Cancelled"
}


class InvoiceService:
    def __init__(self):
        self._lock = asyncio.Lock()
        self.invoices_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "data",
            "invoices.json"
        )
        self.invoices_by_order: Dict[str, dict] = {} # order_id -> invoice_data
        self.invoices_by_number: Dict[str, dict] = {} # invoice_number -> invoice_data
        self._sequence_counter = 0
        self._load_local_invoices()

    def _load_local_invoices(self):
        try:
            if os.path.exists(self.invoices_file):
                with open(self.invoices_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    for inv in data:
                        self.invoices_by_order[inv["order_id"]] = inv
                        self.invoices_by_number[inv["invoice_number"]] = inv
            self._init_sequence_counter()
        except Exception as e:
            print(f"[InvoiceService] Error loading local invoices: {e}")

    def _init_sequence_counter(self):
        max_seq = 0
        current_year = datetime.now(timezone.utc).strftime("%Y")
        pattern = re.compile(rf"^SM/{current_year}/(\d+)$")
        for num in self.invoices_by_number.keys():
            m = pattern.match(num)
            if m:
                val = int(m.group(1))
                if val > max_seq:
                    max_seq = val
        self._sequence_counter = max_seq

    def _generate_invoice_number(self) -> str:
        self._sequence_counter += 1
        year_str = datetime.now(timezone.utc).strftime("%Y")
        return f"SM/{year_str}/{self._sequence_counter:04d}"

    def _save_local_invoices(self):
        try:
            os.makedirs(os.path.dirname(self.invoices_file), exist_ok=True)
            with open(self.invoices_file, "w", encoding="utf-8") as f:
                json.dump(list(self.invoices_by_order.values()), f, indent=2)
        except Exception as e:
            print(f"[InvoiceService] Error saving invoices locally: {e}")

    async def _try_save_supabase_invoice(self, invoice_data: dict):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            return
        url = f"{settings.SUPABASE_URL}/rest/v1/invoices"
        headers = {
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        payload = {
            "id": invoice_data["id"],
            "invoice_number": invoice_data["invoice_number"],
            "order_id": invoice_data["order_id"],
            "customer_id": invoice_data["customer_info"].get("customer_id") or invoice_data["order_id"],
            "invoice_date": invoice_data["invoice_date"],
            "subtotal": invoice_data["pricing"]["subtotal"],
            "discount": invoice_data["pricing"]["product_discount"] + invoice_data["pricing"]["coupon_discount"],
            "tax_amount": invoice_data["pricing"]["cgst"] + invoice_data["pricing"]["sgst"] + invoice_data["pricing"]["igst"],
            "delivery_charge": invoice_data["pricing"]["delivery_charge"],
            "grand_total": invoice_data["pricing"]["grand_total"],
            "amount_paid": invoice_data["pricing"]["amount_paid"],
            "balance_due": invoice_data["pricing"]["balance_due"],
            "payment_status": invoice_data["payment_info"]["payment_status"],
            "payment_method": invoice_data["payment_info"]["payment_method"],
            "items_snapshot": invoice_data["items"],
            "billing_address": invoice_data["customer_info"].get("billing_address"),
            "shipping_address": invoice_data["customer_info"].get("shipping_address"),
            "store_snapshot": invoice_data["store_info"]
        }
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                await client.post(url, json=payload, headers=headers)
        except Exception:
            pass # Graceful fallback to persistent JSON

    async def get_or_create_invoice_for_order(
        self,
        order: dict,
        requesting_user: dict
    ) -> InvoiceResponse:
        """
        Retrieves existing invoice or idempotently creates a new official showroom invoice.
        Enforces customer access isolation: Customer can only access their own orders.
        """
        # Access control
        user_role = (requesting_user.get("role") or "").lower()
        is_admin = user_role in ["admin", "super_admin"]
        if not is_admin and order.get("user_id") != requesting_user.get("id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view or print this invoice."
            )

        order_id = order["id"]
        order_number = order["order_number"]

        async with self._lock:
            existing = self.invoices_by_order.get(order_id)
            store_settings = await settings_service.get_store_settings()

            store_info = StoreInfo(
                store_name=store_settings.get("store_name", "SANJANA MOBILES"),
                tagline=store_settings.get("tagline", "Your Trusted Partner for Smartphones & Accessories"),
                address_line1=store_settings.get("address_line1", "Main Bazaar, Near Bus Stand"),
                address_line2=store_settings.get("address_line2", "Ground Floor, Commercial Complex"),
                city=store_settings.get("city", "Harur"),
                district=store_settings.get("district", "Dharmapuri"),
                state=store_settings.get("state", "Tamil Nadu"),
                postal_code=store_settings.get("postal_code", "636903"),
                country=store_settings.get("country", "India"),
                phone=store_settings.get("phone", "9876543210"),
                email=store_settings.get("email", "sanjanamobilesharur@gmail.com"),
                gstin=store_settings.get("gstin"),
                opening_hours=store_settings.get("opening_hours")
            )

            # Customer & Address preparation
            customer_name = order.get("customer_name") or requesting_user.get("full_name") or "Valued Customer"
            customer_email = order.get("customer_email") or requesting_user.get("email")
            customer_mobile = order.get("customer_mobile")
            
            shipping_addr = order.get("delivery_address")
            if not customer_mobile and shipping_addr:
                customer_mobile = shipping_addr.get("mobile_number") or shipping_addr.get("phone")

            customer_info = CustomerInfo(
                full_name=customer_name,
                mobile=customer_mobile,
                email=customer_email,
                delivery_method=order.get("delivery_method", "HOME_DELIVERY"),
                billing_address=shipping_addr, # In retail mobile sales, billing defaults to delivery address
                shipping_address=shipping_addr
            )

            # Payment Info calculation
            payment_status = order.get("payment_status", "PENDING").upper()
            is_paid = payment_status in ["PAID", "VERIFIED"]
            grand_total = float(order.get("total_amount", 0.0))
            amount_paid = grand_total if is_paid else 0.0
            balance_due = 0.0 if is_paid else grand_total

            payment_method_name = "UPI Payment"
            raw_method = (order.get("payment_method") or "").upper()
            if "STORE" in raw_method or order.get("delivery_method") == "STORE_PICKUP":
                payment_method_name = "Store Pickup (Pay at Counter)"
            elif "RAZORPAY" in raw_method:
                payment_method_name = "Online / Razorpay"
            elif raw_method:
                payment_method_name = raw_method

            payment_info = PaymentInfo(
                payment_method=payment_method_name,
                payment_status=payment_status,
                transaction_id=order.get("upi_utr") or order.get("razorpay_payment_id"),
                payment_reference=order.get("upi_utr") or order.get("razorpay_order_id") or order_number,
                payment_date=order.get("upi_submission_time") or (order.get("updated_at") if is_paid else None),
                amount_paid=amount_paid,
                balance_due=balance_due,
                is_confirmed=is_paid
            )

            # Items Snapshot
            raw_items = order.get("items", [])
            items_list: List[InvoiceItem] = []
            for idx, it in enumerate(raw_items, start=1):
                qty = it.get("quantity", 1)
                unit_price = float(it.get("price_snapshot", it.get("price", 0.0)))
                subtot = float(it.get("subtotal", unit_price * qty))
                items_list.append(InvoiceItem(
                    s_no=idx,
                    product_name=it.get("title") or it.get("name") or "Product",
                    sku=it.get("sku") or "SKU-GEN",
                    model=it.get("model"),
                    variant=it.get("variant"),
                    quantity=qty,
                    unit_price=unit_price,
                    discount=0.0,
                    total=subtot
                ))

            # Pricing & Tax calculation (18% GST inclusive standard)
            subtotal = float(order.get("subtotal", grand_total))
            discount = float(order.get("discount_amount", 0.0))
            delivery_charge = float(order.get("delivery_charge", 0.0))

            # Taxable base calculation
            taxable_base = subtotal - discount
            if taxable_base < 0:
                taxable_base = 0.0

            # Determine intra-state vs inter-state
            dest_state = ""
            if shipping_addr and isinstance(shipping_addr, dict):
                dest_state = (shipping_addr.get("state") or "").strip().lower()
            store_state = store_info.state.strip().lower()

            is_intra_state = (not dest_state) or (dest_state == store_state)

            taxable_amount = round(taxable_base / 1.18, 2)
            total_tax = round(taxable_base - taxable_amount, 2)

            if is_intra_state:
                cgst = round(total_tax / 2, 2)
                sgst = round(total_tax - cgst, 2)
                igst = 0.0
            else:
                cgst = 0.0
                sgst = 0.0
                igst = total_tax

            words_str = amount_to_words_inr(grand_total)

            pricing = InvoicePricing(
                subtotal=subtotal,
                product_discount=discount,
                coupon_discount=0.0,
                delivery_charge=delivery_charge,
                taxable_amount=taxable_amount,
                cgst=cgst,
                sgst=sgst,
                igst=igst,
                tax_rate_percent=18.0,
                is_inclusive_tax=True,
                grand_total=grand_total,
                amount_paid=amount_paid,
                balance_due=balance_due,
                total_in_words=words_str,
                currency="INR"
            )

            raw_status = order.get("status", "NEW").upper()
            display_status = STATUS_DISPLAY_MAP.get(raw_status, raw_status)

            if existing:
                # Update volatile fields (payment status, order status, amounts) without changing invoice_number or created invoice_date
                existing["order_status"] = raw_status
                existing["display_order_status"] = display_status
                existing["payment_info"] = payment_info.model_dump()
                existing["pricing"]["amount_paid"] = amount_paid
                existing["pricing"]["balance_due"] = balance_due
                existing["store_info"] = store_info.model_dump()
                self._save_local_invoices()
                asyncio.create_task(self._try_save_supabase_invoice(existing))
                return InvoiceResponse(**existing)

            # Generate new unique invoice number
            invoice_num = self._generate_invoice_number()
            now_iso = datetime.now(timezone.utc).isoformat()
            inv_id = f"inv-{uuid.uuid4().hex[:10]}"

            new_invoice_data = {
                "id": inv_id,
                "invoice_number": invoice_num,
                "order_id": order_id,
                "order_number": order_number,
                "invoice_date": now_iso,
                "order_date": order.get("created_at", now_iso),
                "order_status": raw_status,
                "display_order_status": display_status,
                "store_info": store_info.model_dump(),
                "customer_info": customer_info.model_dump(),
                "payment_info": payment_info.model_dump(),
                "items": [it.model_dump() for it in items_list],
                "pricing": pricing.model_dump(),
                "notes": "Thank you for shopping with SANJANA MOBILES! Goods once sold carry official manufacturer warranty."
            }

            self.invoices_by_order[order_id] = new_invoice_data
            self.invoices_by_number[invoice_num] = new_invoice_data
            self._save_local_invoices()
            asyncio.create_task(self._try_save_supabase_invoice(new_invoice_data))

            return InvoiceResponse(**new_invoice_data)


invoice_service = InvoiceService()

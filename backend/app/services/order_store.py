import asyncio
import re
import uuid
import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from fastapi import HTTPException, status

from app.core.config import settings
from app.schemas.cart import (
    CartItemIn,
    CartItemResponse,
    CartCalculationResponse,
)
from app.schemas.address import (
    AddressCreate,
    AddressUpdate,
    AddressResponse,
)
from app.schemas.order import (
    OrderItemSnapshot,
    OrderStatusHistoryItem,
    OrderDetailedResponse,
    AdminOrdersSummaryResponse,
    ORDER_STATUS_FLOW,
    REJECTION_REASONS,
)
from app.schemas.checkout import (
    CheckoutInitiateRequest,
    CheckoutInitiateResponse,
    PaymentVerificationRequest,
    PaymentVerificationResponse,
    UpiPaymentSubmitRequest,
    UpiPaymentSubmitResponse,
    AdminPaymentVerifyRequest,
    AdminPaymentVerifyResponse,
    PaymentSettingsSchema,
)
from app.schemas.refund import (
    RefundInitiateRequest,
    RefundRecordResponse,
    PaymentTransactionItem,
)
from app.schemas.inventory import StockAdjustmentRequest
from app.services.catalog_store import catalog_store
from app.services.razorpay_service import razorpay_service
from app.services.rewards_store import rewards_store
from app.services.delivery_service import delivery_service


class OrderStore:
    def __init__(self):
        self._lock = asyncio.Lock()
        
        # In-memory stores (can sync with Supabase tables)
        # user_id -> List[{"product_id": str, "quantity": int, "added_at": str}]
        self.user_carts: Dict[str, List[dict]] = {}
        
        # address_id -> dict
        self.addresses: Dict[str, dict] = {}
        
        # order_id -> dict
        self.orders: Dict[str, dict] = {}
        
        # order_number -> order_id
        self.order_number_map: Dict[str, str] = {}
        
        # razorpay_order_id -> order_id
        self.rzp_order_map: Dict[str, str] = {}
        
        # transaction_id -> dict
        self.transactions: Dict[str, dict] = {}
        
        # refund_id -> dict
        self.refunds: Dict[str, dict] = {}
        
        # processed webhook event IDs for idempotency
        self.processed_webhook_events: set = set()
        
        # notifications: List[dict]
        self.notifications: List[dict] = []
        
        # Central UPI Payment Settings (Configurable by Super Admin)
        self.payment_settings: Dict[str, Any] = {
            "upi_id": "REPLACE_WITH_REAL_SHOP_UPI_ID",
            "merchant_name": "SANJANA MOBILES",
            "qr_code_image_url": "",
            "payment_instructions": (
                "1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app.\n"
                "2. Or click Pay with UPI on mobile.\n"
                "3. Complete the transfer for the exact order amount.\n"
                "4. Enter the 12-digit UPI Reference Number / UTR below and submit for verification."
            ),
            "is_upi_enabled": True,
            "require_manual_verification": True,
            "updated_at": "2026-03-01T00:00:00Z"
        }
        
        # Concurrency-safe sequential order number counter (e.g. SANJANA-001, SANJANA-002...)
        self._order_sequence = 0
        self._init_order_sequence()

    def _init_order_sequence(self):
        """Scans existing orders to determine starting sequence number"""
        max_seq = 0
        for o in self.orders.values():
            num = o.get("order_number", "")
            match = re.match(r"^SANJANA-(\d+)$", num)
            if match:
                val = int(match.group(1))
                if val > max_seq:
                    max_seq = val
        self._order_sequence = max_seq

    def _generate_next_order_number(self) -> str:
        """
        Generates the next sequential order number:
        SANJANA-001, SANJANA-002 ... SANJANA-999, SANJANA-1000 ...
        """
        self._order_sequence += 1
        if self._order_sequence < 1000:
            return f"SANJANA-{self._order_sequence:03d}"
        return f"SANJANA-{self._order_sequence}"

    # ==========================================
    # CART MANAGEMENT & SERVER-SIDE CALCULATION
    # ==========================================
    async def get_user_cart(self, user_id: str) -> List[dict]:
        return self.user_carts.get(user_id, [])

    async def update_user_cart(self, user_id: str, items: List[CartItemIn]) -> List[dict]:
        async with self._lock:
            cart_list = []
            for item in items:
                cart_list.append({
                    "product_id": item.product_id,
                    "quantity": item.quantity,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                })
            self.user_carts[user_id] = cart_list
            return cart_list

    async def add_item_to_cart(self, user_id: str, item: CartItemIn) -> List[dict]:
        async with self._lock:
            cart = self.user_carts.setdefault(user_id, [])
            for c in cart:
                if c["product_id"] == item.product_id:
                    c["quantity"] = min(50, c["quantity"] + item.quantity)
                    c["updated_at"] = datetime.now(timezone.utc).isoformat()
                    return cart
            cart.append({
                "product_id": item.product_id,
                "quantity": item.quantity,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            return cart

    async def remove_item_from_cart(self, user_id: str, product_id: str) -> List[dict]:
        async with self._lock:
            if user_id in self.user_carts:
                self.user_carts[user_id] = [c for c in self.user_carts[user_id] if c["product_id"] != product_id]
            return self.user_carts.get(user_id, [])

    async def clear_user_cart(self, user_id: str):
        async with self._lock:
            self.user_carts[user_id] = []

    async def calculate_cart(
        self,
        items: List[CartItemIn],
        delivery_method: str = "HOME_DELIVERY",
        promo_code: Optional[str] = None,
        coins_to_redeem: int = 0,
        user_id: Optional[str] = None
    ) -> CartCalculationResponse:
        """
        Authoritative server-side price calculation.
        Never trusts client price or subtotal submissions.
        Checks product existence, active status, and real available stock.
        Calculates loyalty coin redemption and preview coins earned.
        """
        subtotal = 0.0
        calculated_items: List[CartItemResponse] = []
        has_unavailable = False
        unavailable_reasons: List[str] = []

        for it in items:
            p_id = it.product_id
            prod = catalog_store.products.get(p_id)
            inv = catalog_store.inventory.get(p_id, {"available_quantity": 0})
            avail_stock = inv.get("available_quantity", 0)

            if not prod:
                has_unavailable = True
                unavailable_reasons.append(f"Product '{p_id}' does not exist in store catalog.")
                continue

            if not prod.get("is_active", True):
                has_unavailable = True
                unavailable_reasons.append(f"'{prod.get('title')}' is currently inactive and cannot be purchased.")

            if avail_stock < it.quantity:
                has_unavailable = True
                unavailable_reasons.append(
                    f"'{prod.get('title')}' only has {avail_stock} units available (requested: {it.quantity})."
                )

            unit_price = float(prod.get("sale_price") or prod.get("price", 0.0))
            orig_price = float(prod.get("price", 0.0))
            item_total = round(unit_price * it.quantity, 2)
            subtotal += item_total

            img_url = ""
            if prod.get("primary_image"):
                img_url = prod["primary_image"]
            elif prod.get("images") and len(prod["images"]) > 0:
                first_img = prod["images"][0]
                img_url = first_img.get("image_url") or first_img.get("url") if isinstance(first_img, dict) else str(first_img)

            calculated_items.append(CartItemResponse(
                id=f"ci-{uuid.uuid4().hex[:6]}",
                product_id=p_id,
                product_title=prod.get("title", "Unknown"),
                product_slug=prod.get("slug", ""),
                image_url=img_url,
                sku=prod.get("sku", ""),
                unit_price=unit_price,
                original_price=orig_price,
                quantity=it.quantity,
                item_total=item_total,
                is_available=(prod.get("is_active", True) and avail_stock >= it.quantity),
                available_stock=avail_stock
            ))

        subtotal = round(subtotal, 2)
        
        # Delivery calculation
        if delivery_method == "STORE_PICKUP":
            delivery_charge = 0.0
        else:
            if subtotal >= settings.FREE_DELIVERY_THRESHOLD or subtotal == 0:
                delivery_charge = 0.0
            else:
                delivery_charge = settings.DEFAULT_DELIVERY_FEE

        # Promotional discount
        discount_amount = 0.0
        if promo_code and promo_code.strip().upper() in ["SANJANA10", "LUNA10"]:
            discount_amount = round(subtotal * 0.10, 2)

        pre_coin_total = round(max(0.0, subtotal - discount_amount + delivery_charge), 2)

        # Loyalty coin redemption calculation
        coin_discount = 0.0
        coins_used = 0
        if coins_to_redeem > 0:
            conv = float(rewards_store.settings.get("coin_conversion_rate", 1.0))
            max_red = int(rewards_store.settings.get("max_redemption_per_order", 500))
            coins_used = min(coins_to_redeem, max_red)
            coin_discount = round(min(pre_coin_total, coins_used * conv), 2)

        payable_after_coins = round(max(0.0, pre_coin_total - coin_discount), 2)
        ratio = float(rewards_store.settings.get("earning_ratio", 0.01))
        coins_earned_preview = int(payable_after_coins * ratio) if rewards_store.settings.get("is_active", True) else 0

        return CartCalculationResponse(
            items=calculated_items,
            subtotal=subtotal,
            discount_amount=discount_amount,
            delivery_charge=delivery_charge,
            final_total=pre_coin_total,
            currency="INR",
            currency_symbol="₹",
            free_delivery_threshold=settings.FREE_DELIVERY_THRESHOLD,
            delivery_method=delivery_method,
            coins_redeemed=coins_used,
            coin_discount=coin_discount,
            payable_after_coins=payable_after_coins,
            coins_earned_preview=coins_earned_preview,
            has_unavailable_items=has_unavailable,
            unavailable_reasons=unavailable_reasons
        )

    # ==========================================
    # CUSTOMER ADDRESS MANAGEMENT
    # ==========================================
    async def list_user_addresses(self, user_id: str) -> List[AddressResponse]:
        user_addrs = [
            AddressResponse(**addr)
            for addr in self.addresses.values()
            if addr["user_id"] == user_id
        ]
        # Sort so default address comes first
        user_addrs.sort(key=lambda a: (not a.is_default, a.created_at or ""))
        return user_addrs

    async def get_address(self, address_id: str, user_id: Optional[str] = None) -> AddressResponse:
        addr = self.addresses.get(address_id)
        if not addr:
            raise HTTPException(status_code=404, detail="Address not found")
        if user_id and addr["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to address")
        return AddressResponse(**addr)

    async def create_address(self, user_id: str, req: AddressCreate) -> AddressResponse:
        async with self._lock:
            now = datetime.now(timezone.utc).isoformat()
            addr_id = f"addr-{uuid.uuid4().hex[:8]}"

            # If this is the user's first address, make it default automatically
            user_existing = [a for a in self.addresses.values() if a["user_id"] == user_id]
            is_default = req.is_default or len(user_existing) == 0

            if is_default:
                for a in user_existing:
                    a["is_default"] = False

            data = req.model_dump()
            data["id"] = addr_id
            data["user_id"] = user_id
            data["is_default"] = is_default
            data["created_at"] = now
            data["updated_at"] = now

            self.addresses[addr_id] = data
            return AddressResponse(**data)

    async def update_address(self, address_id: str, user_id: str, req: AddressUpdate) -> AddressResponse:
        async with self._lock:
            addr = self.addresses.get(address_id)
            if not addr:
                raise HTTPException(status_code=404, detail="Address not found")
            if addr["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Unauthorized access to address")

            update_data = req.model_dump(exclude_unset=True)
            if update_data.get("is_default") is True:
                for a in self.addresses.values():
                    if a["user_id"] == user_id:
                        a["is_default"] = False

            addr.update(update_data)
            addr["updated_at"] = datetime.now(timezone.utc).isoformat()
            return AddressResponse(**addr)

    async def delete_address(self, address_id: str, user_id: str) -> dict:
        async with self._lock:
            addr = self.addresses.get(address_id)
            if not addr:
                raise HTTPException(status_code=404, detail="Address not found")
            if addr["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Unauthorized access to address")

            was_default = addr.get("is_default", False)
            del self.addresses[address_id]

            # If the deleted address was default, set another one as default if exists
            if was_default:
                remaining = [a for a in self.addresses.values() if a["user_id"] == user_id]
                if remaining:
                    remaining[0]["is_default"] = True

            return {"message": "Address deleted successfully", "id": address_id}

    async def set_default_address(self, address_id: str, user_id: str) -> AddressResponse:
        async with self._lock:
            addr = self.addresses.get(address_id)
            if not addr:
                raise HTTPException(status_code=404, detail="Address not found")
            if addr["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Unauthorized access to address")

            for a in self.addresses.values():
                if a["user_id"] == user_id:
                    a["is_default"] = (a["id"] == address_id)

            addr["updated_at"] = datetime.now(timezone.utc).isoformat()
            return AddressResponse(**addr)

    # ==========================================
    # CHECKOUT WORKFLOW & RAZORPAY INTEGRATION
    # ==========================================
    async def initiate_checkout(
        self,
        user: dict,
        req: CheckoutInitiateRequest
    ) -> CheckoutInitiateResponse:
        """
        Step-by-step Checkout Initiation:
        1. Validates cart items, verifies product status & stock.
        2. Validates delivery options (Home Delivery vs Store Pickup).
        3. Holds / reserves stock atomically to prevent overselling.
        4. Creates Order in 'PENDING' payment state.
        5. Calls Razorpay API to generate razorpay_order_id.
        6. Persists order & payment transaction mapping.
        """
        if not req.items:
            raise HTTPException(status_code=400, detail="Cannot checkout with empty cart.")

        # Server-side price calculation
        calc = await self.calculate_cart(
            items=req.items,
            delivery_method=req.delivery_method,
            promo_code=req.promo_code
        )

        if calc.has_unavailable_items:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"message": "Cart contains unavailable items", "errors": calc.unavailable_reasons}
            )

        # Handle delivery destination details
        delivery_address_data = None
        pickup_details_data = None

        if req.delivery_method == "HOME_DELIVERY":
            if not req.address_id:
                # Find default address for user
                user_addrs = [a for a in self.addresses.values() if a["user_id"] == user["id"]]
                default_addr = next((a for a in user_addrs if a.get("is_default")), None)
                if not default_addr and user_addrs:
                    default_addr = user_addrs[0]
                if not default_addr:
                    raise HTTPException(status_code=400, detail="Delivery address is required for Home Delivery.")
                delivery_address_data = default_addr
            else:
                addr = self.addresses.get(req.address_id)
                if not addr or addr["user_id"] != user["id"]:
                    raise HTTPException(status_code=400, detail="Invalid delivery address selected.")
                delivery_address_data = addr
        else: # STORE_PICKUP
            pickup_name = req.pickup_person_name or (req.pickup_details.get("pickup_person_name") if req.pickup_details else None)
            pickup_phone = req.pickup_person_phone or (req.pickup_details.get("pickup_person_phone") if req.pickup_details else None)
            if not pickup_name or not pickup_phone:
                raise HTTPException(status_code=400, detail="Pickup contact name and mobile number are required for Store Pickup.")
            pickup_details_data = {
                "pickup_person_name": pickup_name,
                "pickup_person_phone": pickup_phone,
                "store_location": settings.STORE_NAME + " Flagship Store, Bengaluru",
                "ready_instructions": "Bring original Government Photo ID and Order Confirmation SMS/Email."
            }

        async with self._lock:
            # Atomic stock reservation for each item
            now = datetime.now(timezone.utc)
            order_id = f"ord-{uuid.uuid4().hex[:10]}"
            order_number = self._generate_next_order_number()

            # Snapshot item details
            order_items: List[dict] = []
            for item_resp in calc.items:
                # Atomically decrement available quantity and increment reserved_quantity
                inv = catalog_store.inventory.setdefault(item_resp.product_id, {"available_quantity": 0, "reserved_quantity": 0})
                if inv["available_quantity"] < item_resp.quantity:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Stock for '{item_resp.product_title}' changed. Available: {inv['available_quantity']}"
                    )
                inv["available_quantity"] -= item_resp.quantity
                inv["reserved_quantity"] += item_resp.quantity

                prod = catalog_store.products.get(item_resp.product_id, {})
                req_item = next((it for it in req.items if it.product_id == item_resp.product_id), None)
                variant_val = getattr(req_item, "variant", None) or prod.get("variant") or prod.get("model") or None

                order_items.append({
                    "id": f"oi-{uuid.uuid4().hex[:8]}",
                    "product_id": item_resp.product_id,
                    "title": item_resp.product_title,
                    "sku": item_resp.sku or prod.get("sku") or "SKU-GEN",
                    "price_snapshot": item_resp.unit_price,
                    "quantity": item_resp.quantity,
                    "subtotal": item_resp.item_total,
                    "image_url": item_resp.image_url,
                    "variant": variant_val
                })

            # Loyalty Coin Redemption Handling
            coins_redeemed = 0
            coin_discount = 0.0
            if req.coins_to_redeem and req.coins_to_redeem > 0:
                redemption = await rewards_store.validate_and_calculate_redemption(
                    user["id"],
                    req.coins_to_redeem,
                    calc.final_total
                )
                coins_redeemed = redemption["coins_used"]
                coin_discount = redemption["discount_amount"]
                # Atomically debit coins from customer wallet
                await rewards_store.debit_coins_for_order(
                    user["id"],
                    coins_redeemed,
                    order_id,
                    order_number
                )

            payable_amount = round(max(0.0, calc.final_total - coin_discount), 2)
            is_full_coin_payment = (payable_amount == 0.0 and coins_redeemed > 0)

            # Generate official UPI payment URI
            upi_id = self.payment_settings.get("upi_id", "REPLACE_WITH_REAL_SHOP_UPI_ID")
            merchant_name = self.payment_settings.get("merchant_name", "SANJANA MOBILES")
            encoded_pn = urllib.parse.quote(merchant_name)
            encoded_tn = urllib.parse.quote(f"Order {order_number} - SANJANA MOBILES")
            upi_uri = f"upi://pay?pa={upi_id}&pn={encoded_pn}&am={payable_amount:.2f}&cu=INR&tn={encoded_tn}"

            is_store_pickup = (req.delivery_method == "STORE_PICKUP")
            requested_payment_method = getattr(req, "payment_method", None)
            is_pay_at_store = is_store_pickup and (requested_payment_method in ["PAY_AT_STORE", "STORE_PICKUP", None, ""])

            if is_pay_at_store:
                payment_method = "PAY_AT_STORE"
                payment_status = "PENDING"
                order_status = "NEW"
                rzp_order_id = f"pos_{uuid.uuid4().hex[:14]}"
                rzp_amount_paise = int(payable_amount * 100)

                # Commit reserved stock for store pickup
                for it in order_items:
                    p_id = it["product_id"]
                    inv = catalog_store.inventory.get(p_id)
                    if inv:
                        inv["reserved_quantity"] = max(0, inv.get("reserved_quantity", 0) - it["quantity"])

                # Clear cart
                self.user_carts[user["id"]] = []
                initial_comment = f"Direct Store Pickup Order placed. Customer will Pay at Store upon collection. Order {order_number}"
            elif is_full_coin_payment:
                payment_method = "COINS"
                rzp_order_id = f"coin_{uuid.uuid4().hex[:14]}"
                rzp_amount_paise = 0
                payment_status = "PAID"
                order_status = "NEW"

                # Commit stock
                for it in order_items:
                    p_id = it["product_id"]
                    inv = catalog_store.inventory.get(p_id)
                    if inv:
                        inv["reserved_quantity"] = max(0, inv.get("reserved_quantity", 0) - it["quantity"])

                # Clear cart
                self.user_carts[user["id"]] = []

                initial_comment = f"Order paid in full using {coins_redeemed} Sanjana loyalty coins"
            else:
                payment_method = "UPI"
                payment_status = "PENDING"
                order_status = "NEW"
                rzp_order = razorpay_service.create_order(
                    amount=payable_amount,
                    receipt=order_number,
                    notes={
                        "order_id": order_id,
                        "order_number": order_number,
                        "user_id": user["id"],
                        "delivery_method": req.delivery_method,
                        "coins_redeemed": coins_redeemed
                    }
                )
                rzp_order_id = rzp_order["id"]
                rzp_amount_paise = rzp_order["amount"]
                initial_comment = f"Order created. UPI Payment Pending. Order {order_number}"

            # Store order record
            order_record = {
                "id": order_id,
                "order_number": order_number,
                "user_id": user["id"],
                "customer_name": user.get("name") or user.get("full_name") or "Valued Customer",
                "customer_email": user.get("email", ""),
                "customer_mobile": user.get("mobile") or (delivery_address_data.get("mobile_number") if delivery_address_data else req.pickup_person_phone),
                "delivery_method": req.delivery_method,
                "payment_method": payment_method,
                "internal_delivery_assignment": "UNASSIGNED",
                "assigned_admin_id": None,
                "assigned_admin_name": None,
                "admin_delivery_status": None,
                "admin_delivery_assigned_at": None,
                "admin_delivery_completed_at": None,
                "admin_delivery_notes": None,
                "delivery_address": delivery_address_data,
                "pickup_details": pickup_details_data,
                "items": order_items,
                "items_count": sum(it["quantity"] for it in order_items),
                "subtotal": calc.subtotal,
                "discount_amount": calc.discount_amount,
                "delivery_charge": calc.delivery_charge,
                "total_amount": calc.final_total,
                "currency": "INR",
                "status": order_status,
                "payment_status": payment_status,
                "upi_id": upi_id,
                "upi_utr": None,
                "upi_submission_time": None,
                "admin_verification_notes": None,
                "razorpay_order_id": rzp_order_id,
                "razorpay_payment_id": None if not is_full_coin_payment else f"pay_coin_{uuid.uuid4().hex[:10]}",
                "rejection_reason": None,
                "rejection_notes": None,
                "refunded_amount": 0.0,
                "coins_redeemed": coins_redeemed,
                "coin_discount_amount": coin_discount,
                "coins_earned": 0,
                "coins_credited": False,
                "status_history": [
                    {
                        "id": f"osh-{uuid.uuid4().hex[:6]}",
                        "order_id": order_id,
                        "previous_status": None,
                        "new_status": "NEW" if (is_full_coin_payment or is_pay_at_store) else "CHECKOUT_INITIATED",
                        "comment": initial_comment,
                        "changed_by": user["id"],
                        "created_at": now.isoformat()
                    }
                ],
                "created_at": now.isoformat(),
                "updated_at": now.isoformat()
            }

            self.orders[order_id] = order_record
            self.order_number_map[order_number] = order_id
            self.rzp_order_map[rzp_order_id] = order_id

            # Record initial transaction
            txn_id = f"txn-{uuid.uuid4().hex[:8]}"
            self.transactions[txn_id] = {
                "id": txn_id,
                "order_id": order_id,
                "order_number": order_number,
                "razorpay_order_id": rzp_order_id,
                "razorpay_payment_id": order_record["razorpay_payment_id"],
                "amount": payable_amount,
                "currency": "INR",
                "status": payment_status,
                "customer_email": user.get("email", ""),
                "created_at": now.isoformat()
            }

            return CheckoutInitiateResponse(
                order_id=order_id,
                order_number=order_number,
                razorpay_order_id=rzp_order_id,
                razorpay_key_id=settings.RAZORPAY_KEY_ID,
                amount_in_paise=rzp_amount_paise,
                amount=payable_amount,
                currency="INR",
                customer_name=order_record["customer_name"],
                customer_email=order_record["customer_email"],
                customer_mobile=order_record["customer_mobile"] or "",
                delivery_method=req.delivery_method,
                payment_method=payment_method,
                is_pay_at_store=is_pay_at_store,
                expires_at=(now + timedelta(minutes=30)).isoformat(),
                coins_redeemed=coins_redeemed,
                coin_discount=coin_discount,
                is_full_coin_payment=is_full_coin_payment,
                upi_id=upi_id,
                merchant_name=merchant_name,
                upi_uri=upi_uri,
                qr_code_image_url=self.payment_settings.get("qr_code_image_url") or self.payment_settings.get("qr_code_url"),
                qr_code_url=self.payment_settings.get("qr_code_url") or self.payment_settings.get("qr_code_image_url"),
                payment_status=payment_status,
                order_status=order_status
            )

    async def verify_payment(
        self,
        user: dict,
        req: PaymentVerificationRequest
    ) -> PaymentVerificationResponse:
        """
        Cryptographic verification of Razorpay payment signature.
        Never marks order paid without signature check.
        Updates order status to NEW and payment_status to PAID.
        Creates internal notification for Admin dashboard.
        """
        async with self._lock:
            order_id = req.order_id
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order["user_id"] != user["id"] and user.get("role") != "admin":
                raise HTTPException(status_code=403, detail="Unauthorized access to order")

            # Check matching razorpay_order_id
            if order["razorpay_order_id"] != req.razorpay_order_id:
                raise HTTPException(status_code=400, detail="Mismatched Razorpay Order ID")

            # Verify cryptographic signature
            is_valid = razorpay_service.verify_payment_signature(
                razorpay_order_id=req.razorpay_order_id,
                razorpay_payment_id=req.razorpay_payment_id,
                razorpay_signature=req.razorpay_signature
            )

            if not is_valid:
                # Update transaction as failed
                for txn in self.transactions.values():
                    if txn["razorpay_order_id"] == req.razorpay_order_id:
                        txn["status"] = "FAILED"
                        txn["razorpay_payment_id"] = req.razorpay_payment_id

                order["payment_status"] = "FAILED"
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid payment signature. Payment verification failed."
                )

            # Idempotency check: if already paid, return existing success
            if order["payment_status"] == "PAID":
                return PaymentVerificationResponse(
                    success=True,
                    order_id=order["id"],
                    order_number=order["order_number"],
                    payment_status="PAID",
                    order_status=order["status"],
                    message="Payment already verified and recorded."
                )

            now = datetime.now(timezone.utc).isoformat()

            # Mark Payment PAID and Order NEW
            order["payment_status"] = "PAID"
            order["status"] = "NEW"
            order["razorpay_payment_id"] = req.razorpay_payment_id
            order["updated_at"] = now

            # Transition reserved stock to committed
            for it in order["items"]:
                p_id = it["product_id"]
                inv = catalog_store.inventory.get(p_id)
                if inv:
                    inv["reserved_quantity"] = max(0, inv.get("reserved_quantity", 0) - it["quantity"])

            # Append history
            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": "CHECKOUT_INITIATED",
                "new_status": "NEW",
                "comment": f"Payment of ₹{order['total_amount']} verified via Razorpay ID {req.razorpay_payment_id}",
                "changed_by": user["id"],
                "created_at": now
            })

            # Update transaction
            for txn in self.transactions.values():
                if txn["razorpay_order_id"] == req.razorpay_order_id:
                    txn["status"] = "PAID"
                    txn["razorpay_payment_id"] = req.razorpay_payment_id

            # Clear customer's cart
            self.user_carts[user["id"]] = []

            # Add internal notification for store admin
            self.notifications.append({
                "id": f"notif-{uuid.uuid4().hex[:6]}",
                "type": "NEW_ORDER",
                "title": f"New Order Received: {order['order_number']}",
                "message": f"{order['customer_name']} placed order {order['order_number']} for ₹{order['total_amount']}",
                "order_id": order["id"],
                "order_number": order["order_number"],
                "customer_name": order["customer_name"],
                "amount": order["total_amount"],
                "payment_status": "PAID",
                "is_read": False,
                "created_at": now
            })

            return PaymentVerificationResponse(
                success=True,
                order_id=order["id"],
                order_number=order["order_number"],
                payment_status="PAID",
                order_status=order["status"],
                message="Payment verified successfully. Order confirmed."
            )

    async def submit_upi_payment(
        self,
        user_id: str,
        req: UpiPaymentSubmitRequest
    ) -> UpiPaymentSubmitResponse:
        """
        Customer submits 12-digit UPI transaction reference (UTR):
        1. Validates order existence and authorization.
        2. Validates UTR uniqueness across orders to prevent duplicate submissions.
        3. Sets payment_status = 'VERIFICATION_PENDING'.
        4. Does NOT auto-verify or mark order as paid.
        5. Logs payment audit history and notifies Admin dashboard for independent manual verification.
        """
        async with self._lock:
            order = self.orders.get(req.order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order["user_id"] != user_id and not user_id.startswith("admin-"):
                raise HTTPException(status_code=403, detail="Unauthorized access to order")

            clean_utr = req.upi_utr.strip()
            if len(clean_utr) < 6:
                raise HTTPException(status_code=400, detail="Invalid UPI reference / UTR number. Must be at least 6 characters.")

            # Prevent duplicate UTR submission across all orders
            for oid, o in self.orders.items():
                if oid != req.order_id and o.get("upi_utr") and o.get("upi_utr", "").lower() == clean_utr.lower():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="This UPI reference number (UTR) has already been submitted for another order. Duplicate payment submissions are strictly prohibited."
                    )

            now_iso = datetime.now(timezone.utc).isoformat()
            order["upi_utr"] = clean_utr
            order["upi_submission_time"] = now_iso
            order["payment_status"] = "VERIFICATION_PENDING"
            order["customer_payment_notes"] = req.customer_notes
            order["updated_at"] = now_iso

            # Audit history log
            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order["id"],
                "previous_status": order.get("status", "PENDING"),
                "new_status": order.get("status", "PENDING"),
                "comment": f"Customer submitted UPI payment reference UTR: {clean_utr}. Payment Verification Pending.",
                "changed_by": user_id,
                "created_at": now_iso
            })

            # Add internal admin notification
            self.notifications.append({
                "id": f"notif-{uuid.uuid4().hex[:8]}",
                "order_id": order["id"],
                "order_number": order["order_number"],
                "title": f"Payment Verification Required — {order['order_number']}",
                "message": f"Customer {order['customer_name']} submitted UPI UTR: {clean_utr} for ₹{order['total_amount']:.2f}. Verify bank/UPI deposit.",
                "type": "PAYMENT_SUBMITTED",
                "is_read": False,
                "created_at": now_iso
            })

            # Clear user cart upon submitting payment
            if user_id in self.user_carts:
                self.user_carts[user_id] = []

            return UpiPaymentSubmitResponse(
                success=True,
                order_id=order["id"],
                order_number=order["order_number"],
                upi_utr=clean_utr,
                payment_status="VERIFICATION_PENDING",
                order_status=order.get("status", "PENDING"),
                message="Payment reference submitted successfully. Our accounts team will verify receipt with our bank records shortly.",
                submitted_at=now_iso
            )

    async def admin_verify_payment(
        self,
        admin_id: str,
        req: AdminPaymentVerifyRequest
    ) -> AdminPaymentVerifyResponse:
        """
        Admin manual verification of customer UPI payment:
        - Admin independently verifies funds in shop bank/UPI account.
        - If VERIFY: transitions payment_status to 'VERIFIED', transitions order status to 'ACCEPTED'.
        - If REJECT: transitions payment_status to 'REJECTED' with audit note.
        - Logs audit trail and updates order timeline.
        """
        async with self._lock:
            order = self.orders.get(req.order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            now_iso = datetime.now(timezone.utc).isoformat()
            notes = req.admin_notes.strip() if req.admin_notes else ""

            if req.action == "VERIFY":
                order["payment_status"] = "VERIFIED"
                order["admin_verification_notes"] = notes or "Payment independently confirmed in shop bank/UPI account."
                order["status"] = "ACCEPTED"
                order["updated_at"] = now_iso

                # Commit stock
                for it in order.get("items", []):
                    p_id = it["product_id"]
                    inv = catalog_store.inventory.get(p_id)
                    if inv:
                        inv["reserved_quantity"] = max(0, inv.get("reserved_quantity", 0) - it["quantity"])

                order["status_history"].append({
                    "id": f"osh-{uuid.uuid4().hex[:6]}",
                    "order_id": order["id"],
                    "previous_status": "VERIFICATION_PENDING",
                    "new_status": "ACCEPTED",
                    "comment": f"Payment VERIFIED by Admin {admin_id}. Funds confirmed in bank account. Notes: {order['admin_verification_notes']}",
                    "changed_by": admin_id,
                    "created_at": now_iso
                })

                msg = f"Payment for order {order['order_number']} marked as VERIFIED and order accepted for fulfillment."
            else: # REJECT
                order["payment_status"] = "REJECTED"
                order["admin_verification_notes"] = notes or "Payment rejected during manual bank audit."
                order["updated_at"] = now_iso

                order["status_history"].append({
                    "id": f"osh-{uuid.uuid4().hex[:6]}",
                    "order_id": order["id"],
                    "previous_status": order.get("payment_status", "PENDING"),
                    "new_status": "REJECTED",
                    "comment": f"Payment REJECTED by Admin {admin_id}. Reason: {order['admin_verification_notes']}",
                    "changed_by": admin_id,
                    "created_at": now_iso
                })

                msg = f"Payment for order {order['order_number']} marked as REJECTED."

            return AdminPaymentVerifyResponse(
                success=True,
                order_id=order["id"],
                order_number=order["order_number"],
                payment_status=order["payment_status"],
                order_status=order["status"],
                message=msg,
                verified_at=now_iso
            )

    async def get_payment_settings(self) -> dict:
        async with self._lock:
            return dict(self.payment_settings)

    async def update_payment_settings(self, settings_in: dict) -> dict:
        async with self._lock:
            self.payment_settings.update(settings_in)
            self.payment_settings["updated_at"] = datetime.now(timezone.utc).isoformat()
            return dict(self.payment_settings)

    # ==========================================
    # ORDER STATUS TRANSITION ENGINE
    # ==========================================
    async def _format_order(self, order_dict: dict) -> OrderDetailedResponse:
        data = dict(order_dict)
        if "customer_name" not in data or not data["customer_name"]:
            data["customer_name"] = "Valued Customer"
        if "customer_email" not in data or not data["customer_email"]:
            data["customer_email"] = "customer@example.com"
        if "updated_at" not in data or not data["updated_at"]:
            data["updated_at"] = data.get("created_at") or datetime.now(timezone.utc).isoformat()
        if "shipment" not in data or data["shipment"] is None:
            shipment = await delivery_service.get_order_shipment(data["id"])
            if shipment:
                data["shipment"] = shipment.model_dump()
        return OrderDetailedResponse(**data)

    async def get_order_by_id(self, order_id: str, user_id: Optional[str] = None) -> OrderDetailedResponse:
        order = self.orders.get(order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if user_id and order["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Unauthorized access to order")
        return await self._format_order(order)

    async def get_order_by_number(self, order_number: str, user_id: Optional[str] = None) -> OrderDetailedResponse:
        order_id = self.order_number_map.get(order_number)
        if not order_id or order_id not in self.orders:
            raise HTTPException(status_code=404, detail="Order not found")
        return await self.get_order_by_id(order_id, user_id)

    async def list_customer_orders(self, user_id: str) -> List[OrderDetailedResponse]:
        customer_orders = [
            await self._format_order(ord_data)
            for ord_data in self.orders.values()
            if ord_data["user_id"] == user_id
        ]
        # Sort newest first
        customer_orders.sort(key=lambda o: o.created_at, reverse=True)
        return customer_orders

    async def list_admin_orders(
        self,
        status_filter: Optional[str] = None,
        search_query: Optional[str] = None,
        todays_only: bool = False
    ) -> List[OrderDetailedResponse]:
        orders_list = list(self.orders.values())
        now_date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        filtered = []
        for o in orders_list:
            if todays_only and not o["created_at"].startswith(now_date_str):
                continue
            if status_filter and status_filter.upper() != "ALL" and o["status"].upper() != status_filter.upper():
                continue
            if search_query:
                q = search_query.lower()
                matches = (
                    q in o["order_number"].lower() or
                    q in o["customer_name"].lower() or
                    q in o["customer_email"].lower() or
                    (o.get("customer_mobile") and q in o["customer_mobile"])
                )
                if not matches:
                    continue
            filtered.append(await self._format_order(o))

        filtered.sort(key=lambda o: o.created_at, reverse=True)
        return filtered

    async def get_admin_orders_summary(self) -> AdminOrdersSummaryResponse:
        todays_orders = await self.list_admin_orders(todays_only=True)
        all_orders = await self.list_admin_orders()
        pending_action = len([o for o in all_orders if o.status in ["NEW", "ACCEPTED", "PACKING"]])
        return AdminOrdersSummaryResponse(
            todays_orders=todays_orders,
            all_orders=all_orders,
            todays_count=len(todays_orders),
            pending_action_count=pending_action
        )

    async def accept_order(self, order_id: str, admin_id: str) -> OrderDetailedResponse:
        """
        Admin accepts NEW order -> Transitions to ACCEPTED.
        """
        async with self._lock:
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order["status"] != "NEW":
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot accept order in status '{order['status']}'. Must be 'NEW'."
                )

            now = datetime.now(timezone.utc).isoformat()
            prev_status = order["status"]
            order["status"] = "ACCEPTED"
            order["updated_at"] = now

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": prev_status,
                "new_status": "ACCEPTED",
                "comment": "Order accepted and approved for fulfillment by admin",
                "changed_by": admin_id,
                "created_at": now
            })

            return await self._format_order(order)

    async def update_order_status(
        self,
        order_id: str,
        new_status: str,
        admin_id: str,
        comment: Optional[str] = None
    ) -> OrderDetailedResponse:
        """
        Transitions order through workflow:
        NEW -> ACCEPTED -> PACKING -> PACKED -> DELIVERY_PENDING.
        Direct Delivery: READY_FOR_DELIVERY -> OUT_FOR_DELIVERY -> DELIVERED.
        Courier Delivery: COURIER_ASSIGNED -> SHIPPED -> COURIER_TRACKING -> DELIVERED.
        Enforces strict state validation.
        """
        async with self._lock:
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            current_status = order["status"]
            allowed_next = ORDER_STATUS_FLOW.get(current_status, [])

            if new_status not in allowed_next:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid status transition from '{current_status}' to '{new_status}'. Allowed next statuses: {allowed_next}"
                )

            # Strict rule: Do not process or dispatch order before payment verification is complete
            if new_status in ["PACKING", "PACKED", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "SHIPPED", "DELIVERED"]:
                if order.get("payment_status") not in ["VERIFIED", "PAID"]:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Order cannot be processed or dispatched until payment is verified. Current payment status is '{order.get('payment_status')}'."
                    )

            now = datetime.now(timezone.utc).isoformat()
            order["status"] = new_status
            order["updated_at"] = now

            # If order reached DELIVERED, COLLECTED, or COMPLETED and paid, credit loyalty coins to customer
            if new_status in ["DELIVERED", "COLLECTED", "COMPLETED"]:
                if not order.get("coins_credited", False) and order.get("payment_status") == "PAID":
                    try:
                        credit_res = await rewards_store.credit_coins_for_completed_order(
                            user_id=order["user_id"],
                            eligible_amount=order["total_amount"],
                            order_id=order["id"],
                            order_number=order["order_number"]
                        )
                        if credit_res:
                            order["coins_credited"] = True
                            order["coins_earned"] = credit_res.coins
                    except Exception as e:
                        print(f"Error crediting coins for order {order['id']}: {e}")

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": current_status,
                "new_status": new_status,
                "comment": comment or f"Order status advanced to {new_status}",
                "changed_by": admin_id,
                "created_at": now
            })

            return await self._format_order(order)

    async def reject_order(
        self,
        order_id: str,
        rejection_reason: str,
        admin_id: str,
        rejection_notes: Optional[str] = None,
        initiate_refund: bool = True
    ) -> OrderDetailedResponse:
        """
        Order Rejection Workflow:
        1. Validates rejection reason is non-empty.
        2. Ensures order is not already delivered, collected, or terminal.
        3. Restores inventory stock back to catalog available quantity.
        4. If order was paid via Razorpay and initiate_refund requested, initiates gateway refund.
           Otherwise preserves payment status and records refund pending note.
        5. Restores any redeemed loyalty coins to customer wallet.
        6. Reverses previously credited loyalty coins if order had completed.
        7. Transitions status to 'REJECTED'.
        8. Logs status history and generates internal notification.
        """
        if not rejection_reason or not str(rejection_reason).strip():
            raise HTTPException(
                status_code=400,
                detail="Rejection reason is required and cannot be blank."
            )

        if rejection_reason.strip() not in REJECTION_REASONS:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid rejection reason '{rejection_reason}'. Must be one of sanctioned reasons: {', '.join(REJECTION_REASONS)}"
            )

        async with self._lock:
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order["status"] in ["DELIVERED", "COLLECTED"]:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot reject an order that has already been delivered or collected."
                )

            if order["status"] in ["REJECTED", "CANCELLED"]:
                raise HTTPException(status_code=400, detail=f"Order is already {order['status']}.")

            now = datetime.now(timezone.utc).isoformat()
            prev_status = order["status"]
            order["status"] = "REJECTED"
            order["rejection_reason"] = rejection_reason.strip()
            order["rejection_notes"] = rejection_notes
            order["rejected_by"] = admin_id
            order["rejected_at"] = now
            order["updated_at"] = now

            # Restore stock for each product in the order
            for it in order["items"]:
                p_id = it["product_id"]
                qty = it["quantity"]
                inv = catalog_store.inventory.get(p_id)
                if inv:
                    inv["available_quantity"] += qty
                    # Record movement in catalog_store
                    catalog_store.movements.append({
                        "id": f"mov-{uuid.uuid4().hex[:8]}",
                        "product_id": p_id,
                        "previous_quantity": inv["available_quantity"] - qty,
                        "quantity_changed": qty,
                        "new_quantity": inv["available_quantity"],
                        "movement_type": "rejection_restoration",
                        "reason": f"Stock restored from rejected order {order['order_number']}",
                        "admin_id": admin_id,
                        "created_at": now
                    })

            # Check if customer redeemed coins and restore them back to wallet
            if order.get("coins_redeemed", 0) > 0:
                try:
                    await rewards_store.restore_redeemed_coins_for_order(
                        user_id=order["user_id"],
                        coins_to_restore=order["coins_redeemed"],
                        order_id=order["id"],
                        order_number=order["order_number"]
                    )
                except Exception:
                    pass

            # If order was previously completed and earned coins, reverse them
            if order.get("coins_credited", False):
                try:
                    await rewards_store.reverse_earned_coins_for_order(
                        user_id=order["user_id"],
                        order_id=order["id"],
                        order_number=order["order_number"],
                        reason=f"Order rejected: {rejection_reason}"
                    )
                    order["coins_credited"] = False
                except Exception:
                    pass

            # Check if refund is needed
            refund_note = ""
            if order["payment_status"] in ["PAID", "VERIFIED"]:
                if initiate_refund and order.get("razorpay_payment_id"):
                    try:
                        refund_resp = razorpay_service.create_refund(
                            payment_id=order["razorpay_payment_id"],
                            amount=order["total_amount"],
                            notes={
                                "order_id": order_id,
                                "order_number": order["order_number"],
                                "reason": rejection_reason
                            }
                        )

                        ref_id = f"ref-{uuid.uuid4().hex[:8]}"
                        self.refunds[ref_id] = {
                            "id": ref_id,
                            "order_id": order_id,
                            "order_number": order["order_number"],
                            "razorpay_payment_id": order["razorpay_payment_id"],
                            "razorpay_refund_id": refund_resp.get("id"),
                            "amount": order["total_amount"],
                            "currency": "INR",
                            "reason": f"Order Rejected: {rejection_reason}",
                            "status": "REFUNDED",
                            "admin_id": admin_id,
                            "created_at": now,
                            "updated_at": now
                        }
                        order["payment_status"] = "REFUNDED"
                        order["refunded_amount"] = order["total_amount"]
                        refund_note = f" Full refund of ₹{order['total_amount']} initiated (Refund ID: {refund_resp.get('id')})."
                    except Exception as e:
                        refund_note = f" Payment was marked PAID. Automatic gateway refund failed ({e}); refund pending manual review."
                else:
                    # Do not blindly mark as refunded; keep payment record accurate
                    refund_note = " Order was paid; refund record marked as pending administrator review."

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": prev_status,
                "new_status": "REJECTED",
                "comment": f"Order rejected by admin. Reason: {rejection_reason}. Notes: {rejection_notes or 'None'}.{refund_note}",
                "changed_by": admin_id,
                "created_at": now
            })

            # Add internal notification
            self.notifications.append({
                "id": f"notif-{uuid.uuid4().hex[:6]}",
                "type": "ORDER_REJECTED",
                "title": f"Order Rejected: {order['order_number']}",
                "message": f"Order {order['order_number']} was rejected. Reason: {rejection_reason}.",
                "order_id": order["id"],
                "order_number": order["order_number"],
                "customer_name": order["customer_name"],
                "amount": order["total_amount"],
                "payment_status": order["payment_status"],
                "is_read": False,
                "created_at": now
            })

            return await self._format_order(order)

    async def cancel_order(
        self,
        order_id: str,
        cancellation_reason: str,
        admin_id: str,
        cancellation_notes: Optional[str] = None
    ) -> OrderDetailedResponse:
        """
        Order Cancellation Workflow:
        1. Validates cancellation reason is non-empty.
        2. Validates that order is not already DELIVERED or COLLECTED.
        3. Validates that order is not already CANCELLED or REJECTED.
        4. Restores reserved/allocated inventory stock back to catalog available quantity.
        5. Preserves order record and history (never permanently deletes).
        6. If order was paid, records refund pending manual review rather than silently marking refunded.
        7. Records cancellation reason, notes, admin ID, and timestamp.
        """
        if not cancellation_reason or not str(cancellation_reason).strip():
            raise HTTPException(status_code=400, detail="Cancellation reason is required and cannot be blank.")

        async with self._lock:
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order["status"] in ["DELIVERED", "COLLECTED"]:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot cancel an order that has already been delivered or collected."
                )

            if order["status"] in ["REJECTED", "CANCELLED"]:
                raise HTTPException(status_code=400, detail=f"Order is already {order['status']}.")

            now = datetime.now(timezone.utc).isoformat()
            prev_status = order["status"]
            order["status"] = "CANCELLED"
            order["cancellation_reason"] = cancellation_reason.strip()
            order["cancellation_notes"] = cancellation_notes
            order["cancelled_by"] = admin_id
            order["cancelled_at"] = now
            order["updated_at"] = now

            # Restore stock for each product in the order
            for it in order.get("items", []):
                p_id = it.get("product_id")
                qty = it.get("quantity", 0)
                inv = catalog_store.inventory.get(p_id)
                if inv:
                    inv["available_quantity"] += qty
                    catalog_store.movements.append({
                        "id": f"mov-{uuid.uuid4().hex[:8]}",
                        "product_id": p_id,
                        "previous_quantity": inv["available_quantity"] - qty,
                        "quantity_changed": qty,
                        "new_quantity": inv["available_quantity"],
                        "movement_type": "cancellation_restoration",
                        "reason": f"Stock restored from cancelled order {order['order_number']}",
                        "admin_id": admin_id,
                        "created_at": now
                    })

            # Restore loyalty coins if redeemed
            coins_redeemed = order.get("coins_redeemed") or order.get("coins_used", 0)
            if coins_redeemed > 0:
                try:
                    await rewards_store.restore_redeemed_coins_for_order(
                        user_id=order["user_id"],
                        coins_to_restore=coins_redeemed,
                        order_id=order["id"],
                        order_number=order["order_number"]
                    )
                except Exception:
                    pass

            # Reverse awarded loyalty coins if order was credited
            if order.get("coins_credited", False):
                try:
                    await rewards_store.reverse_earned_coins_for_order(
                        user_id=order["user_id"],
                        order_id=order["id"],
                        order_number=order["order_number"],
                        reason=cancellation_reason
                    )
                    order["coins_credited"] = False
                except Exception as e:
                    print(f"Error reversing coins for cancelled order {order['id']}: {e}")

            refund_status_note = ""
            if order.get("payment_status") in ["PAID", "VERIFIED"]:
                refund_status_note = " Order was paid; refund pending manual administrator processing."

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": prev_status,
                "new_status": "CANCELLED",
                "comment": f"Order cancelled by admin. Reason: {cancellation_reason}. Notes: {cancellation_notes or 'None'}.{refund_status_note}",
                "changed_by": admin_id,
                "created_at": now
            })

            self.notifications.append({
                "id": f"notif-{uuid.uuid4().hex[:6]}",
                "type": "ORDER_CANCELLED",
                "title": f"Order Cancelled: {order['order_number']}",
                "message": f"Order {order['order_number']} was cancelled. Reason: {cancellation_reason}.",
                "order_id": order["id"],
                "order_number": order["order_number"],
                "customer_name": order["customer_name"],
                "amount": order["total_amount"],
                "payment_status": order["payment_status"],
                "is_read": False,
                "created_at": now
            })

            return await self._format_order(order)

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": prev_status,
                "new_status": "REJECTED",
                "comment": f"Order rejected by admin. Reason: {rejection_reason}. Notes: {rejection_notes or 'None'}.{refund_note}",
                "changed_by": admin_id,
                "created_at": now
            })

            # Add internal notification
            self.notifications.append({
                "id": f"notif-{uuid.uuid4().hex[:6]}",
                "type": "ORDER_REJECTED",
                "title": f"Order Rejected: {order['order_number']}",
                "message": f"Order {order['order_number']} was rejected. Reason: {rejection_reason}.",
                "order_id": order["id"],
                "order_number": order["order_number"],
                "customer_name": order["customer_name"],
                "amount": order["total_amount"],
                "payment_status": order["payment_status"],
                "is_read": False,
                "created_at": now
            })

            return await self._format_order(order)

    # ==========================================
    # STORE PICKUP & INTERNAL ADMIN FULFILLMENT
    # ==========================================

    async def admin_confirm_store_payment(
        self,
        order_id: str,
        admin_id: str,
        admin_notes: Optional[str] = None
    ) -> OrderDetailedResponse:
        """
        Store Pickup: Admin confirms customer payment at the SANJANA MOBILES physical store.
        Transitions payment_status from PENDING to PAID.
        """
        async with self._lock:
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            now_iso = datetime.now(timezone.utc).isoformat()
            order["payment_status"] = "PAID"
            order["updated_at"] = now_iso
            notes = (admin_notes or "").strip()
            order["admin_verification_notes"] = notes or "Payment received and confirmed at SANJANA MOBILES store."

            # If order was still NEW, advance to ACCEPTED
            prev_status = order["status"]
            if prev_status == "NEW":
                order["status"] = "ACCEPTED"

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": prev_status,
                "new_status": order["status"],
                "comment": f"Store Pickup payment received and confirmed as PAID by Admin {admin_id}. {order['admin_verification_notes']}",
                "changed_by": admin_id,
                "created_at": now_iso
            })

            return await self._format_order(order)

    async def admin_mark_order_collected(
        self,
        order_id: str,
        admin_id: str,
        admin_notes: Optional[str] = None
    ) -> OrderDetailedResponse:
        """
        Store Pickup: Admin marks the product as handed over and collected by customer.
        Strict check: Must be marked PAID before collection.
        """
        async with self._lock:
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order.get("payment_status") not in ["PAID", "VERIFIED"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Store pickup order must be confirmed as PAID before marking as COLLECTED. Current payment status is '{order.get('payment_status')}'."
                )

            now_iso = datetime.now(timezone.utc).isoformat()
            prev_status = order["status"]
            order["status"] = "COLLECTED"
            order["updated_at"] = now_iso

            # Credit loyalty coins
            if not order.get("coins_credited", False):
                try:
                    credit_res = await rewards_store.credit_coins_for_completed_order(
                        user_id=order["user_id"],
                        order_id=order["id"],
                        order_number=order["order_number"],
                        eligible_amount=order["total_amount"],
                        order_total=order["total_amount"]
                    )
                    if credit_res:
                        order["coins_credited"] = True
                        order["coins_earned"] = credit_res.coins
                except Exception as e:
                    print(f"Error crediting coins in store collection: {e}")

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": prev_status,
                "new_status": "COLLECTED",
                "comment": f"Order collected by customer at SANJANA MOBILES physical store. Verified by Admin {admin_id}. Notes: {admin_notes or 'None'}",
                "changed_by": admin_id,
                "created_at": now_iso
            })

            return await self._format_order(order)

    async def admin_assign_delivery(
        self,
        order_id: str,
        admin_id: str,
        admin_name: str,
        admin_notes: Optional[str] = None
    ) -> OrderDetailedResponse:
        """
        Internal Admin Fulfillment:
        Admin decides to personally deliver a doorstep delivery order.
        Stores internal delivery assignment, assigned admin ID/name, and timestamp.
        """
        async with self._lock:
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order.get("delivery_method") != "HOME_DELIVERY":
                raise HTTPException(
                    status_code=400,
                    detail="Admin personal delivery assignment is only applicable to Doorstep Delivery orders."
                )

            now_iso = datetime.now(timezone.utc).isoformat()
            order["internal_delivery_assignment"] = "ADMIN"
            order["assigned_admin_id"] = admin_id
            order["assigned_admin_name"] = admin_name
            order["admin_delivery_status"] = "ASSIGNED"
            order["admin_delivery_assigned_at"] = now_iso
            order["admin_delivery_notes"] = admin_notes or ""
            order["updated_at"] = now_iso

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": order.get("status"),
                "new_status": order.get("status"),
                "comment": f"Internal Delivery Assignment: Admin '{admin_name}' accepted personal doorstep delivery fulfillment.",
                "changed_by": admin_id,
                "created_at": now_iso
            })

            return await self._format_order(order)

    async def admin_update_delivery_status(
        self,
        order_id: str,
        new_delivery_status: str,
        admin_id: str,
        admin_name: str,
        admin_notes: Optional[str] = None
    ) -> OrderDetailedResponse:
        """
        Internal Admin Fulfillment:
        Admin updates personal delivery progress ('OUT_FOR_DELIVERY' or 'DELIVERED').
        Updates order status and creates audit log history.
        """
        async with self._lock:
            order = self.orders.get(order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order.get("internal_delivery_assignment") != "ADMIN":
                raise HTTPException(
                    status_code=400,
                    detail="This order is not assigned for internal Admin Delivery."
                )

            now_iso = datetime.now(timezone.utc).isoformat()
            order["admin_delivery_status"] = new_delivery_status
            order["updated_at"] = now_iso

            prev_status = order["status"]
            if new_delivery_status == "OUT_FOR_DELIVERY":
                order["status"] = "OUT_FOR_DELIVERY"
                comment = f"Order marked as Out for Delivery by Admin '{admin_name}'. Hand-delivered directly from SANJANA MOBILES."
            elif new_delivery_status == "DELIVERED":
                order["status"] = "DELIVERED"
                order["admin_delivery_completed_at"] = now_iso
                comment = f"Order successfully delivered to customer doorstep by Admin '{admin_name}'."

                # Credit loyalty coins if paid
                if not order.get("coins_credited", False) and order.get("payment_status") in ["PAID", "VERIFIED"]:
                    try:
                        credit_res = await rewards_store.credit_coins_for_completed_order(
                            user_id=order["user_id"],
                            order_id=order["id"],
                            order_number=order["order_number"],
                            eligible_amount=order["total_amount"],
                            order_total=order["total_amount"]
                        )
                        if credit_res:
                            order["coins_credited"] = True
                            order["coins_earned"] = credit_res.coins
                    except Exception as e:
                        print(f"Error crediting coins in doorstep delivery: {e}")
            else:
                comment = f"Admin delivery status updated to {new_delivery_status} by Admin '{admin_name}'."

            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order_id,
                "previous_status": prev_status,
                "new_status": order["status"],
                "comment": comment,
                "changed_by": admin_id,
                "created_at": now_iso
            })

            return await self._format_order(order)

    # ==========================================
    # REFUND MANAGEMENT
    # ==========================================
    async def initiate_refund(
        self,
        req: RefundInitiateRequest,
        admin_id: str
    ) -> RefundRecordResponse:
        """
        Processes full or partial refund for an order:
        - Prevents duplicate refunds or exceeding order total.
        - Interfaces with Razorpay Refund API.
        - Updates order payment_status to PARTIALLY_REFUNDED or REFUNDED.
        """
        async with self._lock:
            order = self.orders.get(req.order_id)
            if not order:
                raise HTTPException(status_code=404, detail="Order not found")

            if order["payment_status"] not in ["PAID", "PARTIALLY_REFUNDED"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot refund order with payment status '{order['payment_status']}'. Only PAID orders can be refunded."
                )

            payment_id = order.get("razorpay_payment_id")
            if not payment_id:
                raise HTTPException(status_code=400, detail="Order has no associated Razorpay Payment ID to refund.")

            current_refunded = float(order.get("refunded_amount", 0.0))
            order_total = float(order["total_amount"])
            remaining_refundable = round(order_total - current_refunded, 2)

            if remaining_refundable <= 0:
                raise HTTPException(status_code=400, detail="This order is already fully refunded.")

            # If amount is None, refund 100% of remaining refundable
            refund_amount = round(req.amount or remaining_refundable, 2)

            if refund_amount > remaining_refundable:
                raise HTTPException(
                    status_code=400,
                    detail=f"Refund amount ₹{refund_amount} exceeds maximum remaining refundable balance of ₹{remaining_refundable}."
                )

            # Call Razorpay Refund API
            rzp_refund = razorpay_service.create_refund(
                payment_id=payment_id,
                amount=refund_amount,
                notes={
                    "order_id": order["id"],
                    "order_number": order["order_number"],
                    "reason": req.reason,
                    "admin_id": admin_id
                }
            )

            now = datetime.now(timezone.utc).isoformat()
            new_refunded_total = round(current_refunded + refund_amount, 2)
            order["refunded_amount"] = new_refunded_total

            if new_refunded_total >= order_total:
                order["payment_status"] = "REFUNDED"
            else:
                order["payment_status"] = "PARTIALLY_REFUNDED"

            order["updated_at"] = now

            ref_id = f"ref-{uuid.uuid4().hex[:8]}"
            record = {
                "id": ref_id,
                "order_id": order["id"],
                "order_number": order["order_number"],
                "razorpay_payment_id": payment_id,
                "razorpay_refund_id": rzp_refund.get("id"),
                "amount": refund_amount,
                "currency": "INR",
                "reason": req.reason,
                "status": "REFUNDED",
                "admin_id": admin_id,
                "created_at": now,
                "updated_at": now
            }
            self.refunds[ref_id] = record

            # Add status history
            order["status_history"].append({
                "id": f"osh-{uuid.uuid4().hex[:6]}",
                "order_id": order["id"],
                "previous_status": order["status"],
                "new_status": order["status"],
                "comment": f"Refund of ₹{refund_amount} processed. (Razorpay Refund ID: {rzp_refund.get('id')}). Reason: {req.reason}",
                "changed_by": admin_id,
                "created_at": now
            })

            return RefundRecordResponse(**record)

    async def list_refunds(self) -> List[RefundRecordResponse]:
        ref_list = [RefundRecordResponse(**r) for r in self.refunds.values()]
        ref_list.sort(key=lambda r: r.created_at, reverse=True)
        return ref_list

    async def list_payment_transactions(self) -> List[PaymentTransactionItem]:
        txns = [PaymentTransactionItem(**t) for t in self.transactions.values()]
        txns.sort(key=lambda t: t.created_at, reverse=True)
        return txns

    # ==========================================
    # WEBHOOK PROCESSING (IDEMPOTENT)
    # ==========================================
    async def process_webhook(self, payload: bytes, signature: str) -> dict:
        """
        Handles Razorpay webhooks idempotently with HMAC SHA256 validation.
        """
        # 1. Verify webhook signature
        is_valid = razorpay_service.verify_webhook_signature(payload, signature)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

        import json
        event = json.loads(payload.decode("utf-8"))
        event_id = event.get("event_id") or event.get("id")

        if not event_id:
            event_id = f"evt-{uuid.uuid4().hex[:8]}"

        # 2. Idempotency check
        if event_id in self.processed_webhook_events:
            return {"status": "success", "message": f"Event {event_id} already processed (idempotent ignore)"}

        event_name = event.get("event")
        entity = event.get("payload", {}).get("payment", {}).get("entity", {})

        if event_name == "payment.captured":
            rzp_order_id = entity.get("order_id")
            rzp_payment_id = entity.get("id")
            if rzp_order_id and rzp_order_id in self.rzp_order_map:
                ord_id = self.rzp_order_map[rzp_order_id]
                order = self.orders.get(ord_id)
                if order and order["payment_status"] != "PAID":
                    order["payment_status"] = "PAID"
                    order["status"] = "NEW"
                    order["razorpay_payment_id"] = rzp_payment_id
                    now = datetime.now(timezone.utc).isoformat()
                    order["updated_at"] = now
                    order["status_history"].append({
                        "id": f"osh-{uuid.uuid4().hex[:6]}",
                        "order_id": ord_id,
                        "previous_status": "CHECKOUT_INITIATED",
                        "new_status": "NEW",
                        "comment": f"Payment captured via webhook ({rzp_payment_id})",
                        "changed_by": "RAZORPAY_WEBHOOK",
                        "created_at": now
                    })

        self.processed_webhook_events.add(event_id)
        return {"status": "success", "event": event_name, "event_id": event_id}

    # ==========================================
    # INTERNAL NOTIFICATIONS
    # ==========================================
    async def get_notifications(self, unread_only: bool = False) -> List[dict]:
        if unread_only:
            return [n for n in self.notifications if not n.get("is_read")]
        return list(reversed(self.notifications))

    async def mark_notifications_read(self) -> dict:
        for n in self.notifications:
            n["is_read"] = True
        return {"message": "All notifications marked as read"}


order_store = OrderStore()

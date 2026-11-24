from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


def amount_to_words_inr(amount: float) -> str:
    """
    Converts a numerical amount in Indian Rupees to words using the Indian numbering system
    (Crores, Lakhs, Thousands, Hundreds, Units) with optional paise.
    """
    if amount == 0:
        return "Indian Rupees Zero Only"

    units = [
        "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
        "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
        "Seventeen", "Eighteen", "Nineteen"
    ]
    tens = [
        "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
    ]

    def two_digits(n: int) -> str:
        if n < 20:
            return units[n]
        return tens[n // 10] + (" " + units[n % 10] if n % 10 != 0 else "")

    def three_digits(n: int) -> str:
        h = n // 100
        rem = n % 100
        res = ""
        if h > 0:
            res += units[h] + " Hundred"
            if rem > 0:
                res += " and "
        if rem > 0:
            res += two_digits(rem)
        return res

    rupees = int(amount)
    paise = int(round((amount - rupees) * 100))

    parts = []

    # Crores (1,00,00,000)
    crores = rupees // 10000000
    rupees %= 10000000
    if crores > 0:
        parts.append(two_digits(crores) + " Crore")

    # Lakhs (1,00,000)
    lakhs = rupees // 100000
    rupees %= 100000
    if lakhs > 0:
        parts.append(two_digits(lakhs) + " Lakh")

    # Thousands (1,000)
    thousands = rupees // 1000
    rupees %= 1000
    if thousands > 0:
        parts.append(two_digits(thousands) + " Thousand")

    # Hundreds and below
    if rupees > 0:
        parts.append(three_digits(rupees))

    rupees_str = " ".join(parts).strip()
    if not rupees_str:
        rupees_str = "Zero"

    res = f"Indian Rupees {rupees_str}"
    if paise > 0:
        res += f" and {two_digits(paise)} Paise"
    res += " Only"
    return res


class InvoiceItem(BaseModel):
    s_no: int
    product_name: str
    sku: str = "SKU-GEN"
    model: Optional[str] = None
    variant: Optional[str] = None
    quantity: int
    unit_price: float
    discount: float = 0.0
    total: float


class StoreInfo(BaseModel):
    store_name: str = "SANJANA MOBILES"
    tagline: Optional[str] = "Your Trusted Partner for Smartphones & Accessories"
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    district: Optional[str] = None
    state: str
    postal_code: str
    country: str = "India"
    phone: str
    email: Optional[str] = None
    gstin: Optional[str] = None
    opening_hours: Optional[str] = None


class CustomerInfo(BaseModel):
    full_name: str
    mobile: Optional[str] = None
    email: Optional[str] = None
    delivery_method: str = "HOME_DELIVERY"
    billing_address: Optional[Dict[str, Any]] = None
    shipping_address: Optional[Dict[str, Any]] = None


class PaymentInfo(BaseModel):
    payment_method: str = "UPI"
    payment_status: str = "PENDING"
    transaction_id: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_date: Optional[str] = None
    amount_paid: float = 0.0
    balance_due: float = 0.0
    is_confirmed: bool = False


class InvoicePricing(BaseModel):
    subtotal: float
    product_discount: float = 0.0
    coupon_discount: float = 0.0
    delivery_charge: float = 0.0
    taxable_amount: float
    cgst: float = 0.0
    sgst: float = 0.0
    igst: float = 0.0
    tax_rate_percent: float = 18.0
    is_inclusive_tax: bool = True
    grand_total: float
    amount_paid: float
    balance_due: float
    total_in_words: str
    currency: str = "INR"


class InvoiceResponse(BaseModel):
    id: str
    invoice_number: str
    order_id: str
    order_number: str
    invoice_date: str
    order_date: str
    order_status: str
    display_order_status: str
    store_info: StoreInfo
    customer_info: CustomerInfo
    payment_info: PaymentInfo
    items: List[InvoiceItem]
    pricing: InvoicePricing
    notes: Optional[str] = "Thank you for shopping with SANJANA MOBILES! Goods once sold carry official manufacturer warranty."

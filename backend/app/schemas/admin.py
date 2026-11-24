from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class LowStockAlertItem(BaseModel):
    id: str
    title: str
    sku: Optional[str] = None
    stock: int
    image: Optional[str] = None
    category: Optional[str] = None
    price: float
    status: str # "LOW STOCK" or "OUT OF STOCK"

class AdminStatsOverview(BaseModel):
    total_products: int
    total_orders: int
    total_customers: int
    total_revenue: Optional[float] = 0.0
    low_stock: int
    pending_orders: int
    low_stock_items: List[LowStockAlertItem] = []

class AdminCustomerItem(BaseModel):
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str = "customer"
    account_status: str = "active"
    orders_count: int = 0
    total_spent: float = 0.0
    created_at: str
    last_login: Optional[str] = None

class AdminCustomerAddress(BaseModel):
    id: str
    full_name: str
    mobile_number: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    district: Optional[str] = None
    state: str
    pin_code: str
    country: str = "India"
    is_default: bool = False
    address_type: str = "home"

class AdminCustomerDetail(BaseModel):
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str = "customer"
    account_status: str = "active"
    orders_count: int = 0
    total_spent: float = 0.0
    created_at: str
    last_login: Optional[str] = None
    addresses: List[AdminCustomerAddress] = []
    orders: List[Dict[str, Any]] = []
    whatsapp_url: Optional[str] = None

class AdminOrderItem(BaseModel):
    id: str
    order_number: str
    customer_name: str
    customer_email: str
    items_count: int
    total_amount: float
    status: str
    payment_status: str
    created_at: str

class AdminInventoryItem(BaseModel):
    id: str
    title: str
    category_name: str
    sku: str
    price: float
    stock_quantity: int
    status: str # 'in_stock', 'low_stock', 'out_of_stock'

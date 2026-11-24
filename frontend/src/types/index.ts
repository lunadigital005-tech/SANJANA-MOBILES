export type UserRole = 'customer' | 'admin' | 'super_admin' | 'moderator';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  mobile_number?: string;
  phone?: string; // backwards compatibility alias
  address_line1: string;
  address_line2?: string;
  city: string;
  district?: string;
  state: string;
  pin_code?: string;
  postal_code?: string; // backwards compatibility alias
  country: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
  address_type: 'home' | 'work' | 'other';
  created_at?: string;
  updated_at?: string;
}

export interface CustomerRewards {
  points: number;
  tier: 'Silver' | 'Gold' | 'Platinum' | 'Obsidian';
  lifetime_points: number;
}

export interface ProductImageItem {
  id?: string;
  image_url: string;
  storage_path?: string;
  is_primary: boolean;
  display_order: number;
  alt_text?: string;
}

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  sale_price?: number | null;
  compare_at_price?: number | null;
  original_price?: number | null;
  discount_percent?: number | null;
  brand?: string;
  model?: string;
  category_ids?: string[];
  category_names?: string[];
  category_slug?: string;
  category_name?: string;
  subcategory_id?: string;
  images: string[];
  image_details?: ProductImageItem[];
  primary_image?: string;
  stock_quantity: number;
  available_stock?: number;
  reserved_stock?: number;
  low_stock_threshold?: number;
  is_low_stock?: boolean;
  is_out_of_stock?: boolean;
  is_active?: boolean;
  is_featured?: boolean;
  is_best_seller?: boolean;
  is_new_arrival?: boolean;
  is_new?: boolean;
  rating: number;
  reviews_count: number;
  tags?: string[];
  dimensions?: string;
  materials?: string;
  warranty?: string;
  compatibility?: string[];
  specifications?: Record<string, string>;
  sku: string;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  storage_path?: string;
  parent_id?: string | null;
  icon_name?: string | null;
  subcategories?: Category[];
  is_active?: boolean;
  display_order?: number;
  item_count: number;
  featured?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Banner {
  id: string;
  title: string;
  headline?: string;
  subtitle?: string;
  description?: string;
  original_price?: number;
  offer_price?: number;
  discount_percent?: number;
  badge?: string;
  cta_text: string;
  cta_link: string;
  image_url: string;
  storage_path?: string;
  product_id?: string;
  start_date?: string;
  end_date?: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type Advertisement = Banner;

export interface SearchSuggestionItem {
  id: string;
  title: string;
  slug: string;
  brand?: string;
  price: number;
  sale_price?: number | null;
  primary_image?: string;
  category_name?: string;
}

export interface SearchSuggestionsResponse {
  query: string;
  products: SearchSuggestionItem[];
  categories: { id: string; name: string; slug: string }[];
  total_matches: number;
}

export interface HomepageSectionsResponse {
  featured_mobiles: Product[];
  charging_accessories: Product[];
  audio_accessories: Product[];
  protection_cases: Product[];
  smart_gadgets: Product[];
  best_sellers: Product[];
  new_arrivals: Product[];
}

export interface WishlistToggleResponse {
  product_id: string;
  is_in_wishlist: boolean;
  total_count: number;
  message: string;
}

export interface WishlistResponse {
  product_ids: string[];
  items: Product[];
  total_count: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface CartCalculatedItem {
  id: string;
  product_id: string;
  product_title: string;
  product_slug: string;
  image_url: string;
  sku: string;
  unit_price: number;
  original_price: number;
  quantity: number;
  item_total: number;
  is_available: boolean;
  available_stock: number;
}

export interface CartCalculationResult {
  items: CartCalculatedItem[];
  subtotal: number;
  discount_amount: number;
  delivery_charge: number;
  final_total: number;
  currency: string;
  currency_symbol: string;
  free_delivery_threshold: number;
  delivery_method: string;
  has_unavailable_items: boolean;
  unavailable_reasons: string[];
}

export interface OrderItemSnapshot {
  id: string;
  product_id: string;
  title: string;
  sku: string;
  price_snapshot: number;
  quantity: number;
  subtotal: number;
  image_url?: string;
  variant?: string | null;
}

export interface OrderStatusHistoryItem {
  id: string;
  order_id: string;
  previous_status?: string | null;
  new_status: string;
  comment?: string | null;
  changed_by?: string | null;
  created_at: string;
}

export type OrderStatus =
  | 'NEW'
  | 'ACCEPTED'
  | 'PACKING'
  | 'PACKED'
  | 'DELIVERY_PENDING'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'READY_FOR_PICKUP'
  | 'COLLECTED'
  | 'COURIER_ASSIGNED'
  | 'SHIPPED'
  | 'COURIER_TRACKING'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered';

export type PaymentStatus =
  | 'PENDING'
  | 'VERIFICATION_PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'PAID'
  | 'FAILED'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_mobile?: string;
  delivery_method: 'HOME_DELIVERY' | 'STORE_PICKUP';
  delivery_address?: Address | Record<string, any> | null;
  pickup_details?: {
    pickup_person_name: string;
    pickup_person_phone: string;
    store_location?: string;
    ready_instructions?: string;
  } | null;
  items: OrderItemSnapshot[];
  items_count: number;
  subtotal: number;
  discount_amount: number;
  delivery_charge: number;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: string;
  internal_delivery_assignment?: string;
  assigned_admin_id?: string;
  assigned_admin_name?: string;
  admin_delivery_status?: string;
  admin_delivery_assigned_at?: string;
  admin_delivery_completed_at?: string;
  admin_delivery_notes?: string;
  upi_id?: string;
  upi_utr?: string;
  upi_submission_time?: string;
  admin_verification_notes?: string;
  verified_by?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  rejection_reason?: string;
  rejection_notes?: string;
  rejected_by?: string;
  rejected_at?: string;
  cancellation_reason?: string;
  cancellation_notes?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  refunded_amount?: number;
  
  // Phase 08 & 09 extensions
  coins_redeemed?: number;
  coin_discount_amount?: number;
  coins_earned?: number;
  coins_credited?: boolean;
  shipment?: ShipmentRecord | null;

  status_history?: OrderStatusHistoryItem[];
  created_at: string;
  updated_at: string;
}

export interface CheckoutInitiateResponse {
  order_id: string;
  order_number: string;
  razorpay_order_id?: string;
  razorpay_key_id?: string;
  amount_in_paise: number;
  amount: number;
  currency: string;
  customer_name: string;
  customer_email: string;
  customer_mobile: string;
  delivery_method: string;
  payment_method?: string;
  is_pay_at_store?: boolean;
  expires_at: string;
  coins_redeemed?: number;
  coin_discount?: number;
  is_full_coin_payment?: boolean;
  upi_id?: string;
  merchant_name?: string;
  upi_uri?: string;
  qr_code_image_url?: string;
  qr_code_url?: string;
}

export interface AdminCustomerItem {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  account_status: string;
  orders_count: number;
  total_spent: number;
  created_at: string;
  last_login?: string | null;
}

export interface AdminCustomerAddress {
  id: string;
  full_name: string;
  mobile_number: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  district?: string | null;
  state: string;
  pin_code: string;
  country: string;
  is_default: boolean;
  address_type: string;
}

export interface AdminCustomerDetail {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  role: string;
  account_status: string;
  orders_count: number;
  total_spent: number;
  created_at: string;
  last_login?: string | null;
  addresses: AdminCustomerAddress[];
  orders: Order[];
  whatsapp_url?: string | null;
}

export interface PaymentVerificationResponse {
  success: boolean;
  order_id: string;
  order_number: string;
  payment_status: string;
  order_status: string;
  message: string;
}

export interface RefundRecord {
  id: string;
  order_id: string;
  order_number: string;
  razorpay_payment_id: string;
  razorpay_refund_id?: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  admin_id?: string;
  created_at: string;
  updated_at: string;
}

export interface LowStockAlertItem {
  id: string;
  title: string;
  sku?: string;
  stock: number;
  image?: string;
  category?: string;
  price: number;
  status: 'LOW STOCK' | 'OUT OF STOCK';
}

export interface AdminStats {
  total_products: number;
  total_orders: number;
  total_customers: number;
  total_revenue?: number;
  low_stock: number;
  pending_orders: number;
  low_stock_items?: LowStockAlertItem[];
}

export interface InventoryItem {
  id: string;
  product_id: string;
  product_title: string;
  sku: string;
  category_name: string;
  price: number;
  available_quantity: number;
  reserved_quantity: number;
  total_stock: number;
  low_stock_threshold: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  updated_at: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  product_title?: string;
  previous_quantity: number;
  quantity_changed: number;
  new_quantity: number;
  movement_type: string;
  reason: string;
  admin_id?: string;
  created_at: string;
}

// =============================================================================
// PHASE 08: LOYALTY COINS & REWARDS ENGINE TYPES
// =============================================================================

export interface RewardSettings {
  id?: string;
  is_active: boolean;
  reward_per_100?: number;
  min_purchase_amount: number;
  earning_ratio: number;
  coin_conversion_rate: number;
  min_redemption_coins: number;
  max_redemption_per_order: number;
  allow_full_coin_payment: boolean;
  allow_mixed_payment: boolean;
  coin_expiry_days?: number;
  updated_at?: string;
}

export interface CoinTransaction {
  id: string;
  user_id: string;
  order_id?: string | null;
  order_number?: string | null;
  transaction_type:
    | 'CREDIT_EARNED'
    | 'DEBIT_REDEEMED'
    | 'REVERSAL_REFUND'
    | 'REVERSAL_CANCELLED'
    | 'RESTORE_FAILED_PAYMENT'
    | 'MANUAL_ADJUSTMENT';
  coins: number;
  monetary_value: number;
  balance_after: number;
  reason: string;
  admin_id?: string | null;
  created_at: string;
}

export interface CustomerWallet {
  user_id: string;
  available_coins: number;
  monetary_value: number;
  total_earned_coins: number;
  total_redeemed_coins: number;
  transactions: CoinTransaction[];
  can_redeem: boolean;
  min_redemption_coins: number;
  max_redemption_coins: number;
}

export interface RewardsOverviewStats {
  total_coins_issued: number;
  total_coins_redeemed: number;
  active_reward_customers: number;
  total_wallet_balance_value: number;
}

export interface ManualCoinAdjustmentRequest {
  user_id: string;
  coins_delta: number;
  reason: string;
}

// =============================================================================
// PHASE 09: DELIVERY & SHIPMENT MANAGEMENT TYPES
// =============================================================================

export interface DeliverySettings {
  store_name: string;
  store_address: string;
  store_latitude: number;
  store_longitude: number;
  direct_delivery_max_distance_km: number;
  courier_suggested_min_distance_km: number;
  enable_auto_distance_calc: boolean;
}

export interface PaymentSettings {
  upi_id: string;
  merchant_name: string;
  qr_code_url?: string;
  qr_code_image_url?: string;
  instructions?: string;
  payment_instructions?: string;
  is_upi_enabled: boolean;
  manual_verification_required: boolean;
  updated_at?: string;
}

export interface StoreSettings {
  store_name: string;
  tagline?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  district?: string;
  state: string;
  pin_code: string;
  country: string;
  store_mobile: string;
  store_email: string;
  google_maps_url?: string;
  free_shipping_threshold: number;
  business_hours?: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  updated_at?: string;
}

export interface DistanceCalculation {
  order_id: string;
  store_coordinates: { latitude: number; longitude: number };
  customer_coordinates?: { latitude: number; longitude: number } | null;
  distance_km?: number | null;
  suggested_method: 'DIRECT_DELIVERY' | 'COURIER' | 'ADMIN_DECISION' | 'MANUAL_SELECTION_REQUIRED';
  explanation: string;
}

export interface CourierTrackingEvent {
  id: string;
  shipment_id?: string;
  order_id?: string;
  status: string;
  location?: string | null;
  description: string;
  event_timestamp: string;
}

export interface ShipmentRecord {
  id: string;
  order_id: string;
  order_number: string;
  delivery_type: 'DIRECT_DELIVERY' | 'COURIER';
  status:
    | 'READY_FOR_DELIVERY'
    | 'OUT_FOR_DELIVERY'
    | 'COURIER_ASSIGNED'
    | 'SHIPPED'
    | 'COURIER_TRACKING'
    | 'DELIVERED';
  calculated_distance_km?: number | null;
  suggested_method?: string | null;

  // Direct Delivery
  direct_assigned_to?: string | null;
  direct_directions_url?: string | null;
  direct_out_for_delivery_at?: string | null;
  direct_delivered_at?: string | null;
  direct_delivery_proof_url?: string | null;
  direct_acknowledgement?: string | null;

  // Courier Delivery
  courier_name?: string | null;
  tracking_number?: string | null;
  tracking_url?: string | null;
  shipment_date?: string | null;
  receipt_image_url?: string | null;
  receipt_storage_path?: string | null;
  shipment_notes?: string | null;
  estimated_delivery_date?: string | null;
  tracking_events?: CourierTrackingEvent[];

  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  order_id: string;
  order_number: string;
  customer_mobile: string;
  customer_name: string;
  notification_event: string;
  message_body: string;
  whatsapp_share_url: string;
}

export interface InvoiceItem {
  s_no: number;
  product_name: string;
  sku: string;
  model?: string | null;
  variant?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
}

export interface InvoiceStoreInfo {
  store_name: string;
  tagline?: string | null;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  district?: string | null;
  state: string;
  postal_code: string;
  country: string;
  phone: string;
  email?: string | null;
  gstin?: string | null;
  opening_hours?: string | null;
}

export interface InvoiceCustomerInfo {
  full_name: string;
  mobile?: string | null;
  email?: string | null;
  delivery_method: string;
  billing_address?: any;
  shipping_address?: any;
}

export interface InvoicePaymentInfo {
  payment_method: string;
  payment_status: string;
  transaction_id?: string | null;
  payment_reference?: string | null;
  payment_date?: string | null;
  amount_paid: number;
  balance_due: number;
  is_confirmed: boolean;
}

export interface InvoicePricing {
  subtotal: number;
  product_discount: number;
  coupon_discount: number;
  delivery_charge: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax_rate_percent: number;
  is_inclusive_tax: boolean;
  grand_total: number;
  amount_paid: number;
  balance_due: number;
  total_in_words: string;
  currency: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  invoice_date: string;
  order_date: string;
  order_status: string;
  display_order_status: string;
  store_info: InvoiceStoreInfo;
  customer_info: InvoiceCustomerInfo;
  payment_info: InvoicePaymentInfo;
  items: InvoiceItem[];
  pricing: InvoicePricing;
  notes?: string;
}

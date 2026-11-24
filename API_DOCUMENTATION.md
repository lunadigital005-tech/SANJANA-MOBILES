# LUNA REST API Specification

---

## 1. Global API Conventions

- **Base URL**: `/api/v1`
- **Content Type**: `application/json`
- **Authentication**: Bearer Token in `Authorization` header (`Authorization: Bearer <token>`)
- **Error Format**: RFC 7807 compliant JSON:
```json
{
  "detail": "Descriptive error message explaining reason for failure"
}
```

---

## 2. Authentication Endpoints (`/api/v1/auth`)

### 2.1 Customer Registration
- **Method**: `POST`
- **Path**: `/api/v1/auth/register`
- **Access**: Public
- **Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "SecurePassword123!",
  "first_name": "Aarav",
  "last_name": "Sharma",
  "mobile_number": "+91 9876543210"
}
```
- **Response (200 OK)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1Ni...",
  "token_type": "bearer",
  "user": {
    "id": "usr-uuid-1234",
    "email": "customer@example.com",
    "role": "customer",
    "first_name": "Aarav",
    "last_name": "Sharma",
    "is_active": true
  }
}
```

### 2.2 Customer & Admin Login
- **Method**: `POST`
- **Path**: `/api/v1/auth/login`
- **Access**: Public
- **Request Body**:
```json
{
  "email": "customer@example.com",
  "password": "SecurePassword123!"
}
```
- **Response (200 OK)**: Token & User profile payload.

### 2.3 Current Authenticated Profile
- **Method**: `GET`
- **Path**: `/api/v1/auth/me`
- **Access**: Authenticated (`Customer` or `Admin`)
- **Response (200 OK)**: Current user's profile details.

---

## 3. Product & Category Endpoints

### 3.1 List Categories
- **Method**: `GET`
- **Path**: `/api/v1/categories`
- **Access**: Public
- **Query Params**: `active_only=true`
- **Response (200 OK)**: Array of Category objects (`id`, `name`, `slug`, `image_url`, `display_order`).

### 3.2 List Products (Customer Storefront)
- **Method**: `GET`
- **Path**: `/api/v1/products`
- **Access**: Public
- **Query Params**:
  - `page`: int (default 1)
  - `limit`: int (default 12)
  - `category_slug`: string (optional)
  - `search`: string (optional)
  - `min_price`: float (optional)
  - `max_price`: float (optional)
  - `sort`: string (`price_asc`, `price_desc`, `rating`, `newest`)
- **Response (200 OK)**:
```json
{
  "items": [
    {
      "id": "prod-01",
      "title": "Minimalist Ceramic Ultrasonic Diffuser",
      "slug": "minimalist-ceramic-ultrasonic-diffuser",
      "price": 2899.00,
      "sale_price": 2499.00,
      "stock_status": "low_stock",
      "available_quantity": 4,
      "primary_image": "https://..."
    }
  ],
  "total": 45,
  "page": 1,
  "pages": 4
}
```

### 3.3 Get Product by Slug or ID
- **Method**: `GET`
- **Path**: `/api/v1/products/{slug_or_id}`
- **Access**: Public
- **Response (200 OK)**: Full product detail object with images array and specifications.

---

## 4. Shopping Cart & Server-Side Pricing (`/api/v1/cart`)

### 4.1 Calculate Verified Cart
- **Method**: `POST`
- **Path**: `/api/v1/cart/calculate`
- **Access**: Public / Authenticated
- **Request Body**:
```json
{
  "items": [
    { "product_id": "prod-01", "quantity": 2 }
  ],
  "promo_code": "LUNA10",
  "coins_to_redeem": 100
}
```
- **Response (200 OK)**:
```json
{
  "items": [
    {
      "product_id": "prod-01",
      "title": "Ceramic Diffuser",
      "unit_price": 2499.00,
      "quantity": 2,
      "line_total": 4998.00,
      "in_stock": true,
      "available_quantity": 4
    }
  ],
  "subtotal": 4998.00,
  "delivery_charges": 0.00,
  "discount_amount": 499.80,
  "coins_redeemed": 100,
  "coins_discount": 100.00,
  "final_payable_amount": 4398.20,
  "is_eligible_for_checkout": true
}
```

---

## 5. Checkout & Payments (`/api/v1/checkout`)

### 5.1 Initiate Checkout & Reserve Stock
- **Method**: `POST`
- **Path**: `/api/v1/checkout/initiate`
- **Access**: Customer Authenticated
- **Request Body**:
```json
{
  "items": [{ "product_id": "prod-01", "quantity": 1 }],
  "address_id": "addr-uuid-5678",
  "delivery_method": "HOME_DELIVERY",
  "coins_to_redeem": 50,
  "promo_code": null
}
```
- **Response (201 Created)**:
```json
{
  "order_id": "ord-2026-9812",
  "payable_amount": 2449.00,
  "currency": "INR",
  "payment_method": "RAZORPAY",
  "razorpay_order_id": "order_RAZOR12345678",
  "expires_at": "2026-11-21T17:05:00Z"
}
```

### 5.2 Verify Razorpay Payment (Cryptographic Signature)
- **Method**: `POST`
- **Path**: `/api/v1/checkout/verify-payment`
- **Access**: Customer Authenticated
- **Request Body**:
```json
{
  "order_id": "ord-2026-9812",
  "razorpay_order_id": "order_RAZOR12345678",
  "razorpay_payment_id": "pay_987654321",
  "razorpay_signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```
- **Response (200 OK)**:
```json
{
  "status": "success",
  "message": "Payment verified and order confirmed successfully",
  "order_id": "ord-2026-9812",
  "order_status": "CONFIRMED"
}
```

---

## 6. Loyalty Rewards (`/api/v1/rewards`)

### 6.1 Get Customer Wallet
- **Method**: `GET`
- **Path**: `/api/v1/rewards/wallet`
- **Access**: Customer Authenticated
- **Response (200 OK)**:
```json
{
  "user_id": "usr-uuid-1234",
  "balance": 250,
  "total_earned": 500,
  "total_redeemed": 250,
  "monetary_value": 250.00,
  "conversion_rate": 1.0
}
```

### 6.2 Get Rewards History
- **Method**: `GET`
- **Path**: `/api/v1/rewards/history`
- **Access**: Customer Authenticated
- **Response (200 OK)**: Array of transaction ledger entries.

---

## 7. Delivery & Fulfillment (`/api/v1/delivery`)

### 7.1 Calculate Distance
- **Method**: `POST`
- **Path**: `/api/v1/delivery/calculate-distance`
- **Access**: Customer Authenticated
- **Request Body**:
```json
{
  "latitude": 12.9800,
  "longitude": 77.6000
}
```
- **Response (200 OK)**:
```json
{
  "customer_coordinates": { "latitude": 12.98, "longitude": 77.6 },
  "store_coordinates": { "latitude": 12.9716, "longitude": 77.5946 },
  "distance_km": 1.12,
  "is_within_delivery_radius": true,
  "delivery_type": "DIRECT_DELIVERY",
  "estimated_delivery_time": "30-45 mins",
  "explanation": "Customer is within 10.0km radius for direct store delivery"
}
```

---

## 8. Admin Operations (`/api/v1/admin`)

- `GET /api/v1/admin/overview`: Sales totals, order counts, out-of-stock items.
- `POST /api/v1/admin/categories`: Create category.
- `POST /api/v1/admin/products`: Create product with images.
- `GET /api/v1/admin/inventory`: Live stock levels, thresholds, reservations.
- `POST /api/v1/admin/inventory/adjust`: Manual restock/correction.
- `POST /api/v1/admin/orders/{id}/status`: Progress order status (`PACKED`, `DISPATCHED`, `DELIVERED`).
- `POST /api/v1/admin/orders/{id}/reject`: Reject order, restore stock, and issue refund.
- `POST /api/v1/admin/delivery/assign-courier`: Assign courier tracking ID and dispatch receipt image.

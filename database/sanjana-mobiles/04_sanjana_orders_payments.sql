-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 04
-- File: database/sanjana-mobiles/04_sanjana_orders_payments.sql
-- Description: Carts, Indian Address Standards, Orders, Order Items (Price Snapshots),
--              Payment Records, Razorpay Fields & Refund Audit Records.
-- Execution: Run fourth in Supabase SQL Editor.
-- ==============================================================================

-- 1. CUSTOMER SHOPPING CARTS
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_prod ON public.cart_items(product_id);

-- 2. CUSTOMER ADDRESSES TABLE (Indian PIN Code, Mobile & Geo-coordinates)
CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    phone TEXT, -- Backwards compatibility alias
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    district TEXT,
    state TEXT NOT NULL,
    pin_code TEXT NOT NULL,
    postal_code TEXT, -- Backwards compatibility alias
    country TEXT NOT NULL DEFAULT 'India',
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_default BOOLEAN NOT NULL DEFAULT false,
    address_type TEXT NOT NULL DEFAULT 'home' CHECK (address_type IN ('home', 'work', 'other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_addresses_user ON public.addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_pincode ON public.addresses(pin_code);

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN (
        'NEW',
        'ACCEPTED',
        'PACKING',
        'PACKED',
        'DELIVERY_PENDING',
        'REJECTED',
        'CANCELLED'
    )),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN (
        'PENDING',
        'PAID',
        'FAILED',
        'PARTIALLY_REFUNDED',
        'REFUNDED'
    )),
    delivery_method TEXT NOT NULL DEFAULT 'HOME_DELIVERY' CHECK (delivery_method IN ('HOME_DELIVERY', 'STORE_PICKUP')),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (delivery_charge >= 0),
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    items_count INTEGER NOT NULL DEFAULT 1 CHECK (items_count > 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    delivery_address JSONB,
    pickup_details JSONB,
    rejection_reason TEXT,
    rejection_notes TEXT,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_rzp_order ON public.orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);

-- 4. ORDER ITEMS (Immutable snapshots of product price and specifications at purchase time)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    sku TEXT NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    price_snapshot NUMERIC(10,2) NOT NULL CHECK (price_snapshot >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_prod ON public.order_items(product_id);

-- 5. ORDER STATUS AUDIT TIMELINE
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    comment TEXT,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id);

-- 6. PAYMENT RECORDS (Razorpay Gateway Audit)
CREATE TABLE IF NOT EXISTS public.payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    razorpay_order_id TEXT NOT NULL,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'captured',
    payment_method TEXT,
    signature_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_rzp_pay ON public.payment_records(razorpay_payment_id);

-- 7. REFUND RECORDS (Automated & Admin Rejected Order Refunds)
CREATE TABLE IF NOT EXISTS public.refund_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    refund_amount NUMERIC(10,2) NOT NULL CHECK (refund_amount > 0),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED')),
    razorpay_refund_id TEXT,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refund_records(order_id);

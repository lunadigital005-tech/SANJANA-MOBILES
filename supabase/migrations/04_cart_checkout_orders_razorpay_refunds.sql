-- ==============================================================================
-- LUNA E-COMMERCE PLATFORM - PHASE 06 & PHASE 07 DATABASE MIGRATION
-- Shopping Cart, Indian Address Standards, Checkout, Order Workflow,
-- Razorpay Payments, Refunds & Internal Notifications
-- ==============================================================================

-- 1. ENHANCE ADDRESSES TABLE (Indian PIN Code & Mobile Validation)
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS pin_code TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

-- Ensure fallback sync for legacy columns
DO $$
BEGIN
    UPDATE public.addresses
    SET mobile_number = phone
    WHERE mobile_number IS NULL AND phone IS NOT NULL;

    UPDATE public.addresses
    SET pin_code = postal_code
    WHERE pin_code IS NULL AND postal_code IS NOT NULL;
END $$;

-- 2. CUSTOMER CARTS & CART ITEMS (Server-side persistence)
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON public.cart_items(product_id);

-- 3. ORDERS TABLE ENHANCEMENTS (Separated Order & Payment Statuses)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT NOT NULL DEFAULT 'HOME_DELIVERY' 
    CHECK (delivery_method IN ('HOME_DELIVERY', 'STORE_PICKUP'));
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pickup_details JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';

-- Drop previous status check and apply strict Phase 06 & 07 status invariants
DO $$
BEGIN
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
END $$;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('NEW', 'ACCEPTED', 'PACKING', 'PACKED', 'DELIVERY_PENDING', 'REJECTED', 'CANCELLED'));

ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
    CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'));

CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id ON public.orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON public.orders(razorpay_payment_id);

-- 4. ORDER ITEMS (Immutable snapshots of product price at purchase time)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    sku TEXT NOT NULL,
    price_snapshot NUMERIC(10,2) NOT NULL CHECK (price_snapshot >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);

-- 5. ORDER STATUS HISTORY (Audit timeline)
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    comment TEXT,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created ON public.order_status_history(created_at DESC);

-- 6. PAYMENT TRANSACTIONS (Razorpay Gateway Audit)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    razorpay_order_id TEXT NOT NULL,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    amount NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED')),
    error_code TEXT,
    error_description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_rzp_order ON public.payment_transactions(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_rzp_payment ON public.payment_transactions(razorpay_payment_id);

-- 7. REFUND RECORDS (Razorpay Refund Management)
CREATE TABLE IF NOT EXISTS public.refund_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
    razorpay_refund_id TEXT UNIQUE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'REFUND_PENDING' 
        CHECK (status IN ('NOT_REQUIRED', 'REFUND_PENDING', 'REFUND_PROCESSING', 'REFUNDED', 'REFUND_FAILED')),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refund_records_order ON public.refund_records(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_records_rzp_refund ON public.refund_records(razorpay_refund_id);

-- 8. WEBHOOK EVENTS LOG (Idempotency and duplicate prevention)
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_id ON public.webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON public.webhook_events(processed);

-- 9. INTERNAL NOTIFICATIONS (Admin & Customer In-App + WhatsApp readiness)
CREATE TABLE IF NOT EXISTS public.internal_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL means broadcast to admins
    type TEXT NOT NULL CHECK (type IN (
        'NEW_ORDER',
        'ORDER_ACCEPTED',
        'ORDER_REJECTED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILURE',
        'REFUND_INITIATED',
        'REFUND_COMPLETED'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_internal_notifications_user ON public.internal_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_internal_notifications_type ON public.internal_notifications(type);
CREATE INDEX IF NOT EXISTS idx_internal_notifications_read ON public.internal_notifications(is_read);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;

-- Carts
DROP POLICY IF EXISTS "Users manage own cart" ON public.carts;
CREATE POLICY "Users manage own cart" ON public.carts FOR ALL USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users manage own cart items" ON public.cart_items;
CREATE POLICY "Users manage own cart items" ON public.cart_items FOR ALL 
    USING (cart_id IN (SELECT id FROM public.carts WHERE user_id = auth.uid()) OR public.is_admin());

-- Order Items & Status History
DROP POLICY IF EXISTS "Users view own order items" ON public.order_items;
CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT
    USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "Users view own status history" ON public.order_status_history;
CREATE POLICY "Users view own status history" ON public.order_status_history FOR SELECT
    USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()) OR public.is_admin());

-- Refunds & Payments
DROP POLICY IF EXISTS "Admins manage refunds" ON public.refund_records;
CREATE POLICY "Admins manage refunds" ON public.refund_records FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users view own payments" ON public.payment_transactions;
CREATE POLICY "Users view own payments" ON public.payment_transactions FOR SELECT
    USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()) OR public.is_admin());

-- Notifications
DROP POLICY IF EXISTS "Users view own notifications" ON public.internal_notifications;
CREATE POLICY "Users view own notifications" ON public.internal_notifications FOR SELECT
    USING (auth.uid() = user_id OR (user_id IS NULL AND public.is_admin()));

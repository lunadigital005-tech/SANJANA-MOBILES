-- =============================================================================
-- LUNA E-COMMERCE PLATFORM: MIGRATION SCRIPT 05
-- PHASES 08 & 09: LOYALTY COINS, REWARDS ENGINE, DELIVERY, COURIER & SHIPMENT
-- =============================================================================

-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. REWARD CONFIGURATION SETTINGS (Admin Configurable)
CREATE TABLE IF NOT EXISTS public.reward_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    min_purchase_amount NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    earning_ratio NUMERIC(10, 4) NOT NULL DEFAULT 0.0100, -- e.g. 1 coin per ₹100 = 0.01
    coin_conversion_rate NUMERIC(10, 2) NOT NULL DEFAULT 1.00, -- 1 coin = ₹1.00
    min_redemption_coins INTEGER NOT NULL DEFAULT 10,
    max_redemption_per_order INTEGER NOT NULL DEFAULT 500,
    allow_full_coin_payment BOOLEAN NOT NULL DEFAULT TRUE,
    allow_mixed_payment BOOLEAN NOT NULL DEFAULT TRUE,
    coin_expiry_days INTEGER DEFAULT 365,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed default settings row if empty
INSERT INTO public.reward_settings (id, is_active, min_purchase_amount, earning_ratio, coin_conversion_rate, min_redemption_coins, max_redemption_per_order, allow_full_coin_payment, allow_mixed_payment)
VALUES ('default', TRUE, 100.00, 0.0100, 1.00, 10, 500, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. CUSTOMER REWARDS WALLET
CREATE TABLE IF NOT EXISTS public.coin_wallets (
    user_id TEXT PRIMARY KEY,
    available_coins INTEGER NOT NULL DEFAULT 0 CHECK (available_coins >= 0),
    total_earned_coins INTEGER NOT NULL DEFAULT 0 CHECK (total_earned_coins >= 0),
    total_redeemed_coins INTEGER NOT NULL DEFAULT 0 CHECK (total_redeemed_coins >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coin_wallets_user_id ON public.coin_wallets (user_id);

-- 3. IMMUTABLE COIN TRANSACTIONS LEDGER
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.coin_wallets(user_id) ON DELETE CASCADE,
    order_id TEXT,
    order_number TEXT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'CREDIT_EARNED',
        'DEBIT_REDEEMED',
        'REVERSAL_REFUND',
        'REVERSAL_CANCELLED',
        'RESTORE_FAILED_PAYMENT',
        'MANUAL_ADJUSTMENT'
    )),
    coins INTEGER NOT NULL, -- positive for credit, negative for debit
    monetary_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reason TEXT NOT NULL,
    admin_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON public.coin_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_order_id ON public.coin_transactions (order_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON public.coin_transactions (created_at DESC);

-- 4. DELIVERY STORE CONFIGURATION
CREATE TABLE IF NOT EXISTS public.delivery_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    store_name TEXT NOT NULL DEFAULT 'LUNA Flagship Store',
    store_address TEXT NOT NULL DEFAULT '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    store_latitude NUMERIC(10, 6) NOT NULL DEFAULT 12.9716,
    store_longitude NUMERIC(10, 6) NOT NULL DEFAULT 77.5946,
    direct_delivery_max_distance_km NUMERIC(6, 2) NOT NULL DEFAULT 3.0,
    courier_suggested_min_distance_km NUMERIC(6, 2) NOT NULL DEFAULT 10.0,
    enable_auto_distance_calc BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.delivery_settings (id, store_name, store_address, store_latitude, store_longitude, direct_delivery_max_distance_km, courier_suggested_min_distance_km)
VALUES ('default', 'LUNA Flagship Store', '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038', 12.9716, 77.5946, 3.0, 10.0)
ON CONFLICT (id) DO NOTHING;

-- 5. SHIPMENT RECORDS TABLE (Branching Direct vs Courier Delivery)
CREATE TABLE IF NOT EXISTS public.shipment_records (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    delivery_type TEXT NOT NULL CHECK (delivery_type IN ('DIRECT_DELIVERY', 'COURIER')),
    status TEXT NOT NULL CHECK (status IN (
        'PENDING_METHOD',
        'READY_FOR_DELIVERY',
        'OUT_FOR_DELIVERY',
        'COURIER_ASSIGNED',
        'SHIPPED',
        'COURIER_TRACKING',
        'DELIVERED'
    )),
    calculated_distance_km NUMERIC(8, 2),
    suggested_method TEXT CHECK (suggested_method IN ('DIRECT_DELIVERY', 'COURIER', 'ADMIN_DECISION')),
    
    -- Direct Delivery Attributes
    direct_assigned_to TEXT,
    direct_directions_url TEXT,
    direct_out_for_delivery_at TIMESTAMP WITH TIME ZONE,
    direct_delivered_at TIMESTAMP WITH TIME ZONE,
    direct_delivery_proof_url TEXT,
    direct_acknowledgement TEXT,

    -- Courier Delivery Attributes
    courier_name TEXT,
    tracking_number TEXT,
    tracking_url TEXT,
    shipment_date TIMESTAMP WITH TIME ZONE,
    receipt_image_url TEXT,
    receipt_storage_path TEXT,
    shipment_notes TEXT,
    estimated_delivery_date TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipment_records (order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_delivery_type ON public.shipment_records (delivery_type);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipment_records (status);

-- 6. COURIER TRACKING EVENTS (Level 1 & Level 2 tracking provider events)
CREATE TABLE IF NOT EXISTS public.courier_tracking_events (
    id TEXT PRIMARY KEY,
    shipment_id TEXT NOT NULL REFERENCES public.shipment_records(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    location TEXT,
    description TEXT NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_courier_events_shipment_id ON public.courier_tracking_events (shipment_id);

-- 7. WHATSAPP NOTIFICATION LOGS
CREATE TABLE IF NOT EXISTS public.whatsapp_notifications (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    order_number TEXT NOT NULL,
    customer_mobile TEXT NOT NULL,
    notification_event TEXT NOT NULL,
    template_name TEXT NOT NULL,
    message_body TEXT NOT NULL,
    whatsapp_share_url TEXT NOT NULL,
    dispatch_type TEXT NOT NULL CHECK (dispatch_type IN ('MANUAL_SHARE', 'API_DISPATCH')),
    status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'SENT', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_notifs_order_id ON public.whatsapp_notifications (order_id);

-- 8. EXTEND ORDERS TABLE WITH REWARD COIN COLUMNS
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS coins_redeemed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS coin_discount_amount NUMERIC(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS coins_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS coins_credited BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS coins_reversed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'HOME_DELIVERY';

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_notifications ENABLE ROW LEVEL SECURITY;

-- Customers can read their own coin wallet and transactions
CREATE POLICY "Customers can view own coin wallet" 
    ON public.coin_wallets FOR SELECT 
    USING (auth.uid()::text = user_id);

CREATE POLICY "Customers can view own coin transactions" 
    ON public.coin_transactions FOR SELECT 
    USING (auth.uid()::text = user_id);

-- Customers can view shipments for their own orders
CREATE POLICY "Customers can view own order shipments" 
    ON public.shipment_records FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.orders 
        WHERE public.orders.id = public.shipment_records.order_id 
        AND public.orders.user_id = auth.uid()::text
    ));

CREATE POLICY "Customers can view tracking events for own shipments" 
    ON public.courier_tracking_events FOR SELECT 
    USING (EXISTS (
        SELECT 1 FROM public.shipment_records 
        JOIN public.orders ON public.orders.id = public.shipment_records.order_id
        WHERE public.shipment_records.id = public.courier_tracking_events.shipment_id
        AND public.orders.user_id = auth.uid()::text
    ));

-- Public / Authenticated read on reward settings
CREATE POLICY "Public read on reward settings"
    ON public.reward_settings FOR SELECT
    USING (TRUE);

-- Service Role / Admin Full Management
CREATE POLICY "Service Role full access to rewards"
    ON public.reward_settings FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service Role full access to coin wallets"
    ON public.coin_wallets FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service Role full access to coin transactions"
    ON public.coin_transactions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service Role full access to shipments"
    ON public.shipment_records FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service Role full access to courier tracking events"
    ON public.courier_tracking_events FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Service Role full access to whatsapp notifications"
    ON public.whatsapp_notifications FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role' OR auth.jwt() ->> 'role' = 'admin');

-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 05
-- File: database/sanjana-mobiles/05_sanjana_rewards_delivery.sql
-- Description: Loyalty Coins Engine, Customer Wallets, Ledger Transactions,
--              Delivery Logistics, Courier Tracking & Receipts.
-- Execution: Run fifth in Supabase SQL Editor.
-- ==============================================================================

-- 1. LOYALTY REWARDS CONFIGURATION (Admin Configurable)
CREATE TABLE IF NOT EXISTS public.reward_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_active BOOLEAN NOT NULL DEFAULT true,
    min_purchase_amount NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
    earning_ratio NUMERIC(10, 4) NOT NULL DEFAULT 0.0100, -- e.g. ₹100 purchase = 1 coin (0.01)
    coin_conversion_rate NUMERIC(10, 2) NOT NULL DEFAULT 1.00, -- 1 coin = ₹1.00
    min_redemption_coins INTEGER NOT NULL DEFAULT 10,
    max_redemption_per_order INTEGER NOT NULL DEFAULT 500,
    allow_full_coin_payment BOOLEAN NOT NULL DEFAULT true,
    allow_mixed_payment BOOLEAN NOT NULL DEFAULT true,
    coin_expiry_days INTEGER DEFAULT 365,
    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default Sanjana Mobiles coin rules
INSERT INTO public.reward_settings (
    id, is_active, min_purchase_amount, earning_ratio, coin_conversion_rate, 
    min_redemption_coins, max_redemption_per_order, allow_full_coin_payment, allow_mixed_payment
)
VALUES ('default', true, 100.00, 0.0100, 1.00, 10, 500, true, true)
ON CONFLICT (id) DO NOTHING;

-- 2. CUSTOMER COIN WALLETS
CREATE TABLE IF NOT EXISTS public.coin_wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    available_coins INTEGER NOT NULL DEFAULT 0 CHECK (available_coins >= 0),
    total_earned_coins INTEGER NOT NULL DEFAULT 0 CHECK (total_earned_coins >= 0),
    total_redeemed_coins INTEGER NOT NULL DEFAULT 0 CHECK (total_redeemed_coins >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coin_wallets_user ON public.coin_wallets(user_id);

-- Trigger to initialize wallet on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.coin_wallets (user_id, available_coins, total_earned_coins, total_redeemed_coins)
    VALUES (NEW.id, 50, 50, 0) -- Welcome 50 Sanjana Coins bonus
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_init_wallet ON auth.users;
CREATE TRIGGER trg_user_init_wallet
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_wallet();

-- 3. IMMUTABLE COIN LEDGER TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.coin_wallets(user_id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    order_number TEXT,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN (
        'CREDIT_EARNED',
        'DEBIT_REDEEMED',
        'REVERSAL_REFUND',
        'REVERSAL_CANCELLED',
        'RESTORE_FAILED_PAYMENT',
        'MANUAL_ADJUSTMENT'
    )),
    coins INTEGER NOT NULL, -- Positive for credits, negative for debits
    monetary_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reason TEXT NOT NULL,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON public.coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_order ON public.coin_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_created ON public.coin_transactions(created_at DESC);

-- 4. DELIVERY STORE CONFIGURATION
CREATE TABLE IF NOT EXISTS public.delivery_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    store_name TEXT NOT NULL DEFAULT 'Sanjana Mobiles Store',
    store_address TEXT NOT NULL DEFAULT '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    store_latitude NUMERIC(10, 6) NOT NULL DEFAULT 12.9716,
    store_longitude NUMERIC(10, 6) NOT NULL DEFAULT 77.5946,
    direct_delivery_max_distance_km NUMERIC(6, 2) NOT NULL DEFAULT 5.0,
    courier_suggested_min_distance_km NUMERIC(6, 2) NOT NULL DEFAULT 10.0,
    enable_auto_distance_calc BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.delivery_settings (
    id, store_name, store_address, store_latitude, store_longitude, 
    direct_delivery_max_distance_km, courier_suggested_min_distance_km
)
VALUES (
    'default', 
    'Sanjana Mobiles Store', 
    '100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038', 
    12.9716, 
    77.5946, 
    5.0, 
    10.0
)
ON CONFLICT (id) DO UPDATE SET
    store_name = EXCLUDED.store_name,
    store_address = EXCLUDED.store_address;

-- 5. SHIPMENT RECORDS (Branching Direct Store Delivery vs 3rd-Party Courier)
CREATE TABLE IF NOT EXISTS public.shipment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
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
    courier_partner_name TEXT,
    waybill_tracking_number TEXT,
    tracking_url TEXT,
    receipt_image_url TEXT,
    receipt_storage_path TEXT,
    delivery_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_shipments_order ON public.shipment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipment_records(status);

-- 6. SHIPMENT STATUS HISTORY (Courier & Delivery Tracking Timeline)
CREATE TABLE IF NOT EXISTS public.shipment_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES public.shipment_records(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    location TEXT,
    event_description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_shipment_history_shipment ON public.shipment_status_history(shipment_id);

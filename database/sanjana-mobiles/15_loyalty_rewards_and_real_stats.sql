-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 15
-- File: database/sanjana-mobiles/15_loyalty_rewards_and_real_stats.sql
-- Description: Automatic Loyalty Coins System, Idempotent Order Rewards,
--              Global Reward Rate Configuration, and Real Dashboard Telemetry.
-- Execution: Safe & Idempotent - can be run repeatedly in Supabase SQL Editor.
-- ==============================================================================

-- 1. ADD GLOBAL REWARD RATE (reward_per_100) TO REWARD SETTINGS
ALTER TABLE IF EXISTS public.reward_settings 
ADD COLUMN IF NOT EXISTS reward_per_100 NUMERIC(10, 2) NOT NULL DEFAULT 1.00;

-- 2. ENSURE DEFAULT REWARD SETTINGS RECORD EXISTS WITH IDEMPOTENT CONFLICT HANDLING
INSERT INTO public.reward_settings (
    id,
    is_active,
    reward_per_100,
    earning_ratio,
    coin_conversion_rate,
    min_purchase_amount,
    min_redemption_coins,
    max_redemption_per_order,
    allow_full_coin_payment,
    allow_mixed_payment,
    coin_expiry_days
)
VALUES (
    'default',
    true,
    1.00,
    0.0100,
    1.00,
    100.00,
    10,
    500,
    true,
    true,
    365
)
ON CONFLICT (id) DO UPDATE SET
    reward_per_100 = COALESCE(public.reward_settings.reward_per_100, EXCLUDED.reward_per_100),
    earning_ratio = COALESCE(public.reward_settings.earning_ratio, EXCLUDED.earning_ratio),
    coin_conversion_rate = COALESCE(public.reward_settings.coin_conversion_rate, EXCLUDED.coin_conversion_rate);

-- 3. ENSURE IDEMPOTENT PARTIAL UNIQUE INDEX ON COIN TRANSACTIONS
-- Prevents duplicate CREDIT_EARNED rewards for the same order at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coin_tx_unique_order_credit 
ON public.coin_transactions (order_id, transaction_type) 
WHERE transaction_type = 'CREDIT_EARNED';

-- 4. RLS POLICIES FOR COIN WALLETS & LEDGER TRANSACTIONS
ALTER TABLE IF EXISTS public.reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coin_transactions ENABLE ROW LEVEL SECURITY;

-- Public/Customer can read reward settings
DROP POLICY IF EXISTS "Public can view reward settings" ON public.reward_settings;
CREATE POLICY "Public can view reward settings" ON public.reward_settings
    FOR SELECT TO public USING (true);

-- Authenticated customers can view own wallet
DROP POLICY IF EXISTS "Customers can view own wallet" ON public.coin_wallets;
CREATE POLICY "Customers can view own wallet" ON public.coin_wallets
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Authenticated customers can view own transactions
DROP POLICY IF EXISTS "Customers can view own transactions" ON public.coin_transactions;
CREATE POLICY "Customers can view own transactions" ON public.coin_transactions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Admins and Service Role have full control
DROP POLICY IF EXISTS "Admins manage reward settings" ON public.reward_settings;
CREATE POLICY "Admins manage reward settings" ON public.reward_settings
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Admins manage coin wallets" ON public.coin_wallets;
CREATE POLICY "Admins manage coin wallets" ON public.coin_wallets
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Admins manage coin transactions" ON public.coin_transactions;
CREATE POLICY "Admins manage coin transactions" ON public.coin_transactions
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'super_admin')
        )
    );

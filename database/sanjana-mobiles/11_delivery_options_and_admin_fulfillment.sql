-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 11
-- File: database/sanjana-mobiles/11_delivery_options_and_admin_fulfillment.sql
-- Description: Customer Delivery Options (Doorstep Delivery & Direct Store Pickup),
--              Internal Admin Fulfillment ("Admin Will Deliver"), and
--              Admin Customer Management Support.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD COLUMNS FOR DELIVERY OPTIONS & INTERNAL ADMIN ASSIGNMENT
-- ------------------------------------------------------------------------------

-- Payment method tracking (UPI, PAY_AT_STORE, COINS, RAZORPAY)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'UPI';

-- Internal Admin Fulfillment Assignment (Kept distinct from customer delivery_method)
-- Values: 'UNASSIGNED', 'ADMIN', 'COURIER'
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS internal_delivery_assignment TEXT DEFAULT 'UNASSIGNED';

-- Assigned administrator details
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_admin_name TEXT;

-- Internal admin delivery tracking status ('ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED')
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_delivery_status TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_delivery_assigned_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_delivery_completed_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_delivery_notes TEXT;

-- ------------------------------------------------------------------------------
-- 2. UPDATE STATUS & PAYMENT_STATUS CONSTRAINTS IDEMPOTENTLY
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    -- Update orders_status_check to include COLLECTED, READY_FOR_PICKUP, etc.
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
        status IN (
            'NEW',
            'ACCEPTED',
            'PACKING',
            'PACKED',
            'DELIVERY_PENDING',
            'READY_FOR_DELIVERY',
            'OUT_FOR_DELIVERY',
            'READY_FOR_PICKUP',
            'COLLECTED',
            'DELIVERED',
            'COURIER_ASSIGNED',
            'SHIPPED',
            'COURIER_TRACKING',
            'REJECTED',
            'CANCELLED',
            -- lowercase fallbacks for compatibility
            'pending',
            'processing',
            'shipped',
            'delivered'
        )
    );

    -- Update orders_payment_status_check
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (
        payment_status IN (
            'PENDING',
            'VERIFICATION_PENDING',
            'VERIFIED',
            'PAID',
            'FAILED',
            'PARTIALLY_REFUNDED',
            'REFUNDED',
            'REJECTED',
            -- lowercase fallbacks
            'pending',
            'paid',
            'failed'
        )
    );

    -- Ensure delivery_method constraint supports HOME_DELIVERY and STORE_PICKUP
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_method_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_method_check CHECK (
        delivery_method IN ('HOME_DELIVERY', 'STORE_PICKUP')
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Constraint update exception handled: %', SQLERRM;
END $$;

-- ------------------------------------------------------------------------------
-- 3. CREATE PERFORMANCE INDEXES FOR ADMIN SEARCH & FILTERS
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_orders_delivery_method ON public.orders(delivery_method);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON public.orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_orders_internal_delivery ON public.orders(internal_delivery_assignment);
CREATE INDEX IF NOT EXISTS idx_orders_assigned_admin ON public.orders(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);

-- ------------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) POLICIES FOR ADMIN CUSTOMER MANAGEMENT & ORDERS
-- ------------------------------------------------------------------------------

-- Ensure Admin can view all customer profiles, while customers only view their own
DROP POLICY IF EXISTS "Users can view own profile or admins view all" ON public.profiles;
CREATE POLICY "Users can view own profile or admins view all"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

-- Ensure Admin can view all addresses for delivery coordination
DROP POLICY IF EXISTS "Users can view own addresses or admins view all" ON public.addresses;
CREATE POLICY "Users can view own addresses or admins view all"
    ON public.addresses FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- Ensure Admin can manage orders, including internal delivery assignment
DROP POLICY IF EXISTS "Admins can update all order fields" ON public.orders;
CREATE POLICY "Admins can update all order fields"
    ON public.orders FOR UPDATE
    USING (public.is_admin());

-- ------------------------------------------------------------------------------
-- 5. POST-MIGRATION VERIFICATION QUERIES
-- ------------------------------------------------------------------------------

-- Verify columns on orders table
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'orders' 
  AND column_name IN (
    'payment_method', 
    'internal_delivery_assignment', 
    'assigned_admin_id', 
    'assigned_admin_name', 
    'admin_delivery_status'
  );

-- Verify status check constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.orders'::regclass
  AND conname IN ('orders_status_check', 'orders_payment_status_check', 'orders_delivery_method_check');

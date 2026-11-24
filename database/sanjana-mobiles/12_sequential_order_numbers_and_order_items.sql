-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 12
-- File: database/sanjana-mobiles/12_sequential_order_numbers_and_order_items.sql
-- Description: Concurrency-Safe Sequential Order Numbers (SANJANA-001, SANJANA-002...)
--              Order Items Snapshots, Cancellation & Rejection Audit Columns.
-- Execution: Run in Supabase SQL Editor. Safe to re-run (fully idempotent).
-- ==============================================================================

-- 1. CONCURRENCY-SAFE POSTGRESQL SEQUENCE FOR ORDER NUMBERS
DO $$
DECLARE
    max_num BIGINT := 0;
BEGIN
    -- Inspect existing orders table if it exists to preserve sequence continuity
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'orders'
    ) THEN
        SELECT COALESCE(MAX(
            CASE 
                WHEN order_number ~ '^SANJANA-[0-9]+$' 
                THEN SUBSTRING(order_number FROM '^SANJANA-([0-9]+)$')::BIGINT
                ELSE 0 
            END
        ), 0) INTO max_num FROM public.orders;
    END IF;

    -- Create or reset sequence to continue from max_num + 1
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'order_number_seq') THEN
        EXECUTE 'CREATE SEQUENCE public.order_number_seq START WITH ' || GREATEST(max_num + 1, 1) || ' INCREMENT BY 1';
    ELSE
        EXECUTE 'SELECT setval(''public.order_number_seq'', ' || GREATEST(max_num, 1) || ', ' || CASE WHEN max_num > 0 THEN 'true' ELSE 'false' END || ')';
    END IF;
END $$;

-- 2. SEQUENTIAL ORDER NUMBER GENERATOR FUNCTION
CREATE OR REPLACE FUNCTION public.generate_sanjana_order_number()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    formatted_num TEXT;
BEGIN
    SELECT nextval('public.order_number_seq') INTO next_val;
    IF next_val < 1000 THEN
        formatted_num := 'SANJANA-' || LPAD(next_val::TEXT, 3, '0');
    ELSE
        formatted_num := 'SANJANA-' || next_val::TEXT;
    END IF;
    RETURN formatted_num;
END;
$$ LANGUAGE plpgsql;

-- 3. ENSURE ORDERS TABLE HAS ALL STATUSES AND AUDIT COLUMNS
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'orders'
    ) THEN
        -- Set default order number to our sequence generator if column exists
        ALTER TABLE public.orders ALTER COLUMN order_number SET DEFAULT public.generate_sanjana_order_number();

        -- Add rejection and cancellation audit columns
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejection_notes TEXT;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id);
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancellation_notes TEXT;
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES auth.users(id);
        ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

        -- Update status check constraint safely
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
        ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN (
            'NEW',
            'ACCEPTED',
            'PACKING',
            'PACKED',
            'DELIVERY_PENDING',
            'READY_FOR_DELIVERY',
            'OUT_FOR_DELIVERY',
            'READY_FOR_PICKUP',
            'COLLECTED',
            'COURIER_ASSIGNED',
            'SHIPPED',
            'COURIER_TRACKING',
            'DELIVERED',
            'REJECTED',
            'CANCELLED'
        ));
    END IF;
END $$;

-- 4. ENSURE ORDER_ITEMS TABLE HAS COMPLETE SNAPSHOT COLUMNS
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    sku TEXT NOT NULL DEFAULT 'SKU-GEN',
    brand VARCHAR(100),
    model VARCHAR(100),
    variant TEXT,
    price_snapshot NUMERIC(10,2) NOT NULL CHECK (price_snapshot >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure variant and image_url exist if table already existed
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS sku TEXT DEFAULT 'SKU-GEN';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0.00;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_prod ON public.order_items(product_id);

-- 5. ROW LEVEL SECURITY (RLS) POLICIES FOR ORDER_ITEMS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view their own order items" ON public.order_items;
CREATE POLICY "Customers can view their own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders 
        WHERE public.orders.id = public.order_items.order_id 
        AND public.orders.user_id = auth.uid()
    )
    OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins have full access to order items" ON public.order_items;
CREATE POLICY "Admins have full access to order items"
ON public.order_items
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Public anon checkout insert policy for order items when authenticated
DROP POLICY IF EXISTS "Allow checkout creation of order items" ON public.order_items;
CREATE POLICY "Allow checkout creation of order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders 
        WHERE public.orders.id = public.order_items.order_id 
        AND (public.orders.user_id = auth.uid() OR public.is_admin())
    )
);

-- 6. VERIFICATION QUERIES
SELECT 'SEQUENCE CURRENT VAL' AS check_type, nextval('public.order_number_seq') AS val;
SELECT public.generate_sanjana_order_number() AS sample_generated_order_number;
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_items' ORDER BY ordinal_position;

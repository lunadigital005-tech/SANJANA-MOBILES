-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 14
-- File: database/sanjana-mobiles/14_professional_invoice_system.sql
-- Description: Professional Retail Invoices Table, Sequence Generator,
--              Row Level Security (RLS) and Order Status Expansion.
-- Execution: Run in Supabase SQL Editor. Safe to re-run (fully idempotent).
-- ==============================================================================

-- 1. CONCURRENCY-SAFE INVOICE NUMBER SEQUENCE
DO $$
DECLARE
    max_inv BIGINT := 0;
BEGIN
    -- Check if invoices table exists to preserve sequence continuity
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invoices'
    ) THEN
        SELECT COALESCE(MAX(
            CASE 
                WHEN invoice_number ~ '^SM/[0-9]{4}/[0-9]+$' 
                THEN SUBSTRING(invoice_number FROM '^SM/[0-9]{4}/([0-9]+)$')::BIGINT
                ELSE 0 
            END
        ), 0) INTO max_inv FROM public.invoices;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'invoice_number_seq') THEN
        EXECUTE 'CREATE SEQUENCE public.invoice_number_seq START WITH ' || GREATEST(max_inv + 1, 1) || ' INCREMENT BY 1';
    ELSE
        EXECUTE 'SELECT setval(''public.invoice_number_seq'', ' || GREATEST(max_inv, 1) || ', ' || CASE WHEN max_inv > 0 THEN 'true' ELSE 'false' END || ')';
    END IF;
END $$;

-- 2. INVOICE NUMBER GENERATION FUNCTION (SM/YYYY/0001)
CREATE OR REPLACE FUNCTION public.generate_sanjana_invoice_number()
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    year_str TEXT;
BEGIN
    SELECT nextval('public.invoice_number_seq') INTO next_val;
    year_str := TO_CHAR(CURRENT_DATE, 'YYYY');
    RETURN 'SM/' || year_str || '/' || LPAD(next_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- 3. INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (delivery_charge >= 0),
    grand_total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (grand_total >= 0),
    amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    balance_due NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (balance_due >= 0),
    payment_status TEXT NOT NULL DEFAULT 'PENDING',
    payment_method TEXT DEFAULT 'UPI',
    items_snapshot JSONB,
    billing_address JSONB,
    shipping_address JSONB,
    store_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_invoices_order UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);

-- 4. UPDATE STORE_SETTINGS TO INCLUDE GSTIN (IF CONFIGURED)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'store_settings'
    ) THEN
        ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS gstin TEXT DEFAULT NULL;
    END IF;
END $$;

-- 5. UPDATE ORDERS STATUS CHECK CONSTRAINT TO INCLUDE 'COMPLETED'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'orders'
    ) THEN
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
            'COMPLETED',
            'REJECTED',
            'CANCELLED'
        ));
    END IF;
END $$;

-- 6. ROW LEVEL SECURITY (RLS) ON INVOICES
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view their own invoices" ON public.invoices;
CREATE POLICY "Customers can view their own invoices"
ON public.invoices FOR SELECT
TO authenticated
USING (
    customer_id = auth.uid() OR public.is_admin()
);

DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
CREATE POLICY "Admins can manage all invoices"
ON public.invoices FOR ALL
TO authenticated
USING (
    public.is_admin()
)
WITH CHECK (
    public.is_admin()
);

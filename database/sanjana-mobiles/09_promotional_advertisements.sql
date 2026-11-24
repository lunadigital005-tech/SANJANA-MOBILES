-- Standalone copy for manual execution in Supabase SQL editor
-- ==============================================================================
-- SANJANA MOBILES - PROMOTIONAL ADVERTISEMENTS SYSTEM MIGRATION (09)
-- File: database/sanjana-mobiles/09_promotional_advertisements.sql
-- ==============================================================================

BEGIN;

-- 1. ADVERTISEMENTS TABLE DEFINITION
CREATE TABLE IF NOT EXISTS public.advertisements (
    id TEXT PRIMARY KEY DEFAULT ('ad-' || substr(md5(random()::text), 1, 8)),
    title TEXT NOT NULL,
    headline TEXT,
    description TEXT,
    original_price NUMERIC(10, 2) CHECK (original_price IS NULL OR original_price >= 0),
    offer_price NUMERIC(10, 2) CHECK (offer_price IS NULL OR offer_price >= 0),
    discount_percent INT CHECK (discount_percent IS NULL OR (discount_percent >= 0 AND discount_percent <= 100)),
    image_url TEXT NOT NULL,
    storage_path TEXT,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    cta_text TEXT NOT NULL DEFAULT 'Shop Now',
    cta_link TEXT NOT NULL DEFAULT '/products',
    badge TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    display_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_advertisements_active_schedule 
    ON public.advertisements(is_active, display_order) 
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_advertisements_dates 
    ON public.advertisements(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_advertisements_product_id 
    ON public.advertisements(product_id);

-- 2. SAFE DATA MIGRATION FROM LEGACY BANNERS TABLE (IF PRESENT)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'banners') THEN
        INSERT INTO public.advertisements (
            id, 
            title, 
            headline, 
            image_url, 
            storage_path, 
            cta_text, 
            cta_link, 
            badge, 
            display_order, 
            is_active, 
            created_at, 
            updated_at
        )
        SELECT 
            id::text, 
            title, 
            subtitle, 
            image_url, 
            storage_path, 
            COALESCE(cta_text, 'Shop Now'), 
            COALESCE(cta_link, '/products'), 
            badge, 
            COALESCE(display_order, 0), 
            COALESCE(is_active, true), 
            COALESCE(created_at, timezone('utc'::text, now())), 
            COALESCE(updated_at, timezone('utc'::text, now()))
        FROM public.banners
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE 'Legacy banners migrated to public.advertisements successfully.';
    END IF;
END $$;

-- 3. PERMISSIONS & SCHEMA PRIVILEGES
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT SELECT ON public.advertisements TO anon, authenticated;
GRANT ALL ON public.advertisements TO authenticated, service_role, postgres;

-- 4. ROW-LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Public can view active and scheduled advertisements" ON public.advertisements;
DROP POLICY IF EXISTS "Public read active advertisements" ON public.advertisements;
CREATE POLICY "Public read active advertisements"
ON public.advertisements FOR SELECT
TO anon, authenticated
USING (
    is_active = true 
    AND (start_date IS NULL OR start_date <= timezone('utc'::text, now()))
    AND (end_date IS NULL OR end_date >= timezone('utc'::text, now()))
);

DROP POLICY IF EXISTS "Admins have full access to advertisements" ON public.advertisements;
DROP POLICY IF EXISTS "Admins can view all advertisements" ON public.advertisements;
CREATE POLICY "Admins can view all advertisements"
ON public.advertisements FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert advertisements" ON public.advertisements;
CREATE POLICY "Admins can insert advertisements"
ON public.advertisements FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update advertisements" ON public.advertisements;
CREATE POLICY "Admins can update advertisements"
ON public.advertisements FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete advertisements" ON public.advertisements;
CREATE POLICY "Admins can delete advertisements"
ON public.advertisements FOR DELETE
TO authenticated
USING (public.is_admin());

COMMIT;

-- ==============================================================================
-- POST-MIGRATION VERIFICATION QUERIES (RUN IN SUPABASE SQL EDITOR TO VERIFY)
-- ==============================================================================

SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'advertisements' 
ORDER BY ordinal_position;

SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'advertisements' 
  AND tc.constraint_type = 'FOREIGN KEY';

SELECT 
    tablename, 
    policyname, 
    roles, 
    cmd 
FROM pg_policies 
WHERE tablename = 'advertisements';

SELECT count(*) AS total_advertisements FROM public.advertisements;

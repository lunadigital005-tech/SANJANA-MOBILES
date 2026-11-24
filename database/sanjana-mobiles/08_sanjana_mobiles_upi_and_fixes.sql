-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 08 (CORRECTED & IDEMPOTENT)
-- File: database/sanjana-mobiles/08_sanjana_mobiles_upi_and_fixes.sql
--
-- PURPOSE:
--   1. Schema & Table Grants: Fix 42501 PostgREST permission denied errors.
--   2. Safe Category Cleanup: Safely deactivate demo furniture categories;
--      only delete if ZERO product dependencies exist.
--   3. Idempotent 17 Official Mobile Categories Upsert:
--      Handles dual UNIQUE constraints (name, slug) safely using PL/pgSQL
--      with foreign key preservation, repointing product junctions if needed.
--   4. Addresses Table Schema, Constraints & RLS:
--      Support Indian address fields (mobile_number, pin_code, district),
--      single-default address trigger, and user-scoped RLS policies.
--   5. Central Admin Payment Settings:
--      payment_settings table, RLS, and initial default configuration.
--   6. Orders Table UPI Enhancements:
--      UPI fields, UTR uniqueness constraint, and manual verification audit.
--
-- EXECUTION:
--   Can be executed safely and repeatedly in the Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 0: PRE-MIGRATION SANITY CHECKS & DIAGNOSTIC LOGGING
-- ==============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Starting SANJANA MOBILES Module 08 migration...';
    RAISE NOTICE 'Current timestamp: %', clock_timestamp();
END $$;


-- ==============================================================================
-- SECTION 1: GRANT TABLE, SEQUENCE & ROUTINE PRIVILEGES
-- Solves 42501 "permission denied for table" errors in Supabase PostgREST
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;


-- ==============================================================================
-- SECTION 2: DEACTIVATE OR SAFELY REMOVE IRRELEVANT DEMO CATEGORIES
-- Deactivates furniture/home categories immediately so they never display.
-- Deletes them ONLY if zero products reference them.
-- ==============================================================================
UPDATE public.categories 
SET is_active = false,
    updated_at = timezone('utc'::text, now())
WHERE slug IN (
    'living-furniture', 
    'ambient-lighting', 
    'ceramics-dining', 
    'fragrance-wellness', 
    'fine-textiles'
);

-- Delete safely only when unreferenced by product_categories or products
DELETE FROM public.categories 
WHERE slug IN (
    'living-furniture', 
    'ambient-lighting', 
    'ceramics-dining', 
    'fragrance-wellness', 
    'fine-textiles'
)
AND NOT EXISTS (
    SELECT 1 FROM public.product_categories pc WHERE pc.category_id = categories.id
)
AND NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.subcategory_id = categories.id
);


-- ==============================================================================
-- SECTION 3: IDEMPOTENT CATEGORY UPSERT & MERGE (DUAL CONSTRAINT RESOLUTION)
--
-- Resolves ERROR 23505 (violates unique constraint "categories_name_key").
-- The categories table has UNIQUE(name) AND UNIQUE(slug).
--
-- Algorithm:
--   1. Create staging table with the 17 official categories.
--   2. For each category:
--      a. Search for existing match by slug OR by name.
--      b. If slug match and name match point to TWO different existing rows:
--         - Merge them safely: repoint foreign keys (product_categories, products)
--           from the duplicate row to the primary row.
--         - Delete the orphaned duplicate row.
--      c. If match found: UPDATE all attributes (name, slug, description, image, etc.).
--      d. If no match found: INSERT new category.
-- ==============================================================================
DO $$
DECLARE
    rec RECORD;
    v_by_slug_id UUID;
    v_by_name_id UUID;
    v_target_id UUID;
BEGIN
    -- Temporary staging table
    CREATE TEMP TABLE tmp_official_categories (
        name TEXT,
        slug TEXT,
        description TEXT,
        image_url TEXT,
        display_order INT,
        is_active BOOLEAN,
        icon_name TEXT
    ) ON COMMIT DROP;

    INSERT INTO tmp_official_categories (name, slug, description, image_url, display_order, is_active, icon_name)
    VALUES
    ('Smartphones', 'smartphones', 'Latest 5G Android smartphones, flagship iPhones, and high-performance devices.', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=800', 1, true, 'Smartphone'),
    ('Feature Phones', 'feature-phones', 'Reliable, long-battery push-button feature phones for everyday calling and backup.', 'https://images.unsplash.com/photo-1580910051074-3eb694886505?auto=format&fit=crop&q=80&w=800', 2, true, 'PhoneCall'),
    ('Chargers & Adapters', 'chargers-adapters', 'Ultra-fast GaN fast chargers, 20W to 120W adapters, multi-port USB hubs.', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=800', 3, true, 'Zap'),
    ('Charging Cables', 'charging-cables', 'Durable nylon-braided fast charging cables, high wattage PD cords.', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=800', 4, true, 'Cable'),
    ('Type-C Accessories', 'type-c-accessories', 'Type-C hubs, audio dongles, multi-adapters, and fast data transfer connectors.', 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=80&w=800', 5, true, 'Usb'),
    ('Earphones & Headphones', 'earphones-headphones', 'TWS wireless earbuds, ANC neckbands, in-ear wired headsets, and studio audio.', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800', 6, true, 'Headphones'),
    ('Bluetooth Speakers', 'bluetooth-speakers', 'Rugged outdoor waterproof speakers, immersive bass portable desktop sound.', 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&q=80&w=800', 7, true, 'Volume2'),
    ('Mobile Back Covers', 'mobile-back-covers', 'Military-grade shockproof cases, sleek silicone covers, and luxury leather cases.', 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&q=80&w=800', 8, true, 'Shield'),
    ('Tempered Glass', 'tempered-glass', '9H scratch-resistant edge-to-edge tempered glass for mobile screens.', 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&q=80&w=800', 9, true, 'ShieldCheck'),
    ('Screen Protectors', 'screen-protectors', 'Matte anti-glare, privacy filters, flexible TPU film, and UV-cured glass protectors.', 'https://images.unsplash.com/photo-1605236453806-6ff36851218e?auto=format&fit=crop&q=80&w=800', 10, true, 'Layers'),
    ('Mobile Stands & Holders', 'mobile-stands-holders', 'Car magnetic dashboard mounts, 360-degree aluminum desk stands & tripod rings.', 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&q=80&w=800', 11, true, 'SmartphoneNfc'),
    ('Power Banks', 'power-banks', '10000mAh - 30000mAh high-capacity quick-charge power banks with digital display.', 'https://images.unsplash.com/photo-1609592807664-42b7814408df?auto=format&fit=crop&q=80&w=800', 12, true, 'BatteryCharging'),
    ('OTG & USB Accessories', 'otg-usb-accessories', 'High-speed dual OTG flash drives, USB female-to-male adapters, and card readers.', 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&q=80&w=800', 13, true, 'Cpu'),
    ('Memory Cards & Storage', 'memory-cards-storage', 'Class 10 high-speed MicroSD, Extreme Pro memory cards for 4K video recording.', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&q=80&w=800', 14, true, 'HardDrive'),
    ('Smartwatches', 'smartwatches', 'AMOLED display fitness trackers, Bluetooth calling smartwatches, health monitors.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800', 15, true, 'Watch'),
    ('Mobile Gaming Accessories', 'mobile-gaming-accessories', 'Ergonomic gaming triggers, cooling fans, finger sleeves, and gamepads.', 'https://images.unsplash.com/photo-1600080972464-8e5f35f63d08?auto=format&fit=crop&q=80&w=800', 16, true, 'Gamepad2'),
    ('Other Mobile Accessories', 'other-mobile-accessories', 'SIM ejector tools, anti-dust plugs, 7-in-1 cleaning kits, and cable winders.', 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=80&w=800', 17, true, 'Sparkles');

    FOR rec IN SELECT * FROM tmp_official_categories ORDER BY display_order LOOP
        -- Check if a category exists by slug
        SELECT id INTO v_by_slug_id FROM public.categories WHERE slug = rec.slug LIMIT 1;
        
        -- Check if a category exists by name
        SELECT id INTO v_by_name_id FROM public.categories WHERE name = rec.name LIMIT 1;

        IF v_by_slug_id IS NOT NULL AND v_by_name_id IS NOT NULL AND v_by_slug_id <> v_by_name_id THEN
            -- CONFLICT CASE: Two distinct rows exist, one holding the target name, one holding the target slug.
            -- Merge into v_by_slug_id and remove the duplicate v_by_name_id safely.
            RAISE NOTICE 'Merging conflicting category rows: slug match %, name match % for %', v_by_slug_id, v_by_name_id, rec.name;

            -- 1. Repoint product junction if product_categories exists
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'product_categories') THEN
                -- Insert missing junction pairs to target
                INSERT INTO public.product_categories (product_id, category_id, is_primary)
                SELECT pc.product_id, v_by_slug_id, pc.is_primary
                FROM public.product_categories pc
                WHERE pc.category_id = v_by_name_id
                ON CONFLICT (product_id, category_id) DO NOTHING;

                -- Delete from old duplicate
                DELETE FROM public.product_categories WHERE category_id = v_by_name_id;
            END IF;

            -- 2. Repoint subcategory references in products table if column exists
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'subcategory_id') THEN
                UPDATE public.products SET subcategory_id = v_by_slug_id WHERE subcategory_id = v_by_name_id;
            END IF;

            -- 3. Repoint parent references within categories table
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'parent_id') THEN
                UPDATE public.categories SET parent_id = v_by_slug_id WHERE parent_id = v_by_name_id;
            END IF;

            -- 4. Delete the merged duplicate row
            DELETE FROM public.categories WHERE id = v_by_name_id;
            
            v_target_id := v_by_slug_id;

        ELSIF v_by_slug_id IS NOT NULL THEN
            v_target_id := v_by_slug_id;
        ELSIF v_by_name_id IS NOT NULL THEN
            v_target_id := v_by_name_id;
        ELSE
            v_target_id := NULL;
        END IF;

        IF v_target_id IS NOT NULL THEN
            -- UPDATE existing record with official attributes
            UPDATE public.categories
            SET name = rec.name,
                slug = rec.slug,
                description = rec.description,
                image_url = rec.image_url,
                display_order = rec.display_order,
                is_active = rec.is_active,
                icon_name = rec.icon_name,
                updated_at = timezone('utc'::text, now())
            WHERE id = v_target_id;
        ELSE
            -- INSERT new category
            INSERT INTO public.categories (
                name, slug, description, image_url, display_order, is_active, icon_name, created_at, updated_at
            ) VALUES (
                rec.name, rec.slug, rec.description, rec.image_url, rec.display_order, rec.is_active, rec.icon_name,
                timezone('utc'::text, now()), timezone('utc'::text, now())
            );
        END IF;
    END LOOP;

    RAISE NOTICE '17 Official Mobile Categories synchronized successfully.';
END $$;


-- ==============================================================================
-- SECTION 4: ADDRESSES TABLE SCHEMA, CONSTRAINTS & RLS POLICIES
-- ==============================================================================
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS mobile_number TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS pin_code TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India';

-- Sync legacy columns safely if populated
UPDATE public.addresses SET mobile_number = phone WHERE mobile_number IS NULL AND phone IS NOT NULL;
UPDATE public.addresses SET pin_code = postal_code WHERE pin_code IS NULL AND postal_code IS NOT NULL;
UPDATE public.addresses SET district = city WHERE district IS NULL AND city IS NOT NULL;

-- Helper function: is_admin check (creates if not present)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Trigger to maintain exactly one default address per user safely
CREATE OR REPLACE FUNCTION public.handle_default_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE public.addresses
        SET is_default = false
        WHERE user_id = NEW.user_id 
          AND id IS DISTINCT FROM NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_default_address ON public.addresses;
CREATE TRIGGER trg_handle_default_address
    BEFORE INSERT OR UPDATE OF is_default ON public.addresses
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION public.handle_default_address();

-- Strict RLS policies on addresses table
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own addresses or admins view all" ON public.addresses;
CREATE POLICY "Users can view own addresses or admins view all"
    ON public.addresses FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
CREATE POLICY "Users can insert own addresses"
    ON public.addresses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
CREATE POLICY "Users can update own addresses"
    ON public.addresses FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;
CREATE POLICY "Users can delete own addresses"
    ON public.addresses FOR DELETE
    USING (auth.uid() = user_id OR public.is_admin());


-- ==============================================================================
-- SECTION 5: PAYMENT SETTINGS TABLE (CENTRAL ADMIN CONFIG)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    upi_id TEXT NOT NULL DEFAULT 'REPLACE_WITH_REAL_SHOP_UPI_ID',
    merchant_name TEXT NOT NULL DEFAULT 'SANJANA MOBILES',
    qr_code_image_url TEXT,
    payment_instructions TEXT NOT NULL DEFAULT '1. Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app.
2. Or click Pay with UPI on mobile.
3. Complete the transfer for the exact order amount.
4. Enter the 12-digit UPI Reference Number / UTR below and submit for verification.',
    is_upi_enabled BOOLEAN NOT NULL DEFAULT true,
    require_manual_verification BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed initial row if not already present
INSERT INTO public.payment_settings (id, upi_id, merchant_name)
VALUES (1, 'REPLACE_WITH_REAL_SHOP_UPI_ID', 'SANJANA MOBILES')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view payment settings" ON public.payment_settings;
CREATE POLICY "Anyone can view payment settings"
    ON public.payment_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Only admins can update payment settings" ON public.payment_settings;
CREATE POLICY "Only admins can update payment settings"
    ON public.payment_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ==============================================================================
-- SECTION 6: ORDER TABLE ENHANCEMENTS FOR MANUAL UPI VERIFICATION
-- ==============================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS upi_utr TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS upi_submission_time TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS admin_verification_notes TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);

-- Enforce unique constraint on non-null UTR numbers to prevent duplicate payment submissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_upi_utr 
    ON public.orders(upi_utr) 
    WHERE upi_utr IS NOT NULL;


-- Re-grant privileges on newly created tables and sequences
GRANT ALL ON public.payment_settings TO postgres, anon, authenticated, service_role;

COMMIT;


-- ==============================================================================
-- SECTION 7: POST-MIGRATION VERIFICATION QUERIES (RUN IN SUPABASE TO VERIFY)
-- ==============================================================================
-- 1. Check all 17 mobile categories are active with zero furniture categories:
SELECT id, name, slug, display_order, is_active 
FROM public.categories 
WHERE is_active = true 
ORDER BY display_order ASC;

-- 2. Verify no active furniture categories remain:
SELECT count(*) AS remaining_furniture_count 
FROM public.categories 
WHERE slug IN ('living-furniture', 'ambient-lighting', 'ceramics-dining', 'fragrance-wellness', 'fine-textiles') 
  AND is_active = true;

-- 3. Verify payment_settings row exists:
SELECT * FROM public.payment_settings WHERE id = 1;

-- 4. Verify orders table UPI columns exist:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('upi_id', 'upi_utr', 'upi_submission_time', 'admin_verification_notes', 'verified_by');

-- 5. Verify addresses table Indian columns exist:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'addresses' 
  AND column_name IN ('mobile_number', 'pin_code', 'district', 'country');

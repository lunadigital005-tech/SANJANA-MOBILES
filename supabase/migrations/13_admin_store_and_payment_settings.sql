-- ==============================================================================
-- SANJANA MOBILES - MIGRATION 13: ADMIN STORE & PAYMENT SETTINGS PERSISTENCE
-- File: 13_admin_store_and_payment_settings.sql
-- Description:
--   1. Creates canonical public.store_settings singleton table (Store address, contact, brand).
--   2. Ensures public.payment_settings singleton table (UPI ID, QR code, payment instructions).
--   3. Configures Supabase Storage bucket 'store-assets' for official QR codes and banners.
--   4. Configures Row Level Security (RLS) allowing public read & admin-only write.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1: STORE SETTINGS TABLE (SINGLETON)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.store_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    store_name TEXT NOT NULL DEFAULT 'SANJANA MOBILES',
    tagline TEXT DEFAULT 'Your Trusted Destination for Genuine Mobiles & Accessories',
    address_line1 TEXT NOT NULL DEFAULT '100 Feet Road',
    address_line2 TEXT DEFAULT 'Near Metro Pillar 42, Indiranagar',
    city TEXT NOT NULL DEFAULT 'Bengaluru',
    district TEXT NOT NULL DEFAULT 'Bengaluru Urban',
    state TEXT NOT NULL DEFAULT 'Karnataka',
    pin_code TEXT NOT NULL DEFAULT '560038',
    country TEXT NOT NULL DEFAULT 'India',
    store_mobile TEXT NOT NULL DEFAULT '9876543210',
    store_email TEXT NOT NULL DEFAULT 'contact@sanjanamobiles.com',
    google_maps_url TEXT DEFAULT 'https://maps.google.com/?q=12.9716,77.5946',
    free_shipping_threshold NUMERIC(10, 2) NOT NULL DEFAULT 999.00,
    business_hours TEXT DEFAULT 'Mon - Sat: 10:00 AM - 9:00 PM | Sun: 11:00 AM - 8:00 PM',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed initial store settings record if not already present
INSERT INTO public.store_settings (
    id, store_name, tagline, address_line1, address_line2, 
    city, district, state, pin_code, country, 
    store_mobile, store_email, free_shipping_threshold
)
VALUES (
    1, 
    'SANJANA MOBILES', 
    'Your Trusted Destination for Genuine Mobiles & Accessories',
    '100 Feet Road', 
    'Near Metro Pillar 42, Indiranagar',
    'Bengaluru', 
    'Bengaluru Urban', 
    'Karnataka', 
    '560038', 
    'India', 
    '9876543210', 
    'contact@sanjanamobiles.com', 
    999.00
)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security on store_settings
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings"
    ON public.store_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Only admins can modify store settings" ON public.store_settings;
CREATE POLICY "Only admins can modify store settings"
    ON public.store_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ==============================================================================
-- SECTION 2: PAYMENT SETTINGS TABLE (SINGLETON)
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

-- Ensure all columns exist in payment_settings if created in an earlier migration
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS qr_code_image_url TEXT;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS is_upi_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.payment_settings ADD COLUMN IF NOT EXISTS require_manual_verification BOOLEAN NOT NULL DEFAULT true;

-- Seed initial payment settings row if not present
INSERT INTO public.payment_settings (id, upi_id, merchant_name)
VALUES (1, 'REPLACE_WITH_REAL_SHOP_UPI_ID', 'SANJANA MOBILES')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security on payment_settings
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
-- SECTION 3: SUPABASE STORAGE BUCKETS CONFIGURATION
-- ==============================================================================
-- Create store-assets bucket for official QR codes, store logos, and banners
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'store-assets', 
    'store-assets', 
    true, 
    5242880, 
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ensure product-images bucket is active as well
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-images', 
    'product-images', 
    true, 
    5242880, 
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage Objects Policies for store-assets
DROP POLICY IF EXISTS "Public read store-assets" ON storage.objects;
CREATE POLICY "Public read store-assets"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'store-assets');

DROP POLICY IF EXISTS "Admins insert store-assets" ON storage.objects;
CREATE POLICY "Admins insert store-assets"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'store-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update store-assets" ON storage.objects;
CREATE POLICY "Admins update store-assets"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'store-assets' AND public.is_admin())
    WITH CHECK (bucket_id = 'store-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete store-assets" ON storage.objects;
CREATE POLICY "Admins delete store-assets"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'store-assets' AND public.is_admin());

-- Storage Objects Policies for product-images
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;
CREATE POLICY "Public read product-images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "Admins insert product-images" ON storage.objects;
CREATE POLICY "Admins insert product-images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update product-images" ON storage.objects;
CREATE POLICY "Admins update product-images"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'product-images' AND public.is_admin())
    WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

DROP POLICY IF EXISTS "Admins delete product-images" ON storage.objects;
CREATE POLICY "Admins delete product-images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'product-images' AND public.is_admin());


-- ==============================================================================
-- SECTION 4: TABLE PERMISSIONS
-- ==============================================================================
GRANT ALL ON public.store_settings TO postgres, anon, authenticated, service_role;
GRANT ALL ON public.payment_settings TO postgres, anon, authenticated, service_role;

COMMIT;

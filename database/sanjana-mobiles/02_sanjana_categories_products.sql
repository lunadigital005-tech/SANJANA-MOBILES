-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 02
-- File: database/sanjana-mobiles/02_sanjana_categories_products.sql
-- Description: Categories, Subcategories, Mobile Products, Specifications (JSONB),
--              Device Compatibility, Images, Banners & Wishlists.
-- Execution: Run second in Supabase SQL Editor.
-- ==============================================================================

-- 1. CATEGORIES TABLE (Supports 2-tier parent-child category tree)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    storage_path TEXT,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    icon_name VARCHAR(60) DEFAULT 'Smartphone',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Upgrade existing categories table if needed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='parent_id') THEN
        ALTER TABLE public.categories ADD COLUMN parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='icon_name') THEN
        ALTER TABLE public.categories ADD COLUMN icon_name VARCHAR(60) DEFAULT 'Smartphone';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_order ON public.categories(display_order ASC);

-- 2. PRODUCTS TABLE (Mobile devices, chargers, audio, protection & accessories)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    sale_price NUMERIC(10,2) CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price < price)),
    original_price NUMERIC(10,2),
    discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
    sku TEXT NOT NULL UNIQUE,
    brand VARCHAR(100) NOT NULL DEFAULT 'Sanjana',
    model VARCHAR(100),
    warranty VARCHAR(255) NOT NULL DEFAULT '1 Year Official Brand Warranty',
    compatibility JSONB NOT NULL DEFAULT '[]'::jsonb,
    specifications JSONB NOT NULL DEFAULT '{}'::jsonb,
    subcategory_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_best_seller BOOLEAN NOT NULL DEFAULT false,
    is_new_arrival BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(2,1) DEFAULT 4.8,
    reviews_count INTEGER DEFAULT 12,
    tags TEXT[] DEFAULT '{}',
    materials TEXT,
    dimensions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Safe column upgrade for existing databases
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='brand') THEN
        ALTER TABLE public.products ADD COLUMN brand VARCHAR(100) DEFAULT 'Sanjana';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='model') THEN
        ALTER TABLE public.products ADD COLUMN model VARCHAR(100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='original_price') THEN
        ALTER TABLE public.products ADD COLUMN original_price NUMERIC(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='discount_percent') THEN
        ALTER TABLE public.products ADD COLUMN discount_percent INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_best_seller') THEN
        ALTER TABLE public.products ADD COLUMN is_best_seller BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_new_arrival') THEN
        ALTER TABLE public.products ADD COLUMN is_new_arrival BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='warranty') THEN
        ALTER TABLE public.products ADD COLUMN warranty VARCHAR(255) DEFAULT '1 Year Official Brand Warranty';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='compatibility') THEN
        ALTER TABLE public.products ADD COLUMN compatibility JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='specifications') THEN
        ALTER TABLE public.products ADD COLUMN specifications JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='subcategory_id') THEN
        ALTER TABLE public.products ADD COLUMN subcategory_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Indexes for lightning fast searching and filtering
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(LOWER(brand));
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_best_seller ON public.products(is_best_seller);
CREATE INDEX IF NOT EXISTS idx_products_new_arrival ON public.products(is_new_arrival);
CREATE INDEX IF NOT EXISTS idx_products_created ON public.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_specs_gin ON public.products USING GIN (specifications);
CREATE INDEX IF NOT EXISTS idx_products_compat_gin ON public.products USING GIN (compatibility);

-- 3. PRODUCT-CATEGORY JUNCTION (Many-to-Many Relationship)
CREATE TABLE IF NOT EXISTS public.product_categories (
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_prod ON public.product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_cat ON public.product_categories(category_id);

-- 4. PRODUCT IMAGES TABLE (Multi-image support with primary indicator)
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_path TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 1,
    alt_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_product_images_prod ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_order ON public.product_images(product_id, display_order ASC);

-- 5. HOMEPAGE BANNERS TABLE
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(350),
    badge VARCHAR(80),
    cta_text VARCHAR(60) NOT NULL DEFAULT 'Shop Now',
    cta_link VARCHAR(255) NOT NULL DEFAULT '/products',
    image_url TEXT NOT NULL,
    storage_path TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_banners_active_order ON public.banners(is_active, display_order);

-- 6. CUSTOMER WISHLISTS TABLE
CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_prod ON public.wishlists(product_id);

-- 7. AUTO-DISCOUNT & TIMESTAMP TRIGGERS
CREATE OR REPLACE FUNCTION public.calc_product_discount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    IF NEW.original_price IS NOT NULL AND NEW.original_price > NEW.price THEN
        NEW.discount_percent = ROUND(((NEW.original_price - NEW.price) / NEW.original_price) * 100);
    ELSE
        NEW.discount_percent = 0;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_discount ON public.products;
CREATE TRIGGER trg_products_discount
    BEFORE INSERT OR UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.calc_product_discount();

-- 8. SEED DATA: SANJANA MOBILES 9 CORE CATEGORIES
INSERT INTO public.categories (name, slug, description, image_url, display_order, is_active, icon_name)
VALUES
('Mobile Phones', 'smartphones', 'Flagship 5G phones, iPhones, Android smartphones & budget devices.', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&q=80&w=800', 1, true, 'Smartphone'),
('Charging Accessories', 'charging-accessories', 'Fast chargers, GaN adapters, Type-C & Lightning cables, wireless pads.', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=800', 2, true, 'Zap'),
('Audio Accessories', 'audio-accessories', 'TWS Earbuds, ANC neckbands, studio headphones & Bluetooth speakers.', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800', 3, true, 'Headphones'),
('Mobile Protection', 'mobile-protection', 'Shockproof cases, 9H tempered glass, privacy screens & camera lens rings.', 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&q=80&w=800', 4, true, 'Shield'),
('Mobile Stands & Holders', 'stands-holders', 'Car magnetic dashboard mounts, 360-degree desk stands & tripod rings.', 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&q=80&w=800', 5, true, 'Layers'),
('Power Accessories', 'power-accessories', 'High-capacity 20,000mAh power banks, fast charging battery packs & hubs.', 'https://images.unsplash.com/photo-1609592807664-42b7814408df?auto=format&fit=crop&q=80&w=800', 6, true, 'BatteryCharging'),
('Storage Accessories', 'storage-accessories', 'High-speed Class 10 MicroSD cards, dual OTG pen drives & card readers.', 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&q=80&w=800', 7, true, 'HardDrive'),
('Smart Gadgets', 'smart-gadgets', 'AMOLED display smartwatches, fitness trackers & Bluetooth smart tags.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800', 8, true, 'Watch'),
('Other Accessories', 'other-accessories', 'SIM ejector pins, screen cleaning kits, mobile gaming triggers & pouches.', 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=80&w=800', 9, true, 'Sparkles')
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    display_order = EXCLUDED.display_order,
    is_active = EXCLUDED.is_active,
    icon_name = EXCLUDED.icon_name;

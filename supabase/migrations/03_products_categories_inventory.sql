-- ==============================================================================
-- LUNA E-COMMERCE PLATFORM - PHASE 04 & PHASE 05 DATABASE MIGRATION
-- Products, Multiple Categories, Product Images, Inventory, Stock Movements & Stock Reservations
-- Execute this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. CATEGORIES TABLE ENHANCEMENT
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    storage_path TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    item_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was partially created in demo seed
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='is_active') THEN
        ALTER TABLE public.categories ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='display_order') THEN
        ALTER TABLE public.categories ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='storage_path') THEN
        ALTER TABLE public.categories ADD COLUMN storage_path TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='updated_at') THEN
        ALTER TABLE public.categories ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_display_order ON public.categories(display_order ASC);

-- 2. PRODUCTS TABLE ENHANCEMENT
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    sale_price NUMERIC(10,2) CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price < price)),
    sku TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(2,1) DEFAULT 5.0,
    reviews_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    materials TEXT,
    dimensions TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price') THEN
        ALTER TABLE public.products ADD COLUMN sale_price NUMERIC(10,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_active') THEN
        ALTER TABLE public.products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='materials') THEN
        ALTER TABLE public.products ADD COLUMN materials TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='dimensions') THEN
        ALTER TABLE public.products ADD COLUMN dimensions TEXT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- 3. PRODUCT-CATEGORY JUNCTION (Many-to-Many support)
CREATE TABLE IF NOT EXISTS public.product_categories (
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT, -- Prevent deleting categories with assigned products!
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_product ON public.product_categories(product_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_category ON public.product_categories(category_id);

-- 4. PRODUCT IMAGES TABLE (Supabase Storage metadata, multiple images, primary selection)
CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    storage_path TEXT, -- Path in Supabase Storage bucket for safe cleanup
    is_primary BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    alt_text TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_primary ON public.product_images(product_id, is_primary);

-- 5. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
    available_quantity INTEGER NOT NULL DEFAULT 0 CHECK (available_quantity >= 0),
    reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_available ON public.inventory(available_quantity);

-- 6. STOCK MOVEMENTS (Audit trail for every inventory change)
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    previous_quantity INTEGER NOT NULL,
    quantity_changed INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN (
        'restock',
        'adjustment',
        'sale',
        'return',
        'reservation_hold',
        'reservation_release',
        'reservation_commit'
    )),
    reason TEXT NOT NULL,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- 7. STOCK RESERVATIONS (Checkout concurrency protection & auto-expiry)
CREATE TABLE IF NOT EXISTS public.stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'converted', 'expired', 'cancelled')),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_product ON public.stock_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status_expires ON public.stock_reservations(status, expires_at);

-- ==============================================================================
-- ATOMIC STORED PROCEDURES (Concurrency, Overselling Prevention & Business Rules)
-- ==============================================================================

-- 1. Atomic Stock Reservation (prevents overselling via row lock SELECT FOR UPDATE)
CREATE OR REPLACE FUNCTION public.reserve_product_stock(
    p_product_id UUID,
    p_quantity INTEGER,
    p_user_id UUID DEFAULT NULL,
    p_duration_minutes INTEGER DEFAULT 15
)
RETURNS UUID AS $$
DECLARE
    v_available INTEGER;
    v_reservation_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_is_active BOOLEAN;
BEGIN
    -- Check that product is active
    SELECT is_active INTO v_is_active FROM public.products WHERE id = p_product_id;
    IF NOT FOUND OR NOT v_is_active THEN
        RAISE EXCEPTION 'Product is inactive or does not exist.';
    END IF;

    -- Lock the inventory row for atomic check
    SELECT available_quantity INTO v_available
    FROM public.inventory
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record not found for product.';
    END IF;

    IF v_available < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Requested: %, Available: %', p_quantity, v_available;
    END IF;

    v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    -- Update inventory atomically
    UPDATE public.inventory
    SET available_quantity = available_quantity - p_quantity,
        reserved_quantity = reserved_quantity + p_quantity,
        updated_at = NOW()
    WHERE product_id = p_product_id;

    -- Create reservation record
    INSERT INTO public.stock_reservations (
        product_id, user_id, quantity, expires_at, status
    ) VALUES (
        p_product_id, p_user_id, p_quantity, v_expires_at, 'active'
    ) RETURNING id INTO v_reservation_id;

    -- Log movement
    INSERT INTO public.stock_movements (
        product_id, previous_quantity, quantity_changed, new_quantity,
        movement_type, reason
    ) VALUES (
        p_product_id, v_available, -p_quantity, v_available - p_quantity,
        'reservation_hold', 'Stock held for checkout reservation ' || v_reservation_id
    );

    RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Release Expired Stock Reservations
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
    v_prev_avail INTEGER;
BEGIN
    FOR r IN
        SELECT id, product_id, quantity
        FROM public.stock_reservations
        WHERE status = 'active' AND expires_at < NOW()
        FOR UPDATE
    LOOP
        -- Lock inventory row
        SELECT available_quantity INTO v_prev_avail
        FROM public.inventory
        WHERE product_id = r.product_id
        FOR UPDATE;

        -- Return reserved quantity to available
        UPDATE public.inventory
        SET available_quantity = available_quantity + r.quantity,
            reserved_quantity = GREATEST(0, reserved_quantity - r.quantity),
            updated_at = NOW()
        WHERE product_id = r.product_id;

        -- Mark reservation as expired
        UPDATE public.stock_reservations
        SET status = 'expired'
        WHERE id = r.id;

        -- Log stock return
        INSERT INTO public.stock_movements (
            product_id, previous_quantity, quantity_changed, new_quantity,
            movement_type, reason
        ) VALUES (
            r.product_id, v_prev_avail, r.quantity, v_prev_avail + r.quantity,
            'reservation_release', 'Automatic release of expired reservation ' || r.id
        );

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atomic Manual Stock Adjustment by Admin
CREATE OR REPLACE FUNCTION public.adjust_product_stock(
    p_product_id UUID,
    p_quantity_delta INTEGER,
    p_movement_type TEXT,
    p_reason TEXT,
    p_admin_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_prev_avail INTEGER;
    v_new_avail INTEGER;
BEGIN
    SELECT available_quantity INTO v_prev_avail
    FROM public.inventory
    WHERE product_id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Inventory record not found.';
    END IF;

    v_new_avail := v_prev_avail + p_quantity_delta;

    IF v_new_avail < 0 THEN
        RAISE EXCEPTION 'Stock cannot become negative. Current: %, Delta: %', v_prev_avail, p_quantity_delta;
    END IF;

    UPDATE public.inventory
    SET available_quantity = v_new_avail,
        updated_at = NOW()
    WHERE product_id = p_product_id;

    INSERT INTO public.stock_movements (
        product_id, previous_quantity, quantity_changed, new_quantity,
        movement_type, reason, admin_id
    ) VALUES (
        p_product_id, v_prev_avail, p_quantity_delta, v_new_avail,
        p_movement_type, p_reason, p_admin_id
    );

    RETURN v_new_avail;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Safe Category Deletion Verification
CREATE OR REPLACE FUNCTION public.safe_delete_category(p_category_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_product_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_product_count
    FROM public.product_categories
    WHERE category_id = p_category_id;

    IF v_product_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete category: it is assigned to % product(s). Please reassign or remove these products first.', v_product_count;
    END IF;

    DELETE FROM public.categories WHERE id = p_category_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Auto-sync inventory on product insert
CREATE OR REPLACE FUNCTION public.handle_new_product_inventory()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.inventory (product_id, available_quantity, reserved_quantity, low_stock_threshold)
    VALUES (NEW.id, 0, 0, 5)
    ON CONFLICT (product_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_init_product_inventory ON public.products;
CREATE TRIGGER trg_init_product_inventory
    AFTER INSERT ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_product_inventory();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;

-- Categories RLS
DROP POLICY IF EXISTS "Public view active categories" ON public.categories;
CREATE POLICY "Public view active categories"
    ON public.categories FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories"
    ON public.categories FOR ALL
    USING (public.is_admin());

-- Products RLS
DROP POLICY IF EXISTS "Public view active products" ON public.products;
CREATE POLICY "Public view active products"
    ON public.products FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products"
    ON public.products FOR ALL
    USING (public.is_admin());

-- Product Categories RLS
DROP POLICY IF EXISTS "Public view product categories" ON public.product_categories;
CREATE POLICY "Public view product categories"
    ON public.product_categories FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins manage product categories" ON public.product_categories;
CREATE POLICY "Admins manage product categories"
    ON public.product_categories FOR ALL
    USING (public.is_admin());

-- Product Images RLS
DROP POLICY IF EXISTS "Public view product images" ON public.product_images;
CREATE POLICY "Public view product images"
    ON public.product_images FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins manage product images" ON public.product_images;
CREATE POLICY "Admins manage product images"
    ON public.product_images FOR ALL
    USING (public.is_admin());

-- Inventory RLS
DROP POLICY IF EXISTS "Public view inventory levels" ON public.inventory;
CREATE POLICY "Public view inventory levels"
    ON public.inventory FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins manage inventory" ON public.inventory;
CREATE POLICY "Admins manage inventory"
    ON public.inventory FOR ALL
    USING (public.is_admin());

-- Stock Movements RLS (Admin audit log only)
DROP POLICY IF EXISTS "Admins view stock movements" ON public.stock_movements;
CREATE POLICY "Admins view stock movements"
    ON public.stock_movements FOR SELECT
    USING (public.is_admin());

-- Stock Reservations RLS
DROP POLICY IF EXISTS "Users view own reservations or admin all" ON public.stock_reservations;
CREATE POLICY "Users view own reservations or admin all"
    ON public.stock_reservations FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- ==============================================================================
-- SUPABASE STORAGE BUCKET CONFIGURATION (Execute in Supabase SQL editor)
-- ==============================================================================
-- 1. Create product-images storage bucket if not exists:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies:
-- CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
-- CREATE POLICY "Admins upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin());
-- CREATE POLICY "Admins delete product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND public.is_admin());

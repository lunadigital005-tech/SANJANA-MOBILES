-- =============================================================================
-- SANJANA MOBILES DATABASE MIGRATION 06
-- Mobile Catalog, Subcategories, Mobile Specifications, Banners & Wishlists
-- =============================================================================

-- 1. Extend Categories with Parent Relationship (Subcategories) & Icon
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS icon_name VARCHAR(50) DEFAULT 'Smartphone';

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);

-- 2. Extend Products with Mobile Hardware & Accessory Attributes
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS brand VARCHAR(100) DEFAULT 'Generic',
ADD COLUMN IF NOT EXISTS model VARCHAR(100),
ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS discount_percent INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_best_seller BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_new_arrival BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS warranty VARCHAR(150) DEFAULT '1 Year Brand Warranty',
ADD COLUMN IF NOT EXISTS compatibility JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_best_seller ON products(is_best_seller);
CREATE INDEX IF NOT EXISTS idx_products_new_arrival ON products(is_new_arrival);

-- 3. Create Homepage Banners Table
CREATE TABLE IF NOT EXISTS banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(300),
    badge VARCHAR(80),
    cta_text VARCHAR(60) DEFAULT 'Shop Now',
    cta_link VARCHAR(255) DEFAULT '/products',
    image_url TEXT NOT NULL,
    storage_path TEXT,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banners_active_order ON banners(is_active, display_order);

-- Enable RLS on Banners
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active banners"
    ON banners FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Admin manage all banners"
    ON banners FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 4. Create Customer Wishlists Table
CREATE TABLE IF NOT EXISTS wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product ON wishlists(product_id);

-- Enable RLS on Wishlists
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view and manage own wishlist"
    ON wishlists FOR ALL
    USING (auth.uid() = user_id);

-- =============================================================================
-- SEED DATA: SANJANA MOBILES 9 CORE CATEGORIES & SUBCATEGORIES
-- =============================================================================

-- Clear outdated temporary categories and seed official categories
INSERT INTO categories (id, name, slug, description, image_url, display_order, is_active, icon_name)
VALUES
('cat-mobiles', 'Mobile Phones', 'mobile-phones', 'Flagship 5G phones, iPhones, Android smartphones & budget devices.', 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&q=80&w=800', 1, TRUE, 'Smartphone'),
('cat-charging', 'Charging Accessories', 'charging-accessories', 'Fast chargers, Type-C & Lightning cables, wireless pads & multi-port hubs.', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=800', 2, TRUE, 'Zap'),
('cat-audio', 'Audio Accessories', 'audio-accessories', 'TWS Earbuds, neckbands, noise-cancelling headphones & Bluetooth speakers.', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=800', 3, TRUE, 'Headphones'),
('cat-protection', 'Mobile Protection', 'mobile-protection', 'Shockproof cases, 9H tempered glass, privacy guards & camera lens protectors.', 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?auto=format&fit=crop&q=80&w=800', 4, TRUE, 'Shield'),
('cat-stands', 'Mobile Stands & Holders', 'mobile-stands-holders', 'Car magnetic dashboard mounts, 360-degree desk stands & tripod rings.', 'https://images.unsplash.com/photo-1586105251261-72a756497a11?auto=format&fit=crop&q=80&w=800', 5, TRUE, 'SmartphoneNfc'),
('cat-power', 'Power Accessories', 'power-accessories', 'High-capacity 20,000mAh power banks, OTG adapters & USB-C hubs.', 'https://images.unsplash.com/photo-1609592807664-42b7814408df?auto=format&fit=crop&q=80&w=800', 6, TRUE, 'BatteryCharging'),
('cat-storage', 'Storage Accessories', 'storage-accessories', 'High-speed Class 10 MicroSD cards, dual OTG pen drives & card readers.', 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&q=80&w=800', 7, TRUE, 'HardDrive'),
('cat-gadgets', 'Smart Gadgets', 'smart-gadgets', 'AMOLED display smartwatches, fitness trackers & Bluetooth smart tags.', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=800', 8, TRUE, 'Watch'),
('cat-other', 'Other Accessories', 'other-accessories', 'SIM ejector pins, screen cleaning kits, mobile gaming triggers & pouches.', 'https://images.unsplash.com/photo-1616401784845-180882ba9ba8?auto=format&fit=crop&q=80&w=800', 9, TRUE, 'Layers')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    display_order = EXCLUDED.display_order,
    icon_name = EXCLUDED.icon_name;

-- Seed Sample Banners
INSERT INTO banners (id, title, subtitle, badge, cta_text, cta_link, image_url, display_order, is_active)
VALUES
('ban-01', 'Next-Gen Smartphones & Genuine Accessories', 'Official Brand Warranty • Same-Day Local Delivery in Bengaluru • Instant In-Store Pickup', 'SANJANA MOBILES EXCLUSIVE', 'Shop Smartphones', '/category/mobile-phones', 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=1600', 1, TRUE),
('ban-02', 'Ultra-Fast 65W & 100W Power Delivery Chargers', 'GaN Technology • Dual Port Type-C • Compatible with iPhone & Android', 'LIMITED OFFER', 'Explore Chargers', '/category/charging-accessories', 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&q=80&w=1600', 2, TRUE),
('ban-03', 'Active Noise Cancellation TWS Earbuds', 'Up to 50 Hours Playback • IPX5 Water Resistant • Deep Bass Acoustic Drivers', 'NEW ARRIVALS', 'Discover Audio', '/category/audio-accessories', 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&q=80&w=1600', 3, TRUE)
ON CONFLICT (id) DO NOTHING;

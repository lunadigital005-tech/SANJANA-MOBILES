-- ==============================================================================
-- LUNA E-COMMERCE PLATFORM - DEMO SEED DATA (OPTIONAL)
-- Products, Categories, Sample Orders
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    item_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    compare_at_price NUMERIC(10,2),
    category_slug TEXT REFERENCES public.categories(slug) ON UPDATE CASCADE ON DELETE SET NULL,
    category_name TEXT NOT NULL,
    images TEXT[] NOT NULL DEFAULT '{}',
    stock_quantity INTEGER NOT NULL DEFAULT 10,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(2,1) DEFAULT 4.9,
    reviews_count INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);

-- Insert Demo Categories
INSERT INTO public.categories (name, slug, description, image_url, item_count)
VALUES
('Living & Furniture', 'living-furniture', 'Sculptural seating, minimalist tables, and architectural centerpieces.', 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800', 12),
('Ambient Lighting', 'ambient-lighting', 'Soft glow pendants, brushed brass fixtures, and tactile lamps.', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&q=80&w=800', 8),
('Ceramics & Dining', 'ceramics-dining', 'Hand-thrown stoneware, matte glaze tableware, and sculptural carafes.', 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&q=80&w=800', 15),
('Fragrance & Wellness', 'fragrance-wellness', 'Wild harvest botanical diffusers, basalt stone warmers, and essential balms.', 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&q=80&w=800', 9),
('Fine Textiles', 'fine-textiles', 'Belgian washed linen throws, organic boucle cushions, and handwoven rugs.', 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&q=80&w=800', 10)
ON CONFLICT (slug) DO NOTHING;

-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 06
-- File: database/sanjana-mobiles/06_sanjana_admin_security.sql
-- Description: Complete Row-Level Security (RLS) Policies, Defense Against
--              Privilege Escalation, and Official Super Admin Role Assignment.
-- Target Super Admin Email: sanjanamobiledatabase@gmail.com
-- Execution: Run sixth in Supabase SQL Editor AFTER creating the user account!
-- ==============================================================================

-- ==============================================================================
-- 1. DEFENSE AGAINST PRIVILEGE ESCALATION
-- ==============================================================================

-- Trigger to prevent customers from tampering with their own security role
CREATE OR REPLACE FUNCTION public.protect_user_roles()
RETURNS TRIGGER AS $$
BEGIN
    -- If role is being changed
    IF OLD.role IS DISTINCT FROM NEW.role THEN
        -- Only existing Super Admins can alter roles
        IF NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Security Violation: You do not have permission to modify user security roles.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_user_roles ON public.profiles;
CREATE TRIGGER trg_protect_user_roles
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_user_roles();

-- ==============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_status_history ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. RLS POLICIES DEFINITIONS
-- ==============================================================================

-- PROFILES
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile non-role fields" ON public.profiles;
CREATE POLICY "Users can update own profile non-role fields"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin());

-- ADMIN PROFILES (Only accessible by Admins/Super Admins)
DROP POLICY IF EXISTS "Admins can view admin profiles" ON public.admin_profiles;
CREATE POLICY "Admins can view admin profiles"
    ON public.admin_profiles FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Only Super Admin can manage admin profiles" ON public.admin_profiles;
CREATE POLICY "Only Super Admin can manage admin profiles"
    ON public.admin_profiles FOR ALL
    USING (public.is_super_admin());

-- CATEGORIES & PRODUCTS (Public read, Admin manage)
DROP POLICY IF EXISTS "Public can view active categories" ON public.categories;
CREATE POLICY "Public can view active categories"
    ON public.categories FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
    ON public.categories FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
    ON public.products FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
CREATE POLICY "Admins can manage products"
    ON public.products FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view product categories" ON public.product_categories;
CREATE POLICY "Public can view product categories"
    ON public.product_categories FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage product categories" ON public.product_categories;
CREATE POLICY "Admins can manage product categories"
    ON public.product_categories FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Public can view product images" ON public.product_images;
CREATE POLICY "Public can view product images"
    ON public.product_images FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage product images" ON public.product_images;
CREATE POLICY "Admins can manage product images"
    ON public.product_images FOR ALL
    USING (public.is_admin());

-- BANNERS
DROP POLICY IF EXISTS "Public can view active banners" ON public.banners;
CREATE POLICY "Public can view active banners"
    ON public.banners FOR SELECT
    USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
CREATE POLICY "Admins can manage banners"
    ON public.banners FOR ALL
    USING (public.is_admin());

-- WISHLISTS (Customers manage own, Admin can read)
DROP POLICY IF EXISTS "Users can manage own wishlist" ON public.wishlists;
CREATE POLICY "Users can manage own wishlist"
    ON public.wishlists FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

-- INVENTORY & STOCK (Public can read stock availability, Admin can adjust)
DROP POLICY IF EXISTS "Public can view inventory" ON public.inventory;
CREATE POLICY "Public can view inventory"
    ON public.inventory FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage inventory" ON public.inventory;
CREATE POLICY "Admins can manage inventory"
    ON public.inventory FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view stock movements" ON public.stock_movements;
CREATE POLICY "Admins can view stock movements"
    ON public.stock_movements FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage reservations" ON public.stock_reservations;
CREATE POLICY "Admins can manage reservations"
    ON public.stock_reservations FOR ALL
    USING (public.is_admin() OR auth.uid() = user_id);

-- CARTS & ADDRESSES
DROP POLICY IF EXISTS "Users can manage own cart" ON public.carts;
CREATE POLICY "Users can manage own cart"
    ON public.carts FOR ALL
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own cart items" ON public.cart_items;
CREATE POLICY "Users can manage own cart items"
    ON public.cart_items FOR ALL
    USING (EXISTS (SELECT 1 FROM public.carts WHERE id = cart_items.cart_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage own addresses" ON public.addresses;
CREATE POLICY "Users can manage own addresses"
    ON public.addresses FOR ALL
    USING (auth.uid() = user_id OR public.is_admin());

-- ORDERS & PAYMENTS (Strict separation: Customers see own, Admins see all)
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;
CREATE POLICY "Admins can manage orders"
    ON public.orders FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
    ON public.order_items FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_items.order_id AND (user_id = auth.uid() OR public.is_admin())));

DROP POLICY IF EXISTS "Admins can manage order items" ON public.order_items;
CREATE POLICY "Admins can manage order items"
    ON public.order_items FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view payments and refunds" ON public.payment_records;
CREATE POLICY "Admins view payments and refunds"
    ON public.payment_records FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins view refund records" ON public.refund_records;
CREATE POLICY "Admins view refund records"
    ON public.refund_records FOR ALL
    USING (public.is_admin());

-- REWARDS & WALLETS
DROP POLICY IF EXISTS "Public can view active reward settings" ON public.reward_settings;
CREATE POLICY "Public can view active reward settings"
    ON public.reward_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage reward settings" ON public.reward_settings;
CREATE POLICY "Admins can manage reward settings"
    ON public.reward_settings FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Users can view own wallet" ON public.coin_wallets;
CREATE POLICY "Users can view own wallet"
    ON public.coin_wallets FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can view own coin transactions" ON public.coin_transactions;
CREATE POLICY "Users can view own coin transactions"
    ON public.coin_transactions FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

-- DELIVERY & SHIPMENTS
DROP POLICY IF EXISTS "Public view delivery settings" ON public.delivery_settings;
CREATE POLICY "Public view delivery settings"
    ON public.delivery_settings FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins manage delivery settings" ON public.delivery_settings;
CREATE POLICY "Admins manage delivery settings"
    ON public.delivery_settings FOR ALL
    USING (public.is_admin());

DROP POLICY IF EXISTS "Users view own shipments" ON public.shipment_records;
CREATE POLICY "Users view own shipments"
    ON public.shipment_records FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.orders WHERE id = shipment_records.order_id AND (user_id = auth.uid() OR public.is_admin())));

DROP POLICY IF EXISTS "Admins manage all shipments" ON public.shipment_records;
CREATE POLICY "Admins manage all shipments"
    ON public.shipment_records FOR ALL
    USING (public.is_admin());


-- ==============================================================================
-- 4. OFFICIAL SUPER ADMIN ROLE ASSIGNMENT
-- ==============================================================================
-- Target Email: sanjanamobiledatabase@gmail.com
-- IMPORTANT: This block MUST be run after creating the user account in Supabase Auth.
-- It verifies identity, sets 'super_admin' role, and initializes the admin profile.
-- Safe to execute repeatedly (idempotent).
-- ==============================================================================

DO $$
DECLARE
    v_admin_email TEXT := 'sanjanamobiledatabase@gmail.com';
    v_user_id UUID;
    v_existing_role TEXT;
BEGIN
    -- 1. Locate the authenticated user by normalized lowercase email
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_admin_email));

    -- 2. Verify account existence in Supabase Authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'CRITICAL SETUP PREREQUISITE MISSING:
No Supabase Auth user found with email "%".

HOW TO FIX:
1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/_/auth/users
2. Click "Add user" -> "Create user".
3. Enter email: %
4. Set a strong password.
5. Confirm user creation.
6. Then re-run this script to assign Super Admin privileges.', v_admin_email, v_admin_email;
    END IF;

    -- 3. Upsert into public.profiles with super_admin role
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        updated_at
    )
    VALUES (
        v_user_id,
        LOWER(TRIM(v_admin_email)),
        'Sanjana Super Admin',
        'super_admin',
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'super_admin',
        full_name = 'Sanjana Super Admin',
        updated_at = timezone('utc'::text, now());

    -- 4. Upsert into public.admin_profiles with full system privileges
    INSERT INTO public.admin_profiles (
        id,
        admin_level,
        department,
        can_manage_products,
        can_manage_orders,
        can_manage_inventory,
        can_manage_rewards,
        can_manage_admins,
        can_manage_settings,
        is_active,
        updated_at
    )
    VALUES (
        v_user_id,
        'super_admin',
        'Executive Management',
        true,
        true,
        true,
        true,
        true,
        true,
        true,
        timezone('utc'::text, now())
    )
    ON CONFLICT (id) DO UPDATE SET
        admin_level = 'super_admin',
        can_manage_admins = true,
        can_manage_settings = true,
        is_active = true,
        updated_at = timezone('utc'::text, now());

    -- 5. Verification Notice
    SELECT role INTO v_existing_role FROM public.profiles WHERE id = v_user_id;

    RAISE NOTICE '================================================================';
    RAISE NOTICE 'SANJANA MOBILES - SUPER ADMIN ASSIGNMENT SUCCESSFUL';
    RAISE NOTICE 'Target Email: %', v_admin_email;
    RAISE NOTICE 'Auth User ID: %', v_user_id;
    RAISE NOTICE 'Assigned Role: %', v_existing_role;
    RAISE NOTICE 'Admin Portal: /admin/login';
    RAISE NOTICE '================================================================';
END $$;

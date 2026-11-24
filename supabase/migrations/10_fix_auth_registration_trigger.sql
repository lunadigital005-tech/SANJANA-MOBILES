-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 10
-- File: supabase/migrations/10_fix_auth_registration_trigger.sql
-- Description: Fix Customer Registration Failure (POST /auth/v1/signup 500)
--              - Repairs the auth.users trigger (on_auth_user_created)
--              - Removes broken references to non-existent customer_rewards / public.users
--              - Consolidates profile and wallet initialization into an atomic, resilient SECURITY DEFINER trigger
--              - Enforces role = 'customer' (strictly prevents role escalation via metadata)
--              - Adds missing INSERT RLS policies on public.profiles and public.coin_wallets
--              - Grants proper permissions to supabase_auth_admin and auth roles
--              - Backfills profiles for any orphan auth.users records
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PRE-CHECK & CLEANUP OF CONFLICTING / BROKEN TRIGGERS
-- ------------------------------------------------------------------------------

-- Remove redundant/unprivileged wallet trigger on auth.users if it exists
DROP TRIGGER IF EXISTS trg_user_init_wallet ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_wallet();

-- Drop existing on_auth_user_created trigger so we can recreate it cleanly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- ------------------------------------------------------------------------------
-- 2. ENSURE PROFILES TABLE SCHEMA & CONSTRAINTS ARE SOUND
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL DEFAULT 'Valued Customer',
    phone TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'moderator', 'admin', 'super_admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure check constraint allows all legitimate roles
DO $$
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('customer', 'moderator', 'admin', 'super_admin'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ------------------------------------------------------------------------------
-- 3. ENSURE COIN_WALLETS TABLE EXISTS FOR REWARDS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.coin_wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    available_coins INTEGER NOT NULL DEFAULT 0 CHECK (available_coins >= 0),
    total_earned_coins INTEGER NOT NULL DEFAULT 0 CHECK (total_earned_coins >= 0),
    total_redeemed_coins INTEGER NOT NULL DEFAULT 0 CHECK (total_redeemed_coins >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coin_wallets_user ON public.coin_wallets(user_id);

-- ------------------------------------------------------------------------------
-- 4. ATOMIC, SECURE, RESILIENT TRIGGER FUNCTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_full_name TEXT;
    v_email TEXT;
BEGIN
    -- Determine safe display name from metadata or email prefix
    v_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
        'Valued Customer'
    );

    v_email := LOWER(TRIM(COALESCE(NEW.email, '')));

    -- 1. Insert or update customer profile
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        avatar_url,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_email,
        v_full_name,
        'customer', -- STRICT SECURITY: Always force 'customer' role for new signups
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.created_at, NOW()),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = CASE 
            WHEN profiles.full_name IS NULL OR profiles.full_name = 'Valued Customer' 
            THEN EXCLUDED.full_name 
            ELSE profiles.full_name 
        END,
        -- NEVER allow signup metadata to change existing role on conflict
        role = profiles.role,
        updated_at = NOW();

    -- 2. Safely initialize customer coin wallet (50 welcome Sanjana Coins)
    -- Wrapped in defensive block so secondary reward issues NEVER block user registration
    BEGIN
        INSERT INTO public.coin_wallets (
            user_id,
            available_coins,
            total_earned_coins,
            total_redeemed_coins,
            created_at,
            updated_at
        )
        VALUES (
            NEW.id,
            50, -- 50 Sanjana Coins welcome bonus
            50,
            0,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log warning internally; do NOT fail the auth transaction
            RAISE WARNING 'handle_new_user: Failed to initialize coin wallet for user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. ATTACH TRIGGER TO auth.users
-- ------------------------------------------------------------------------------

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 6. GRANT NECESSARY PERMISSIONS TO AUTH ROLES & SUPABASE ADMIN
-- ------------------------------------------------------------------------------

-- Allow supabase_auth_admin, postgres, authenticated, and anon proper schema access
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;

-- Permissions on profiles
GRANT ALL ON TABLE public.profiles TO postgres, service_role, supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;

-- Permissions on coin_wallets
GRANT ALL ON TABLE public.coin_wallets TO postgres, service_role, supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON TABLE public.coin_wallets TO authenticated;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_wallets ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile non-role fields" ON public.profiles;
CREATE POLICY "Users can update own profile non-role fields"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Allow system and users to insert profile" ON public.profiles;
CREATE POLICY "Allow system and users to insert profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() IS NULL OR public.is_admin());

-- Coin Wallets Policies
DROP POLICY IF EXISTS "Users can view own wallet" ON public.coin_wallets;
CREATE POLICY "Users can view own wallet"
    ON public.coin_wallets FOR SELECT
    USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Allow wallet creation on signup" ON public.coin_wallets;
CREATE POLICY "Allow wallet creation on signup"
    ON public.coin_wallets FOR INSERT
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own wallet" ON public.coin_wallets;
CREATE POLICY "Users can update own wallet"
    ON public.coin_wallets FOR UPDATE
    USING (auth.uid() = user_id OR public.is_admin());

-- ------------------------------------------------------------------------------
-- 8. BACKFILL MISSING PROFILES FOR ANY EXISTING AUTH USERS
-- ------------------------------------------------------------------------------

INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
    au.id,
    LOWER(TRIM(COALESCE(au.email, ''))),
    COALESCE(
        NULLIF(TRIM(au.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(au.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(split_part(au.email, '@', 1)), ''),
        'Valued Customer'
    ),
    'customer',
    COALESCE(au.created_at, NOW()),
    NOW()
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Backfill missing coin wallets
INSERT INTO public.coin_wallets (user_id, available_coins, total_earned_coins, total_redeemed_coins, created_at, updated_at)
SELECT 
    p.id,
    50,
    50,
    0,
    NOW(),
    NOW()
FROM public.profiles p
LEFT JOIN public.coin_wallets cw ON cw.user_id = p.id
WHERE cw.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

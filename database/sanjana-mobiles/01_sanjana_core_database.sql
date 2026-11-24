-- ==============================================================================
-- SANJANA MOBILES - DATABASE MODULE 01
-- File: database/sanjana-mobiles/01_sanjana_core_database.sql
-- Description: Core Database Structure, Customer & Admin Profiles, User Roles,
--              Automated Profile Creation Trigger, and Security Definers.
-- Execution: Run first in Supabase SQL Editor.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CUSTOM USER ROLES
-- Supported roles: customer, moderator, admin, super_admin
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sanjana_user_role') THEN
        CREATE TYPE public.sanjana_user_role AS ENUM ('customer', 'moderator', 'admin', 'super_admin');
    END IF;
END $$;

-- 3. PROFILES TABLE (Linked 1:1 with auth.users)
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

-- Ensure check constraint allows 'super_admin' on existing databases
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
CREATE INDEX IF NOT EXISTS idx_profiles_created ON public.profiles(created_at DESC);

-- 4. DEDICATED ADMIN PROFILES TABLE (Detailed privileges for Admin/Super Admin)
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    admin_level TEXT NOT NULL DEFAULT 'admin' CHECK (admin_level IN ('admin', 'super_admin')),
    department TEXT NOT NULL DEFAULT 'Store Operations',
    can_manage_products BOOLEAN NOT NULL DEFAULT true,
    can_manage_orders BOOLEAN NOT NULL DEFAULT true,
    can_manage_inventory BOOLEAN NOT NULL DEFAULT true,
    can_manage_rewards BOOLEAN NOT NULL DEFAULT true,
    can_manage_admins BOOLEAN NOT NULL DEFAULT false,
    can_manage_settings BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_profiles_level ON public.admin_profiles(admin_level);
CREATE INDEX IF NOT EXISTS idx_admin_profiles_active ON public.admin_profiles(is_active);

-- 5. AUTOMATED TIMESTAMP TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_admin_profiles_updated_at ON public.admin_profiles;
CREATE TRIGGER trg_admin_profiles_updated_at
    BEFORE UPDATE ON public.admin_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. AUTOMATED NEW USER SIGNUP HOOK
-- Safely inserts customer profile upon registration in auth.users.
-- Security: ALWAYS defaults to 'customer'. Cannot be hijacked to create admin.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_full_name TEXT;
BEGIN
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );

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
        LOWER(TRIM(NEW.email)),
        v_full_name,
        'customer',
        NEW.raw_user_meta_data->>'avatar_url',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 7. SECURITY HELPER FUNCTIONS
-- Check if current authenticated user has Admin or Super Admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
          AND role IN ('admin', 'super_admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if current authenticated user is strictly Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
          AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

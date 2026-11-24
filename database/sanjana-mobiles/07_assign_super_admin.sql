-- ==============================================================================
-- SANJANA MOBILES - STANDALONE SUPER ADMIN ROLE ASSIGNMENT SCRIPT
-- File: database/sanjana-mobiles/07_assign_super_admin.sql
-- Description: Assigns Super Admin privileges to sanjanamobiledatabase@gmail.com
-- Prerequisite: User account must be created in Supabase Auth before running this.
-- Safe to re-run anytime (Idempotent).
-- ==============================================================================

DO $$
DECLARE
    v_admin_email TEXT := 'sanjanamobiledatabase@gmail.com';
    v_user_id UUID;
    v_assigned_role TEXT;
BEGIN
    -- 1. Locate the Supabase Auth user
    SELECT id INTO v_user_id
    FROM auth.users
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_admin_email));

    -- 2. Validate that the email exists in auth.users
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '
--------------------------------------------------------------------------------
ERROR: Account "%" was NOT found in Supabase Auth!
--------------------------------------------------------------------------------
Please complete the following step first:
1. Go to your Supabase Dashboard -> Authentication -> Users.
2. Click "Add User" -> "Create User".
3. Enter email: %
4. Set your secure password.
5. Save the user.
6. Re-run this SQL script.
--------------------------------------------------------------------------------', v_admin_email, v_admin_email;
    END IF;

    -- 3. Upsert into public.profiles
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

    -- 4. Upsert into public.admin_profiles
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

    -- 5. Verification output
    SELECT role INTO v_assigned_role FROM public.profiles WHERE id = v_user_id;

    RAISE NOTICE '
================================================================================
SANJANA MOBILES - SUPER ADMIN ASSIGNMENT CONFIRMED
================================================================================
Target User: %
User UUID:   %
Role Level:  %
Dashboard:   /admin/dashboard
Login URL:   /admin/login
Status:      SUPER ADMIN ACTIVE & VERIFIED
================================================================================',
    v_admin_email, v_user_id, v_assigned_role;
END $$;

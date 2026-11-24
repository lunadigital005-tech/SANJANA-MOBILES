# SANJANA MOBILES — Supabase Database Setup & Admin Authentication Guide

This directory contains the complete, production-ready PostgreSQL database modules for **SANJANA MOBILES**, including catalog architecture, inventory management, order processing, Razorpay payments, loyalty coins, delivery tracking, Row-Level Security (RLS), and the official Super Admin authentication setup for:

> **Official Super Admin Email:** `sanjanamobiledatabase@gmail.com`

---

## 1. Directory File Summary

All SQL scripts are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO UPDATE`), formatted for PostgreSQL / Supabase, and safe to execute in sequence:

| Step | Script File Name | Purpose & Contents |
| :---: | :--- | :--- |
| **1** | [`01_sanjana_core_database.sql`](./01_sanjana_core_database.sql) | Extensions, user roles (`customer`, `moderator`, `admin`, `super_admin`), `profiles` table, `admin_profiles` table, timestamp triggers, new user hook, and security functions (`is_admin()`, `is_super_admin()`). |
| **2** | [`02_sanjana_categories_products.sql`](./02_sanjana_categories_products.sql) | 9 core mobile categories, subcategories (`parent_id`), mobile products with brand, model, warranty, `specifications` (JSONB), `compatibility` (JSONB), image galleries, banners, wishlists, and discount trigger. |
| **3** | [`03_sanjana_inventory.sql`](./03_sanjana_inventory.sql) | Inventory quantities, stock movements audit ledger, stock reservations during checkout, atomic row-lock stored procedures (`reserve_product_stock`, `release_expired_reservations`, `adjust_inventory_stock`). |
| **4** | [`04_sanjana_orders_payments.sql`](./04_sanjana_orders_payments.sql) | Shopping carts, Indian address standards (PIN code, mobile, district), orders table (`SANJANA-xxxx`), order items price snapshots, payment audit records, Razorpay IDs, and refund logs. |
| **5** | [`05_sanjana_rewards_delivery.sql`](./05_sanjana_rewards_delivery.sql) | Loyalty coin settings, customer coin wallets, coin transaction ledger, store pickup, direct delivery, courier shipments, receipt image storage, and tracking event timeline. |
| **6** | [`06_sanjana_admin_security.sql`](./06_sanjana_admin_security.sql) | Full Row-Level Security (RLS) policies for all 24 tables, anti-privilege escalation triggers, and the **Super Admin role assignment block** for `sanjanamobiledatabase@gmail.com`. |
| **Opt** | [`07_assign_super_admin.sql`](./07_assign_super_admin.sql) | Standalone script to grant or re-grant Super Admin role to `sanjanamobiledatabase@gmail.com` at any time. |

---

## 2. Step-by-Step Supabase Execution Order

Follow these steps in your Supabase project dashboard:

### Step A: Open Supabase SQL Editor
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. In the left navigation sidebar, click on the **SQL Editor** icon (shaped like `>_` or a database query sheet).
4. Click **+ New Query** to open a blank query tab.

### Step B: Execute Modules 01 through 05
Run files 01 through 05 one by one:

1. **Module 01:**
   - Open `01_sanjana_core_database.sql`.
   - Copy the entire SQL content and paste it into the Supabase SQL Editor.
   - Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`).
   - Verify green status: `"Success. No rows returned"`.

2. **Module 02:**
   - Open `02_sanjana_categories_products.sql`.
   - Paste into a new query tab and click **Run**.
   - Creates the mobile catalog, indexes, and seeds the 9 core categories.

3. **Module 03:**
   - Open `03_sanjana_inventory.sql`.
   - Paste and click **Run**.
   - Creates stock tables, triggers, and atomic locking procedures.

4. **Module 04:**
   - Open `04_sanjana_orders_payments.sql`.
   - Paste and click **Run**.
   - Configures carts, addresses, orders, order items, and payment tables.

5. **Module 05:**
   - Open `05_sanjana_rewards_delivery.sql`.
   - Paste and click **Run**.
   - Configures loyalty coin wallets, transaction ledger, and courier shipments.

---

## 3. Creating the Official Super Admin Account in Supabase Auth

Before executing Module 06 (or Module 07), you must create the user in Supabase Authentication:

1. In your Supabase Dashboard sidebar, click **Authentication** (the user/lock icon).
2. Click on **Users** in the sub-menu.
3. Click the green **Add user** button in the top right, then choose **Create user**.
4. In the modal:
   - **User Email:** `sanjanamobiledatabase@gmail.com`
   - **User Password:** Enter your secure master password (at least 8–12 characters with letters, numbers, and symbols).
   - **Auto Confirm User:** Make sure the **Auto Confirm User?** toggle is checked (so no verification email is required for this admin account).
5. Click **Create user**.
6. The user will now appear in your Supabase Auth Users table with an assigned UUID.

---

## 4. Assigning the Super Admin Role

Once the user `sanjanamobiledatabase@gmail.com` exists in Supabase Auth:

1. Go back to the **SQL Editor** in your Supabase Dashboard.
2. Open `06_sanjana_admin_security.sql` (or `07_assign_super_admin.sql`).
3. Paste the contents into the SQL Editor and click **Run**.
4. The script will:
   - Match `sanjanamobiledatabase@gmail.com` in `auth.users`.
   - Assign `role = 'super_admin'` in `public.profiles`.
   - Create the matching record in `public.admin_profiles` with full management permissions.
   - Output a success notice in the query results panel:
     ```text
     NOTICE: SANJANA MOBILES - SUPER ADMIN ASSIGNMENT CONFIRMED
     Target User: sanjanamobiledatabase@gmail.com
     User UUID:   [Your User ID]
     Role Level:  super_admin
     Dashboard:   /admin/dashboard
     Login URL:   /admin/login
     Status:      SUPER ADMIN ACTIVE & VERIFIED
     ```

---

## 5. Verifying Admin Access on the Website

1. Start your local frontend and backend:
   ```bash
   # Backend:
   uvicorn app.main:app --reload --port 8000

   # Frontend:
   npm --prefix frontend run dev
   ```
2. In your web browser, navigate to:
   ```
   http://localhost:5173/admin/login
   ```
3. Enter your official admin credentials:
   - **Email:** `sanjanamobiledatabase@gmail.com`
   - **Password:** The password you created in Step 3.
4. Click **Authenticate & Access Console**.
5. You will be authenticated via Supabase Auth, verified against `public.profiles`, and redirected to `/admin/dashboard` with full access to:
   - **Dashboard Overview**
   - **Products** (Create, edit, specs, compatibility, images)
   - **Categories & Subcategories**
   - **Inventory & Stock Adjustments**
   - **Orders & Order Acceptance/Rejection**
   - **Deliveries & Courier Waybill Tracking**
   - **Loyalty Rewards & Coin Rules**
   - **Refunds Management**
   - **Customer Accounts**
   - **Store Settings**

---

## 6. Troubleshooting Common Errors

### Error: `No Supabase Auth user found with email "sanjanamobiledatabase@gmail.com"`
*   **Cause:** You executed `06_sanjana_admin_security.sql` or `07_assign_super_admin.sql` before creating the user in Supabase Authentication.
*   **Solution:** Follow Step 3 above (Supabase Dashboard -> Authentication -> Users -> Add User -> `sanjanamobiledatabase@gmail.com`), then run the script again.

### Error: `relation "public.profiles" does not exist`
*   **Cause:** The SQL scripts were executed out of order.
*   **Solution:** Ensure you run `01_sanjana_core_database.sql` first before running the subsequent modules.

### Error: `table "categories" already exists`
*   **Solution:** All scripts use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Existing tables and data are safely preserved.

### Error: `permission denied for schema public` or RLS blocks queries
*   **Solution:** Ensure your backend API connects using either:
    - User JWT in `Authorization: Bearer <token>` for customer operations.
    - `SUPABASE_SERVICE_ROLE_KEY` in your backend `.env` for elevated server-side tasks. Never expose the service-role key in frontend code.

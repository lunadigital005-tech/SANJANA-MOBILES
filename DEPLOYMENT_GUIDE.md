# LUNA Production Deployment Guide

---

## 1. Production Architecture Overview

In production, LUNA is hosted across three scalable cloud services:
1. **Frontend SPA**: Hosted on **Vercel** (or Cloudflare Pages / Netlify) with global Edge CDN caching.
2. **Backend API**: Containerized FastAPI service hosted on **Render** (or Railway / AWS ECS / DigitalOcean App Platform).
3. **Database & Storage**: Managed **Supabase PostgreSQL** instance with automated daily backups and high-availability object storage.
4. **Payments**: **Razorpay Production Mode** with live API keys and webhook signatures.

---

## 2. Supabase Production Database Setup

### Step 1: Create a Production Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a project in your target region (e.g. `ap-south-1` Mumbai).
2. Note your Project URL (`https://xyz.supabase.co`), `anon` public key, and `service_role` secret key.

### Step 2: Run Database Migrations
In the Supabase SQL Editor, execute the migration files in order:
1. `supabase/migrations/01_auth_and_profiles.sql`
2. `supabase/migrations/02_seed_demo_data.sql`
3. `supabase/migrations/03_products_categories_inventory.sql`
4. `supabase/migrations/04_orders_payments_and_refunds.sql`
5. `supabase/migrations/05_loyalty_rewards_and_delivery_shipments.sql`

### Step 3: Create Storage Buckets
In the Supabase Storage console, create two public buckets:
- `product-images` (Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, Max file size: 5 MB)
- `delivery-receipts` (Allowed MIME types: `image/jpeg`, `image/png`, `application/pdf`, Max file size: 10 MB)

---

## 3. Backend Deployment (Render / Railway)

### Step 1: Create a Dockerfile (`backend/Dockerfile`)
```dockerfile
FROM python:3.14-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Step 2: Configure Production Environment Variables on Render
Under Environment Settings, add:
- `ENVIRONMENT=production`
- `SUPABASE_URL=https://your-project.supabase.co`
- `SUPABASE_KEY=your-supabase-anon-key`
- `SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key`
- `RAZORPAY_KEY_ID=rzp_live_xxxxxxxx`
- `RAZORPAY_KEY_SECRET=your-live-razorpay-secret`
- `RAZORPAY_WEBHOOK_SECRET=your-live-webhook-secret`
- `BACKEND_CORS_ORIGINS=["https://luna-store.com", "https://admin.luna-store.com"]`
- `ADMIN_SECRET_KEY=generate-a-strong-random-64-char-string`

---

## 4. Frontend Deployment (Vercel)

### Step 1: Connect Git Repository to Vercel
1. Set Root Directory to `frontend`.
2. Build Command: `npm run build`.
3. Output Directory: `dist`.

### Step 2: Configure Vercel Environment Variables
- `VITE_API_URL=https://api.luna-store.com`
- `VITE_SUPABASE_URL=https://your-project.supabase.co`
- `VITE_SUPABASE_ANON_KEY=your-supabase-anon-key`
- `VITE_RAZORPAY_KEY_ID=rzp_live_xxxxxxxx`
- `VITE_STORE_NAME=LUNA`

### Step 3: SPA Rewrites (`vercel.json`)
To ensure React Router routes (e.g. `/shop`, `/orders`) resolve correctly on page reload, add `frontend/vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 5. Razorpay Production Webhook Configuration

1. In the Razorpay Dashboard, navigate to **Settings > Webhooks**.
2. Click **Add New Webhook**.
3. **Webhook URL**: `https://api.luna-store.com/api/v1/orders/webhook`.
4. **Secret**: Enter the exact secret configured in `RAZORPAY_WEBHOOK_SECRET`.
5. **Active Events**: Check:
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
   - `order.paid`

---

## 6. Post-Deployment Verification Checklist

- [ ] Verify Backend Health Endpoint: `curl https://api.luna-store.com/health` returns `{"status": "healthy"}`.
- [ ] Verify Security Headers: Run `curl -I https://api.luna-store.com/health` and verify `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.
- [ ] Verify Frontend SSL: Ensure HTTPS certificate is active and redirecting HTTP.
- [ ] Perform End-to-End Test Transaction: Place a live order with a 1-rupee test product using UPI/Card, verify stock deduction, and verify receipt of order confirmation.

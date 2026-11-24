# LUNA Environment Variables Reference

---

## 1. Security & Hygiene Principles

> [!CAUTION]
> **Never commit real secret keys, service-role tokens, or payment credentials to version control.**
> All files named `.env`, `.env.local`, and `.env.production` must be listed in `.gitignore`.
> Provide team members with `.env.example` templates containing sanitized placeholder values only.

---

## 2. Backend Environment Variables (`backend/.env`)

| Variable Name | Type | Required | Secret? | Default (Local Dev) | Production Description & Format |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `PROJECT_NAME` | String | No | No | `"LUNA E-Commerce Backend"` | Display name for OpenAPI documentation |
| `API_V1_STR` | String | No | No | `"/api/v1"` | URL prefix for REST endpoints |
| `ENVIRONMENT` | String | Yes | No | `"development"` | Set to `"production"` to activate production logging & security |
| `SUPABASE_URL` | URL | Yes | No | `"https://placeholder.supabase.co"` | Your production Supabase project API URL |
| `SUPABASE_KEY` | String | Yes | No | `"anon-key-placeholder"` | Public Supabase anon key for public client queries |
| `SUPABASE_SERVICE_ROLE_KEY` | String | Yes | **YES** | `"service-role-placeholder"` | Secret Supabase Service Role key (Bypasses RLS for backend admin actions) |
| `RAZORPAY_KEY_ID` | String | Yes | No | `"rzp_test_placeholder"` | Razorpay public Key ID (`rzp_live_...` in prod) |
| `RAZORPAY_KEY_SECRET` | String | Yes | **YES** | `"rzp_secret_placeholder"` | Razorpay Secret Key for HMAC-SHA256 signature checks |
| `RAZORPAY_WEBHOOK_SECRET` | String | Yes | **YES** | `"webhook_secret_placeholder"` | Secret string to authenticate inbound webhook payloads |
| `BACKEND_CORS_ORIGINS` | JSON List | Yes | No | `["http://localhost:5173"]` | Allowed web origins. E.g. `["https://luna-store.com", "https://admin.luna-store.com"]` |
| `ADMIN_SECRET_KEY` | String | Yes | **YES** | `"luna-admin-secret-key-change-in-prod"` | 64+ char entropy secret for administrative CLI tasks |

---

## 3. Frontend Environment Variables (`frontend/.env`)

Vite requires public variables to be prefixed with `VITE_`. These are compiled into client-side JS bundles:

| Variable Name | Type | Required | Default (Local Dev) | Production Description |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_URL` | URL | Yes | `"http://localhost:8000/api/v1"` | Full URL pointing to the FastAPI backend service |
| `VITE_SUPABASE_URL` | URL | Yes | `"https://placeholder.supabase.co"` | Supabase API endpoint for Auth & Storage |
| `VITE_SUPABASE_ANON_KEY` | String | Yes | `"anon-key-placeholder"` | Public Supabase anonymous client key |
| `VITE_RAZORPAY_KEY_ID` | String | Yes | `"rzp_test_placeholder"` | Razorpay public key ID used to initialize client modal |
| `VITE_STORE_NAME` | String | No | `"LUNA"` | Configurable storefront title |

---

## 4. Example Configuration Files

### `backend/.env.example`
```env
PROJECT_NAME="LUNA E-Commerce Backend"
API_V1_STR="/api/v1"
ENVIRONMENT="development"

SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-secret-key"

RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
RAZORPAY_KEY_SECRET="your-razorpay-secret"
RAZORPAY_WEBHOOK_SECRET="your-webhook-secret"

BACKEND_CORS_ORIGINS='["http://localhost:5173", "http://localhost:3000"]'
ADMIN_SECRET_KEY="replace-with-a-secure-random-token"
```

### `frontend/.env.example`
```env
VITE_API_URL="http://localhost:8000/api/v1"
VITE_SUPABASE_URL="https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY="your-anon-key"
VITE_RAZORPAY_KEY_ID="rzp_test_xxxxxxxxxxxx"
VITE_STORE_NAME="LUNA"
```

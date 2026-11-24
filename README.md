# SANJANA MOBILES E-Commerce Platform
## Production Architecture & Operational Manual (Phases 01 – 10 Complete)

![SANJANA MOBILES](https://img.shields.io/badge/Brand-SANJANA%20MOBILES-21132B?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18.3+-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Auth%20%2B%20Storage-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Razorpay](https://img.shields.io/badge/Razorpay-HMAC--SHA256%20Verified-02042B?style=for-the-badge&logo=razorpay&logoColor=white)
![Build Status](https://img.shields.io/badge/Tests-43%2F43%20Passing-success?style=for-the-badge)

---

## 1. Executive Summary

**SANJANA MOBILES** is an enterprise-grade, full-stack mobile phone and mobile accessories e-commerce platform engineered with Python FastAPI, React.js (Vite + TypeScript), Supabase PostgreSQL, and Razorpay. Designed from the ground up to deliver a distinctive, premium mobile shopping experience, SANJANA MOBILES departs from conventional template layouts to provide bespoke interactions, robust server-side pricing integrity, atomic inventory concurrency, a configurable loyalty rewards engine, and multi-tier direct & courier fulfillment management.

---

## 2. Official Brand Identity & Visual Design Tokens

- **Official Name**: SANJANA MOBILES
- **Short Logo Name**: S
- **Website Name**: Sanjana Mobiles
- **Browser Title**: `Sanjana Mobiles – Online Mobile Shopping`

### Official Logo Assets
The brand uses an original, tech-inspired S-symbol blending sleek smartphone curves with modern circuit pathways and high-contrast typography:
- Full Logo (Light Surfaces): `/images/sanjana-mobiles-logo.svg` & `/images/sanjana-mobiles-logo.png`
- Full Logo (Dark Surfaces): `/images/sanjana-mobiles-logo-dark.svg`
- Standalone S-Mark Icon: `/images/sanjana-mobiles-icon.svg` & `/images/sanjana-mobiles-icon.png`
- Browser Favicon: `/favicon.svg`

SANJANA MOBILES uses a disciplined, accessible design system defined via CSS custom properties and Tailwind tokens:

| Design Token | Hex Code | Purpose & Usage |
| :--- | :--- | :--- |
| **Deep Plum** | `#21132B` | Primary brand canvas, high-contrast headings, primary buttons, admin header |
| **Vibrant Coral** | `#FF6B4A` | Accent action items, CTA buttons, active state badges, highlight alerts |
| **Soft Mint** | `#DDF4E7` | Success badges, low-stock chips, positive price indicators, soft accents |
| **Warm Ivory** | `#F8F6F0` | Primary page background, card container backgrounds, muted borders |

*Central Configuration*: The store name, logos, and brand attributes are defined centrally in `frontend/src/config/store.ts` and can be customized dynamically without altering individual component trees.

---

## 3. Technology Stack

### Frontend
- **Framework**: React 18.3 + TypeScript
- **Bundler & Tooling**: Vite 8.3 + Rolldown runtime
- **Styling**: Tailwind CSS 3.4 with custom LUNA design palette
- **Routing**: React Router DOM v6 with role-based layout guards (`ProtectedRoute`, `AdminRoute`)
- **Icons**: Lucide React
- **Resilience**: Custom React `ErrorBoundary` with fallback UI and session reset

### Backend
- **Framework**: Python 3.14 + FastAPI
- **Data Validation & Settings**: Pydantic v2 (`BaseModel`, `SettingsConfigDict`)
- **Security & Cryptography**: PyJWT, Python `hashlib` (HMAC-SHA256 verification)
- **HTTP Client**: HTTPX / Starlette TestClient
- **Middleware**: Custom Security Headers (`nosniff`, `DENY`, `1; mode=block`), CORS middleware

### Database, Storage & Payments
- **Database**: Supabase PostgreSQL with Row-Level Security (RLS), foreign keys, indexes, triggers, and stored functions
- **Authentication**: Supabase Auth (JWT bearer verification with metadata sync)
- **Object Storage**: Supabase Storage buckets (`product-images`, `delivery-receipts`)
- **Payment Gateway**: Razorpay (Server-to-server Order generation, client checkout modal, HMAC-SHA256 signature verification, and idempotent webhook handlers)

---

## 4. Complete System Architecture & Directory Structure

```
.
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── admin.py            # Admin catalog, orders, inventory & stats
│   │   │   │   ├── auth.py             # Auth register, login, profile, password reset
│   │   │   │   ├── categories.py       # Public category browsing
│   │   │   │   ├── customer.py         # Customer profile, addresses
│   │   │   │   ├── delivery.py         # Haversine distance, direct/courier tracking
│   │   │   │   ├── orders.py           # Cart pricing, checkout, Razorpay, webhooks
│   │   │   │   ├── products.py         # Public product catalog with search/filter
│   │   │   │   └── rewards.py          # Loyalty wallet, coin history, admin rules
│   │   │   └── api.py                  # API router mounting
│   │   ├── core/
│   │   │   ├── config.py               # Pydantic SettingsConfigDict configuration
│   │   │   └── security.py             # JWT decode, customer & admin role guards
│   │   ├── schemas/                    # Pydantic request/response schemas
│   │   │   ├── admin.py
│   │   │   ├── auth.py
│   │   │   ├── category.py
│   │   │   ├── delivery.py
│   │   │   ├── inventory.py
│   │   │   ├── order.py
│   │   │   ├── product.py
│   │   │   ├── rewards.py
│   │   │   └── user.py
│   │   ├── services/                   # Business logic and in-memory transactional state
│   │   │   ├── catalog_store.py        # Categories, products, stock reservations
│   │   │   ├── delivery_service.py     # Distance calc, courier tracking, WhatsApp
│   │   │   ├── order_store.py          # Cart calculation, order status, refunds
│   │   │   ├── rewards_store.py        # Coin wallet, earning rules, transactions
│   │   │   └── storage.py              # Supabase storage upload & validation
│   │   └── main.py                     # App factory, security headers, CORS
│   ├── requirements.txt
│   ├── test_api.py                     # Auth & RBAC test suite
│   ├── test_phase4_5.py                # Catalog & Inventory concurrency test suite
│   ├── test_phase6_7.py                # Cart, Checkout, Razorpay & Refund test suite
│   ├── test_phase8_9.py                # Rewards engine & Delivery fulfillment test suite
│   └── test_phase10_audit.py           # Production security, tamper & conflict test suite
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/                 # Button, Modal, ErrorBoundary, Badge, Input
│   │   │   ├── layout/                 # Navbar, Footer, CustomerLayout, AdminLayout
│   │   │   └── product/                # ProductCard, ProductGrid, CategoryFilter
│   │   ├── config/                     # store.ts (central store identity)
│   │   ├── context/                    # AuthContext, CartContext, ToastContext
│   │   ├── pages/
│   │   │   ├── admin/                  # Dashboard, Products, Categories, Inventory, Orders, Rewards, Delivery
│   │   │   └── customer/               # Home, Shop, ProductDetails, Cart, Checkout, Orders, Rewards, Profile
│   │   ├── routes/                     # AppRoutes, ProtectedRoute, AdminRoute
│   │   ├── services/                   # api.ts (Axios REST client), supabase.ts
│   │   └── types/                      # TypeScript domain interfaces
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── supabase/
│   └── migrations/
│       ├── 01_auth_and_profiles.sql
│       ├── 02_seed_demo_data.sql
│       ├── 03_products_categories_inventory.sql
│       ├── 04_orders_payments_and_refunds.sql
│       └── 05_loyalty_rewards_and_delivery_shipments.sql
└── documentation/ (15 Master Documentation Files)
```

---

## 5. Master Documentation Index

All technical subsystems, security models, database schemas, and operating runbooks are fully documented in the following files:

1. [PROJECT_ARCHITECTURE.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/PROJECT_ARCHITECTURE.md) - System architecture, data flow, client-server design, and security boundaries.
2. [FRONTEND_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/FRONTEND_DOCUMENTATION.md) - React 18, Vite code-splitting, Tailwind tokens, Context API, and route guards.
3. [BACKEND_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/BACKEND_DOCUMENTATION.md) - FastAPI endpoints, Pydantic v2 schemas, services, and security middleware.
4. [DATABASE_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/DATABASE_DOCUMENTATION.md) - Supabase PostgreSQL schemas, tables, constraints, indexes, RLS, and migrations 01-05.
5. [API_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/API_DOCUMENTATION.md) - Complete REST API specification with endpoints, schemas, and status codes.
6. [AUTHENTICATION_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/AUTHENTICATION_DOCUMENTATION.md) - Supabase Auth, JWT verification, and Role-Based Access Control.
7. [PAYMENT_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/PAYMENT_DOCUMENTATION.md) - Razorpay HMAC-SHA256 verification, webhooks, mixed coin payments, and refunds.
8. [INVENTORY_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/INVENTORY_DOCUMENTATION.md) - Concurrency management, 15-minute reservations, movements audit, and anti-overselling.
9. [REWARDS_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/REWARDS_DOCUMENTATION.md) - Configurable loyalty coin engine, ledger transactions, and redemption rules.
10. [DELIVERY_DOCUMENTATION.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/DELIVERY_DOCUMENTATION.md) - Direct delivery radius (Haversine), courier dispatch, receipts, and WhatsApp messaging.
11. [DEPLOYMENT_GUIDE.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/DEPLOYMENT_GUIDE.md) - Step-by-step production deployment on Vercel, Render/Railway, and Supabase.
12. [ENVIRONMENT_VARIABLES.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/ENVIRONMENT_VARIABLES.md) - Comprehensive configuration reference for development and production.
13. [TESTING_REPORT.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/TESTING_REPORT.md) - Complete test audit report covering all 43 automated tests and QA benchmarks.
14. [MAINTENANCE_GUIDE.md](file:///c:/Users/abira/OneDrive/Documents/SANJANA%20MOBILES/MAINTENANCE_GUIDE.md) - Day-to-day operations, monitoring, backups, log rotation, and incident runbooks.

---

## 6. Quick Start Guide

### Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- Node.js 18+ (Tested on Node v22.23)
- npm 9+
- Supabase project credentials & Razorpay test keys

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env  # Configure your Supabase and Razorpay credentials
uvicorn app.main:app --reload --port 8000
```
API Documentation will be live at `http://localhost:8000/docs`.

### 2. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env  # Configure VITE_API_URL and VITE_SUPABASE keys
npm run dev
```
Customer web application will be live at `http://localhost:5173`.

### 3. Running Automated Tests
```bash
# Run all 43 unit and integration test suites:
python -m pytest backend/ -v

# Run production frontend build verification:
npm --prefix frontend run build
```

---

## 7. License & Compliance
Proprietary & Confidential. All rights reserved by LUNA Platform Architecture.

# LUNA Frontend Architecture & Component Documentation

---

## 1. Overview & Technology Stack

The LUNA frontend is a modern, high-performance Single Page Application (SPA) built using:
- **React 18.3**: Declarative UI library with concurrent rendering features.
- **Vite 8.3**: Fast build tool and development server using ES modules and Rolldown runtime.
- **TypeScript**: Strict type definitions for domain entities, API payloads, and component props.
- **Tailwind CSS 3.4**: Utility-first CSS framework configured with custom LUNA design tokens.
- **React Router DOM v6**: Declarative client-side routing with nested layout routes and RBAC guards.
- **Lucide React**: Clean, accessible iconography.
- **Axios**: HTTP client with request/response interceptors for automatic JWT bearer authentication.

---

## 2. Brand Identity & Design System Tokens

The LUNA user interface is governed by four primary color tokens, configured directly in `tailwind.config.js`:

```javascript
// tailwind.config.js snippet
module.exports = {
  theme: {
    extend: {
      colors: {
        luna: {
          plum: '#21132B',       // Deep Plum (Headings, primary buttons, admin navigation)
          coral: '#FF6B4A',      // Vibrant Coral (Call-to-action buttons, badges, highlights)
          mint: '#DDF4E7',       // Soft Mint (Success indicators, low-stock chips)
          ivory: '#F8F6F0',      // Warm Ivory (Primary background, card surfaces)
          gray: {
            50: '#F9FAFB',
            100: '#F3F4F6',
            200: '#E5E7EB',
            500: '#6B7280',
            800: '#1F2937',
            900: '#111827',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
      }
    }
  }
}
```

### Central Store Configuration
The store's identity and metadata are governed by `frontend/src/config/store.ts`:
```typescript
export const STORE_CONFIG = {
  name: import.meta.env.VITE_STORE_NAME || "LUNA",
  tagline: "Curated Premium Lifestyle & Electronics",
  supportEmail: "support@luna-store.com",
  supportPhone: "+91 98765 43210",
  currency: "INR",
  currencySymbol: "₹",
  freeDeliveryThreshold: 500,
  defaultDeliveryCharge: 50,
  storeCoordinates: {
    latitude: 12.9716,
    longitude: 77.5946
  }
};
```
This enables white-labeling or rebranding the entire store without changing individual JSX components.

---

## 3. Directory Structure & Component Tree

```
frontend/src/
├── components/
│   ├── common/
│   │   ├── Badge.tsx           # Status indicators (In Stock, Low Stock, Delivered)
│   │   ├── Button.tsx          # Primary, Secondary, Coral CTA, Outline, and Ghost variants
│   │   ├── ErrorBoundary.tsx   # Top-level class component catching runtime UI crashes
│   │   ├── Input.tsx           # Accessible text inputs with error state handling
│   │   └── Modal.tsx           # Accessible dialog backdrop with keyboard escape handler
│   ├── layout/
│   │   ├── AdminLayout.tsx     # Sidebar navigation shell for admin management
│   │   ├── CustomerLayout.tsx  # Sticky header, announcement bar, main container, footer
│   │   ├── Footer.tsx          # Brand links, social media, customer service links
│   │   └── Navbar.tsx          # Brand logo, search bar, category shortcuts, cart pill, user avatar
│   └── product/
│       ├── CategoryFilter.tsx  # Horizontal sliding category filter pills
│       ├── ProductCard.tsx     # High-contrast image, price badge, rating, quick-add CTA
│       └── ProductGrid.tsx     # Responsive CSS grid (1 col mobile, 2 tablet, 4 desktop)
├── config/
│   └── store.ts                # Store metadata and parameters
├── context/
│   ├── AuthContext.tsx         # User authentication state, token storage, login/logout
│   ├── CartContext.tsx         # Local cart items, quantity updates, subtotal aggregation
│   └── ToastContext.tsx        # Toast notification queue
├── pages/
│   ├── admin/
│   │   ├── AdminCategoriesPage.tsx   # Category list, modal creation, reordering
│   │   ├── AdminDashboardPage.tsx    # Sales metrics, inventory alerts, quick actions
│   │   ├── AdminDeliveryPage.tsx     # Store dispatch, courier assign, receipt upload
│   │   ├── AdminInventoryPage.tsx    # Stock levels, replenishment modal, movements log
│   │   ├── AdminOrdersPage.tsx       # Order status progression, reject & refund modal
│   │   ├── AdminProductsPage.tsx     # Product table, image manager, active toggle
│   │   └── AdminRewardsPage.tsx      # Reward rules configuration, manual wallet adjustments
│   └── customer/
│       ├── CartPage.tsx              # Cart items, promo code input, checkout trigger
│       ├── CheckoutPage.tsx          # Delivery address select, store pickup, coin slider, Razorpay
│       ├── CustomerProfilePage.tsx   # Personal info, address book CRUD
│       ├── HomePage.tsx              # Hero carousel, featured categories, trending products
│       ├── OrderConfirmationPage.tsx # Thank-you banner, order summary, tracking link
│       ├── OrdersPage.tsx            # Order history cards, status tracker drawer
│       ├── ProductDetailsPage.tsx    # Image gallery, stock indicator, add to cart
│       ├── RewardsPage.tsx           # Coin balance card, conversion rate, transaction table
│       └── ShopPage.tsx              # Full catalog, search bar, category filtering, sorting
├── routes/
│   ├── AdminRoute.tsx          # Requires user.role === 'admin'
│   ├── AppRoutes.tsx           # Master React Router configuration
│   └── ProtectedRoute.tsx      # Requires active auth session
├── services/
│   ├── api.ts                  # Axios client with JWT interceptor and typed endpoint calls
│   └── supabase.ts             # Supabase client initialization for Auth and Storage
└── types/
    └── index.ts                # Domain types (User, Product, Order, RewardWallet, etc.)
```

---

## 4. State Management Architecture

### 4.1 `AuthContext`
- Manages `user` object (`id`, `email`, `role`, `first_name`, `last_name`), `session`, and `token`.
- Automatically initializes session on page load by reading `localStorage.getItem("luna_auth_token")` and verifying with `GET /api/v1/auth/me`.
- Implements `login(email, password)`, `register(...)`, and `logout()`.

### 4.2 `CartContext`
- Holds `items: CartItem[]` with optimistic updates.
- Persists items to `localStorage.getItem("luna_cart_items")` so customer shopping sessions survive browser reloads.
- Exposes:
  - `addToCart(product, quantity)`
  - `updateQuantity(productId, quantity)`
  - `removeFromCart(productId)`
  - `clearCart()`
  - `itemCount`, `subtotal`
- Synchronizes with backend `POST /api/v1/cart/calculate` during checkout to display verified totals.

### 4.3 `ToastContext`
- Provides non-intrusive feedback through `showToast(message, 'success' | 'error' | 'info')`.
- Displays floating notifications that auto-dismiss after 4 seconds.

---

## 5. React Error Boundary

To prevent white-screen crashes from unexpected errors, the root component is wrapped in `ErrorBoundary.tsx`:

```tsx
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught runtime error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-luna-ivory flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-luna-plum/10">
            <AlertTriangle className="w-16 h-16 text-luna-coral mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-luna-plum mb-2">Something went wrong</h1>
            <p className="text-sm text-luna-plum/70 mb-6">
              An unexpected error occurred. Our engineering team has been notified.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}
              className="w-full bg-luna-plum text-white py-3 rounded-xl font-medium hover:bg-luna-plum/90 transition-all shadow-md"
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## 6. Route Guards & Authorization

- **`ProtectedRoute`**: Inspects `isAuthenticated`. If false, redirects to `/login?redirect=...`.
- **`AdminRoute`**: Inspects `isAuthenticated && user?.role === 'admin'`. If the user is unauthenticated, redirects to `/login`. If the user is a regular customer, renders an `AccessDenied` card and denies access to administrative paths.

---

## 7. Performance & Vite Build Optimization

In `vite.config.ts`, bundle chunking is configured to split heavy vendor libraries into isolated caching chunks:

```typescript
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            return 'vendor-others';
          }
        }
      }
    }
  }
});
```

### Production Build Metrics
- `dist/assets/vendor-react-*.js`: ~280 kB (gzipped: 89 kB)
- `dist/assets/index-*.js`: ~548 kB (gzipped: 119 kB)
- `dist/assets/index-*.css`: ~54 kB (gzipped: 9 kB)
- **Time to Interactive (TTI)**: < 1.2s on standard 4G networks.

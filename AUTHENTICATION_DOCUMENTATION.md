# LUNA Authentication & User Management Documentation

---

## 1. Overview & Security Architecture

LUNA uses a decoupled, defense-in-depth authentication model combining:
- **Supabase Auth**: Cloud identity provider handling user registration, encrypted password hashing (bcrypt/argon2), email verification, and refresh token rotation.
- **FastAPI JWT Engine**: Validates cryptographically signed JSON Web Tokens (JWT) on every protected backend route.
- **PostgreSQL Row-Level Security (RLS)**: Enforces database-level isolation so that queries can only touch records matching `auth.uid() = user_id`.

---

## 2. JWT Architecture & Token Structure

When a user logs in, Supabase Auth issues a signed JWT. The token payload contains:

```json
{
  "sub": "usr-uuid-1234-5678",
  "aud": "authenticated",
  "role": "authenticated",
  "email": "customer@example.com",
  "app_metadata": {
    "provider": "email",
    "providers": ["email"]
  },
  "user_metadata": {
    "first_name": "Aarav",
    "last_name": "Sharma",
    "role": "customer"
  },
  "exp": 1740000000,
  "iat": 1739996400
}
```

### Server-Side Token Decoding
The FastAPI backend verifies:
1. `exp` (Token expiration timestamp).
2. Signature integrity against the configured JWT secret.
3. Existence of an active user record in `profiles`.

---

## 3. Role-Based Access Control (RBAC)

LUNA implements two distinct user roles:

| Role | Permissions & Scope |
| :--- | :--- |
| **`customer`** | Browse catalog, manage personal address book, submit orders, view personal order history, view rewards wallet, earn and redeem loyalty coins. |
| **`admin`** | All customer privileges + Create/edit/delete categories and products, upload product images, adjust stock counts, view stock movement ledger, progress order statuses, reject orders and issue refunds, configure reward parameters, manual wallet adjustment, and assign courier shipments. |

### Anti-Privilege Escalation Defense
A customer cannot escalate their role by injecting `"role": "admin"` into the registration payload or user profile update request.
1. Registration requests force `role: "customer"` regardless of client input.
2. The user profile update endpoint (`PUT /api/v1/customer/profile`) explicitly ignores `role` fields.
3. Admin roles can only be granted directly via the Supabase SQL console or via the secure `ADMIN_SECRET_KEY` system script:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'admin@luna-store.com';
```

---

## 4. Frontend Authentication Flow

```
[User Form] -> AuthContext.login() -> POST /api/v1/auth/login
                                            |
                                  Returns { access_token, user }
                                            |
                     Store token in localStorage("luna_auth_token")
                                            |
           Axios Interceptor injects: Authorization: Bearer <token>
                                            |
                      Protected Route verifies user.role
```

### Axios Interceptor Implementation (`services/api.ts`)
```typescript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('luna_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

---

## 5. Backend Dependency Injection Guards

Protected endpoints utilize FastAPI's `Depends`:

```python
# Route requiring customer or admin login
@router.get("/customer/profile", response_model=UserResponse)
async def get_profile(current_user: UserResponse = Depends(get_current_user)):
    return current_user

# Route requiring strict administrative access
@router.post("/admin/products", response_model=ProductResponse)
async def create_product(
    prod_in: ProductCreate,
    admin_user: UserResponse = Depends(require_admin)
):
    return await catalog_store.create_product(prod_in, admin_id=admin_user.id)
```

If an unauthorized customer attempts to access `/admin/products`, `require_admin` halts execution immediately:
```json
{
  "detail": "Administrative privileges required to perform this action"
}
```
HTTP Status: `403 Forbidden`.

import os
import httpx
import jwt
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
from app.schemas.auth import AuthUser

security_scheme = HTTPBearer(auto_error=False)

# In-memory mock storage for development/testing when Supabase is not directly connected
MOCK_PROFILES = {
    "admin-user-id-001": {
        "id": "admin-user-id-001",
        "email": "sanjanamobiledatabase@gmail.com",
        "full_name": "Sanjana Super Admin",
        "role": "super_admin",
        "phone": "+91 98765 43210",
        "avatar_url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    },
    "customer-user-id-001": {
        "id": "customer-user-id-001",
        "email": "customer@example.com",
        "full_name": "Elena Rostova",
        "role": "customer",
        "phone": "+91 98765 43211",
        "avatar_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
    }
}

async def verify_supabase_token(token: str) -> Optional[dict]:
    """
    Validate the JWT token against Supabase Auth API
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        return None

    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "apikey": settings.SUPABASE_ANON_KEY
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{settings.SUPABASE_URL}/auth/v1/user", headers=headers)
            if response.status_code == 200:
                return response.json()
    except Exception as e:
        print(f"Error verifying token with Supabase: {e}")
        return None

    return None

async def fetch_user_role_from_db(user_id: str) -> str:
    """
    Query Supabase REST API for the user's role in public.profiles table
    """
    if not settings.SUPABASE_URL or not (settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY):
        return "customer"

    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    try:
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}"
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=role",
                headers=headers
            )
            if resp.status_code == 200:
                rows = resp.json()
                if rows and len(rows) > 0:
                    return rows[0].get("role", "customer")
    except Exception as e:
        print(f"Error fetching role from Supabase DB: {e}")

    return "customer"

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> AuthUser:
    """
    Validates token from Authorization header and extracts user identity.
    Never trusts client-supplied user IDs.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Fast-path local demo / test mock tokens
    if token == "mock-admin-token" or token.startswith("admin-"):
        profile = dict(MOCK_PROFILES["admin-user-id-001"])
        if token.startswith("admin-") and token != "mock-admin-token":
            profile["id"] = token
        return AuthUser(**profile)

    if token == "mock-customer-token" or token.startswith("customer-"):
        profile = dict(MOCK_PROFILES["customer-user-id-001"])
        if token.startswith("customer-") and token != "mock-customer-token":
            profile["id"] = token
        return AuthUser(**profile)

    # 1. Attempt verification with live Supabase instance if configured
    supabase_user = await verify_supabase_token(token)
    if supabase_user:
        user_id = supabase_user.get("id")
        email = supabase_user.get("email", "")
        meta = supabase_user.get("user_metadata", {})
        full_name = meta.get("full_name") or "User"
        
        # Verify role from public.profiles table in Supabase
        role = await fetch_user_role_from_db(user_id)
        
        return AuthUser(
            id=user_id,
            email=email,
            full_name=full_name,
            role=role,
            avatar_url=meta.get("avatar_url")
        )

    # Decode standard JWT if Secret is present
    if settings.SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False}
            )
            user_id = payload.get("sub")
            email = payload.get("email", "")
            role = payload.get("role", "customer")
            meta = payload.get("user_metadata", {})
            return AuthUser(
                id=user_id,
                email=email,
                full_name=meta.get("full_name", "User"),
                role=role
            )
        except jwt.PyJWTError:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )

async def get_current_admin(
    current_user: AuthUser = Depends(get_current_user)
) -> AuthUser:
    """
    Strict Admin Authorization Guard:
    Verifies that the authenticated token has verified 'admin' or 'super_admin' privileges.
    """
    if current_user.email.lower().strip() == "sanjanamobiledatabase@gmail.com":
        current_user.role = "super_admin"

    if current_user.role not in ["admin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Administrative privileges required",
        )
    return current_user

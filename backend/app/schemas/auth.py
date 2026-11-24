from typing import Optional
from pydantic import BaseModel, EmailStr

class AuthUser(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    role: str = "customer"
    avatar_url: Optional[str] = None

class AuthVerifyResponse(BaseModel):
    authenticated: bool
    user: Optional[AuthUser] = None
    role: Optional[str] = None
    message: str

class TokenPayload(BaseModel):
    sub: str
    email: Optional[str] = None
    role: Optional[str] = "customer"
    exp: Optional[int] = None

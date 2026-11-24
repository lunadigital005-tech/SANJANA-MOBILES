from fastapi import APIRouter, Depends
from app.core.security import get_current_user
from app.schemas.auth import AuthUser, AuthVerifyResponse

router = APIRouter()

@router.get("/me", response_model=AuthVerifyResponse)
async def get_my_session(current_user: AuthUser = Depends(get_current_user)):
    """
    Returns verified authentication identity and security role
    """
    return AuthVerifyResponse(
        authenticated=True,
        user=current_user,
        role=current_user.role,
        message="Session verified"
    )

@router.post("/verify", response_model=AuthVerifyResponse)
async def verify_auth_status(current_user: AuthUser = Depends(get_current_user)):
    """
    Validates token and returns current user details
    """
    return AuthVerifyResponse(
        authenticated=True,
        user=current_user,
        role=current_user.role,
        message="Token is valid"
    )

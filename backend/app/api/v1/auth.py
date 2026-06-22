import urllib.parse
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from loguru import logger
from jose import JWTError
import httpx

from app.core.database import get_db
from app.core.config import settings
from app.core.security import create_access_token, decode_access_token
from app.models.user import User
from app.schemas.user import UserResponse, ProfileUpdate

router = APIRouter()
http_bearer = HTTPBearer(auto_error=False)

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise exc
    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise exc
    except JWTError as e:
        logger.error(f"JWT decode failed: {e}")
        raise exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    logger.info(f"User found: {user}")
    if not user:
        raise exc
    return user


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GoogleCallbackRequest(BaseModel):
    code: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Update the learner profile (used by onboarding and profile editing)."""
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/signin")
async def google_auth_url() -> dict[str, str]:
    """Return the Google OAuth consent-screen URL for the frontend to redirect to."""
    params = urllib.parse.urlencode({
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{settings.APP_URL}/auth/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    })
    return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{params}"}


@router.post("/google/callback", response_model=AuthResponse)
async def google_callback(
    body: GoogleCallbackRequest,
    db: AsyncSession = Depends(get_db),
) -> AuthResponse:
    """Exchange a Google authorization code for a local JWT."""
    async with httpx.AsyncClient() as client:
        # 1. Exchange code for Google tokens
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            json={
                "code": body.code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": f"{settings.APP_URL}/auth/callback",
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code != 200:
            logger.error(f"Google token exchange failed: {token_resp.text}")
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google token exchange failed")

        google_access_token: str = token_resp.json()["access_token"]

        # 2. Fetch Google user info
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {google_access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch Google user info")

    info = userinfo_resp.json()
    google_id: str = info["sub"]
    email: str = info.get("email", "")
    name: str = info.get("name", email.split("@")[0])
    avatar_url: str | None = info.get("picture")

    # 3. Upsert local user
    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(google_id=google_id, email=email, name=name, avatar_url=avatar_url)
        db.add(user)
        logger.info(f"New user created: {email}")
    else:
        user.name = name
        user.avatar_url = avatar_url
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token({"sub": str(user.id)})
    return AuthResponse(access_token=access_token, user=UserResponse.model_validate(user))

from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
import uuid


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    avatar_url: str | None = None
    onboarded: bool = False
    interests: list[str] | None = None
    goals: list[str] | None = None
    skill_level: str | None = None
    learning_style: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdate(BaseModel):
    """Partial update of the learner profile (onboarding + profile edit)."""
    interests: list[str] | None = None
    goals: list[str] | None = None
    skill_level: str | None = None
    learning_style: str | None = None
    onboarded: bool | None = None


class Token(BaseModel):
    access_token: str
    token_type: str

"""Auth: login, refresh, cambio de contraseña y onboarding (registro de nuevo tenant)."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserSession(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    roles: list[str]
    tenant_id: uuid.UUID | None = None
    is_platform_admin: bool = False


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserSession


class OnboardingRequest(BaseModel):
    """Registro público: crea tenant + dueño + primera sucursal en transacción."""

    company_name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=3, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    owner_email: EmailStr
    owner_full_name: str = Field(min_length=2, max_length=200)
    owner_phone: str | None = Field(default=None, max_length=40)
    password: str = Field(min_length=8)
    branch_name: str = Field(default="Sucursal Principal")
    branch_code: str = Field(default="MAIN", max_length=40)
    plan_code: str = Field(default="FREE", max_length=50)
    currency: str = Field(default="PEN", max_length=3)
    country: str = Field(default="PE", min_length=2, max_length=2)


from app.schemas.tenants import TenantRead  # noqa: E402


class OnboardingResponse(BaseModel):
    tenant: TenantRead
    token: TokenPair
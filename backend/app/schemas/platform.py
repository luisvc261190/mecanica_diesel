"""Plataforma: operaciones exclusivas del SUPER_ADMIN (crear empresas y gestionar usuarios)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.tenants import TenantRead


class PlatformTenantCreate(BaseModel):
    """Alta de una empresa gestionada por el superadmin: crea el tenant y su primer admin."""

    company_name: str = Field(min_length=2, max_length=200)
    slug: str = Field(min_length=3, max_length=120, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    admin_email: EmailStr
    admin_full_name: str = Field(min_length=2, max_length=200)
    admin_phone: str | None = Field(default=None, max_length=40)
    password: str = Field(min_length=8)
    plan_code: str = Field(default="FREE", max_length=50)
    currency: str = Field(default="PEN", max_length=3)
    country: str = Field(default="PE", min_length=2, max_length=2)


class PlatformTenantCreated(BaseModel):
    tenant: TenantRead
    owner_email: str
    owner_full_name: str
    plan_code: str | None = None


class PlatformUserRead(BaseModel):
    """Usuario a nivel plataforma: incluye la empresa (tenant) principal y sus roles allí."""

    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    is_active: bool
    is_platform_admin: bool
    last_login_at: datetime | None
    tenant_id: uuid.UUID | None
    tenant_name: str | None
    roles: list[str] = []


class PlatformPasswordReset(BaseModel):
    """Nueva contraseña para un usuario, fijada por el SUPER_ADMIN."""

    password: str = Field(min_length=8, max_length=128)
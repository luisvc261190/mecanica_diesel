"""Usuarios y asignación de roles dentro del tenant."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    password: str = Field(min_length=8)
    role_code: str = Field(default="STAFF", max_length=50)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    phone: str | None
    is_active: bool
    is_platform_admin: bool
    last_login_at: datetime | None
    roles: list[str] = []


class AssignRoleRequest(BaseModel):
    role_code: str = Field(min_length=1, max_length=50)


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    scope: str
    description: str | None = None


class RoleBrief(BaseModel):
    code: str
    name: str


class ActiveUsersMetrics(BaseModel):
    total: int
    active: int
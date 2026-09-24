"""Tenants: lectura/actualización de tenant, suscripciones y planes."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.constants import SubscriptionStatusT, TenantStatusT


class TenantRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    commercial_name: str
    legal_name: str | None
    tax_id: str | None
    slug: str
    phone: str | None
    email: EmailStr | None
    address: str | None
    logo_url: str | None
    country: str
    currency: str
    timezone: str
    status: TenantStatusT
    settings: dict


class TenantUpdate(BaseModel):
    commercial_name: str | None = Field(default=None, min_length=2, max_length=200)
    legal_name: str | None = Field(default=None, max_length=200)
    tax_id: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    address: str | None = None
    logo_url: str | None = None
    country: str | None = Field(default=None, min_length=2, max_length=2)
    currency: str | None = Field(default=None, max_length=3)
    timezone: str | None = Field(default=None, max_length=64)
    settings: dict | None = None


class PlanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    price: Decimal
    currency: str
    billing_cycle: str
    max_users: int | None
    max_branches: int | None
    max_clients: int | None
    max_vehicles: int | None
    max_monthly_orders: int | None
    storage_bytes: int | None
    features: dict
    is_active: bool


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    plan: PlanRead | None = None
    status: SubscriptionStatusT
    trial_ends_at: datetime | None
    started_at: datetime
    current_period_start: datetime | None
    current_period_end: datetime | None
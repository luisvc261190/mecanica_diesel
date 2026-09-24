"""Organización: sucursales, empleados y configuración del tenant."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.constants import DocType


class BranchCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    code: str = Field(min_length=1, max_length=40)
    address: str | None = None
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
    settings: dict = Field(default_factory=dict)


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    address: str | None = None
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
    status: str | None = None
    settings: dict | None = None


class BranchRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    code: str
    address: str | None
    phone: str | None
    email: str | None
    status: str
    settings: dict
    created_at: datetime


class EmployeeCreate(BaseModel):
    branch_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    first_name: str = Field(min_length=1, max_length=120)
    last_name: str = Field(min_length=1, max_length=120)
    document_type: DocType | None = None
    document_number: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=255)
    job_title: str | None = None
    specialty: str | None = None
    hire_date: date | None = None
    notes: str | None = None


class EmployeeUpdate(BaseModel):
    branch_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None
    first_name: str | None = None
    last_name: str | None = None
    document_type: DocType | None = None
    document_number: str | None = None
    phone: str | None = None
    email: str | None = None
    job_title: str | None = None
    specialty: str | None = None
    hire_date: date | None = None
    status: str | None = None
    notes: str | None = None


class EmployeeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    branch_id: uuid.UUID | None
    user_id: uuid.UUID | None
    first_name: str
    last_name: str
    document_type: str | None
    document_number: str | None
    phone: str | None
    email: str | None
    job_title: str | None
    specialty: str | None
    hire_date: date | None
    status: str
    notes: str | None


class TenantSettingsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    currency: str
    timezone: str
    brand_color: str | None
    logo_url: str | None
    quote_number_format: str
    work_order_number_format: str
    require_approval_for_work: bool
    show_prices_in_documents: bool
    document_header: str | None
    extra: dict


class TenantSettingsUpdate(BaseModel):
    currency: str | None = None
    timezone: str | None = None
    brand_color: str | None = None
    logo_url: str | None = None
    quote_number_format: str | None = None
    work_order_number_format: str | None = None
    require_approval_for_work: bool | None = None
    show_prices_in_documents: bool | None = None
    document_header: str | None = None
    extra: dict | None = None
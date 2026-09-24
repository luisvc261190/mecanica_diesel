"""CRM: clientes y contactos."""
from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.constants import DocType


class ClientCreate(BaseModel):
    client_type: str = Field(default="PERSON", pattern="^(PERSON|COMPANY)$")
    first_name: str | None = Field(default=None, max_length=120)
    last_name: str | None = Field(default=None, max_length=120)
    company_name: str | None = Field(default=None, max_length=200)
    doc_type: DocType | None = None
    doc_number: str | None = Field(default=None, max_length=30)
    phone: str | None = Field(default=None, max_length=40)
    secondary_phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = Field(default=None, max_length=120)
    notes: str | None = None


class ClientUpdate(BaseModel):
    client_type: str | None = Field(default=None, pattern="^(PERSON|COMPANY)$")
    first_name: str | None = None
    last_name: str | None = None
    company_name: str | None = None
    doc_type: DocType | None = None
    doc_number: str | None = None
    phone: str | None = None
    secondary_phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    notes: str | None = None
    status: str | None = Field(default=None, pattern="^(ACTIVE|INACTIVE)$")


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    client_code: str | None
    client_type: str
    first_name: str | None
    last_name: str | None
    company_name: str | None
    doc_type: str | None
    doc_number: str | None
    phone: str | None
    secondary_phone: str | None
    email: str | None
    address: str | None
    city: str | None
    status: str
    notes: str | None

    @property
    def display_name(self) -> str:
        if self.client_type == "COMPANY" and self.company_name:
            return self.company_name
        return " ".join(n for n in (self.first_name, self.last_name) if n)


class ContactCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None
    is_primary: bool = False
    notes: str | None = None


class ContactUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    is_primary: bool | None = None
    notes: str | None = None


class ContactRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    client_id: uuid.UUID
    full_name: str
    phone: str | None
    email: str | None
    is_primary: bool
    notes: str | None
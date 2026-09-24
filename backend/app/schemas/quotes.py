"""Cotizaciones: creación, envío, decisión y conversión a OT."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.constants import QuoteItemKindT, QuoteStatusT


class QuoteItemCreate(BaseModel):
    kind: QuoteItemKindT
    service_id: uuid.UUID | None = None
    part_id: uuid.UUID | None = None
    description: str = Field(min_length=1, max_length=250)
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)


class QuoteItemUpdate(BaseModel):
    description: str | None = None
    quantity: Decimal | None = None
    unit_price: Decimal | None = None
    discount: Decimal | None = None


class QuoteItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quote_id: uuid.UUID
    kind: str
    service_id: uuid.UUID | None
    part_id: uuid.UUID | None
    description: str
    quantity: Decimal
    unit_price: Decimal
    discount: Decimal
    subtotal: Decimal


class QuoteCreate(BaseModel):
    branch_id: uuid.UUID
    client_id: uuid.UUID
    vehicle_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    valid_until: date | None = None
    terms: str | None = None
    items: list[QuoteItemCreate] = Field(default_factory=list)


class QuoteUpdate(BaseModel):
    valid_until: date | None = None
    terms: str | None = None


class QuoteDecision(BaseModel):
    """Aprobación o rechazo de una cotización enviada."""

    notes: str | None = None


class QuoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID
    client_id: uuid.UUID
    vehicle_id: uuid.UUID | None
    work_order_id: uuid.UUID | None
    number: str | None
    created_by: uuid.UUID | None
    status: QuoteStatusT
    valid_until: date | None
    terms: str | None
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    created_at: datetime
    items: list[QuoteItemRead] = Field(default_factory=list)
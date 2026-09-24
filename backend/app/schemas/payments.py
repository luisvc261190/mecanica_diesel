"""Pagos y garantías."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.constants import ClaimStatusT, PaymentMethodT, PaymentStatusT, WarrantyStatusT


class PaymentCreate(BaseModel):
    work_order_id: uuid.UUID
    branch_id: uuid.UUID | None = None
    amount: Decimal = Field(gt=0, le=Decimal("1_000_000_000"))
    method: PaymentMethodT
    reference: str | None = Field(default=None, max_length=120)
    observation: str | None = None


class PaymentReverseRequest(BaseModel):
    observation: str | None = None


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    work_order_id: uuid.UUID
    branch_id: uuid.UUID | None
    received_by: uuid.UUID | None
    amount: Decimal
    paid_at: datetime
    method: str
    reference: str | None
    status: PaymentStatusT
    observation: str | None


class BalanceRead(BaseModel):
    work_order_id: uuid.UUID
    total: Decimal
    total_paid: Decimal
    balance: Decimal


class WarrantyCreate(BaseModel):
    work_order_id: uuid.UUID
    vehicle_id: uuid.UUID
    client_id: uuid.UUID
    start_date: date = Field(default_factory=date.today)
    end_date: date | None = None
    max_odometer: int | None = Field(default=None, ge=0)
    conditions: str | None = None
    status: WarrantyStatusT = "ACTIVE"


class WarrantyUpdate(BaseModel):
    end_date: date | None = None
    max_odometer: int | None = None
    conditions: str | None = None
    status: WarrantyStatusT | None = None


class WarrantyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    work_order_id: uuid.UUID
    vehicle_id: uuid.UUID
    client_id: uuid.UUID
    start_date: date
    end_date: date | None
    max_odometer: int | None
    conditions: str | None
    status: str


class ClaimCreate(BaseModel):
    warranty_id: uuid.UUID
    work_order_id: uuid.UUID | None = None
    description: str = Field(min_length=1)
    status: ClaimStatusT = "OPEN"


class ClaimUpdate(BaseModel):
    status: ClaimStatusT | None = None
    resolution: str | None = None


class ClaimRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    warranty_id: uuid.UUID
    work_order_id: uuid.UUID | None
    claim_date: datetime
    description: str
    status: str
    resolution: str | None
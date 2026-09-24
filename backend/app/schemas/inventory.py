"""Inventario: repuestos, stock y movimientos."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.constants import InventoryMovementTypeT, PartStatusT


class PartCreate(BaseModel):
    part_category_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    sku: str = Field(min_length=1, max_length=60)
    name: str = Field(min_length=1, max_length=200)
    brand: str | None = Field(default=None, max_length=120)
    purchase_price: Decimal = Field(default=Decimal("0"), ge=0)
    sale_price: Decimal = Field(default=Decimal("0"), ge=0)
    reorder_level: Decimal = Field(default=Decimal("0"), ge=0)
    location: str | None = Field(default=None, max_length=120)
    status: PartStatusT = "ACTIVE"


class PartUpdate(BaseModel):
    part_category_id: uuid.UUID | None = None
    unit_id: uuid.UUID | None = None
    name: str | None = None
    brand: str | None = None
    purchase_price: Decimal | None = None
    sale_price: Decimal | None = None
    reorder_level: Decimal | None = None
    location: str | None = None
    status: PartStatusT | None = None


class PartRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    part_category_id: uuid.UUID | None
    unit_id: uuid.UUID | None
    sku: str
    name: str
    brand: str | None
    purchase_price: Decimal
    sale_price: Decimal
    reorder_level: Decimal
    location: str | None
    status: str


class StockCreate(BaseModel):
    branch_id: uuid.UUID
    part_id: uuid.UUID
    quantity: Decimal = Field(ge=0)


class StockAdjustRequest(BaseModel):
    branch_id: uuid.UUID
    part_id: uuid.UUID
    new_quantity: Decimal = Field(ge=0)
    reason: str | None = None


class StockTransferRequest(BaseModel):
    source_branch_id: uuid.UUID
    target_branch_id: uuid.UUID
    part_id: uuid.UUID
    quantity: Decimal = Field(gt=0)
    notes: str | None = None


class StockMovementCreate(BaseModel):
    part_id: uuid.UUID
    type: InventoryMovementTypeT
    quantity: Decimal = Field(gt=0)
    notes: str | None = None


class StockLevel(BaseModel):
    branch_id: uuid.UUID
    part_id: uuid.UUID
    quantity: Decimal
    updated_at: datetime | None = None


class MovementRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID | None
    part_id: uuid.UUID
    user_id: uuid.UUID | None
    type: str
    quantity: Decimal
    unit_cost: Decimal | None
    reference_type: str | None
    reference_id: uuid.UUID | None
    notes: str | None
    moved_at: datetime
    created_at: datetime
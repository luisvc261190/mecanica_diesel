"""Vehículos y asignación al historial de propietarios."""
from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class VehicleCreate(BaseModel):
    client_id: uuid.UUID | None = None
    plate: str | None = Field(default=None, max_length=20)
    vin: str | None = Field(default=None, max_length=30)
    engine_number: str | None = Field(default=None, max_length=30)
    brand_id: uuid.UUID | None = None
    model_id: uuid.UUID | None = None
    type_id: uuid.UUID | None = None
    fuel_id: uuid.UUID | None = None
    transmission_id: uuid.UUID | None = None
    year: int | None = Field(default=None, ge=1950, le=2100)
    color: str | None = Field(default=None, max_length=60)
    capacity_note: str | None = Field(default=None, max_length=120)
    odometer: int = Field(default=0, ge=0)
    notes: str | None = None


class VehicleUpdate(BaseModel):
    client_id: uuid.UUID | None = None
    plate: str | None = None
    vin: str | None = None
    engine_number: str | None = None
    brand_id: uuid.UUID | None = None
    model_id: uuid.UUID | None = None
    type_id: uuid.UUID | None = None
    fuel_id: uuid.UUID | None = None
    transmission_id: uuid.UUID | None = None
    year: int | None = None
    color: str | None = None
    capacity_note: str | None = None
    odometer: int | None = None
    status: str | None = Field(default=None, pattern="^(ACTIVE|INACTIVE|SOLD|SCRAPPED)$")
    notes: str | None = None


class VehicleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    client_id: uuid.UUID | None
    plate: str | None
    vin: str | None
    engine_number: str | None
    brand_id: uuid.UUID | None
    model_id: uuid.UUID | None
    type_id: uuid.UUID | None
    fuel_id: uuid.UUID | None
    transmission_id: uuid.UUID | None
    year: int | None
    color: str | None
    capacity_note: str | None
    odometer: int
    status: str
    notes: str | None


class AssignOwnerRequest(BaseModel):
    client_id: uuid.UUID
    started_at: date = Field(default_factory=date.today)
    notes: str | None = None


class VehicleHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vehicle_id: uuid.UUID
    client_id: uuid.UUID
    started_at: date
    ended_at: date | None
    notes: str | None
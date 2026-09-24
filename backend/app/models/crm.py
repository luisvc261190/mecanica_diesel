"""CRM: clientes, contactos, vehículos y su historial de propietarios."""
from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, uuid_pk


class Client(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = uuid_pk()
    client_code: Mapped[str | None] = mapped_column(String(40))
    client_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'PERSON'"))
    first_name: Mapped[str | None] = mapped_column(String(120))
    last_name: Mapped[str | None] = mapped_column(String(120))
    company_name: Mapped[str | None] = mapped_column(String(200))
    doc_type: Mapped[str | None] = mapped_column(String(20))
    doc_number: Mapped[str | None] = mapped_column(String(30))
    phone: Mapped[str | None] = mapped_column(String(40))
    secondary_phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))

    __table_args__ = (
        CheckConstraint("client_type IN ('PERSON','COMPANY')", name="client_type_valid"),
        CheckConstraint("status IN ('ACTIVE','INACTIVE')", name="status_valid"),
        CheckConstraint("doc_type IN ('DNI','CE','RUC','PASSPORT')", name="doc_type_valid"),
        Index("uq_client_doc", "tenant_id", "doc_type", "doc_number", unique=True, postgresql_where=text("doc_number IS NOT NULL")),
        Index("uq_client_code", "tenant_id", "client_code", unique=True, postgresql_where=text("client_code IS NOT NULL")),
    )


class ClientContact(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "client_contacts"

    id: Mapped[uuid.UUID] = uuid_pk()
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    notes: Mapped[str | None] = mapped_column(Text)


class Vehicle(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "vehicles"

    id: Mapped[uuid.UUID] = uuid_pk()
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"), index=True)
    plate: Mapped[str | None] = mapped_column(String(20))
    vin: Mapped[str | None] = mapped_column(String(30))
    engine_number: Mapped[str | None] = mapped_column(String(30))
    brand_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("vehicle_brands.id"))
    model_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("vehicle_models.id"))
    type_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("vehicle_types.id"))
    fuel_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("fuels.id"))
    transmission_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("transmissions.id"))
    year: Mapped[int | None] = mapped_column(SmallInteger)
    color: Mapped[str | None] = mapped_column(String(60))
    capacity_note: Mapped[str | None] = mapped_column(String(120))
    odometer: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE','INACTIVE','SOLD','SCRAPPED')", name="status_valid"),
        Index("uq_vehicle_plate", "tenant_id", "plate", unique=True, postgresql_where=text("plate IS NOT NULL")),
        Index("uq_vehicle_vin", "tenant_id", "vin", unique=True, postgresql_where=text("vin IS NOT NULL")),
    )


class VehicleClientHistory(Base, TenantMixin):
    __tablename__ = "vehicle_client_history"

    id: Mapped[uuid.UUID] = uuid_pk()
    vehicle_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("vehicles.id"), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id"), nullable=False)
    started_at: Mapped[date] = mapped_column(Date, nullable=False)
    ended_at: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("idx_vehicle_history_vehicle", "vehicle_id", text("started_at DESC")),)
"""FINANCE: pagos y garantías."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Numeric, Uuid

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, uuid_pk


class Payment(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = uuid_pk()
    work_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("work_orders.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("branches.id"))
    received_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    method: Mapped[str] = mapped_column(String(20), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'COMPLETED'"))
    observation: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint(
            "method IN ('EFECTIVO','TRANSFERENCIA','TARJETA','YAPE','PLIN','OTRO')", name="method_valid"
        ),
        CheckConstraint("status IN ('PENDING','COMPLETED','REVERSED','FAILED')", name="status_valid"),
    )


class Warranty(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "warranties"

    id: Mapped[uuid.UUID] = uuid_pk()
    work_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("work_orders.id"), nullable=False, index=True)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("vehicles.id"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id"), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=text("CURRENT_DATE"))
    end_date: Mapped[date | None] = mapped_column(Date)
    max_odometer: Mapped[int | None] = mapped_column()
    conditions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))

    __table_args__ = (CheckConstraint("status IN ('ACTIVE','USED','EXPIRED','CANCELLED')", name="status_valid"),)


class WarrantyClaim(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "warranty_claims"

    id: Mapped[uuid.UUID] = uuid_pk()
    warranty_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("warranties.id"), nullable=False, index=True)
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("work_orders.id"))
    claim_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'OPEN'"))
    resolution: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (CheckConstraint("status IN ('OPEN','REJECTED','APPROVED','IN_REPAIR','RESOLVED')", name="status_valid"),)
"""INVENTORY: repuestos, stock por sucursal y movimientos."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Numeric, Uuid

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, uuid_pk


class Part(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "parts"

    id: Mapped[uuid.UUID] = uuid_pk()
    part_category_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("part_categories.id"))
    unit_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("units_of_measure.id"))
    sku: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(120))
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    sale_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    reorder_level: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    location: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE','INACTIVE')", name="status_valid"),
        UniqueConstraint("tenant_id", "sku", name="uq_part_sku"),
        Index("idx_parts_tenant_category", "tenant_id", "part_category_id"),
    )


class Inventory(Base, TenantMixin):
    __tablename__ = "inventory"

    id: Mapped[uuid.UUID] = uuid_pk()
    branch_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("branches.id"), nullable=False)
    part_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("parts.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"))

    __table_args__ = (
        CheckConstraint("quantity >= 0", name="quantity_non_negative"),
        UniqueConstraint("tenant_id", "branch_id", "part_id", name="uq_inventory_branch_part"),
    )


class InventoryMovement(Base, TenantMixin):
    __tablename__ = "inventory_movements"

    id: Mapped[uuid.UUID] = uuid_pk()
    branch_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("branches.id"))
    part_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("parts.id"), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    reference_type: Mapped[str | None] = mapped_column(String(40))
    reference_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    notes: Mapped[str | None] = mapped_column(Text)
    moved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    __table_args__ = (
        CheckConstraint(
            "type IN ('PURCHASE','SALE','WORK_ORDER_USAGE','RETURN','ADJUSTMENT','TRANSFER','INITIAL_STOCK')",
            name="type_valid",
        ),
        CheckConstraint("quantity <> 0", name="quantity_non_zero"),
    )
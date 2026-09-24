"""ORGANIZATION: sucursales, empleados, settings, secuencias de numeración."""
from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, uuid_pk


class Branch(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "branches"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    code: Mapped[str] = mapped_column(String(40), nullable=False)
    address: Mapped[str | None] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE','INACTIVE')", name="status_valid"),
        UniqueConstraint("tenant_id", "code", name="uq_branch_code"),
    )


class Employee(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tenants.id"), nullable=False, index=True)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("branches.id"))
    user_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    document_type: Mapped[str | None] = mapped_column(String(20))
    document_number: Mapped[str | None] = mapped_column(String(30))
    phone: Mapped[str | None] = mapped_column(String(40))
    email: Mapped[str | None] = mapped_column(String(255))
    job_title: Mapped[str | None] = mapped_column(String(120))
    specialty: Mapped[str | None] = mapped_column(String(120))
    hire_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'ACTIVE'"))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE','INACTIVE')", name="status_valid"),
        CheckConstraint("document_type IN ('DNI','CE','RUC','PASSPORT')", name="document_type_valid"),
    )


class TenantSetting(Base, TimestampMixin):
    __tablename__ = "tenant_settings"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tenants.id"), nullable=False, unique=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default=text("'PEN'"))
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, server_default=text("'America/Lima'"))
    brand_color: Mapped[str | None] = mapped_column(String(20))
    logo_url: Mapped[str | None] = mapped_column(Text)
    quote_number_format: Mapped[str] = mapped_column(
        String(60), nullable=False, server_default=text("'COT-{YEAR}-{SEQ6}'")
    )
    work_order_number_format: Mapped[str] = mapped_column(
        String(60), nullable=False, server_default=text("'OT-{YEAR}-{SEQ6}'")
    )
    require_approval_for_work: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    show_prices_in_documents: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    document_header: Mapped[str | None] = mapped_column(Text)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))


class DocumentSequence(Base, TimestampMixin):
    __tablename__ = "document_sequences"

    id: Mapped[uuid.UUID] = uuid_pk()
    tenant_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tenants.id"), nullable=False)
    branch_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("branches.id"))
    doc_type: Mapped[str] = mapped_column(String(20), nullable=False)
    prefix: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'OT'"))
    year: Mapped[int] = mapped_column(nullable=False)
    last_value: Mapped[int] = mapped_column(BigInteger, nullable=False, server_default=text("0"))

    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "branch_id",
            "doc_type",
            "year",
            name="uq_doc_seq",
            postgresql_nulls_not_distinct=True,
        ),
    )
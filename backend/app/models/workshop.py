"""WORKSHOP + QUOTATIONS: citas, recepción, diagnóstico, órdenes, servicios, técnicos, labor, parts, checklists, cotizaciones."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Uuid

from app.models.base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin, uuid_pk


class Service(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "services"

    id: Mapped[uuid.UUID] = uuid_pk()
    code: Mapped[str | None] = mapped_column(String(40))
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str | None] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(40), nullable=False, server_default=text("'SERVICIO'"))
    default_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))

    __table_args__ = (
        Index("uq_service_code", "tenant_id", "code", unique=True, postgresql_where=text("code IS NOT NULL")),
        Index("uq_service_name", "tenant_id", "name", unique=True),
    )


class Appointment(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = uuid_pk()
    branch_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("branches.id"), nullable=False)
    client_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("clients.id"))
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("vehicles.id"))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(nullable=False, server_default=text("60"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'SCHEDULED'"))
    reason: Mapped[str | None] = mapped_column(Text)
    symptoms: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(
            "status IN ('SCHEDULED','CONFIRMED','ARRIVED','COMPLETED','CANCELLED','NO_SHOW')",
            name="status_valid",
        ),
        Index("idx_appointments_branch_time", "tenant_id", "branch_id", "scheduled_at"),
    )


class VehicleReception(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "vehicle_receptions"

    id: Mapped[uuid.UUID] = uuid_pk()
    branch_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("branches.id"), nullable=False)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("appointments.id"))
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id"), nullable=False)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("vehicles.id"), nullable=False, index=True)
    received_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    odometer: Mapped[int | None] = mapped_column()
    fuel_level: Mapped[str | None] = mapped_column(String(20))
    reason: Mapped[str | None] = mapped_column(Text)
    reported_symptoms: Mapped[str | None] = mapped_column(Text)
    observations: Mapped[str | None] = mapped_column(Text)
    accessories: Mapped[str | None] = mapped_column(Text)
    visible_damage: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'OPEN'"))

    __table_args__ = (
        CheckConstraint("status IN ('OPEN','IN_DIAGNOSIS','DIAGNOSED','DONE','CANCELLED')", name="status_valid"),
        Index("idx_receptions_time", "tenant_id", text("received_at DESC")),
    )


class Diagnostic(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "diagnostics"

    id: Mapped[uuid.UUID] = uuid_pk()
    branch_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("branches.id"))
    vehicle_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("vehicles.id"), nullable=False, index=True)
    reception_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("vehicle_receptions.id"))
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    performed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    summary: Mapped[str | None] = mapped_column(Text)
    recommendations: Mapped[str | None] = mapped_column(Text)
    resolution_status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'UNRESOLVED'"))

    __table_args__ = (
        CheckConstraint("resolution_status IN ('UNRESOLVED','PARTIAL','RESOLVED')", name="resolution_status_valid"),
    )


class DiagnosticFinding(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "diagnostic_findings"

    id: Mapped[uuid.UUID] = uuid_pk()
    diagnostic_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("diagnostics.id"), nullable=False, index=True)
    area: Mapped[str | None] = mapped_column(String(120))
    symptom: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    probable_cause: Mapped[str | None] = mapped_column(Text)
    confirmed_cause: Mapped[str | None] = mapped_column(Text)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    resolution: Mapped[str | None] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'MEDIUM'"))

    __table_args__ = (CheckConstraint("severity IN ('LOW','MEDIUM','HIGH','CRITICAL')", name="severity_valid"),)


class DiagnosticTest(Base, TenantMixin):
    __tablename__ = "diagnostic_tests"

    id: Mapped[uuid.UUID] = uuid_pk()
    diagnostic_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("diagnostics.id"), nullable=False, index=True)
    test_type: Mapped[str] = mapped_column(String(80), nullable=False)
    result: Mapped[str | None] = mapped_column(Text)
    performed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    notes: Mapped[str | None] = mapped_column(Text)


class DiagnosticFindingFaultCode(Base, TenantMixin):
    __tablename__ = "diagnostic_finding_fault_codes"

    finding_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("diagnostic_findings.id"), primary_key=True)
    fault_code_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("fault_codes.id"), primary_key=True)


class WorkOrder(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "work_orders"

    id: Mapped[uuid.UUID] = uuid_pk()
    branch_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("branches.id"), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id"), nullable=False, index=True)
    vehicle_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("vehicles.id"), nullable=False, index=True)
    reception_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("vehicle_receptions.id"))
    diagnostic_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("diagnostics.id"))
    quote_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("quotes.id"))
    number: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40), nullable=False, server_default=text("'RECEIVED'"))
    priority: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'NORMAL'"))
    responsible_employee_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    supervisor_employee_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint(
            "status IN ('RECEIVED','DIAGNOSIS','QUOTED','WAITING_APPROVAL','APPROVED',"
            "'IN_PROGRESS','WAITING_PARTS','PAUSED','QUALITY_CONTROL',"
            "'COMPLETED','READY_FOR_PICKUP','DELIVERED','CANCELLED')",
            name="status_valid",
        ),
        CheckConstraint("priority IN ('LOW','NORMAL','HIGH','URGENT')", name="priority_valid"),
        Index("uq_work_order_number", "tenant_id", "number", unique=True, postgresql_where=text("number IS NOT NULL")),
        Index("idx_work_orders_branch_status", "tenant_id", "branch_id", "status"),
        Index("idx_work_orders_opened", "tenant_id", text("opened_at DESC")),
    )


class WorkOrderStatusHistory(Base, TenantMixin):
    __tablename__ = "work_order_status_history"

    id: Mapped[uuid.UUID] = uuid_pk()
    work_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("work_orders.id"), nullable=False, index=True)
    from_status: Mapped[str | None] = mapped_column(String(40))
    to_status: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    notes: Mapped[str | None] = mapped_column(Text)


class WorkOrderService(Base, TenantMixin):
    __tablename__ = "work_order_services"

    id: Mapped[uuid.UUID] = uuid_pk()
    work_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("work_orders.id"), nullable=False, index=True)
    service_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("services.id"))
    service_name: Mapped[str] = mapped_column(String(160), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("1"))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))


class WorkOrderTechnician(Base, TenantMixin):
    __tablename__ = "work_order_technicians"

    id: Mapped[uuid.UUID] = uuid_pk()
    work_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("work_orders.id"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("employees.id"), nullable=False)
    role_in_job: Mapped[str | None] = mapped_column(String(120))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hours_worked: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (Index("uq_wo_technician", "work_order_id", "employee_id", unique=True),)


class LaborEntry(Base, TenantMixin):
    __tablename__ = "labor_entries"

    id: Mapped[uuid.UUID] = uuid_pk()
    work_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("work_orders.id"), nullable=False, index=True)
    employee_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("employees.id"), nullable=False)
    service_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("services.id"))
    hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False, server_default=text("0"))
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    notes: Mapped[str | None] = mapped_column(Text)


class WorkOrderPart(Base, TenantMixin):
    __tablename__ = "work_order_parts"

    id: Mapped[uuid.UUID] = uuid_pk()
    work_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("work_orders.id"), nullable=False, index=True)
    part_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("parts.id"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("1"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    technician_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

    __table_args__ = (CheckConstraint("quantity > 0", name="quantity_positive"),)


class Checklist(Base, TenantMixin, TimestampMixin):
    __tablename__ = "checklists"

    id: Mapped[uuid.UUID] = uuid_pk()
    work_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("work_orders.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    checked_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    __table_args__ = (
        CheckConstraint("kind IN ('RECEPTION','DELIVERY')", name="kind_valid"),
        Index("idx_checklists_wo", "work_order_id", "kind"),
    )


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id: Mapped[uuid.UUID] = uuid_pk()
    checklist_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("checklists.id"), nullable=False, index=True)
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_ok: Mapped[bool | None] = mapped_column(Boolean)
    observation: Mapped[str | None] = mapped_column(Text)


class Quote(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "quotes"

    id: Mapped[uuid.UUID] = uuid_pk()
    branch_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("branches.id"), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("clients.id"), nullable=False, index=True)
    vehicle_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("vehicles.id"), index=True)
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("work_orders.id"))
    number: Mapped[str | None] = mapped_column(String(40))
    created_by: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("employees.id"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'DRAFT'"))
    valid_until: Mapped[date | None] = mapped_column(Date)
    terms: Mapped[str | None] = mapped_column(Text)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))

    __table_args__ = (
        CheckConstraint("status IN ('DRAFT','SENT','APPROVED','REJECTED','EXPIRED','CONVERTED')", name="status_valid"),
        Index("uq_quote_number", "tenant_id", "number", unique=True, postgresql_where=text("number IS NOT NULL")),
    )


class QuoteItem(Base, TenantMixin):
    __tablename__ = "quote_items"

    id: Mapped[uuid.UUID] = uuid_pk()
    quote_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("quotes.id"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    service_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("services.id"))
    part_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("parts.id"))
    description: Mapped[str] = mapped_column(String(250), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("1"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text("0"))

    __table_args__ = (
        CheckConstraint("kind IN ('SERVICE','PART')", name="kind_valid"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
    )
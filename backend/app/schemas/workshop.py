"""Taller: servicios, citas, recepciones, diagnósticos, OTs, labor y checklist."""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.constants import (
    AppointmentStatusT,
    ChecklistKindT,
    ReceptionStatusT,
    ResolutionStatusT,
    SeverityT,
    WorkOrderPriorityT,
    WorkOrderStatusT,
)


class ServiceCreate(BaseModel):
    code: str | None = Field(default=None, max_length=40)
    name: str = Field(min_length=1, max_length=160)
    category: str | None = Field(default=None, max_length=120)
    unit: str = Field(default="SERVICIO", max_length=40)
    default_price: Decimal = Field(default=Decimal("0"), ge=0)
    is_active: bool = True


class ServiceUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    default_price: Decimal | None = None
    is_active: bool | None = None


class ServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str | None
    name: str
    category: str | None
    unit: str
    default_price: Decimal
    is_active: bool


class AppointmentCreate(BaseModel):
    branch_id: uuid.UUID
    client_id: uuid.UUID | None = None
    vehicle_id: uuid.UUID | None = None
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=10, le=600)
    status: AppointmentStatusT = "SCHEDULED"
    reason: str | None = None
    symptoms: str | None = None
    notes: str | None = None


class AppointmentUpdate(BaseModel):
    scheduled_at: datetime | None = None
    duration_minutes: int | None = None
    status: AppointmentStatusT | None = None
    reason: str | None = None
    symptoms: str | None = None
    notes: str | None = None


class AppointmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID
    client_id: uuid.UUID | None
    vehicle_id: uuid.UUID | None
    scheduled_at: datetime
    duration_minutes: int
    status: str
    reason: str | None
    symptoms: str | None
    notes: str | None


class ReceptionCreate(BaseModel):
    branch_id: uuid.UUID
    appointment_id: uuid.UUID | None = None
    client_id: uuid.UUID
    vehicle_id: uuid.UUID
    received_by: uuid.UUID | None = None
    odometer: int | None = Field(default=None, ge=0)
    fuel_level: str | None = Field(default=None, max_length=20)
    reason: str | None = None
    reported_symptoms: str | None = None
    observations: str | None = None
    accessories: str | None = None
    visible_damage: str | None = None
    status: ReceptionStatusT = "OPEN"


class ReceptionUpdate(BaseModel):
    status: ReceptionStatusT | None = None
    odometer: int | None = None
    fuel_level: str | None = None
    reported_symptoms: str | None = None
    observations: str | None = None
    accessories: str | None = None
    visible_damage: str | None = None


class ReceptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID
    appointment_id: uuid.UUID | None
    client_id: uuid.UUID
    vehicle_id: uuid.UUID
    received_by: uuid.UUID | None
    received_at: datetime
    odometer: int | None
    fuel_level: str | None
    reason: str | None
    reported_symptoms: str | None
    observations: str | None
    accessories: str | None
    visible_damage: str | None
    status: str


class DiagnosticCreate(BaseModel):
    branch_id: uuid.UUID | None = None
    vehicle_id: uuid.UUID
    reception_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    performed_by: uuid.UUID | None = None
    summary: str | None = None
    recommendations: str | None = None
    resolution_status: ResolutionStatusT = "UNRESOLVED"


class DiagnosticUpdate(BaseModel):
    summary: str | None = None
    recommendations: str | None = None
    resolution_status: ResolutionStatusT | None = None


class DiagnosticRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID | None
    vehicle_id: uuid.UUID
    reception_id: uuid.UUID | None
    work_order_id: uuid.UUID | None
    performed_by: uuid.UUID | None
    performed_at: datetime
    summary: str | None
    recommendations: str | None
    resolution_status: str


class FindingCreate(BaseModel):
    diagnostic_id: uuid.UUID
    area: str | None = Field(default=None, max_length=120)
    symptom: str | None = None
    description: str = Field(min_length=1)
    probable_cause: str | None = None
    confirmed_cause: str | None = None
    is_confirmed: bool = False
    severity: SeverityT = "MEDIUM"
    fault_code_ids: list[uuid.UUID] = Field(default_factory=list)


class FindingUpdate(BaseModel):
    area: str | None = None
    symptom: str | None = None
    description: str | None = None
    probable_cause: str | None = None
    confirmed_cause: str | None = None
    is_confirmed: bool | None = None
    severity: SeverityT | None = None
    resolution: str | None = None
    fault_code_ids: list[uuid.UUID] | None = None


class FindingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    diagnostic_id: uuid.UUID
    area: str | None
    symptom: str | None
    description: str
    probable_cause: str | None
    confirmed_cause: str | None
    is_confirmed: bool
    severity: str
    resolution: str | None
    fault_code_ids: list[uuid.UUID] = Field(default_factory=list)


class DiagnosticTestCreate(BaseModel):
    diagnostic_id: uuid.UUID
    test_type: str = Field(min_length=1, max_length=80)
    result: str | None = None
    performed_by: uuid.UUID | None = None
    notes: str | None = None


class DiagnosticTestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    diagnostic_id: uuid.UUID
    test_type: str
    result: str | None
    performed_by: uuid.UUID | None
    performed_at: datetime
    notes: str | None


class WorkOrderCreate(BaseModel):
    branch_id: uuid.UUID
    client_id: uuid.UUID
    vehicle_id: uuid.UUID
    reception_id: uuid.UUID | None = None
    diagnostic_id: uuid.UUID | None = None
    quote_id: uuid.UUID | None = None
    priority: WorkOrderPriorityT = "NORMAL"
    responsible_employee_id: uuid.UUID | None = None
    supervisor_employee_id: uuid.UUID | None = None
    notes: str | None = None


class WorkOrderUpdate(BaseModel):
    priority: WorkOrderPriorityT | None = None
    responsible_employee_id: uuid.UUID | None = None
    supervisor_employee_id: uuid.UUID | None = None
    notes: str | None = None


class WorkOrderAction(BaseModel):
    """Transición de estado: approve, start, pause, resume, quality_control, complete, deliver, cancel..."""

    action: str = Field(min_length=1, max_length=40)
    notes: str | None = None


class WorkOrderServiceAdd(BaseModel):
    service_id: uuid.UUID | None = None
    service_name: str = Field(min_length=1, max_length=160)
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    price: Decimal = Field(default=Decimal("0"), ge=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)


class WorkOrderServiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    work_order_id: uuid.UUID
    service_id: uuid.UUID | None
    service_name: str
    quantity: Decimal
    price: Decimal
    discount: Decimal
    subtotal: Decimal


class WorkOrderTechnicianAssign(BaseModel):
    employee_id: uuid.UUID
    role_in_job: str | None = Field(default=None, max_length=120)
    hours_worked: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class WorkOrderTechnicianRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    work_order_id: uuid.UUID
    employee_id: uuid.UUID
    role_in_job: str | None
    assigned_at: datetime
    finished_at: datetime | None
    hours_worked: Decimal | None
    notes: str | None


class LaborEntryCreate(BaseModel):
    work_order_id: uuid.UUID
    employee_id: uuid.UUID
    service_id: uuid.UUID | None = None
    hours: Decimal = Field(gt=0, le=Decimal("24"))
    hourly_rate: Decimal = Field(ge=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    notes: str | None = None


class LaborEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    work_order_id: uuid.UUID
    employee_id: uuid.UUID
    service_id: uuid.UUID | None
    hours: Decimal
    hourly_rate: Decimal
    discount: Decimal
    subtotal: Decimal
    notes: str | None


class WorkOrderPartAdd(BaseModel):
    part_id: uuid.UUID
    quantity: Decimal = Field(gt=0)
    unit_price: Decimal = Field(default=Decimal("0"), ge=0)
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    technician_id: uuid.UUID | None = None


class WorkOrderPartRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    work_order_id: uuid.UUID
    part_id: uuid.UUID
    quantity: Decimal
    unit_price: Decimal
    discount: Decimal
    subtotal: Decimal
    technician_id: uuid.UUID | None
    used_at: datetime


class ChecklistItemInput(BaseModel):
    item_name: str = Field(min_length=1, max_length=200)
    is_ok: bool | None = None
    observation: str | None = None


class ChecklistCreate(BaseModel):
    work_order_id: uuid.UUID
    kind: ChecklistKindT
    checked_by: uuid.UUID | None = None
    notes: str | None = None
    items: list[ChecklistItemInput] = Field(default_factory=list)


class ChecklistItemUpdate(BaseModel):
    is_ok: bool | None = None
    observation: str | None = None


class ChecklistItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    checklist_id: uuid.UUID
    item_name: str
    is_ok: bool | None
    observation: str | None


class ChecklistRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    work_order_id: uuid.UUID
    kind: str
    checked_by: uuid.UUID | None
    completed_at: datetime | None
    notes: str | None
    items: list[ChecklistItemRead] = Field(default_factory=list)


class WorkOrderStatusHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    work_order_id: uuid.UUID
    from_status: str | None
    to_status: str
    changed_by: uuid.UUID | None
    changed_at: datetime
    notes: str | None


class WorkOrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    branch_id: uuid.UUID
    client_id: uuid.UUID
    vehicle_id: uuid.UUID
    reception_id: uuid.UUID | None
    diagnostic_id: uuid.UUID | None
    quote_id: uuid.UUID | None
    number: str | None
    status: WorkOrderStatusT
    priority: str
    responsible_employee_id: uuid.UUID | None
    supervisor_employee_id: uuid.UUID | None
    opened_at: datetime
    closed_at: datetime | None
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    notes: str | None
    services: list[WorkOrderServiceRead] = Field(default_factory=list)
    parts: list[WorkOrderPartRead] = Field(default_factory=list)
    labor: list[LaborEntryRead] = Field(default_factory=list)
    technicians: list[WorkOrderTechnicianRead] = Field(default_factory=list)
    status_history: list[WorkOrderStatusHistoryRead] = Field(default_factory=list)
    total_paid: Decimal = Decimal("0")
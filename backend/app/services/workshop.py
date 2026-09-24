"""Servicios del taller: servicios, citas, recepciones, diagnósticos y OTs con máquina de estados."""
from __future__ import annotations

import uuid
from datetime import datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.core.exceptions import BusinessRuleError, NotFoundError, ValidationError
from app.models.organization import Branch, Employee
from app.models.workshop import (
    Checklist,
    ChecklistItem,
    DiagnosticFinding,
    DiagnosticFindingFaultCode,
    DiagnosticTest,
    LaborEntry,
    WorkOrder,
    WorkOrderPart,
    WorkOrderStatusHistory,
    WorkOrderTechnician,
)
from app.models.workshop import (
    WorkOrderService as WorkOrderServiceModel,
)
from app.repositories.crm_repos import ClientRepository, VehicleRepository
from app.repositories.workshop_repos import (
    AppointmentRepository,
    ChecklistRepository,
    DiagnosticRepository,
    DocumentNumberRepository,
    ReceptionRepository,
    ServiceRepository,
    WorkOrderRepository,
)
from app.schemas.workshop import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
    ChecklistCreate,
    ChecklistItemRead,
    ChecklistItemUpdate,
    ChecklistRead,
    DiagnosticCreate,
    DiagnosticRead,
    DiagnosticTestCreate,
    DiagnosticTestRead,
    DiagnosticUpdate,
    FindingCreate,
    FindingRead,
    FindingUpdate,
    LaborEntryCreate,
    LaborEntryRead,
    ReceptionCreate,
    ReceptionRead,
    ReceptionUpdate,
    ServiceCreate,
    ServiceRead,
    ServiceUpdate,
    WorkOrderCreate,
    WorkOrderPartAdd,
    WorkOrderPartRead,
    WorkOrderRead,
    WorkOrderServiceAdd,
    WorkOrderServiceRead,
    WorkOrderStatusHistoryRead,
    WorkOrderTechnicianAssign,
    WorkOrderTechnicianRead,
    WorkOrderUpdate,
)
from app.services.audit import AuditService
from app.services.context import Principal
from app.services.inventory import InventoryService

_IGV = Decimal("0.18")

# acción → (estados permitidos de origen, estado destino). "*" = cualquiera no terminal.
_STATUS_ACTIONS: dict[str, tuple[frozenset[str] | None, str]] = {
    "request_approval": (None, "WAITING_APPROVAL"),
    "approve": (frozenset({"RECEIVED", "QUOTED", "WAITING_APPROVAL", "APPROVED"}), "APPROVED"),
    "start": (frozenset({"RECEIVED", "DIAGNOSIS", "QUOTED", "WAITING_APPROVAL", "APPROVED", "QUALITY_CONTROL"}), "IN_PROGRESS"),
    "wait_parts": (frozenset({"IN_PROGRESS"}), "WAITING_PARTS"),
    "resume_parts": (frozenset({"WAITING_PARTS"}), "IN_PROGRESS"),
    "pause": (frozenset({"IN_PROGRESS", "WAITING_PARTS"}), "PAUSED"),
    "resume": (frozenset({"PAUSED"}), "IN_PROGRESS"),
    "quality_control": (frozenset({"IN_PROGRESS", "WAITING_PARTS"}), "QUALITY_CONTROL"),
    "complete": (frozenset({"QUALITY_CONTROL", "IN_PROGRESS"}), "COMPLETED"),
    "ready": (frozenset({"COMPLETED"}), "READY_FOR_PICKUP"),
    "deliver": (frozenset({"READY_FOR_PICKUP", "COMPLETED"}), "DELIVERED"),
    "cancel": (None, "CANCELLED"),
}

_TERMINAL = {"DELIVERED", "CANCELLED"}


def _subtotal(qty: Decimal, price: Decimal, discount: Decimal) -> Decimal:
    raw = qty * price - (discount or Decimal("0"))
    return raw if raw > 0 else Decimal("0")


class ServiceService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ServiceRepository(db)
        self.audit = AuditService(db)

    async def search(self, ctx: Principal, q: str | None, page: int, page_size: int) -> tuple[list[ServiceRead], int]:
        await set_tenant_context(self.db, ctx.tc())
        rows, total = await self.repo.search(ctx.tenant_id, q, page, page_size)
        return [ServiceRead.model_validate(r) for r in rows], total

    async def create(self, ctx: Principal, payload: ServiceCreate) -> ServiceRead:
        await set_tenant_context(self.db, ctx.tc())
        row = await self.repo.create(tenant_id=ctx.tenant_id, **payload.model_dump())
        await self.audit.record_raw(ctx, "SERVICE_CREATE", "services", row.id)
        await self.db.commit()
        return ServiceRead.model_validate(row)

    async def update(self, ctx: Principal, service_id: uuid.UUID, payload: ServiceUpdate) -> ServiceRead:
        await set_tenant_context(self.db, ctx.tc())
        row = await self.repo.get_tenant_or_404(service_id, ctx.tenant_id)
        await self.repo.update(row, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return ServiceRead.model_validate(row)

    async def delete(self, ctx: Principal, service_id: uuid.UUID) -> None:
        await set_tenant_context(self.db, ctx.tc())
        row = await self.repo.get_tenant_or_404(service_id, ctx.tenant_id)
        await self.repo.delete(row)
        await self.db.commit()


class AppointmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AppointmentRepository(db)
        self.audit = AuditService(db)

    async def _validate_links(self, ctx: Principal, payload) -> None:
        if payload.client_id:
            await ClientRepository(self.db).get_tenant_or_404(payload.client_id, ctx.tenant_id)
        if payload.vehicle_id:
            await VehicleRepository(self.db).get_tenant_or_404(payload.vehicle_id, ctx.tenant_id)

    async def create(self, ctx: Principal, payload: AppointmentCreate) -> AppointmentRead:
        await set_tenant_context(self.db, ctx.tc())
        await self._validate_links(ctx, payload)
        row = await self.repo.create(tenant_id=ctx.tenant_id, **payload.model_dump())
        await self.db.commit()
        return AppointmentRead.model_validate(row)

    async def get(self, ctx: Principal, appointment_id: uuid.UUID) -> AppointmentRead:
        await set_tenant_context(self.db, ctx.tc())
        row = await self.repo.get_tenant_or_404(appointment_id, ctx.tenant_id)
        return AppointmentRead.model_validate(row)

    async def list_day(self, ctx: Principal, branch_id: uuid.UUID | None, on: datetime) -> list[AppointmentRead]:
        await set_tenant_context(self.db, ctx.tc())
        start = datetime.combine(on.date(), time.min)
        end = start + timedelta(days=1)
        rows = await self.repo.list_for_date_range(ctx.tenant_id, branch_id, start, end)
        return [AppointmentRead.model_validate(r) for r in rows]

    async def update(self, ctx: Principal, appointment_id: uuid.UUID, payload: AppointmentUpdate) -> AppointmentRead:
        await set_tenant_context(self.db, ctx.tc())
        row = await self.repo.get_tenant_or_404(appointment_id, ctx.tenant_id)
        await self.repo.update(row, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return AppointmentRead.model_validate(row)

    async def delete(self, ctx: Principal, appointment_id: uuid.UUID) -> None:
        await set_tenant_context(self.db, ctx.tc())
        row = await self.repo.get_tenant_or_404(appointment_id, ctx.tenant_id)
        await self.repo.delete(row)
        await self.db.commit()

    async def counts(self, ctx: Principal) -> dict[str, int]:
        await set_tenant_context(self.db, ctx.tc())
        return await self.repo.count_by_status(ctx.tenant_id)


class ReceptionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ReceptionRepository(db)
        self.audit = AuditService(db)

    async def create(self, ctx: Principal, payload: ReceptionCreate) -> ReceptionRead:
        await set_tenant_context(self.db, ctx.tc())
        await VehicleRepository(self.db).get_tenant_or_404(payload.vehicle_id, ctx.tenant_id)
        await ClientRepository(self.db).get_tenant_or_404(payload.client_id, ctx.tenant_id)
        row = await self.repo.create(tenant_id=ctx.tenant_id, **payload.model_dump())
        await self.audit.record_raw(ctx, "RECEPTION_CREATE", "vehicle_receptions", row.id)
        await self.db.commit()
        return ReceptionRead.model_validate(row)

    async def get(self, ctx: Principal, reception_id: uuid.UUID) -> ReceptionRead:
        await set_tenant_context(self.db, ctx.tc())
        row = await self.repo.get_tenant_or_404(reception_id, ctx.tenant_id)
        return ReceptionRead.model_validate(row)

    async def update_status(self, ctx: Principal, reception_id: uuid.UUID, payload: ReceptionUpdate) -> ReceptionRead:
        await set_tenant_context(self.db, ctx.tc())
        row = await self.repo.get_tenant_or_404(reception_id, ctx.tenant_id)
        await self.repo.update(row, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return ReceptionRead.model_validate(row)


class DiagnosticService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = DiagnosticRepository(db)
        self.audit = AuditService(db)

    async def create(self, ctx: Principal, payload: DiagnosticCreate) -> DiagnosticRead:
        await set_tenant_context(self.db, ctx.tc())
        await VehicleRepository(self.db).get_tenant_or_404(payload.vehicle_id, ctx.tenant_id)
        diag = await self.repo.create(tenant_id=ctx.tenant_id, **payload.model_dump())
        await self.audit.record_raw(ctx, "DIAGNOSTIC_CREATE", "diagnostics", diag.id)
        await self.db.commit()
        return DiagnosticRead.model_validate(diag)

    async def update(self, ctx: Principal, diagnostic_id: uuid.UUID, payload: DiagnosticUpdate) -> DiagnosticRead:
        await set_tenant_context(self.db, ctx.tc())
        diag = await self.repo.get_tenant_or_404(diagnostic_id, ctx.tenant_id)
        await self.repo.update(diag, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return DiagnosticRead.model_validate(diag)

    async def update_finding(self, ctx: Principal, finding_id: uuid.UUID, payload: FindingUpdate) -> FindingRead:
        await set_tenant_context(self.db, ctx.tc())
        finding = await self.db.get(DiagnosticFinding, finding_id)
        if finding is None or finding.tenant_id != ctx.tenant_id:
            raise NotFoundError(message="Hallazgo no encontrado o sin acceso")
        data = payload.model_dump(exclude_unset=True)
        fault_code_ids = data.pop("fault_code_ids", None)
        for key, value in data.items():
            setattr(finding, key, value)
        if fault_code_ids is not None:
            await self.db.execute(
                DiagnosticFindingFaultCode.__table__.delete().where(
                    DiagnosticFindingFaultCode.finding_id == finding.id
                )
            )
            for fc in fault_code_ids:
                self.db.add(
                    DiagnosticFindingFaultCode(tenant_id=ctx.tenant_id, finding_id=finding.id, fault_code_id=fc)
                )
        await self.db.commit()
        return FindingRead.model_validate(finding)

    async def get(self, ctx: Principal, diagnostic_id: uuid.UUID) -> dict:
        await set_tenant_context(self.db, ctx.tc())
        diag = await self.repo.get_tenant_or_404(diagnostic_id, ctx.tenant_id)
        return {
            "diagnostic": DiagnosticRead.model_validate(diag),
            "findings": [FindingRead.model_validate(f) for f in await self.repo.list_findings(diag.id)],
            "tests": [DiagnosticTestRead.model_validate(t) for t in await self.repo.list_tests(diag.id)],
        }

    async def add_finding(self, ctx: Principal, payload: FindingCreate) -> FindingRead:
        await set_tenant_context(self.db, ctx.tc())
        diag = await self.repo.get_tenant_or_404(payload.diagnostic_id, ctx.tenant_id)
        finding = DiagnosticFinding(
            tenant_id=ctx.tenant_id,
            diagnostic_id=diag.id,
            area=payload.area,
            symptom=payload.symptom,
            description=payload.description,
            probable_cause=payload.probable_cause,
            confirmed_cause=payload.confirmed_cause,
            is_confirmed=payload.is_confirmed,
            severity=payload.severity,
        )
        self.db.add(finding)
        await self.db.flush()
        for fc in payload.fault_code_ids:
            self.db.add(DiagnosticFindingFaultCode(tenant_id=ctx.tenant_id, finding_id=finding.id, fault_code_id=fc))
        await self.db.commit()
        return FindingRead.model_validate(finding)

    async def add_test(self, ctx: Principal, payload: DiagnosticTestCreate) -> DiagnosticTestRead:
        await set_tenant_context(self.db, ctx.tc())
        diag = await self.repo.get_tenant_or_404(payload.diagnostic_id, ctx.tenant_id)
        test = DiagnosticTest(
            tenant_id=ctx.tenant_id,
            diagnostic_id=diag.id,
            test_type=payload.test_type,
            result=payload.result,
            performed_by=payload.performed_by,
            notes=payload.notes,
        )
        self.db.add(test)
        await self.db.commit()
        return DiagnosticTestRead.model_validate(test)


class WorkOrderService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = WorkOrderRepository(db)
        self.numbers = DocumentNumberRepository(db)
        self.audit = AuditService(db)
        self.inventory = InventoryService(db)

    # ------------------------------------------------------------ helpers
    async def _validate_links(self, ctx: Principal, payload: WorkOrderCreate) -> None:
        await ClientRepository(self.db).get_tenant_or_404(payload.client_id, ctx.tenant_id)
        await VehicleRepository(self.db).get_tenant_or_404(payload.vehicle_id, ctx.tenant_id)
        branch = await self.db.scalar(select(Branch).where(Branch.id == payload.branch_id, Branch.tenant_id == ctx.tenant_id))
        if branch is None:
            raise NotFoundError(message="Sucursal no encontrada o sin acceso")

    async def _recompute(self, ctx: Principal, wo: WorkOrder) -> None:
        services = await self.repo.list_services(wo.id)
        parts = await self.repo.list_parts(wo.id)
        labor = await self.repo.list_labor(wo.id)
        subtotal = Decimal("0")
        for row in services:
            subtotal += row.subtotal
        for row in parts:
            subtotal += row.subtotal
        for row in labor:
            subtotal += row.subtotal
        wo.subtotal = subtotal
        wo.tax = (subtotal - wo.discount) * _IGV if subtotal > 0 else Decimal("0")
        wo.total = subtotal - wo.discount + wo.tax
        await self.db.flush()

    def _change_status(self, ctx: Principal, wo: WorkOrder, to: str, notes: str | None) -> None:
        self.db.add(
            WorkOrderStatusHistory(
                tenant_id=ctx.tenant_id,
                work_order_id=wo.id,
                from_status=wo.status,
                to_status=to,
                changed_by=ctx.user_id,
                notes=notes,
            )
        )
        wo.status = to
        if to in ("DELIVERED", "CANCELLED"):
            wo.closed_at = datetime.utcnow()

    # ----------------------------------------------------------------- create
    async def create(self, ctx: Principal, payload: WorkOrderCreate) -> WorkOrderRead:
        await set_tenant_context(self.db, ctx.tc())
        await self._validate_links(ctx, payload)
        wo = await self.repo.create(tenant_id=ctx.tenant_id, **payload.model_dump(exclude={"priority", "notes"}))
        wo.priority = payload.priority
        wo.notes = payload.notes
        wo.number = await self.numbers.next_number(ctx.tenant_id, payload.branch_id, doc_type="WORK_ORDER", prefix="OT")
        self._change_status(ctx, wo, "RECEIVED", "Creación de orden de trabajo")
        await self.audit.record_raw(ctx, "WORK_ORDER_CREATE", "work_orders", wo.id, new_values={"number": wo.number})
        await self.db.commit()
        return await self.get_full(ctx, wo.id)

    async def get_full(self, ctx: Principal, wo_id: uuid.UUID) -> WorkOrderRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(wo_id, ctx.tenant_id)
        read = WorkOrderRead.model_validate(wo)
        read.services = [WorkOrderServiceRead.model_validate(x) for x in await self.repo.list_services(wo.id)]
        read.parts = [WorkOrderPartRead.model_validate(x) for x in await self.repo.list_parts(wo.id)]
        read.labor = [LaborEntryRead.model_validate(x) for x in await self.repo.list_labor(wo.id)]
        read.technicians = [WorkOrderTechnicianRead.model_validate(x) for x in await self.repo.list_technicians(wo.id)]
        read.status_history = [
            WorkOrderStatusHistoryRead.model_validate(x) for x in await self.repo.list_history(wo.id)
        ]
        return read

    async def list(self, ctx: Principal, *, branch_id, status, client_id, q, page, page_size) -> tuple[list[WorkOrderRead], int]:
        await set_tenant_context(self.db, ctx.tc())
        rows, total = await self.repo.list_filtered(
            ctx.tenant_id, branch_id=branch_id, status=status, client_id=client_id, q=q, page=page, page_size=page_size
        )
        return [WorkOrderRead.model_validate(r) for r in rows], total

    async def update(self, ctx: Principal, wo_id: uuid.UUID, payload: WorkOrderUpdate) -> WorkOrderRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(wo_id, ctx.tenant_id)
        await self.repo.update(wo, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return await self.get_full(ctx, wo_id)

    async def action(self, ctx: Principal, wo_id: uuid.UUID, action: str, notes: str | None) -> WorkOrderRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(wo_id, ctx.tenant_id)
        if wo.status in _TERMINAL:
            raise BusinessRuleError(message=f"La orden ya está en estado terminal {wo.status}", code="TERMINAL_STATE")
        mapping = _STATUS_ACTIONS.get(action)
        if mapping is None:
            raise ValidationError(message="Acción de estado inválida", code="INVALID_ACTION")
        allowed, to = mapping
        if allowed is not None and wo.status not in allowed:
            raise BusinessRuleError(
                message=f"No se puede '{action}' desde estado {wo.status}", code="INVALID_TRANSITION"
            )
        self._change_status(ctx, wo, to, notes)
        await self.audit.record_raw(ctx, "WORK_ORDER_STATUS", "work_orders", wo.id, new_values={"status": to})
        await self.db.commit()
        return await self.get_full(ctx, wo_id)

    async def counts(self, ctx: Principal) -> dict[str, int]:
        await set_tenant_context(self.db, ctx.tc())
        return await self.repo.count_by_status(ctx.tenant_id)

    # ---------------------------------------------------------------- lines
    async def add_service(self, ctx: Principal, wo_id: uuid.UUID, payload: WorkOrderServiceAdd) -> WorkOrderServiceRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(wo_id, ctx.tenant_id)
        if payload.service_id:
            await ServiceRepository(self.db).get_tenant_or_404(payload.service_id, ctx.tenant_id)
        row = WorkOrderServiceModel(
            tenant_id=ctx.tenant_id,
            work_order_id=wo.id,
            service_id=payload.service_id,
            service_name=payload.service_name,
            quantity=payload.quantity,
            price=payload.price,
            discount=payload.discount,
            subtotal=_subtotal(payload.quantity, payload.price, payload.discount),
        )
        self.db.add(row)
        await self._recompute(ctx, wo)
        await self.db.commit()
        return WorkOrderServiceRead.model_validate(row)

    async def add_labor(self, ctx: Principal, wo_id: uuid.UUID, payload: LaborEntryCreate) -> LaborEntryRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(wo_id, ctx.tenant_id)
        row = LaborEntry(
            tenant_id=ctx.tenant_id,
            work_order_id=wo.id,
            employee_id=payload.employee_id,
            service_id=payload.service_id,
            hours=payload.hours,
            hourly_rate=payload.hourly_rate,
            discount=payload.discount,
            subtotal=_subtotal(payload.hours, payload.hourly_rate, payload.discount),
            notes=payload.notes,
        )
        self.db.add(row)
        await self._recompute(ctx, wo)
        await self.db.commit()
        return LaborEntryRead.model_validate(row)

    async def add_part(self, ctx: Principal, wo_id: uuid.UUID, payload: WorkOrderPartAdd) -> WorkOrderPartRead:
        """Registra el uso de un repuesto descontando stock atómicamente (SELECT FOR UPDATE)."""
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(wo_id, ctx.tenant_id)
        await self.inventory.consume(
            ctx, branch_id=wo.branch_id, part_id=payload.part_id, quantity=payload.quantity,
            reference_id=wo.id, user_id=ctx.user_id,
        )
        row = WorkOrderPart(
            tenant_id=ctx.tenant_id,
            work_order_id=wo.id,
            part_id=payload.part_id,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            discount=payload.discount,
            subtotal=_subtotal(payload.quantity, payload.unit_price, payload.discount),
            technician_id=payload.technician_id,
        )
        self.db.add(row)
        await self._recompute(ctx, wo)
        await self.db.commit()
        return WorkOrderPartRead.model_validate(row)

    async def assign_technician(
        self, ctx: Principal, wo_id: uuid.UUID, payload: WorkOrderTechnicianAssign
    ) -> WorkOrderTechnicianRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(wo_id, ctx.tenant_id)
        emp = await self.db.scalar(
            select(Employee).where(Employee.id == payload.employee_id, Employee.tenant_id == ctx.tenant_id)
        )
        if emp is None:
            raise NotFoundError(message="Empleado no encontrado o sin acceso")
        row = WorkOrderTechnician(
            tenant_id=ctx.tenant_id,
            work_order_id=wo.id,
            employee_id=payload.employee_id,
            role_in_job=payload.role_in_job,
            hours_worked=payload.hours_worked,
            notes=payload.notes,
        )
        self.db.add(row)
        await self.db.commit()
        return WorkOrderTechnicianRead.model_validate(row)

    async def finish_technician(self, ctx: Principal, wo_id: uuid.UUID, tech_id: uuid.UUID) -> WorkOrderTechnicianRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(wo_id, ctx.tenant_id)
        row = await self.db.get(WorkOrderTechnician, tech_id)
        if row is None or row.tenant_id != ctx.tenant_id or row.work_order_id != wo.id:
            raise NotFoundError(message="Asignación no encontrada")
        row.finished_at = datetime.utcnow()
        await self.db.commit()
        return WorkOrderTechnicianRead.model_validate(row)

    # ------------------------------------------------------------- checklists
    async def create_checklist(self, ctx: Principal, payload: ChecklistCreate) -> ChecklistRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self.repo.get_tenant_or_404(payload.work_order_id, ctx.tenant_id)
        cl = Checklist(
            tenant_id=ctx.tenant_id,
            work_order_id=wo.id,
            kind=payload.kind,
            checked_by=payload.checked_by,
            notes=payload.notes,
        )
        self.db.add(cl)
        await self.db.flush()
        for item in payload.items:
            self.db.add(ChecklistItem(checklist_id=cl.id, item_name=item.item_name, is_ok=item.is_ok, observation=item.observation))
        await self.db.commit()
        return await self.get_checklist(ctx, cl.id)

    async def get_checklist(self, ctx: Principal, checklist_id: uuid.UUID) -> ChecklistRead:
        await set_tenant_context(self.db, ctx.tc())
        cl = await self.db.scalar(select(Checklist).where(Checklist.id == checklist_id, Checklist.tenant_id == ctx.tenant_id))
        if cl is None:
            raise NotFoundError(message="Checklist no encontrado")
        items = await ChecklistRepository(self.db).list_items(cl.id)
        read = ChecklistRead.model_validate(cl)
        read.items = [ChecklistItemRead.model_validate(i) for i in items]
        return read

    async def complete_checklist_item(self, ctx: Principal, checklist_id: uuid.UUID, item_id: uuid.UUID, payload: ChecklistItemUpdate) -> ChecklistRead:
        await set_tenant_context(self.db, ctx.tc())
        item = await self.db.get(ChecklistItem, item_id)
        if item is None:
            raise NotFoundError(message="Ítem no encontrado")
        cl = await self.db.scalar(select(Checklist).where(Checklist.id == checklist_id, Checklist.tenant_id == ctx.tenant_id))
        if cl is None or item.checklist_id != cl.id:
            raise NotFoundError(message="Checklist no encontrado o sin acceso")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        items = await ChecklistRepository(self.db).list_items(cl.id)
        if items and all(i.is_ok for i in items):
            cl.completed_at = datetime.utcnow()
        await self.db.commit()
        return await self.get_checklist(ctx, cl.id)
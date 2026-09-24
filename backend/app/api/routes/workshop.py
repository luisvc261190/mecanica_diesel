"""Rutas del taller: servicios, citas, recepciones, diagnósticos y OTs."""
from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.schemas.common import ApiResponse, Paginated
from app.schemas.workshop import (
    AppointmentCreate,
    AppointmentRead,
    AppointmentUpdate,
    ChecklistCreate,
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
    WorkOrderAction,
    WorkOrderCreate,
    WorkOrderPartAdd,
    WorkOrderPartRead,
    WorkOrderRead,
    WorkOrderServiceAdd,
    WorkOrderServiceRead,
    WorkOrderTechnicianAssign,
    WorkOrderTechnicianRead,
    WorkOrderUpdate,
)
from app.services.context import Principal
from app.services.workshop import (
    AppointmentService,
    DiagnosticService,
    ReceptionService,
    ServiceService,
    WorkOrderService,
)

router = APIRouter(prefix="/workshop", tags=["workshop"])


# ------------------------------------------------------------------ services
@router.get("/services", response_model=ApiResponse[Paginated[ServiceRead]])
async def list_services(
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_permission("services.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await ServiceService(db).search(principal, q, page, page_size)
    return ApiResponse(data=Paginated.build(items, page, page_size, total))


@router.post("/services", response_model=ApiResponse[ServiceRead], status_code=201)
async def create_service(
    payload: ServiceCreate,
    principal: Principal = Depends(require_permission("services.create")),
    db: AsyncSession = Depends(get_db),
):
    service = await ServiceService(db).create(principal, payload)
    return ApiResponse(data=service, message="Servicio creado")


@router.patch("/services/{service_id}", response_model=ApiResponse[ServiceRead])
async def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    principal: Principal = Depends(require_permission("services.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await ServiceService(db).update(principal, service_id, payload))


@router.delete("/services/{service_id}", response_model=ApiResponse[dict])
async def delete_service(
    service_id: uuid.UUID,
    principal: Principal = Depends(require_permission("services.delete")),
    db: AsyncSession = Depends(get_db),
):
    await ServiceService(db).delete(principal, service_id)
    return ApiResponse(data={"id": str(service_id)})


# --------------------------------------------------------------- appointments
@router.get("/appointments/day", response_model=ApiResponse[list[AppointmentRead]])
async def appointments_day(
    day: datetime | None = None,
    branch_id: uuid.UUID | None = None,
    principal: Principal = Depends(require_permission("appointments.view")),
    db: AsyncSession = Depends(get_db),
):
    on = day or datetime.now()
    return ApiResponse(data=await AppointmentService(db).list_day(principal, branch_id, on))


@router.get("/appointments/counts", response_model=ApiResponse[dict])
async def appointment_counts(
    principal: Principal = Depends(require_permission("appointments.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await AppointmentService(db).counts(principal))


@router.get("/appointments/{appointment_id}", response_model=ApiResponse[AppointmentRead])
async def get_appointment(
    appointment_id: uuid.UUID,
    principal: Principal = Depends(require_permission("appointments.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await AppointmentService(db).get(principal, appointment_id))


@router.post("/appointments", response_model=ApiResponse[AppointmentRead], status_code=201)
async def create_appointment(
    payload: AppointmentCreate,
    principal: Principal = Depends(require_permission("appointments.create")),
    db: AsyncSession = Depends(get_db),
):
    appointment = await AppointmentService(db).create(principal, payload)
    return ApiResponse(data=appointment, message="Cita creada")


@router.patch("/appointments/{appointment_id}", response_model=ApiResponse[AppointmentRead])
async def update_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentUpdate,
    principal: Principal = Depends(require_permission("appointments.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await AppointmentService(db).update(principal, appointment_id, payload))


@router.delete("/appointments/{appointment_id}", response_model=ApiResponse[dict])
async def delete_appointment(
    appointment_id: uuid.UUID,
    principal: Principal = Depends(require_permission("appointments.delete")),
    db: AsyncSession = Depends(get_db),
):
    await AppointmentService(db).delete(principal, appointment_id)
    return ApiResponse(data={"id": str(appointment_id)})


# ---------------------------------------------------------------- receptions
@router.post("/receptions", response_model=ApiResponse[ReceptionRead], status_code=201)
async def create_reception(
    payload: ReceptionCreate,
    principal: Principal = Depends(require_permission("receptions.create")),
    db: AsyncSession = Depends(get_db),
):
    reception = await ReceptionService(db).create(principal, payload)
    return ApiResponse(data=reception, message="Recepción creada")


@router.get("/receptions/{reception_id}", response_model=ApiResponse[ReceptionRead])
async def get_reception(
    reception_id: uuid.UUID,
    principal: Principal = Depends(require_permission("receptions.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await ReceptionService(db).get(principal, reception_id))


@router.patch("/receptions/{reception_id}", response_model=ApiResponse[ReceptionRead])
async def update_reception(
    reception_id: uuid.UUID,
    payload: ReceptionUpdate,
    principal: Principal = Depends(require_permission("receptions.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await ReceptionService(db).update_status(principal, reception_id, payload))


# --------------------------------------------------------------- diagnostics
@router.post("/diagnostics", response_model=ApiResponse[DiagnosticRead], status_code=201)
async def create_diagnostic(
    payload: DiagnosticCreate,
    principal: Principal = Depends(require_permission("diagnostics.create")),
    db: AsyncSession = Depends(get_db),
):
    diag = await DiagnosticService(db).create(principal, payload)
    return ApiResponse(data=diag, message="Diagnóstico creado")


@router.get("/diagnostics/{diagnostic_id}", response_model=ApiResponse[dict])
async def get_diagnostic(
    diagnostic_id: uuid.UUID,
    principal: Principal = Depends(require_permission("diagnostics.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await DiagnosticService(db).get(principal, diagnostic_id))


@router.patch("/diagnostics/{diagnostic_id}", response_model=ApiResponse[DiagnosticRead])
async def update_diagnostic(
    diagnostic_id: uuid.UUID,
    payload: DiagnosticUpdate,
    principal: Principal = Depends(require_permission("diagnostics.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await DiagnosticService(db).update(principal, diagnostic_id, payload))


@router.post("/diagnostics/{diagnostic_id}/findings", response_model=ApiResponse[FindingRead], status_code=201)
async def add_finding(
    diagnostic_id: uuid.UUID,
    payload: FindingCreate,
    principal: Principal = Depends(require_permission("diagnostics.create")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await DiagnosticService(db).add_finding(principal, payload))


@router.patch("/findings/{finding_id}", response_model=ApiResponse[FindingRead])
async def update_finding(
    finding_id: uuid.UUID,
    payload: FindingUpdate,
    principal: Principal = Depends(require_permission("diagnostics.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await DiagnosticService(db).update_finding(principal, finding_id, payload))


@router.post("/diagnostics/{diagnostic_id}/tests", response_model=ApiResponse[DiagnosticTestRead], status_code=201)
async def add_test(
    diagnostic_id: uuid.UUID,
    payload: DiagnosticTestCreate,
    principal: Principal = Depends(require_permission("diagnostics.create")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await DiagnosticService(db).add_test(principal, payload))


# ---------------------------------------------------------------- work orders
@router.get("/work-orders", response_model=ApiResponse[Paginated[WorkOrderRead]])
async def list_work_orders(
    branch_id: uuid.UUID | None = None,
    status: str | None = None,
    client_id: uuid.UUID | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_permission("work_orders.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await WorkOrderService(db).list(
        principal, branch_id=branch_id, status=status, client_id=client_id, q=q, page=page, page_size=page_size
    )
    return ApiResponse(data=Paginated.build(items, page, page_size, total))


@router.get("/work-orders/counts", response_model=ApiResponse[dict])
async def work_order_counts(
    principal: Principal = Depends(require_permission("work_orders.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).counts(principal))


@router.post("/work-orders", response_model=ApiResponse[WorkOrderRead], status_code=201)
async def create_work_order(
    payload: WorkOrderCreate,
    principal: Principal = Depends(require_permission("work_orders.create")),
    db: AsyncSession = Depends(get_db),
):
    wo = await WorkOrderService(db).create(principal, payload)
    return ApiResponse(data=wo, message="Orden de trabajo creada")


@router.get("/work-orders/{work_order_id}", response_model=ApiResponse[WorkOrderRead])
async def get_work_order(
    work_order_id: uuid.UUID,
    principal: Principal = Depends(require_permission("work_orders.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).get_full(principal, work_order_id))


@router.patch("/work-orders/{work_order_id}", response_model=ApiResponse[WorkOrderRead])
async def update_work_order(
    work_order_id: uuid.UUID,
    payload: WorkOrderUpdate,
    principal: Principal = Depends(require_permission("work_orders.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).update(principal, work_order_id, payload))


@router.post("/work-orders/{work_order_id}/action", response_model=ApiResponse[WorkOrderRead])
async def work_order_action(
    work_order_id: uuid.UUID,
    payload: WorkOrderAction,
    principal: Principal = Depends(require_permission("work_orders.change_status")),
    db: AsyncSession = Depends(get_db),
):
    wo = await WorkOrderService(db).action(principal, work_order_id, payload.action, payload.notes)
    return ApiResponse(data=wo, message=f"Acción '{payload.action}' aplicada")


@router.post("/work-orders/{work_order_id}/services", response_model=ApiResponse[WorkOrderServiceRead], status_code=201)
async def add_wo_service(
    work_order_id: uuid.UUID,
    payload: WorkOrderServiceAdd,
    principal: Principal = Depends(require_permission("work_orders.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).add_service(principal, work_order_id, payload))


@router.post("/work-orders/{work_order_id}/labor", response_model=ApiResponse[LaborEntryRead], status_code=201)
async def add_wo_labor(
    work_order_id: uuid.UUID,
    payload: LaborEntryCreate,
    principal: Principal = Depends(require_permission("labor.create")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).add_labor(principal, work_order_id, payload))


@router.post("/work-orders/{work_order_id}/parts", response_model=ApiResponse[WorkOrderPartRead], status_code=201)
async def add_wo_part(
    work_order_id: uuid.UUID,
    payload: WorkOrderPartAdd,
    principal: Principal = Depends(require_permission("work_orders.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).add_part(principal, work_order_id, payload))


@router.post("/work-orders/{work_order_id}/technicians", response_model=ApiResponse[WorkOrderTechnicianRead], status_code=201)
async def assign_technician(
    work_order_id: uuid.UUID,
    payload: WorkOrderTechnicianAssign,
    principal: Principal = Depends(require_permission("technicians.assign")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).assign_technician(principal, work_order_id, payload))


@router.post("/work-orders/{work_order_id}/technicians/{tech_id}/finish", response_model=ApiResponse[WorkOrderTechnicianRead])
async def finish_technician(
    work_order_id: uuid.UUID,
    tech_id: uuid.UUID,
    principal: Principal = Depends(require_permission("technicians.assign")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).finish_technician(principal, work_order_id, tech_id))


# ---------------------------------------------------------------- checklists
@router.post("/checklists", response_model=ApiResponse[ChecklistRead], status_code=201)
async def create_checklist(
    payload: ChecklistCreate,
    principal: Principal = Depends(require_permission("work_orders.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).create_checklist(principal, payload), message="Checklist creado")


@router.get("/checklists/{checklist_id}", response_model=ApiResponse[ChecklistRead])
async def get_checklist(
    checklist_id: uuid.UUID,
    principal: Principal = Depends(require_permission("work_orders.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).get_checklist(principal, checklist_id))


@router.patch("/checklists/{checklist_id}/items/{item_id}", response_model=ApiResponse[ChecklistRead])
async def complete_checklist_item(
    checklist_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: ChecklistItemUpdate,
    principal: Principal = Depends(require_permission("work_orders.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WorkOrderService(db).complete_checklist_item(principal, checklist_id, item_id, payload))
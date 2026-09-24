"""Repositorios de taller: OTs, historiales y numeración de documentos."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ColumnElement, func, or_, select, text

from app.models.workshop import (
    Appointment,
    Checklist,
    ChecklistItem,
    Diagnostic,
    DiagnosticFinding,
    DiagnosticTest,
    LaborEntry,
    Quote,
    QuoteItem,
    Service,
    VehicleReception,
    WorkOrder,
    WorkOrderPart,
    WorkOrderService,
    WorkOrderStatusHistory,
    WorkOrderTechnician,
)
from app.repositories.base import BaseRepository


class WorkOrderRepository(BaseRepository[WorkOrder]):
    model = WorkOrder

    async def list_filtered(
        self,
        tenant_id: uuid.UUID,
        *,
        branch_id: uuid.UUID | None = None,
        status: str | None = None,
        client_id: uuid.UUID | None = None,
        q: str | None = None,
        page: int = 1,
        page_size: int = 20,
        order_by: Any | None = None,
    ) -> tuple[list[WorkOrder], int]:
        where: list[ColumnElement[bool]] = [WorkOrder.tenant_id == tenant_id]
        if branch_id:
            where.append(WorkOrder.branch_id == branch_id)
        if status:
            where.append(WorkOrder.status == status)
        if client_id:
            where.append(WorkOrder.client_id == client_id)
        if q:
            where.append(or_(WorkOrder.number.ilike(f"%{q}%"), WorkOrder.notes.ilike(f"%{q}%")))
        return await self.list_paginated(
            where=where, order_by=order_by or WorkOrder.opened_at.desc(), page=page, page_size=page_size
        )

    async def count_by_status(self, tenant_id: uuid.UUID) -> dict[str, int]:
        rows = (
            await self.session.execute(
                select(WorkOrder.status, func.count()).where(WorkOrder.tenant_id == tenant_id).group_by(WorkOrder.status)
            )
        ).all()
        return {status: count for status, count in rows}

    async def add_status_history(
        self,
        tenant_id: uuid.UUID,
        work_order_id: uuid.UUID,
        from_status: str | None,
        to_status: str,
        changed_by: uuid.UUID | None,
        notes: str | None,
    ) -> WorkOrderStatusHistory:
        return await self.add(
            WorkOrderStatusHistory(
                tenant_id=tenant_id,
                work_order_id=work_order_id,
                from_status=from_status,
                to_status=to_status,
                changed_by=changed_by,
                notes=notes,
            )
        )

    async def list_services(self, work_order_id: uuid.UUID) -> list[WorkOrderService]:
        stmt = select(WorkOrderService).where(WorkOrderService.work_order_id == work_order_id).order_by(WorkOrderService.id)
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_parts(self, work_order_id: uuid.UUID) -> list[WorkOrderPart]:
        stmt = select(WorkOrderPart).where(WorkOrderPart.work_order_id == work_order_id).order_by(WorkOrderPart.id)
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_labor(self, work_order_id: uuid.UUID) -> list[LaborEntry]:
        stmt = select(LaborEntry).where(LaborEntry.work_order_id == work_order_id).order_by(LaborEntry.id)
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_technicians(self, work_order_id: uuid.UUID) -> list[WorkOrderTechnician]:
        stmt = (
            select(WorkOrderTechnician)
            .where(WorkOrderTechnician.work_order_id == work_order_id)
            .order_by(WorkOrderTechnician.assigned_at)
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_history(self, work_order_id: uuid.UUID) -> list[WorkOrderStatusHistory]:
        stmt = (
            select(WorkOrderStatusHistory)
            .where(WorkOrderStatusHistory.work_order_id == work_order_id)
            .order_by(WorkOrderStatusHistory.changed_at)
        )
        return list((await self.session.execute(stmt)).scalars().all())


class DocumentNumberRepository:
    """Numeración por secuencias del tenant usando la función del baseline SQL.

    ``next_document_number(tenant_id, branch_id, doc_type, prefix, year)`` devuelve
    ya el número formateado (ej: ``OT-2026-000001``).
    """

    def __init__(self, session) -> None:
        self.session = session

    async def next_number(self, tenant_id: uuid.UUID, branch_id: uuid.UUID | None, *, doc_type: str, prefix: str) -> str:
        result = await self.session.execute(
            text("SELECT next_document_number(:tenant_id, :branch_id, :doc_type, :prefix, :year)"),
            {
                "tenant_id": tenant_id,
                "branch_id": branch_id,
                "doc_type": doc_type,
                "prefix": prefix,
                "year": datetime.utcnow().year,
            },
        )
        return result.scalar_one()


class ServiceRepository(BaseRepository[Service]):
    model = Service

    async def search(self, tenant_id: uuid.UUID, q: str | None = None, page: int = 1, page_size: int = 20):
        where: list[ColumnElement[bool]] = [Service.tenant_id == tenant_id]
        if q:
            where.append(or_(Service.name.ilike(f"%{q}%"), Service.code.ilike(f"%{q}%")))
        return await self.list_paginated(where=where, order_by=Service.name, page=page, page_size=page_size)


class AppointmentRepository(BaseRepository[Appointment]):
    model = Appointment

    async def list_for_date_range(self, tenant_id: uuid.UUID, branch_id: uuid.UUID | None, start, end) -> list[Appointment]:
        where: list[ColumnElement[bool]] = [Appointment.tenant_id == tenant_id, Appointment.scheduled_at >= start, Appointment.scheduled_at <= end]
        if branch_id:
            where.append(Appointment.branch_id == branch_id)
        return await self.list(where=where, order_by=Appointment.scheduled_at)

    async def count_by_status(self, tenant_id: uuid.UUID) -> dict[str, int]:
        rows = (
            await self.session.execute(
                select(Appointment.status, func.count()).where(Appointment.tenant_id == tenant_id).group_by(Appointment.status)
            )
        ).all()
        return {status: count for status, count in rows}


class ReceptionRepository(BaseRepository[VehicleReception]):
    model = VehicleReception


class DiagnosticRepository(BaseRepository[Diagnostic]):
    model = Diagnostic

    async def with_findings(self, tenant_id: uuid.UUID, diagnostic_id: uuid.UUID) -> Diagnostic | None:
        return await self.get_tenant(diagnostic_id, tenant_id)

    async def list_findings(self, diagnostic_id: uuid.UUID) -> list[DiagnosticFinding]:
        return list(
            (await self.session.execute(select(DiagnosticFinding).where(DiagnosticFinding.diagnostic_id == diagnostic_id))).scalars()
        )

    async def list_tests(self, diagnostic_id: uuid.UUID) -> list[DiagnosticTest]:
        return list(
            (await self.session.execute(select(DiagnosticTest).where(DiagnosticTest.diagnostic_id == diagnostic_id))).scalars()
        )


class QuoteRepository(BaseRepository[Quote]):
    model = Quote

    async def list_filtered(
        self,
        tenant_id: uuid.UUID,
        *,
        status: str | None = None,
        client_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Quote], int]:
        where: list[ColumnElement[bool]] = [Quote.tenant_id == tenant_id]
        if status:
            where.append(Quote.status == status)
        if client_id:
            where.append(Quote.client_id == client_id)
        return await self.list_paginated(where=where, order_by=Quote.created_at.desc(), page=page, page_size=page_size)

    async def list_items(self, quote_id: uuid.UUID) -> list[QuoteItem]:
        return list(
            (await self.session.execute(select(QuoteItem).where(QuoteItem.quote_id == quote_id))).scalars()
        )


class ChecklistRepository(BaseRepository[Checklist]):
    model = Checklist

    async def list_items(self, checklist_id: uuid.UUID) -> list[ChecklistItem]:
        return list(
            (await self.session.execute(select(ChecklistItem).where(ChecklistItem.checklist_id == checklist_id))).scalars()
        )
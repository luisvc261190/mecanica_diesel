"""Servicio de tablero: métricas agregadas del tenant."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.models.aux_models import Notification
from app.models.crm import Client, Vehicle
from app.models.finance import Payment
from app.models.organization import Branch, Employee
from app.models.workshop import Appointment, Quote
from app.repositories.aux_repos import NotificationRepository
from app.repositories.crm_repos import ClientRepository, VehicleRepository
from app.repositories.workshop_repos import AppointmentRepository, QuoteRepository, WorkOrderRepository
from app.schemas.dashboard import DashboardSummary
from app.services.audit import AuditService
from app.services.context import Principal
from app.services.inventory import InventoryService


class DashboardService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.inventory = InventoryService(db)
        self.wo_repo = WorkOrderRepository(db)
        self.appointments = AppointmentRepository(db)
        self.audit = AuditService(db)

    async def _revenue(self, tenant_id: uuid.UUID, start: datetime, end: datetime) -> Decimal:
        total = await self.db.scalar(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.tenant_id == tenant_id,
                Payment.status == "COMPLETED",
                Payment.paid_at >= start,
                Payment.paid_at < end,
            )
        )
        return Decimal(total or 0)

    async def summary(self, ctx: Principal) -> DashboardSummary:
        await set_tenant_context(self.db, ctx.tc())
        tid = ctx.tenant_id
        today = datetime.now(UTC).date()
        day_start = datetime.combine(today, datetime.min.time(), tzinfo=UTC)
        month_start = datetime.combine(today.replace(day=1), datetime.min.time(), tzinfo=UTC)

        status_counts = await self.wo_repo.count_by_status(tid)
        quote_repo = QuoteRepository(self.db)
        open_statuses = ("RECEIVED", "DIAGNOSIS", "QUOTED", "WAITING_APPROVAL", "APPROVED")
        in_progress_statuses = ("IN_PROGRESS", "WAITING_PARTS", "QUALITY_CONTROL")
        ready_statuses = ("READY_FOR_PICKUP", "COMPLETED")

        appointments_today = await self.appointments.count(
            where=[Appointment.tenant_id == tid, Appointment.scheduled_at >= day_start, Appointment.scheduled_at < day_start.replace(hour=23, minute=59, second=59)]
        )
        appointments_scheduled = await self.appointments.count(
            where=[Appointment.tenant_id == tid, Appointment.status.in_(("SCHEDULED", "CONFIRMED"))]
        )

        return DashboardSummary(
            work_orders_open=sum(status_counts.get(s, 0) for s in open_statuses),
            work_orders_in_progress=sum(status_counts.get(s, 0) for s in in_progress_statuses),
            work_orders_ready=sum(status_counts.get(s, 0) for s in ready_statuses),
            quotes_pending=await quote_repo.count(where=[Quote.tenant_id == tid, Quote.status == "SENT"]),
            clients_total=await ClientRepository(self.db).count(where=[Client.tenant_id == tid]),
            vehicles_total=await VehicleRepository(self.db).count(where=[Vehicle.tenant_id == tid]),
            appointments_today=appointments_today,
            appointments_scheduled=appointments_scheduled,
            revenue_today=await self._revenue(tid, day_start, day_start.replace(hour=23, minute=59, second=59)),
            revenue_month=await self._revenue(tid, month_start, day_start.replace(hour=23, minute=59, second=59)),
            parts_low_stock=await self.inventory.low_stock_count(ctx),
            parts_total=await self.inventory.parts_total(ctx),
            technicians_active=await self.db.scalar(
                select(func.count()).select_from(Employee).where(
                    Employee.tenant_id == tid,
                    Employee.status == "ACTIVE",
                    or_(Employee.job_title.ilike("%tecnic%"), Employee.specialty.ilike("%mecanic%")),
                )
            )
            or 0,
        )

    async def branches(self, ctx: Principal) -> list[Branch]:
        await set_tenant_context(self.db, ctx.tc())
        return (
            await self.db.scalars(
                select(Branch).where(Branch.tenant_id == ctx.tenant_id, Branch.deleted_at.is_(None))
            )
        ).all()

    async def notifications(self, ctx: Principal, page: int = 1, page_size: int = 20):
        await set_tenant_context(self.db, ctx.tc())
        base = NotificationRepository(self.db)
        total = await base.count(where=[Notification.user_id == ctx.user_id, Notification.is_read.is_(False)])
        rows = await base.list(
            where=[Notification.user_id == ctx.user_id],
            order_by=Notification.created_at.desc(),
            limit=page_size,
            offset=(page - 1) * page_size,
        )
        return rows, total
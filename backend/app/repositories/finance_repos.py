"""Repositorios de finanzas y auditoría."""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.types import Numeric

from app.models.aux_models import AuditLog
from app.models.finance import Payment, Warranty, WarrantyClaim
from app.repositories.base import BaseRepository


class PaymentRepository(BaseRepository[Payment]):
    model = Payment

    async def total_paid(self, work_order_id: uuid.UUID, tenant_id: uuid.UUID) -> Decimal:
        stmt = (
            select(func.coalesce(func.sum(Payment.amount), 0).cast(Numeric(20, 2)))
            .where(Payment.work_order_id == work_order_id)
            .where(Payment.tenant_id == tenant_id)
            .where(Payment.status == "COMPLETED")
        )
        return (await self.session.execute(stmt)).scalar_one()

    async def list_for_work_order(self, work_order_id: uuid.UUID, tenant_id: uuid.UUID) -> list[Payment]:
        return await self.list(
            where=[Payment.work_order_id == work_order_id, Payment.tenant_id == tenant_id],
            order_by=Payment.paid_at.desc(),
        )


class WarrantyRepository(BaseRepository[Warranty]):
    model = Warranty


class ClaimRepository(BaseRepository[WarrantyClaim]):
    model = WarrantyClaim


class AuditRepository(BaseRepository[AuditLog]):
    model = AuditLog

    async def record(
        self,
        *,
        tenant_id: uuid.UUID | None,
        user_id: uuid.UUID | None,
        action: str,
        entity: str,
        entity_id: uuid.UUID | None = None,
        old_values: dict | None = None,
        new_values: dict | None = None,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        return await self.add(
            AuditLog(
                tenant_id=tenant_id,
                user_id=user_id,
                action=action,
                entity=entity,
                entity_id=entity_id,
                old_values=old_values,
                new_values=new_values,
                ip=ip,
                user_agent=user_agent,
            )
        )

    async def list_filtered(
        self,
        tenant_id: uuid.UUID,
        *,
        action: str | None = None,
        entity: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[AuditLog], int]:
        where: list[ColumnElement[bool]] = [AuditLog.tenant_id == tenant_id]
        if action:
            where.append(AuditLog.action == action)
        if entity:
            where.append(AuditLog.entity == entity)
        return await self.list_paginated(
            where=where, order_by=AuditLog.created_at.desc(), page=page, page_size=page_size
        )
"""Servicio de auditoría: registrar eventos y consultar el historial del tenant."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.repositories.finance_repos import AuditRepository
from app.schemas.audit import AuditRead
from app.services.context import Principal


class AuditService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AuditRepository(db)

    async def record_raw(
        self,
        ctx: Principal,
        action: str,
        entity: str,
        entity_id: uuid.UUID | None = None,
        *,
        old_values: dict | None = None,
        new_values: dict | None = None,
    ):
        await self.repo.record(
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            old_values=old_values,
            new_values=new_values,
        )

    async def list(self, ctx: Principal, *, action: str | None, entity: str | None, page: int, page_size: int):
        await set_tenant_context(self.db, ctx.tc())
        items, total = await self.repo.list_filtered(
            ctx.tenant_id, action=action, entity=entity, page=page, page_size=page_size
        )
        return [AuditRead.model_validate(i) for i in items], total
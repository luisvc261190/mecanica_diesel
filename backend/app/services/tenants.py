"""Servicios de tenant: perfil, settings, suscripción y planes."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.core.exceptions import NotFoundError
from app.models.organization import Branch, TenantSetting
from app.models.platform import Plan, TenantSubscription
from app.repositories.platform_repos import TenantRepository
from app.schemas.organization import TenantSettingsRead, TenantSettingsUpdate
from app.schemas.tenants import PlanRead, SubscriptionRead, TenantRead, TenantUpdate
from app.services.context import Principal


class TenantService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.tenants = TenantRepository(db)

    async def _require_ctx(self, ctx: Principal) -> uuid.UUID:
        if ctx.tenant_id is None:
            raise NotFoundError(message="Sin tenant activo", code="TENANT_REQUIRED")
        return ctx.tenant_id

    async def get(self, ctx: Principal) -> TenantRead:
        tid = await self._require_ctx(ctx)
        await set_tenant_context(self.db, ctx.tc())
        tenant = await self.tenants.get(tid)
        if tenant is None:
            raise NotFoundError(message="Tenant no encontrado")
        return TenantRead.model_validate(tenant)

    async def update(self, ctx: Principal, payload: TenantUpdate) -> TenantRead:
        tid = await self._require_ctx(ctx)
        await set_tenant_context(self.db, ctx.tc())
        tenant = await self.tenants.get_tenant_or_404(tid, tid)
        await self.tenants.update(tenant, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return TenantRead.model_validate(tenant)

    # --------------------------------------------------------------- settings
    async def get_settings(self, ctx: Principal) -> TenantSettingsRead:
        tid = await self._require_ctx(ctx)
        await set_tenant_context(self.db, ctx.tc())
        setting = (
            await self.db.execute(select(TenantSetting).where(TenantSetting.tenant_id == tid))
        ).scalar_one_or_none()
        if setting is None:
            setting = TenantSetting(tenant_id=tid)
            self.db.add(setting)
            await self.db.commit()
        return TenantSettingsRead.model_validate(setting)

    async def update_settings(self, ctx: Principal, payload: TenantSettingsUpdate) -> TenantSettingsRead:
        tid = await self._require_ctx(ctx)
        await set_tenant_context(self.db, ctx.tc())
        setting = (
            await self.db.execute(select(TenantSetting).where(TenantSetting.tenant_id == tid))
        ).scalar_one_or_none()
        if setting is None:
            setting = TenantSetting(tenant_id=tid)
            self.db.add(setting)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(setting, key, value)
        await self.db.commit()
        return TenantSettingsRead.model_validate(setting)

    # ---------------------------------------------------------- subscription
    async def get_subscription(self, ctx: Principal) -> SubscriptionRead:
        tid = await self._require_ctx(ctx)
        await set_tenant_context(self.db, ctx.tc())
        sub = (
            await self.db.execute(
                select(TenantSubscription)
                .where(TenantSubscription.tenant_id == tid)
                .order_by(TenantSubscription.started_at.desc())
            )
        ).scalar_one_or_none()
        if sub is None:
            raise NotFoundError(message="Sin suscripción activa")
        plan = (await self.db.execute(select(Plan).where(Plan.id == sub.plan_id))).scalar_one_or_none()
        out = SubscriptionRead.model_validate(sub)
        if plan:
            out.plan = PlanRead.model_validate(plan)
        return out

    async def list_branches(self, ctx: Principal) -> list[Branch]:
        tid = await self._require_ctx(ctx)
        await set_tenant_context(self.db, ctx.tc())
        return (await self.db.scalars(select(Branch).where(Branch.tenant_id == tid))).all() or []

    async def list_plans(self) -> list[PlanRead]:
        plans = (await self.db.execute(select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.sort_order))).scalars().all()
        return [PlanRead.model_validate(p) for p in plans]
"""Servicios de plataforma: alta de empresas y gestión de usuarios gestionados por el SUPER_ADMIN."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_platform_context
from app.core.exceptions import ValidationError
from app.core.security import hash_password
from app.models.platform import Role, Tenant, User, UserTenantRole
from app.repositories.platform_repos import RefreshTokenRepository, TenantRepository, UserRepository
from app.schemas.platform import (
    PlatformPasswordReset,
    PlatformTenantCreate,
    PlatformTenantCreated,
    PlatformUserRead,
)
from app.schemas.tenants import TenantRead
from app.schemas.users import UserUpdate
from app.services.audit import AuditService
from app.services.context import Principal
from app.services.onboarding import OnboardingService


class PlatformService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.tenants = TenantRepository(db)
        self.refresh = RefreshTokenRepository(db)
        self.audit = AuditService(db)
        self.onboarding = OnboardingService(db)

    # ------------------------------------------------------------------ empresas
    async def create_tenant(self, payload: PlatformTenantCreate) -> PlatformTenantCreated:
        """Crea la empresa + su admin en contexto de plataforma y persiste en una transacción."""
        user, tenant = await self.onboarding.create_company(
            company_name=payload.company_name,
            slug=payload.slug,
            owner_email=payload.admin_email,
            owner_full_name=payload.admin_full_name,
            owner_phone=payload.admin_phone,
            password=payload.password,
            plan_code=payload.plan_code,
            currency=payload.currency,
            country=payload.country,
        )
        await self.db.commit()
        return PlatformTenantCreated(
            tenant=TenantRead.model_validate(tenant),
            owner_email=user.email,
            owner_full_name=user.full_name,
            plan_code=payload.plan_code,
        )

    # -------------------------------------------------------------------- usuarios
    async def _primary_tenant(self, user_id: uuid.UUID) -> tuple[uuid.UUID | None, str | None, list[str]]:
        """Tenant principal del usuario (prefiere el OWNER) y sus roles en ese tenant."""
        rows = (
            await self.db.execute(
                select(Tenant.id, Tenant.commercial_name, Tenant.created_at, Role.code)
                .join(UserTenantRole, UserTenantRole.tenant_id == Tenant.id)
                .join(Role, Role.id == UserTenantRole.role_id)
                .where(UserTenantRole.user_id == user_id, Tenant.deleted_at.is_(None))
            )
        ).all()
        grouped: dict[uuid.UUID, dict] = {}
        for tenant_id, name, created_at, role_code in rows:
            entry = grouped.setdefault(tenant_id, {"name": name, "created_at": created_at, "roles": []})
            entry["roles"].append(role_code)
        if not grouped:
            return None, None, []
        ordered = sorted(grouped.keys(), key=lambda tid: grouped[tid]["created_at"])
        primary = next((tid for tid in ordered if "OWNER" in grouped[tid]["roles"]), ordered[0])
        return primary, grouped[primary]["name"], grouped[primary]["roles"]

    async def _to_platform_read(self, user: User) -> PlatformUserRead:
        tenant_id, tenant_name, roles = await self._primary_tenant(user.id)
        return PlatformUserRead(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            is_active=user.is_active,
            is_platform_admin=user.is_platform_admin,
            last_login_at=user.last_login_at,
            tenant_id=tenant_id,
            tenant_name=tenant_name,
            roles=roles,
        )

    async def list_users(
        self, ctx: Principal, *, search: str | None, page: int, page_size: int
    ) -> tuple[list[PlatformUserRead], int]:
        await set_platform_context(self.db)
        users, total = await self.users.list_platform_users(search=search, page=page, page_size=page_size)
        return [await self._to_platform_read(u) for u in users], total

    async def get_user(self, ctx: Principal, user_id: uuid.UUID) -> PlatformUserRead:
        await set_platform_context(self.db)
        return await self._to_platform_read(await self.users.get_or_404(user_id))

    async def update_user(self, ctx: Principal, user_id: uuid.UUID, payload: UserUpdate) -> PlatformUserRead:
        await set_platform_context(self.db)
        user = await self.users.get_or_404(user_id)
        data = payload.model_dump(exclude_unset=True)
        if data.get("is_active") is False and user.id == ctx.user_id:
            raise ValidationError(message="No puedes desactivar tu propia cuenta", code="SELF_DEACTIVATE")
        changed = {key: value for key, value in data.items() if getattr(user, key, None) != value}
        for key, value in data.items():
            setattr(user, key, value)
        await self.db.flush()
        await self.audit.record_raw(ctx, "USER_UPDATE", "users", user.id, new_values=changed)
        await self.db.commit()
        return await self._to_platform_read(user)

    async def reset_password(self, ctx: Principal, user_id: uuid.UUID, payload: PlatformPasswordReset) -> PlatformUserRead:
        await set_platform_context(self.db)
        user = await self.users.get_or_404(user_id)
        user.password_hash = hash_password(payload.password)
        await self.refresh.revoke_all_for_user(user.id)
        await self.audit.record_raw(ctx, "PASSWORD_RESET", "users", user.id)
        await self.db.commit()
        return await self._to_platform_read(user)
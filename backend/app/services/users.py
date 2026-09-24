"""Servicios de usuarios y asignación de roles dentro del tenant."""
from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.core.exceptions import ConflictError, PermissionDeniedError, ValidationError
from app.core.security import hash_password
from app.models.platform import Role
from app.repositories.platform_repos import UserRepository
from app.schemas.users import RoleRead, UserCreate, UserRead, UserUpdate
from app.services.audit import AuditService
from app.services.context import Principal

_PLATFORM_ROLES = {"SUPER_ADMIN"}


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = UserRepository(db)
        self.audit = AuditService(db)

    async def _role_by_code(self, code: str) -> Role | None:
        return (await self.db.execute(select(Role).where(Role.code == code))).scalar_one_or_none()

    async def _to_read(self, user, ctx: Principal) -> UserRead:
        out = UserRead.model_validate(user)
        if ctx.tenant_id:
            out.roles = await self.repo.get_roles_for_tenant(user.id, ctx.tenant_id)
        return out

    async def get(self, ctx: Principal, user_id: uuid.UUID) -> UserRead:
        await set_tenant_context(self.db, ctx.tc())
        user = await self.repo.get_or_404(user_id)
        return await self._to_read(user, ctx)

    async def list(self, ctx: Principal, *, search: str | None, page: int, page_size: int) -> tuple[list[UserRead], int]:
        await set_tenant_context(self.db, ctx.tc())
        users, total = await self.repo.list_users_in_tenant(ctx.tenant_id, search=search, page=page, page_size=page_size)
        return [await self._to_read(u, ctx) for u in users], total

    async def create(self, ctx: Principal, payload: UserCreate) -> UserRead:
        await set_tenant_context(self.db, ctx.tc())
        if await self.repo.by_email(payload.email.strip()):
            raise ConflictError(message="El email ya está registrado", code="EMAIL_IN_USE")
        if payload.role_code in _PLATFORM_ROLES:
            raise PermissionDeniedError(message="No puedes asignar roles de plataforma")
        role = await self._role_by_code(payload.role_code)
        if role is None or role.scope != "TENANT":
            raise ValidationError(message="Rol inválido", code="INVALID_ROLE")
        user = await self.repo.create(
            email=payload.email.strip().lower(),
            password_hash=hash_password(payload.password),
            full_name=payload.full_name,
            phone=payload.phone,
        )
        await self.repo.assign_role(user.id, ctx.tenant_id, role)
        await self.audit.record_raw(ctx, "USER_CREATE", "users", user.id, new_values={"email": user.email, "role": role.code})
        await self.db.commit()
        return await self._to_read(user, ctx)

    async def update(self, ctx: Principal, user_id: uuid.UUID, payload: UserUpdate) -> UserRead:
        await set_tenant_context(self.db, ctx.tc())
        user = await self.repo.get_or_404(user_id)
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(user, key, value)
        await self.db.flush()
        await self.audit.record_raw(ctx, "USER_UPDATE", "users", user.id)
        await self.db.commit()
        return await self._to_read(user, ctx)

    async def assign_role(self, ctx: Principal, user_id: uuid.UUID, role_code: str) -> UserRead:
        await set_tenant_context(self.db, ctx.tc())
        if role_code in _PLATFORM_ROLES:
            raise PermissionDeniedError(message="No puedes asignar roles de plataforma")
        role = await self._role_by_code(role_code)
        if role is None or role.scope != "TENANT":
            raise ValidationError(message="Rol inválido", code="INVALID_ROLE")
        user = await self.repo.get_or_404(user_id)
        await self.repo.assign_role(user.id, ctx.tenant_id, role)
        await self.audit.record_raw(ctx, "ROLE_ASSIGN", "users", user.id, new_values={"role": role.code})
        await self.db.commit()
        return await self._to_read(user, ctx)

    async def remove_role(self, ctx: Principal, user_id: uuid.UUID, role_code: str) -> UserRead:
        await set_tenant_context(self.db, ctx.tc())
        if role_code in _PLATFORM_ROLES:
            raise PermissionDeniedError(message="No puedes modificar roles de plataforma")
        user = await self.repo.get_or_404(user_id)
        await self.repo.remove_role(user.id, ctx.tenant_id, role_code)
        await self.audit.record_raw(ctx, "ROLE_REMOVE", "users", user.id, old_values={"role": role_code})
        await self.db.commit()
        return await self._to_read(user, ctx)

    async def list_roles(self, ctx: Principal) -> list[RoleRead]:
        roles = (
            await self.db.execute(
                select(Role).where(Role.scope == "TENANT").order_by(Role.name)
            )
        ).scalars().all()
        return [RoleRead.model_validate(r) for r in roles]
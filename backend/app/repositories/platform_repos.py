"""Repositorios de plataforma: usuarios, tokens de refresco y tenants."""
from __future__ import annotations

import uuid

from sqlalchemy import func, select, text

from app.core.exceptions import ConflictError
from app.models.platform import RefreshToken, Role, Tenant, User, UserTenantRole
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    model = User

    async def by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_roles_for_tenant(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> list[str]:
        stmt = (
            select(Role.code)
            .join(UserTenantRole, UserTenantRole.role_id == Role.id)
            .where(UserTenantRole.user_id == user_id, UserTenantRole.tenant_id == tenant_id)
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_platform_users(
        self, *, search: str | None = None, page: int = 1, page_size: int = 20
    ) -> tuple[list[User], int]:
        """Usuarios de todas las empresas. Requiere contexto de plataforma (RLS lo permite)."""
        base = select(User).where(User.deleted_at.is_(None))
        if search:
            like = f"%{search}%"
            base = base.where(
                User.full_name.ilike(like) | User.email.ilike(like) | User.phone.ilike(like)
            )
        total = (await self.session.execute(select(func.count()).select_from(base.order_by(None).subquery()))).scalar_one()
        stmt = base.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size)
        return list((await self.session.execute(stmt)).scalars().all()), total

    async def list_users_in_tenant(
        self, tenant_id: uuid.UUID, *, search: str | None = None, page: int = 1, page_size: int = 20
    ) -> tuple[list[User], int]:
        base = (
            select(User)
            .join(UserTenantRole, UserTenantRole.user_id == User.id)
            .where(UserTenantRole.tenant_id == tenant_id, User.deleted_at.is_(None))
            .group_by(User.id)
        )
        if search:
            like = f"%{search}%"
            base = base.where(
                User.full_name.ilike(like) | User.email.ilike(like) | text("users.phone ILIKE :like").bindparams(like=like)
            )
        total = (
            await self.session.execute(select(func.count()).select_from(base.order_by(None).subquery()))
        ).scalar_one()
        stmt = base.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size)
        return list((await self.session.execute(stmt)).scalars().all()), total

    async def assign_role(self, user_id: uuid.UUID, tenant_id: uuid.UUID, role: Role) -> None:
        exists = await self.session.execute(
            select(UserTenantRole.id).where(
                UserTenantRole.tenant_id == tenant_id,
                UserTenantRole.user_id == user_id,
                UserTenantRole.role_id == role.id,
            )
        )
        if exists.first():
            return
        self.session.add(UserTenantRole(tenant_id=tenant_id, user_id=user_id, role_id=role.id))
        await self.session.flush()

    async def remove_role(self, user_id: uuid.UUID, tenant_id: uuid.UUID, role_code: str) -> None:
        stmt = (
            select(UserTenantRole.id)
            .join(Role, Role.id == UserTenantRole.role_id)
            .where(
                UserTenantRole.tenant_id == tenant_id,
                UserTenantRole.user_id == user_id,
                Role.code == role_code,
            )
        )
        row = (await self.session.execute(stmt)).first()
        if row:
            await self.session.execute(
                UserTenantRole.__table__.delete().where(UserTenantRole.id == row.id)
            )


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    async def find_active_by_hash(self, token_hash: str) -> RefreshToken | None:
        stmt = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> int:
        stmt = (
            RefreshToken.__table__.update()
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=func.now())
        )
        res = await self.session.execute(stmt)
        return res.rowcount or 0


class TenantRepository(BaseRepository[Tenant]):
    model = Tenant

    async def by_slug(self, slug: str) -> Tenant | None:
        stmt = select(Tenant).where(Tenant.slug == slug)
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def require_unique_slug(self, slug: str) -> None:
        if await self.by_slug(slug):
            raise ConflictError(message="El slug ya está en uso", code="SLUG_IN_USE")
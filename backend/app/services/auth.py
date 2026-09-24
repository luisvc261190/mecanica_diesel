"""Servicio de autenticación: login, refresh (rotación), logout y gestión de sesiones."""
from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    token_payload,
    verify_password,
)
from app.models.platform import RefreshToken, Tenant, UserTenantRole
from app.repositories.platform_repos import RefreshTokenRepository, UserRepository
from app.schemas.auth import TokenPair, UserSession

settings = get_settings()


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.refresh_repo = RefreshTokenRepository(db)

    # ------------------------------------------------------------------ helpers
    async def _default_tenant(self, user_id: uuid.UUID) -> uuid.UUID | None:
        stmt = (
            select(UserTenantRole.tenant_id, func.min(UserTenantRole.created_at).label("first"))
            .join(Tenant, Tenant.id == UserTenantRole.tenant_id)
            .where(UserTenantRole.user_id == user_id, Tenant.status == "ACTIVE")
            .group_by(UserTenantRole.tenant_id)
            .order_by("first")
            .limit(1)
        )
        row = (await self.db.execute(stmt)).first()
        return row[0] if row else None

    async def _issue_tokens(self, user, tenant_id: uuid.UUID | None, user_agent: str | None) -> TokenPair:
        roles = await self.users.get_roles_for_tenant(user.id, tenant_id) if tenant_id else []
        token_id = uuid.uuid4()
        access = create_access_token(user_id=user.id, tenant_id=tenant_id, roles=roles)
        refresh = create_refresh_token(user_id=user.id, jti=token_id)
        self.db.add(
            RefreshToken(
                id=token_id,
                user_id=user.id,
                token_hash=_hash_token(refresh),
                expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
                user_agent=user_agent,
            )
        )
        await self.db.flush()
        user_session = UserSession(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            roles=roles,
            tenant_id=tenant_id,
            is_platform_admin=user.is_platform_admin,
        )
        return TokenPair(
            access_token=access,
            refresh_token=refresh,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=user_session,
        )

    # ------------------------------------------------------------------ login
    async def login(self, email: str, password: str, user_agent: str | None = None) -> TokenPair:
        user = await self.users.by_email(email.strip())
        if user is None or not verify_password(password, user.password_hash):
            raise UnauthorizedError("Credenciales inválidas", code="INVALID_CREDENTIALS")
        if not user.is_active:
            raise UnauthorizedError("Usuario inactivo", code="ACCOUNT_INACTIVE")
        user.last_login_at = datetime.now(UTC)
        await self.db.flush()
        tenant_id = await self._default_tenant(user.id)
        pair = await self._issue_tokens(user, tenant_id, user_agent)
        await self.db.commit()
        return pair

    # ----------------------------------------------------------------- refresh
    async def refresh(self, raw_token: str, user_agent: str | None = None) -> TokenPair:
        payload = token_payload(raw_token, expected_type="refresh")
        row = await self.refresh_repo.find_active_by_hash(_hash_token(raw_token))
        if row is None or row.id != uuid.UUID(payload.get("jti", "")) or row.user_id != uuid.UUID(payload.get("sub", "")):
            raise UnauthorizedError("Sesión inválida o revocada", code="REFRESH_INVALID")
        if row.expires_at < datetime.now(UTC):
            await self.refresh_repo.revoke_all_for_user(row.user_id)
            raise UnauthorizedError("Sesión expirada", code="REFRESH_EXPIRED")
        user = await self.users.get(row.user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Usuario inactivo", code="ACCOUNT_INACTIVE")
        row.revoked_at = datetime.now(UTC)
        await self.db.flush()
        tenant_id = await self._default_tenant(user.id)
        pair = await self._issue_tokens(user, tenant_id, user_agent)
        await self.db.commit()
        return pair

    # ------------------------------------------------------------------ logout
    async def logout(self, raw_token: str) -> None:
        payload = token_payload(raw_token, expected_type="refresh")
        row = await self.refresh_repo.find_active_by_hash(_hash_token(raw_token))
        if row is not None and row.id == uuid.UUID(payload.get("jti", "")):
            row.revoked_at = datetime.now(UTC)
            await self.db.commit()

    async def logout_all(self, user_id: uuid.UUID) -> None:
        await self.refresh_repo.revoke_all_for_user(user_id)
        await self.db.commit()

    # ---------------------------------------------------- change password/token
    async def change_password(self, user_id: uuid.UUID, current_password: str, new_password: str) -> None:
        user = await self.users.get_or_404(user_id)
        if not verify_password(current_password, user.password_hash):
            raise UnauthorizedError("La contraseña actual es incorrecta", code="INVALID_CURRENT_PASSWORD")
        user.password_hash = hash_password(new_password)
        await self.refresh_repo.revoke_all_for_user(user_id)
        await self.db.commit()

    async def list_tenants(self, user_id: uuid.UUID) -> list[dict]:
        stmt = (
            select(Tenant.id, Tenant.slug, Tenant.commercial_name)
            .join(UserTenantRole, UserTenantRole.tenant_id == Tenant.id)
            .where(UserTenantRole.user_id == user_id, Tenant.status == "ACTIVE")
            .order_by(Tenant.commercial_name)
        )
        rows = (await self.db.execute(stmt)).all()
        return [{"id": r[0], "slug": r[1], "commercial_name": r[2]} for r in rows]

    async def select_tenant(self, user_id: uuid.UUID, tenant_id: uuid.UUID, user_agent: str | None = None) -> TokenPair:
        user = await self.users.get_or_404(user_id)
        roles = await self.users.get_roles_for_tenant(user_id, tenant_id)
        if not roles and not user.is_platform_admin:
            raise ConflictError(message="No perteneces a este tenant", code="NOT_TENANT_MEMBER")
        pair = await self._issue_tokens(user, tenant_id, user_agent)
        await self.db.commit()
        return pair
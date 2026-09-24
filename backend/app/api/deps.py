"""Dependencias HTTP: sesión, autenticación por JWT Bearer y RBAC por permiso."""
from __future__ import annotations

import uuid

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.exceptions import PermissionDeniedError, UnauthorizedError
from app.core.permissions import role_has_permission
from app.core.security import decode_token
from app.services.context import Principal

_bearer = HTTPBearer(auto_error=False)


async def get_db() -> AsyncSession:
    """Sesión por request, rollback automático ante error, sin commit implícito."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_optional_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal | None:
    """Resuelve el Principal del token de acceso si existe; None si no hay token."""
    if credentials is None:
        return None
    payload = decode_token(credentials.credentials)
    try:
        user_id = uuid.UUID(payload["sub"])
        tenant_id = uuid.UUID(payload["tid"]) if payload.get("tid") else None
        roles = tuple(payload.get("roles") or ())
    except (KeyError, TypeError, ValueError) as exc:
        raise UnauthorizedError("Token con claims inválidos", code="TOKEN_CLAIMS_INVALID") from exc
    # El email/full_name del token evita una query; si se necesita frescura, tocar base.
    return Principal(
        user_id=user_id,
        email=payload.get("email") or "",
        full_name=payload.get("name") or "",
        tenant_id=tenant_id,
        roles=roles,
        is_platform_admin=bool(roles and "SUPER_ADMIN" in roles),
    )


async def get_current_user(principal: Principal | None = Depends(get_optional_principal)) -> Principal:
    if principal is None:
        raise UnauthorizedError("Autenticación requerida", code="AUTH_REQUIRED")
    return principal


async def get_current_tenant(principal: Principal = Depends(get_current_user)) -> Principal:
    if principal.tenant_id is None:
        raise UnauthorizedError("Se requiere un tenant activo", code="TENANT_REQUIRED")
    return principal


def require_permission(*permissions: str):
    """Dependencia de RBAC: el rol del principal debe tener al menos un permiso de la lista."""

    async def _checker(
        principal: Principal = Depends(get_current_tenant),
    ) -> Principal:
        allowed = any(role_has_permission(role, perm) for role in principal.roles for perm in permissions)
        if not allowed:
            raise PermissionDeniedError(
                message=f"Permiso no otorgado: requiere {', '.join(permissions)}", code="PERMISSION_DENIED"
            )
        return principal

    return _checker


def require_platform_admin(principal: Principal = Depends(get_current_user)) -> Principal:
    if not principal.is_platform_admin:
        raise PermissionDeniedError(message="Se requiere acceso de plataforma", code="PLATFORM_ADMIN_ONLY")
    return principal
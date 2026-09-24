"""Contexto de la petición: identidad resuelta por el JWT de acceso."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.core.database import TenantContext
from app.core.exceptions import NotFoundError


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    email: str
    full_name: str
    tenant_id: uuid.UUID | None
    roles: tuple[str, ...] = ()
    is_platform_admin: bool = False

    def tc(self) -> TenantContext:
        if self.tenant_id is None:
            raise NotFoundError(message="Sin tenant activo en la sesión", code="TENANT_REQUIRED")
        return TenantContext(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            is_platform_admin=self.is_platform_admin,
        )
"""Capa HTTP: dependencias y puntos de entrada /api/v1."""
from app.api.deps import (
    get_current_tenant,
    get_current_user,
    get_db,
    get_optional_principal,
    require_permission,
    require_platform_admin,
)

__all__ = [
    "get_current_tenant",
    "get_current_user",
    "get_db",
    "get_optional_principal",
    "require_permission",
    "require_platform_admin",
]
"""Pruebas de construcción de la app, wiring de dependencias y RBAC (sin base de datos)."""
from __future__ import annotations

import uuid

import pytest
from app.api.deps import get_current_tenant, get_current_user, require_permission, require_platform_admin
from app.core.exceptions import PermissionDeniedError, UnauthorizedError
from app.core.permissions import role_has_permission
from app.main import create_app
from app.services.context import Principal


def _principal(roles=("RECEPTION",)) -> Principal:
    return Principal(
        user_id=uuid.uuid4(),
        email="worker@test.local",
        full_name="Worker",
        tenant_id=uuid.uuid4(),
        roles=roles,
        is_platform_admin=False,
    )


def test_app_builds_and_registers_endpoints():
    app = create_app()
    schema = app.openapi()
    paths = set(schema["paths"])
    expect = {"/api/v1/health", "/api/v1/auth/login", "/api/v1/clients", "/api/v1/workshop/work-orders"}
    assert expect <= paths
    assert len(paths) >= 70


def test_get_current_user_requires_auth():
    with pytest.raises(UnauthorizedError):
        _call_dep(get_current_user, None)


def _call_dep(dep, principal):
    import asyncio

    async def runner():
        return await dep(principal)

    return asyncio.run(runner())


def test_get_current_tenant_requires_tid():
    principal = _principal()
    p = _call_dep(get_current_tenant, principal)  # tiene tenant → OK
    assert p is principal
    no_tenant = Principal(
        user_id=uuid.uuid4(),
        email="x",
        full_name="x",
        tenant_id=None,
        roles=("OWNER",),
        is_platform_admin=False,
    )
    with pytest.raises(UnauthorizedError):
        _call_dep(get_current_tenant, no_tenant)


@pytest.mark.asyncio
async def test_require_permission_granted_and_denied():
    allow = require_permission("work_orders.view")
    p = await allow(_principal(("RECEPTION",)))
    assert p.roles == ("RECEPTION",)

    deny = require_permission("inventory.adjust", "users.manage")
    with pytest.raises(PermissionDeniedError):
        await deny(_principal(("RECEPTION",)))


@pytest.mark.asyncio
async def test_super_admin_bypasses_permission_on_require():
    allow = require_permission("inventory.adjust")
    await allow(_principal(("SUPER_ADMIN",)))
    assert role_has_permission("SUPER_ADMIN", "anything")


@pytest.mark.asyncio
async def test_require_platform_admin():
    # require_platform_admin es una dependencia síncrona.
    with pytest.raises(PermissionDeniedError):
        require_platform_admin(_principal())
    admin = Principal(
        user_id=uuid.uuid4(),
        email="root@test.local",
        full_name="Root",
        tenant_id=uuid.uuid4(),
        roles=("SUPER_ADMIN",),
        is_platform_admin=True,
    )
    got = require_platform_admin(admin)
    assert got is admin
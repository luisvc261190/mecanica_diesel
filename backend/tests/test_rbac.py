"""Pruebas de consistencia del RBAC: cada rol solo referencia permisos existentes."""
from __future__ import annotations

from app.core.permissions import ALL_PERMISSIONS, PERMISSIONS_BY_ROLE, ROLE_SUPER_ADMIN, role_has_permission


def test_all_role_permissions_are_declared():
    for role, perms in PERMISSIONS_BY_ROLE.items():
        unknown = perms - ALL_PERMISSIONS
        assert not unknown, f"Rol {role} referencia permisos inexistentes: {sorted(unknown)}"
        assert perms <= ALL_PERMISSIONS


def test_super_admin_implicitly_bypasses():
    assert role_has_permission(ROLE_SUPER_ADMIN, "anything.not.declared")


def test_unknown_role_has_no_permissions():
    for p in ("work_orders.view", "users.manage", "inventory.adjust"):
        assert not role_has_permission("NO_EXISTE", p)


def test_common_scenarios():
    assert role_has_permission("RECEPTION", "work_orders.view")
    assert not role_has_permission("RECEPTION", "payments.register")
    assert role_has_permission("CASHIER", "payments.register")
    assert role_has_permission("WAREHOUSE", "inventory.adjust")
    assert role_has_permission("TECHNICIAN", "diagnostics.create")
    assert not role_has_permission("TECHNICIAN", "inventory.adjust")


def test_all_expected_roles_present():
    assert {"OWNER", "ADMIN", "SUPERVISOR", "RECEPTION", "TECHNICIAN", "MECHANIC", "WAREHOUSE", "CASHIER", "SUPER_ADMIN"} <= set(
        PERMISSIONS_BY_ROLE
    )
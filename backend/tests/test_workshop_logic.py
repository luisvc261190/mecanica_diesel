"""Pruebas de la lógica de transiciones de orden de trabajo y totales."""
from __future__ import annotations

from decimal import Decimal

from app.services.quotes import _IGV
from app.services.workshop import _STATUS_ACTIONS, _TERMINAL, _subtotal


def test_status_actions_flow():
    # Las 12 acciones definidas; secuencia canónica RECEIVED → DELIVERED.
    assert set(_STATUS_ACTIONS) == {
        "request_approval",
        "approve",
        "start",
        "wait_parts",
        "resume_parts",
        "pause",
        "resume",
        "quality_control",
        "complete",
        "ready",
        "deliver",
        "cancel",
    }
    assert _STATUS_ACTIONS["start"][1] == "IN_PROGRESS"
    assert _STATUS_ACTIONS["quality_control"][1] == "QUALITY_CONTROL"
    assert _STATUS_ACTIONS["complete"][1] == "COMPLETED"
    assert _STATUS_ACTIONS["ready"][1] == "READY_FOR_PICKUP"
    assert _STATUS_ACTIONS["deliver"][1] == "DELIVERED"


def test_cancel_allows_any_active_source():
    allowed, dest = _STATUS_ACTIONS["cancel"]
    assert allowed is None  # "*": cualquier estado no terminal
    assert dest == "CANCELLED"


def test_terminal_states():
    assert _TERMINAL == {"DELIVERED", "CANCELLED"}
    for action, (_allowed, dest) in _STATUS_ACTIONS.items():
        assert dest not in _TERMINAL or action in {"deliver", "cancel"}


def test_actions_only_leave_terminal_by_deliver_or_cancel():
    for action, (_, dest) in _STATUS_ACTIONS.items():
        if action not in {"deliver", "cancel"}:
            assert dest not in _TERMINAL


def test_subtotal_strategy():
    assert _subtotal(Decimal("2"), Decimal("150.50"), Decimal("10")) == Decimal("291.00")
    assert _subtotal(Decimal("1"), Decimal("100"), Decimal("150")) == Decimal("0")  # sin negativos
    assert _subtotal(Decimal("5"), Decimal("0"), Decimal("0")) == Decimal("0")


def test_igv_tax_recompute():
    subtotal = _subtotal(Decimal("2"), Decimal("100"), Decimal("20"))
    tax = (subtotal - Decimal("0")) * _IGV
    assert tax == Decimal("32.40")
    assert _IGV == Decimal("0.18")
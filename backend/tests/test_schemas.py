"""Pruebas de schemas y envoltorio de respuesta."""
from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from app.schemas.auth import OnboardingRequest
from app.schemas.common import ApiResponse, Paginated
from app.schemas.constants import WorkOrderStatusT
from app.schemas.quotes import QuoteCreate, QuoteItemCreate
from app.schemas.workshop import WorkOrderAction
from pydantic import ValidationError


def test_paginated_build_math():
    items = [1, 2, 3]
    p = Paginated.build(items, page=1, page_size=10, total=23)
    assert p.page == 1
    assert p.total == 23
    assert p.pages == 3


def test_api_response_envelope_serializes():
    out = ApiResponse(data={"ok": True}, message="OK").model_dump()
    assert out == {"data": {"ok": True}, "message": "OK"}


def test_api_response_typing_concrete():
    model = ApiResponse[dict]
    assert model(data={"a": 1}).data == {"a": 1}


def test_quote_item_requires_positive_quantity():
    with pytest.raises(ValidationError):
        QuoteItemCreate(kind="SERVICE", description="X", quantity=Decimal("-1"))


def test_quote_create_empty_items_allowed():
    q = QuoteCreate(branch_id=uuid.uuid4(), client_id=uuid.uuid4())
    assert q.items == []


def test_onboarding_slug_pattern():
    for bad in ("Invalid_Slug", "-inicio", "fin-", "MAYUS"):
        with pytest.raises(ValidationError):
            OnboardingRequest(
                company_name="Taller X",
                slug=bad,
                owner_email="a@b.com",
                owner_full_name="Juan Pérez",
                password="super-seguro-123",
            )
    ok = OnboardingRequest(
        company_name="Taller X",
        slug="taller-x",
        owner_email="a@b.com",
        owner_full_name="Juan Pérez",
        password="super-seguro-123",
    )
    assert ok.plan_code == "FREE"


def test_work_order_action_validates_length():
    with pytest.raises(ValidationError):
        WorkOrderAction(action="x" * 41)
    with pytest.raises(ValidationError):
        WorkOrderAction(action="")
    a = WorkOrderAction(action="start", notes="En marcha")
    assert a.action == "start"


def test_work_order_status_literals():
    # Solo estados definidos compilan; inválidos fallan en runtime de validación.
    assert set(WorkOrderStatusT.__args__) >= {"RECEIVED", "DELIVERED", "CANCELLED"}
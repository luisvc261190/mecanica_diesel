"""Rutas de cotizaciones: ciclo de vida y conversión a OT."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.schemas.common import ApiResponse, Paginated
from app.schemas.quotes import QuoteCreate, QuoteDecision, QuoteRead, QuoteUpdate
from app.schemas.workshop import WorkOrderRead
from app.services.context import Principal
from app.services.quotes import QuoteService

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.get("", response_model=ApiResponse[Paginated[QuoteRead]])
async def list_quotes(
    status: str | None = None,
    client_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_permission("quotes.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await QuoteService(db).list(
        principal, status=status, client_id=client_id, page=page, page_size=page_size
    )
    return ApiResponse(data=Paginated.build(items, page, page_size, total))


@router.post("", response_model=ApiResponse[QuoteRead], status_code=201)
async def create_quote(
    payload: QuoteCreate,
    principal: Principal = Depends(require_permission("quotes.create")),
    db: AsyncSession = Depends(get_db),
):
    quote = await QuoteService(db).create(principal, payload)
    return ApiResponse(data=quote, message="Cotización creada")


@router.get("/{quote_id}", response_model=ApiResponse[QuoteRead])
async def get_quote(
    quote_id: uuid.UUID,
    principal: Principal = Depends(require_permission("quotes.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await QuoteService(db).get(principal, quote_id))


@router.patch("/{quote_id}", response_model=ApiResponse[QuoteRead])
async def update_quote(
    quote_id: uuid.UUID,
    payload: QuoteUpdate,
    principal: Principal = Depends(require_permission("quotes.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await QuoteService(db).update(principal, quote_id, payload))


@router.post("/{quote_id}/send", response_model=ApiResponse[QuoteRead])
async def send_quote(
    quote_id: uuid.UUID,
    principal: Principal = Depends(require_permission("quotes.send")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await QuoteService(db).send(principal, quote_id), message="Cotización enviada")


@router.post("/{quote_id}/approve", response_model=ApiResponse[QuoteRead])
async def approve_quote(
    quote_id: uuid.UUID,
    payload: QuoteDecision,
    principal: Principal = Depends(require_permission("quotes.approve")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await QuoteService(db).decide(principal, quote_id, True, payload), message="Cotización aprobada")


@router.post("/{quote_id}/reject", response_model=ApiResponse[QuoteRead])
async def reject_quote(
    quote_id: uuid.UUID,
    payload: QuoteDecision,
    principal: Principal = Depends(require_permission("quotes.reject")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await QuoteService(db).decide(principal, quote_id, False, payload), message="Cotización rechazada")


@router.post("/{quote_id}/convert", response_model=ApiResponse[WorkOrderRead])
async def convert_quote(
    quote_id: uuid.UUID,
    principal: Principal = Depends(require_permission("quotes.convert")),
    db: AsyncSession = Depends(get_db),
):
    wo = await QuoteService(db).convert(principal, quote_id)
    return ApiResponse(data=wo, message="Cotización convertida en orden de trabajo")
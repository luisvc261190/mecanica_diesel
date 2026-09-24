"""Rutas CRM: clientes y contactos."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.schemas.common import ApiResponse, MaskedResponse, Paginated
from app.schemas.crm import ClientCreate, ClientRead, ClientUpdate, ContactCreate, ContactRead, ContactUpdate
from app.services.context import Principal
from app.services.crm import ClientService, ContactService

router = APIRouter(prefix="/clients", tags=["clients"])


def _page(total: int, page: int, page_size: int) -> int:
    return (total + page_size - 1) // page_size if page_size else 0


@router.get("", response_model=ApiResponse[Paginated[ClientRead]])
async def search_clients(
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_permission("clients.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await ClientService(db).search(principal, q=q, page=page, page_size=page_size)
    return ApiResponse(data=Paginated.build(items, page, page_size, total))


@router.post("", response_model=ApiResponse[ClientRead], status_code=201)
async def create_client(
    payload: ClientCreate,
    principal: Principal = Depends(require_permission("clients.create")),
    db: AsyncSession = Depends(get_db),
):
    client = await ClientService(db).create(principal, payload)
    return ApiResponse(data=client, message="Cliente creado")


@router.get("/{client_id}", response_model=ApiResponse[ClientRead])
async def get_client(
    client_id: uuid.UUID,
    principal: Principal = Depends(require_permission("clients.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await ClientService(db).get(principal, client_id))


@router.patch("/{client_id}", response_model=ApiResponse[ClientRead])
async def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    principal: Principal = Depends(require_permission("clients.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await ClientService(db).update(principal, client_id, payload))


@router.delete("/{client_id}", response_model=ApiResponse[MaskedResponse])
async def delete_client(
    client_id: uuid.UUID,
    principal: Principal = Depends(require_permission("clients.delete")),
    db: AsyncSession = Depends(get_db),
):
    await ClientService(db).delete(principal, client_id)
    return ApiResponse(data=MaskedResponse(id=str(client_id)))


@router.get("/{client_id}/contacts", response_model=ApiResponse[list[ContactRead]])
async def list_contacts(
    client_id: uuid.UUID,
    principal: Principal = Depends(require_permission("clients.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await ContactService(db).list(principal, client_id))


@router.post("/{client_id}/contacts", response_model=ApiResponse[ContactRead], status_code=201)
async def create_contact(
    client_id: uuid.UUID,
    payload: ContactCreate,
    principal: Principal = Depends(require_permission("clients.create")),
    db: AsyncSession = Depends(get_db),
):
    contact = await ContactService(db).create(principal, client_id, payload)
    return ApiResponse(data=contact, message="Contacto creado")


@router.patch("/{client_id}/contacts/{contact_id}", response_model=ApiResponse[ContactRead])
async def update_contact(
    client_id: uuid.UUID,
    contact_id: uuid.UUID,
    payload: ContactUpdate,
    principal: Principal = Depends(require_permission("clients.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await ContactService(db).update(principal, client_id, contact_id, payload))


@router.delete("/{client_id}/contacts/{contact_id}", response_model=ApiResponse[MaskedResponse])
async def delete_contact(
    client_id: uuid.UUID,
    contact_id: uuid.UUID,
    principal: Principal = Depends(require_permission("clients.delete")),
    db: AsyncSession = Depends(get_db),
):
    await ContactService(db).delete(principal, client_id, contact_id)
    return ApiResponse(data=MaskedResponse(id=str(contact_id)))
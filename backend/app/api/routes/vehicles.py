"""Rutas de vehículos y su historial de propietarios."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.schemas.common import ApiResponse, MaskedResponse, Paginated
from app.schemas.vehicles import (
    AssignOwnerRequest,
    VehicleCreate,
    VehicleHistoryRead,
    VehicleRead,
    VehicleUpdate,
)
from app.services.context import Principal
from app.services.crm import VehicleService

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("", response_model=ApiResponse[Paginated[VehicleRead]])
async def search_vehicles(
    q: str | None = None,
    client_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_permission("vehicles.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await VehicleService(db).search(principal, q=q, client_id=client_id, page=page, page_size=page_size)
    return ApiResponse(data=Paginated.build(items, page, page_size, total))


@router.post("", response_model=ApiResponse[VehicleRead], status_code=201)
async def create_vehicle(
    payload: VehicleCreate,
    principal: Principal = Depends(require_permission("vehicles.create")),
    db: AsyncSession = Depends(get_db),
):
    vehicle = await VehicleService(db).create(principal, payload)
    return ApiResponse(data=vehicle, message="Vehículo registrado")


@router.get("/{vehicle_id}", response_model=ApiResponse[VehicleRead])
async def get_vehicle(
    vehicle_id: uuid.UUID,
    principal: Principal = Depends(require_permission("vehicles.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await VehicleService(db).get(principal, vehicle_id))


@router.patch("/{vehicle_id}", response_model=ApiResponse[VehicleRead])
async def update_vehicle(
    vehicle_id: uuid.UUID,
    payload: VehicleUpdate,
    principal: Principal = Depends(require_permission("vehicles.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await VehicleService(db).update(principal, vehicle_id, payload))


@router.delete("/{vehicle_id}", response_model=ApiResponse[MaskedResponse])
async def delete_vehicle(
    vehicle_id: uuid.UUID,
    principal: Principal = Depends(require_permission("vehicles.delete")),
    db: AsyncSession = Depends(get_db),
):
    await VehicleService(db).delete(principal, vehicle_id)
    return ApiResponse(data=MaskedResponse(id=str(vehicle_id)))


@router.post("/{vehicle_id}/owners", response_model=ApiResponse[VehicleRead])
async def assign_owner(
    vehicle_id: uuid.UUID,
    payload: AssignOwnerRequest,
    principal: Principal = Depends(require_permission("vehicles.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await VehicleService(db).assign_owner(principal, vehicle_id, payload))


@router.get("/{vehicle_id}/history", response_model=ApiResponse[list[VehicleHistoryRead]])
async def vehicle_history(
    vehicle_id: uuid.UUID,
    principal: Principal = Depends(require_permission("vehicles.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await VehicleService(db).history(principal, vehicle_id))
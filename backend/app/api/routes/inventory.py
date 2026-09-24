"""Rutas de inventario: repuestos, stock, movimientos y transferencias."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.schemas.common import ApiResponse, Paginated
from app.schemas.inventory import (
    MovementRead,
    PartCreate,
    PartRead,
    PartUpdate,
    StockAdjustRequest,
    StockLevel,
    StockTransferRequest,
)
from app.services.context import Principal
from app.services.inventory import InventoryService

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/parts", response_model=ApiResponse[Paginated[PartRead]])
async def list_parts(
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_permission("parts.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await InventoryService(db).search_parts(principal, q, page, page_size)
    return ApiResponse(data=Paginated.build(items, page, page_size, total))


@router.post("/parts", response_model=ApiResponse[PartRead], status_code=201)
async def create_part(
    payload: PartCreate,
    principal: Principal = Depends(require_permission("parts.create")),
    db: AsyncSession = Depends(get_db),
):
    part = await InventoryService(db).create_part(principal, payload)
    return ApiResponse(data=part, message="Repuesto creado")


@router.get("/parts/{part_id}", response_model=ApiResponse[PartRead])
async def get_part(
    part_id: uuid.UUID,
    principal: Principal = Depends(require_permission("parts.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await InventoryService(db).part(principal, part_id))


@router.patch("/parts/{part_id}", response_model=ApiResponse[PartRead])
async def update_part(
    part_id: uuid.UUID,
    payload: PartUpdate,
    principal: Principal = Depends(require_permission("parts.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await InventoryService(db).update_part(principal, part_id, payload))


@router.get("/stock/{branch_id}/{part_id}", response_model=ApiResponse[StockLevel])
async def stock_at(
    branch_id: uuid.UUID,
    part_id: uuid.UUID,
    principal: Principal = Depends(require_permission("inventory.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await InventoryService(db).stock_at(principal, branch_id, part_id))


@router.post("/stock/adjust", response_model=ApiResponse[StockLevel])
async def adjust_stock(
    payload: StockAdjustRequest,
    principal: Principal = Depends(require_permission("inventory.adjust")),
    db: AsyncSession = Depends(get_db),
):
    level = await InventoryService(db).adjust(principal, payload)
    return ApiResponse(data=level, message="Stock ajustado")


@router.post("/stock/transfer", response_model=ApiResponse[dict])
async def transfer_stock(
    payload: StockTransferRequest,
    principal: Principal = Depends(require_permission("inventory.adjust")),
    db: AsyncSession = Depends(get_db),
):
    await InventoryService(db).transfer(principal, payload)
    return ApiResponse(data={"ok": True}, message="Transferencia realizada")


@router.get("/low-stock", response_model=ApiResponse[list[dict]])
async def low_stock(
    principal: Principal = Depends(require_permission("inventory.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await InventoryService(db).low_stock(principal))


@router.get("/parts/{part_id}/movements", response_model=ApiResponse[Paginated[MovementRead]])
async def part_movements(
    part_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_permission("inventory.movements")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await InventoryService(db).movements_for(principal, part_id, page, page_size)
    return ApiResponse(data=Paginated.build(items, page, page_size, total))
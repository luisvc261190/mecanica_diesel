"""Rutas de pagos, saldos y garantías."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.schemas.common import ApiResponse
from app.schemas.payments import (
    BalanceRead,
    ClaimCreate,
    ClaimRead,
    ClaimUpdate,
    PaymentCreate,
    PaymentRead,
    PaymentReverseRequest,
    WarrantyCreate,
    WarrantyRead,
    WarrantyUpdate,
)
from app.services.context import Principal
from app.services.payments import PaymentService, WarrantyService

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("/balance/{work_order_id}", response_model=ApiResponse[BalanceRead])
async def wo_balance(
    work_order_id: uuid.UUID,
    principal: Principal = Depends(require_permission("payments.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await PaymentService(db).balance(principal, work_order_id))


@router.get("/work-orders/{work_order_id}", response_model=ApiResponse[list[PaymentRead]])
async def list_wo_payments(
    work_order_id: uuid.UUID,
    principal: Principal = Depends(require_permission("payments.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await PaymentService(db).list_for_wo(principal, work_order_id))


@router.post("", response_model=ApiResponse[PaymentRead], status_code=201)
async def register_payment(
    payload: PaymentCreate,
    principal: Principal = Depends(require_permission("payments.register")),
    db: AsyncSession = Depends(get_db),
):
    payment = await PaymentService(db).register(principal, payload)
    return ApiResponse(data=payment, message="Pago registrado")


@router.post("/{payment_id}/reverse", response_model=ApiResponse[PaymentRead])
async def reverse_payment(
    payment_id: uuid.UUID,
    payload: PaymentReverseRequest,
    principal: Principal = Depends(require_permission("payments.register")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await PaymentService(db).reverse(principal, payment_id, payload), message="Pago revertido")


# ---------------------------------------------------------------- warranties
@router.get("/warranties/{work_order_id}", response_model=ApiResponse[list[WarrantyRead]])
async def list_wo_warranties(
    work_order_id: uuid.UUID,
    principal: Principal = Depends(require_permission("warranties.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WarrantyService(db).list_for_wo(principal, work_order_id))


@router.post("/warranties", response_model=ApiResponse[WarrantyRead], status_code=201)
async def create_warranty(
    payload: WarrantyCreate,
    principal: Principal = Depends(require_permission("warranties.create")),
    db: AsyncSession = Depends(get_db),
):
    warranty = await WarrantyService(db).create(principal, payload)
    return ApiResponse(data=warranty, message="Garantía creada")


@router.patch("/warranties/{warranty_id}", response_model=ApiResponse[WarrantyRead])
async def update_warranty(
    warranty_id: uuid.UUID,
    payload: WarrantyUpdate,
    principal: Principal = Depends(require_permission("warranties.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WarrantyService(db).update(principal, warranty_id, payload))


@router.post("/claims", response_model=ApiResponse[ClaimRead], status_code=201)
async def create_claim(
    payload: ClaimCreate,
    principal: Principal = Depends(require_permission("warranties.create")),
    db: AsyncSession = Depends(get_db),
):
    claim = await WarrantyService(db).create_claim(principal, payload)
    return ApiResponse(data=claim, message="Reclamo registrado")


@router.patch("/claims/{claim_id}", response_model=ApiResponse[ClaimRead])
async def update_claim(
    claim_id: uuid.UUID,
    payload: ClaimUpdate,
    principal: Principal = Depends(require_permission("warranties.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await WarrantyService(db).update_claim(principal, claim_id, payload))
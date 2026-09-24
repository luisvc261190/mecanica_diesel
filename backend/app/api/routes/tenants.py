"""Rutas de tenant: perfil, settings, suscripción, sucursales y planes."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_db, require_permission
from app.schemas.common import ApiResponse
from app.schemas.organization import BranchRead, TenantSettingsRead, TenantSettingsUpdate
from app.schemas.tenants import PlanRead, SubscriptionRead, TenantRead, TenantUpdate
from app.services.context import Principal
from app.services.tenants import TenantService

router = APIRouter(prefix="/tenant", tags=["tenant"])


@router.get("", response_model=ApiResponse[TenantRead])
async def get_tenant(principal: Principal = Depends(get_current_tenant), db: AsyncSession = Depends(get_db)):
    return ApiResponse(data=await TenantService(db).get(principal))


@router.patch("", response_model=ApiResponse[TenantRead])
async def update_tenant(
    payload: TenantUpdate,
    principal: Principal = Depends(require_permission("settings.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await TenantService(db).update(principal, payload))


@router.get("/settings", response_model=ApiResponse[TenantSettingsRead])
async def get_settings(
    principal: Principal = Depends(get_current_tenant), db: AsyncSession = Depends(get_db)
):
    return ApiResponse(data=await TenantService(db).get_settings(principal))


@router.patch("/settings", response_model=ApiResponse[TenantSettingsRead])
async def update_settings(
    payload: TenantSettingsUpdate,
    principal: Principal = Depends(require_permission("settings.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await TenantService(db).update_settings(principal, payload))


@router.get("/subscription", response_model=ApiResponse[SubscriptionRead])
async def get_subscription(principal: Principal = Depends(get_current_tenant), db: AsyncSession = Depends(get_db)):
    return ApiResponse(data=await TenantService(db).get_subscription(principal))


@router.get("/branches", response_model=ApiResponse[list[BranchRead]])
async def list_branches(principal: Principal = Depends(get_current_tenant), db: AsyncSession = Depends(get_db)):
    branches = await TenantService(db).list_branches(principal)
    return ApiResponse(data=[BranchRead.model_validate(b) for b in branches])


@router.get("/plans", response_model=ApiResponse[list[PlanRead]])
async def list_plans(db: AsyncSession = Depends(get_db)):
    return ApiResponse(data=await TenantService(db).list_plans())
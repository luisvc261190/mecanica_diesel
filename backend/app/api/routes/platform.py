"""Rutas de plataforma: operaciones exclusivas del SUPER_ADMIN."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_platform_admin
from app.schemas.common import ApiResponse, Paginated
from app.schemas.platform import (
    PlatformPasswordReset,
    PlatformTenantCreate,
    PlatformTenantCreated,
    PlatformUserRead,
)
from app.schemas.users import UserUpdate
from app.services.context import Principal
from app.services.platform import PlatformService

router = APIRouter(prefix="/platform", tags=["platform"])


@router.post("/tenants", response_model=ApiResponse[PlatformTenantCreated], status_code=201)
async def create_tenant(
    payload: PlatformTenantCreate,
    principal: Principal = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await PlatformService(db).create_tenant(payload)
    return ApiResponse(data=result, message="Empresa creada correctamente")


@router.get("/users", response_model=ApiResponse[Paginated[PlatformUserRead]])
async def list_users(
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    items, total = await PlatformService(db).list_users(principal, search=q, page=page, page_size=page_size)
    return ApiResponse(data=Paginated.build(items, page, page_size, total))


@router.get("/users/{user_id}", response_model=ApiResponse[PlatformUserRead])
async def get_user(
    user_id: uuid.UUID,
    principal: Principal = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await PlatformService(db).get_user(principal, user_id))


@router.patch("/users/{user_id}", response_model=ApiResponse[PlatformUserRead])
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    principal: Principal = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await PlatformService(db).update_user(principal, user_id, payload))


@router.post("/users/{user_id}/password", response_model=ApiResponse[PlatformUserRead])
async def reset_password(
    user_id: uuid.UUID,
    payload: PlatformPasswordReset,
    principal: Principal = Depends(require_platform_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await PlatformService(db).reset_password(principal, user_id, payload)
    return ApiResponse(data=result, message="Contraseña restablecida")
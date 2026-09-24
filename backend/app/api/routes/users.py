"""Rutas de usuarios y roles dentro del tenant."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_db, require_permission
from app.schemas.common import ApiResponse, Paginated
from app.schemas.users import (
    AssignRoleRequest,
    RoleRead,
    UserCreate,
    UserRead,
    UserUpdate,
)
from app.services.context import Principal
from app.services.users import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=ApiResponse[Paginated[UserRead]])
async def list_users(
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await UserService(db).list(principal, search=q, page=page, page_size=page_size)
    return ApiResponse(data=Paginated.build(items, page, page_size, total))


@router.post("", response_model=ApiResponse[UserRead], status_code=201)
async def create_user(
    payload: UserCreate,
    principal: Principal = Depends(require_permission("users.create")),
    db: AsyncSession = Depends(get_db),
):
    user = await UserService(db).create(principal, payload)
    return ApiResponse(data=user, message="Usuario creado")


@router.get("/roles", response_model=ApiResponse[list[RoleRead]])
async def list_roles(principal: Principal = Depends(get_current_tenant), db: AsyncSession = Depends(get_db)):
    return ApiResponse(data=await UserService(db).list_roles(principal))


@router.get("/{user_id}", response_model=ApiResponse[UserRead])
async def get_user(
    user_id: uuid.UUID,
    principal: Principal = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await UserService(db).get(principal, user_id))


@router.patch("/{user_id}", response_model=ApiResponse[UserRead])
async def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    principal: Principal = Depends(require_permission("users.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await UserService(db).update(principal, user_id, payload))


@router.post("/{user_id}/roles", response_model=ApiResponse[UserRead])
async def assign_role(
    user_id: uuid.UUID,
    payload: AssignRoleRequest,
    principal: Principal = Depends(require_permission("users.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await UserService(db).assign_role(principal, user_id, payload.role_code))


@router.delete("/{user_id}/roles/{role_code}", response_model=ApiResponse[UserRead])
async def remove_role(
    user_id: uuid.UUID,
    role_code: str,
    principal: Principal = Depends(require_permission("users.update")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await UserService(db).remove_role(principal, user_id, role_code))
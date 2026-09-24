"""Rutas de autenticación y onboarding."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.schemas.auth import (
    LoginRequest,
    OnboardingRequest,
    OnboardingResponse,
    PasswordChangeRequest,
    RefreshRequest,
    TokenPair,
)
from app.schemas.common import ApiResponse
from app.services.auth import AuthService
from app.services.context import Principal
from app.services.onboarding import OnboardingService

router = APIRouter(prefix="/auth", tags=["auth"])


def _ua(request: Request) -> str | None:
    return request.headers.get("user-agent")


@router.post("/onboarding", response_model=ApiResponse[OnboardingResponse], status_code=201)
async def onboarding(payload: OnboardingRequest, request: Request, db: AsyncSession = Depends(get_db)):
    onb = OnboardingService(db)
    result = await onb.onboard(
        payload,
        user_agent=_ua(request),
    )
    return ApiResponse(data=result, message="Tenant creado correctamente")


@router.post("/login", response_model=ApiResponse[TokenPair])
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    pair = await AuthService(db).login(payload.email, payload.password, _ua(request))
    return ApiResponse(data=pair, message="Bienvenido")


@router.post("/refresh", response_model=ApiResponse[TokenPair])
async def refresh(payload: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    pair = await AuthService(db).refresh(payload.refresh_token, _ua(request))
    return ApiResponse(data=pair, message="Sesión renovada")


@router.post("/logout", response_model=ApiResponse[None])
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    await AuthService(db).logout(payload.refresh_token)
    return ApiResponse(data=None, message="Sesión cerrada")


@router.post("/change-password", response_model=ApiResponse[None])
async def change_password(
    payload: PasswordChangeRequest,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await AuthService(db).change_password(principal.user_id, payload.current_password, payload.new_password)
    return ApiResponse(data=None, message="Contraseña actualizada")


@router.get("/tenants", response_model=ApiResponse[list[dict]])
async def list_tenants(principal: Principal = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    tenants = await AuthService(db).list_tenants(principal.user_id)
    return ApiResponse(data=tenants)


@router.post("/tenants/{tenant_id}/select", response_model=ApiResponse[TokenPair])
async def select_tenant(
    tenant_id: str,
    request: Request,
    principal: Principal = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from uuid import UUID

    pair = await AuthService(db).select_tenant(principal.user_id, UUID(tenant_id), _ua(request))
    return ApiResponse(data=pair, message="Tenant seleccionado")
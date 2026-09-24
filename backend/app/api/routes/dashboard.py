"""Rutas del tablero: métricas y notificaciones."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_db, require_permission
from app.schemas.common import ApiResponse, Paginated
from app.schemas.dashboard import DashboardSummary
from app.services.context import Principal
from app.services.dashboard import DashboardService

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=ApiResponse[DashboardSummary])
async def summary(
    principal: Principal = Depends(require_permission("dashboard.view")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await DashboardService(db).summary(principal))


@router.get("/branches", response_model=ApiResponse[list[dict]])
async def branches(
    principal: Principal = Depends(require_permission("dashboard.view")),
    db: AsyncSession = Depends(get_db),
):
    branches = await DashboardService(db).branches(principal)
    return ApiResponse(data=[{"id": str(b.id), "name": b.name, "code": b.code} for b in branches])


@router.get("/notifications", response_model=ApiResponse[Paginated[object]])
async def notifications(
    page: int = 1,
    page_size: int = 20,
    principal: Principal = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    rows, total = await DashboardService(db).notifications(principal, page, page_size)
    payload = [
        {
            "id": str(n.id),
            "type": n.type,
            "title": n.title,
            "body": n.body,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat(),
        }
        for n in rows
    ]
    return ApiResponse(data=Paginated.build(payload, page, page_size, total))
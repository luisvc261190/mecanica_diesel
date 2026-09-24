"""Rutas de auditoría."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.schemas.audit import AuditQueryParams, AuditRead
from app.schemas.common import ApiResponse, Paginated
from app.services.audit import AuditService
from app.services.context import Principal

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=ApiResponse[Paginated[AuditRead]])
async def list_audit_logs(
    params: AuditQueryParams = Depends(),
    principal: Principal = Depends(require_permission("audit.view")),
    db: AsyncSession = Depends(get_db),
):
    items, total = await AuditService(db).list(
        principal, action=params.action, entity=params.entity, page=params.page, page_size=50
    )
    return ApiResponse(data=Paginated.build(items, params.page, 50, total))
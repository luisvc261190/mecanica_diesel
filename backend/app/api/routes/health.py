"""Healthcheck sin autenticación."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import text

from app.core.database import AsyncSessionLocal
from app.schemas.common import ApiResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=ApiResponse[dict], tags=["health"])
async def health() -> ApiResponse[dict]:
    db_ok = True
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    return ApiResponse(
        data={"status": "ok" if db_ok else "degraded", "database": "up" if db_ok else "down"},
        message="Salud" if db_ok else "Base de datos inaccesible",
    )
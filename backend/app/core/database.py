"""Motor async, sesiones y helpers de contexto multi-tenant."""
from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def dispose_engine() -> None:
    await engine.dispose()


@dataclass(frozen=True)
class TenantContext:
    """Contexto aislado por request: quién es (user) y dónde opera (tenant)."""

    tenant_id: uuid.UUID
    user_id: uuid.UUID
    is_platform_admin: bool = False


async def set_tenant_context(session: AsyncSession, ctx: TenantContext) -> None:
    """Fija los GUC de sesión *dentro de la transacción actual*.

    `set_config(..., true)` acota el valor a la transacción: cuando la transacción
    termina (COMMIT/ROLLBACK) el valor desaparece, de modo que una conexión
    reutilizada por el pool jamás arrastra el tenant de otro request.
    """
    await session.execute(
        text("SELECT set_config('app.current_tenant_id', :t, true)"), {"t": str(ctx.tenant_id)}
    )
    await session.execute(
        text("SELECT set_config('app.current_user_id', :u, true)"), {"u": str(ctx.user_id)}
    )
    await session.execute(
        text("SELECT set_config('app.is_platform_admin', :a, true)"), {"a": "on" if ctx.is_platform_admin else "off"}
    )


async def set_platform_context(session: AsyncSession) -> None:
    """Contexto de plataforma (jobs internos, onboarding, migraciones).

    ``current_tenant_id`` queda vacío (→ NULL, ningún tenant visible) e
    ``is_platform_admin = 'on'`` (las políticas RLS lo respetan).
    """
    await session.execute(text("SELECT set_config('app.current_tenant_id', '', true)"))
    await session.execute(text("SELECT set_config('app.current_user_id', '', true)"))
    await session.execute(text("SELECT set_config('app.is_platform_admin', 'on', true)"))


def get_db():
    """Dependencia de FastAPI: sesión por request (nunca global)."""

    async def _get_db() -> AsyncSession:
        async with AsyncSessionLocal() as session:
            try:
                yield session
            except Exception:
                await session.rollback()
                raise

    return _get_db()
"""Repositorio genérico CRUD sobre SQLAlchemy asíncrono."""
from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.base import Base


class BaseRepository[ModelT: Base]:
    """Capa de acceso a datos básica. Subclases fijan ``model`` y agregan consultas."""

    model: type[ModelT]

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ---------------------------------------------------------------- helpers
    def _columns(self) -> dict[str, Any]:
        return dict(self.model.__table__.c)

    def _active_filter(self) -> ColumnElement[bool] | None:
        if "deleted_at" in self._columns():
            return self.model.__table__.c.deleted_at.is_(None)
        return None

    def _apply_active(self, stmt: Any) -> Any:
        active = self._active_filter()
        if active is not None:
            stmt = stmt.where(active)
        return stmt

    # ------------------------------------------------------------------ reads
    async def get(self, obj_id: uuid.UUID) -> ModelT | None:
        stmt = self._apply_active(select(self.model).where(self.model.__table__.c.id == obj_id))
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_or_404(self, obj_id: uuid.UUID) -> ModelT:
        obj = await self.get(obj_id)
        if obj is None:
            raise NotFoundError(message="Recurso no encontrado", code="RESOURCE_NOT_FOUND")
        return obj

    async def get_tenant(self, obj_id: uuid.UUID, tenant_id: uuid.UUID) -> ModelT | None:
        stmt = self._apply_active(
            select(self.model)
            .where(self.model.__table__.c.id == obj_id, self.model.__table__.c.tenant_id == tenant_id)
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_tenant_or_404(self, obj_id: uuid.UUID, tenant_id: uuid.UUID) -> ModelT:
        obj = await self.get_tenant(obj_id, tenant_id)
        if obj is None:
            raise NotFoundError(message="Recurso no encontrado o sin acceso", code="RESOURCE_NOT_FOUND")
        return obj

    async def list(
        self,
        *,
        where: Sequence[ColumnElement[bool] | bool] = (),
        order_by: Any | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> list[ModelT]:
        stmt = self._apply_active(select(self.model).where(*where))
        if order_by is not None:
            stmt = stmt.order_by(order_by)
        if limit is not None:
            stmt = stmt.limit(limit)
        if offset is not None:
            stmt = stmt.offset(offset)
        return list((await self.session.execute(stmt)).scalars().all())

    async def list_paginated(
        self,
        *,
        where: Sequence[ColumnElement[bool] | bool] = (),
        order_by: Any | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[ModelT], int]:
        base = self._apply_active(select(self.model).where(*where))
        count_stmt = select(func.count()).select_from(base.order_by(None).subquery())
        total = (await self.session.execute(count_stmt)).scalar_one()
        stmt = base
        if order_by is not None:
            stmt = base.order_by(order_by)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list((await self.session.execute(stmt)).scalars().all())
        return items, total

    async def count(self, *, where: Sequence[ColumnElement[bool] | bool] = ()) -> int:
        stmt = self._apply_active(select(self.model).where(*where))
        return (await self.session.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()

    async def exists(self, *, where: Sequence[ColumnElement[bool] | bool] = ()) -> bool:
        stmt = self._apply_active(select(self.model.id).where(*where)).limit(1)
        return (await self.session.execute(stmt)).first() is not None

    # ----------------------------------------------------------------- writes
    async def create(self, **values: Any) -> ModelT:
        obj = self.model(**values)
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def add(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def update(self, obj: ModelT, **values: Any) -> ModelT:
        for key, value in values.items():
            setattr(obj, key, value)
        await self.session.flush()
        return obj

    async def delete(self, obj: ModelT) -> None:
        if "deleted_at" in self._columns():
            obj.deleted_at = func.now()
        else:
            await self.session.delete(obj)
        await self.session.flush()
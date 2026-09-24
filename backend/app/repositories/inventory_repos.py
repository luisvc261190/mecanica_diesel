"""Repositorios de inventario: repuestos, stock (con locking) y movimientos."""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.exceptions import AppError
from app.models.inventory import Inventory, InventoryMovement, Part
from app.repositories.base import BaseRepository


class PartRepository(BaseRepository[Part]):
    model = Part

    async def search(self, tenant_id: uuid.UUID, q: str | None = None, page: int = 1, page_size: int = 20) -> tuple[list[Part], int]:
        where: list[ColumnElement[bool]] = [Part.tenant_id == tenant_id]
        if q:
            like = f"%{q}%"
            where.append(
                or_(Part.name.ilike(like), Part.sku.ilike(like), Part.brand.ilike(like))
            )
        return await self.list_paginated(where=where, order_by=Part.name, page=page, page_size=page_size)


class InventoryRepository(BaseRepository[Inventory]):
    model = Inventory

    async def get_stock_for_update(self, tenant_id: uuid.UUID, branch_id: uuid.UUID, part_id: uuid.UUID) -> Inventory | None:
        stmt = (
            select(Inventory)
            .where(
                Inventory.tenant_id == tenant_id,
                Inventory.branch_id == branch_id,
                Inventory.part_id == part_id,
            )
            .with_for_update()
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def upsert_stock(self, tenant_id: uuid.UUID, branch_id: uuid.UUID, part_id: uuid.UUID, quantity: Decimal) -> Inventory:
        stmt = (
            pg_insert(Inventory)
            .values(tenant_id=tenant_id, branch_id=branch_id, part_id=part_id, quantity=quantity)
            .on_conflict_do_update(
                index_elements=["tenant_id", "branch_id", "part_id"],
                set_={"quantity": Inventory.quantity + quantity},
            )
            .returning(Inventory.id, Inventory.quantity)
        )
        row = (await self.session.execute(stmt)).one()
        inv = await self.get_tenant(row.id, tenant_id)
        if inv is None:
            raise AppError(message="No se pudo actualizar el stock", status_code=500)
        return inv

    async def low_stock_items(self, tenant_id: uuid.UUID, limit: int = 50) -> list[tuple[Part, Inventory]]:
        rows = (
            await self.session.execute(
                select(Part, Inventory)
                .join(Inventory, (Inventory.part_id == Part.id) & (Inventory.tenant_id == Part.tenant_id))
                .where(
                    Inventory.tenant_id == tenant_id,
                    Inventory.quantity <= Part.reorder_level,
                )
                .order_by(Part.name)
                .limit(limit)
            )
        ).all()
        return [(p, i) for p, i in rows]

    async def count_with_stock(self, tenant_id: uuid.UUID) -> int:
        stmt = select(func.count()).select_from(Inventory).where(Inventory.tenant_id == tenant_id)
        return (await self.session.execute(stmt)).scalar_one()


class MovementRepository(BaseRepository[InventoryMovement]):
    model = InventoryMovement

    async def add_movement(
        self,
        *,
        tenant_id: uuid.UUID,
        branch_id: uuid.UUID | None,
        part_id: uuid.UUID,
        user_id: uuid.UUID | None,
        type: str,
        quantity: Decimal,
        unit_cost: Decimal | None = None,
        reference_type: str | None = None,
        reference_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> InventoryMovement:
        return await self.add(
            InventoryMovement(
                tenant_id=tenant_id,
                branch_id=branch_id,
                part_id=part_id,
                user_id=user_id,
                type=type,
                quantity=quantity,
                unit_cost=unit_cost,
                reference_type=reference_type,
                reference_id=reference_id,
                notes=notes,
            )
        )

    async def history(self, tenant_id: uuid.UUID, part_id: uuid.UUID, page: int = 1, page_size: int = 20):
        return await self.list_paginated(
            where=[InventoryMovement.tenant_id == tenant_id, InventoryMovement.part_id == part_id],
            order_by=InventoryMovement.moved_at.desc(),
            page=page,
            page_size=page_size,
        )
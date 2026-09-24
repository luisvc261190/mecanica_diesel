"""Servicios de inventario: repuestos, stock con bloqueo, movimientos y transferencias."""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.inventory import Inventory, Part
from app.models.organization import Branch
from app.repositories.inventory_repos import InventoryRepository, MovementRepository, PartRepository
from app.schemas.inventory import (
    MovementRead,
    PartCreate,
    PartRead,
    PartUpdate,
    StockAdjustRequest,
    StockLevel,
    StockTransferRequest,
)
from app.services.audit import AuditService
from app.services.context import Principal


class InventoryService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = InventoryRepository(db)
        self.parts_repo = PartRepository(db)
        self.movements = MovementRepository(db)
        self.audit = AuditService(db)

    async def _require_branch(self, ctx: Principal, branch_id: uuid.UUID) -> Branch:
        branch = await self.db.scalar(
            select(Branch).where(Branch.id == branch_id, Branch.tenant_id == ctx.tenant_id)
        )
        if branch is None:
            raise NotFoundError(message="Sucursal no encontrada o sin acceso")
        return branch

    async def _require_part(self, ctx: Principal, part_id: uuid.UUID) -> Part:
        part = await self.parts_repo.get_tenant_or_404(part_id, ctx.tenant_id)
        return part

    # ---------------------------------------------------------------- parts
    async def create_part(self, ctx: Principal, payload: PartCreate) -> PartRead:
        await set_tenant_context(self.db, ctx.tc())
        part = await self.parts_repo.create(tenant_id=ctx.tenant_id, **payload.model_dump())
        await self.audit.record_raw(ctx, "PART_CREATE", "parts", part.id)
        await self.db.commit()
        return PartRead.model_validate(part)

    async def update_part(self, ctx: Principal, part_id: uuid.UUID, payload: PartUpdate) -> PartRead:
        await set_tenant_context(self.db, ctx.tc())
        part = await self.parts_repo.get_tenant_or_404(part_id, ctx.tenant_id)
        await self.parts_repo.update(part, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return PartRead.model_validate(part)

    async def part(self, ctx: Principal, part_id: uuid.UUID) -> PartRead:
        await set_tenant_context(self.db, ctx.tc())
        return PartRead.model_validate(await self._require_part(ctx, part_id))

    async def search_parts(self, ctx: Principal, q: str | None, page: int, page_size: int) -> tuple[list[PartRead], int]:
        await set_tenant_context(self.db, ctx.tc())
        rows, total = await self.parts_repo.search(ctx.tenant_id, q, page, page_size)
        return [PartRead.model_validate(r) for r in rows], total

    # -------------------------------------------------------- stock movement
    async def consume(
        self,
        ctx: Principal,
        *,
        branch_id: uuid.UUID,
        part_id: uuid.UUID,
        quantity: Decimal,
        reference_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
    ) -> None:
        """Descuenta stock de forma atómica. Lanza si no hay suficiente."""
        stock = await self.repo.get_stock_for_update(ctx.tenant_id, branch_id, part_id)
        available = stock.quantity if stock else Decimal("0")
        if stock is None or stock.quantity < quantity:
            raise BusinessRuleError(
                message=f"Stock insuficiente: disponible {available}, requerido {quantity}",
                code="STOCK_INSUFFICIENT",
            )
        stock.quantity -= quantity
        await self.movements.add_movement(
            tenant_id=ctx.tenant_id,
            branch_id=branch_id,
            part_id=part_id,
            user_id=user_id,
            type="WORK_ORDER_USAGE",
            quantity=-quantity,
            reference_type="WORK_ORDER",
            reference_id=reference_id,
            notes="Consumo en orden de trabajo",
        )
        await self.db.flush()

    async def adjust(self, ctx: Principal, payload: StockAdjustRequest) -> StockLevel:
        await set_tenant_context(self.db, ctx.tc())
        branch = await self._require_branch(ctx, payload.branch_id)
        await self._require_part(ctx, payload.part_id)
        stock = await self.repo.get_stock_for_update(ctx.tenant_id, payload.branch_id, payload.part_id)
        current = stock.quantity if stock else Decimal("0")
        delta = payload.new_quantity - current
        if delta == 0:
            return StockLevel(branch_id=payload.branch_id, part_id=payload.part_id, quantity=current, updated_at=stock.updated_at)
        if stock is None:
            stock = await self.repo.upsert_stock(ctx.tenant_id, payload.branch_id, payload.part_id, payload.new_quantity)
            initial = True
        else:
            stock.quantity = payload.new_quantity
            initial = False
        await self.movements.add_movement(
            tenant_id=ctx.tenant_id,
            branch_id=branch.branch_id if hasattr(branch, "branch_id") else branch.id,
            part_id=payload.part_id,
            user_id=ctx.user_id,
            type="INITIAL_STOCK" if initial else "ADJUSTMENT",
            quantity=delta,
            reference_type="ADJUSTMENT",
            notes=payload.reason,
        )
        await self.audit.record_raw(
            ctx, "INVENTORY_ADJUST", "inventory", stock.id,
            old_values={"quantity": current}, new_values={"quantity": payload.new_quantity},
        )
        await self.db.commit()
        return StockLevel(branch_id=payload.branch_id, part_id=payload.part_id, quantity=stock.quantity, updated_at=stock.updated_at)

    async def transfer(self, ctx: Principal, payload: StockTransferRequest) -> None:
        await set_tenant_context(self.db, ctx.tc())
        if payload.source_branch_id == payload.target_branch_id:
            raise BusinessRuleError(message="Las sucursales deben ser distintas", code="SAME_BRANCH")
        await self._require_branch(ctx, payload.source_branch_id)
        await self._require_branch(ctx, payload.target_branch_id)
        await self._require_part(ctx, payload.part_id)
        src = await self.repo.get_stock_for_update(ctx.tenant_id, payload.source_branch_id, payload.part_id)
        if src is None or src.quantity < payload.quantity:
            raise BusinessRuleError(message="Stock insuficiente en sucursal origen", code="STOCK_INSUFFICIENT")
        src.quantity -= payload.quantity
        dst = await self.repo.get_stock_for_update(ctx.tenant_id, payload.target_branch_id, payload.part_id)
        if dst is None:
            await self.repo.upsert_stock(ctx.tenant_id, payload.target_branch_id, payload.part_id, payload.quantity)
        else:
            dst.quantity += payload.quantity
        await self.movements.add_movement(
            tenant_id=ctx.tenant_id, branch_id=payload.source_branch_id, part_id=payload.part_id,
            user_id=ctx.user_id, type="TRANSFER", quantity=-payload.quantity,
            reference_type="TRANSFER", notes=f"Transferencia a {payload.target_branch_id}",
        )
        await self.movements.add_movement(
            tenant_id=ctx.tenant_id, branch_id=payload.target_branch_id, part_id=payload.part_id,
            user_id=ctx.user_id, type="TRANSFER", quantity=payload.quantity,
            reference_type="TRANSFER", notes=f"Transferencia desde {payload.source_branch_id}",
        )
        await self.db.commit()

    async def stock_at(self, ctx: Principal, branch_id: uuid.UUID, part_id: uuid.UUID) -> StockLevel:
        await set_tenant_context(self.db, ctx.tc())
        inv = await self.db.scalar(
            select(Inventory).where(
                Inventory.tenant_id == ctx.tenant_id,
                Inventory.branch_id == branch_id,
                Inventory.part_id == part_id,
            )
        )
        if inv is None:
            return StockLevel(branch_id=branch_id, part_id=part_id, quantity=Decimal("0"))
        return StockLevel(branch_id=branch_id, part_id=part_id, quantity=inv.quantity, updated_at=inv.updated_at)

    async def movements_for(self, ctx: Principal, part_id: uuid.UUID, page: int, page_size: int):
        await set_tenant_context(self.db, ctx.tc())
        await self._require_part(ctx, part_id)
        rows, total = await self.movements.history(ctx.tenant_id, part_id, page, page_size)
        return [MovementRead.model_validate(r) for r in rows], total

    async def low_stock(self, ctx: Principal) -> list[dict]:
        await set_tenant_context(self.db, ctx.tc())
        rows = await self.repo.low_stock_items(ctx.tenant_id)
        return [{"part": PartRead.model_validate(p).model_dump(), "quantity": i.quantity} for p, i in rows]

    async def low_stock_count(self, ctx: Principal) -> int:
        return len(await self.low_stock(ctx))

    async def parts_total(self, ctx: Principal) -> int:
        return await self.parts_repo.count(where=[Part.tenant_id == ctx.tenant_id])
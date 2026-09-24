"""Servicios de pagos y garantías."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.core.exceptions import BusinessRuleError, NotFoundError
from app.models.finance import Warranty
from app.models.workshop import WorkOrder
from app.repositories.finance_repos import (
    ClaimRepository,
    PaymentRepository,
    WarrantyRepository,
)
from app.schemas.payments import (
    BalanceRead,
    ClaimCreate,
    ClaimRead,
    ClaimUpdate,
    PaymentCreate,
    PaymentRead,
    PaymentReverseRequest,
    WarrantyCreate,
    WarrantyRead,
    WarrantyUpdate,
)
from app.services.audit import AuditService
from app.services.context import Principal


class PaymentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = PaymentRepository(db)
        self.audit = AuditService(db)

    async def _require_wo(self, ctx: Principal, wo_id: uuid.UUID) -> WorkOrder:
        wo = await self.db.scalar(
            select(WorkOrder).where(WorkOrder.id == wo_id, WorkOrder.tenant_id == ctx.tenant_id)
        )
        if wo is None:
            raise NotFoundError(message="Orden de trabajo no encontrada o sin acceso")
        return wo

    async def balance(self, ctx: Principal, wo_id: uuid.UUID) -> BalanceRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self._require_wo(ctx, wo_id)
        paid = await self.repo.total_paid(wo_id, ctx.tenant_id)
        return BalanceRead(work_order_id=wo_id, total=wo.total, total_paid=paid, balance=wo.total - paid)

    async def register(self, ctx: Principal, payload: PaymentCreate) -> PaymentRead:
        await set_tenant_context(self.db, ctx.tc())
        wo = await self._require_wo(ctx, payload.work_order_id)
        paid = await self.repo.total_paid(wo.id, ctx.tenant_id)
        if payload.amount > wo.total - paid:
            raise BusinessRuleError(
                message=f"El pago excede el saldo pendiente ({wo.total - paid})", code="OVERPAYMENT"
            )
        payment = await self.repo.create(
            tenant_id=ctx.tenant_id,
            work_order_id=wo.id,
            branch_id=payload.branch_id or wo.branch_id,
            received_by=ctx.user_id,
            amount=payload.amount,
            method=payload.method,
            reference=payload.reference,
            observation=payload.observation,
        )
        await self.audit.record_raw(
            ctx, "PAYMENT_CREATE", "payments", payment.id, new_values={"amount": str(payment.amount)}
        )
        paid = paid + payment.amount
        if wo.status == "READY_FOR_PICKUP" and paid >= wo.total:
            await self.db.execute(
                update(WorkOrder)
                .where(WorkOrder.id == wo.id)
                .values(status="DELIVERED", closed_at=datetime.now(UTC))
            )
        await self.db.commit()
        return PaymentRead.model_validate(payment)

    async def reverse(self, ctx: Principal, payment_id: uuid.UUID, payload: PaymentReverseRequest) -> PaymentRead:
        await set_tenant_context(self.db, ctx.tc())
        payment = await self.repo.get_tenant_or_404(payment_id, ctx.tenant_id)
        if payment.status == "REVERSED":
            raise BusinessRuleError(message="El pago ya fue revertido", code="ALREADY_REVERSED")
        payment.status = "REVERSED"
        payment.observation = (payment.observation or "") + f" REVERSED: {payload.observation or ''}".strip()
        await self.audit.record_raw(ctx, "PAYMENT_REVERSE", "payments", payment.id)
        await self.db.commit()
        return PaymentRead.model_validate(payment)

    async def list_for_wo(self, ctx: Principal, wo_id: uuid.UUID) -> list[PaymentRead]:
        await set_tenant_context(self.db, ctx.tc())
        await self._require_wo(ctx, wo_id)
        rows = await self.repo.list_for_work_order(wo_id, ctx.tenant_id)
        return [PaymentRead.model_validate(r) for r in rows]


class WarrantyService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = WarrantyRepository(db)
        self.claims = ClaimRepository(db)
        self.audit = AuditService(db)
        self.payments = PaymentService(db)

    async def create(self, ctx: Principal, payload: WarrantyCreate) -> WarrantyRead:
        await set_tenant_context(self.db, ctx.tc())
        await self.payments._require_wo(ctx, payload.work_order_id)
        warranty = await self.repo.create(tenant_id=ctx.tenant_id, **payload.model_dump())
        await self.audit.record_raw(ctx, "WARRANTY_CREATE", "warranties", warranty.id)
        await self.db.commit()
        return WarrantyRead.model_validate(warranty)

    async def update(self, ctx: Principal, warranty_id: uuid.UUID, payload: WarrantyUpdate) -> WarrantyRead:
        await set_tenant_context(self.db, ctx.tc())
        warranty = await self.repo.get_tenant_or_404(warranty_id, ctx.tenant_id)
        await self.repo.update(warranty, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return WarrantyRead.model_validate(warranty)

    async def list_for_wo(self, ctx: Principal, wo_id: uuid.UUID) -> list[WarrantyRead]:
        await set_tenant_context(self.db, ctx.tc())
        rows = await self.repo.list(where=[Warranty.work_order_id == wo_id, Warranty.tenant_id == ctx.tenant_id])
        return [WarrantyRead.model_validate(r) for r in rows]

    async def create_claim(self, ctx: Principal, payload: ClaimCreate) -> ClaimRead:
        await set_tenant_context(self.db, ctx.tc())
        warranty = await self.repo.get_tenant_or_404(payload.warranty_id, ctx.tenant_id)
        claim = await self.claims.create(tenant_id=ctx.tenant_id, **payload.model_dump())
        await self.audit.record_raw(ctx, "CLAIM_CREATE", "warranty_claims", claim.id, new_values={"warranty": str(warranty.id)})
        await self.db.commit()
        return ClaimRead.model_validate(claim)

    async def update_claim(self, ctx: Principal, claim_id: uuid.UUID, payload: ClaimUpdate) -> ClaimRead:
        await set_tenant_context(self.db, ctx.tc())
        claim = await self.claims.get_tenant_or_404(claim_id, ctx.tenant_id)
        await self.claims.update(claim, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return ClaimRead.model_validate(claim)
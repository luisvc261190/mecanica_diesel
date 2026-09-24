"""Servicios de cotizaciones: ciclo de vida y conversión a OT."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.core.exceptions import BusinessRuleError
from app.models.workshop import Quote, QuoteItem
from app.models.workshop import WorkOrderService as WorkOrderServiceModel
from app.repositories.crm_repos import ClientRepository, VehicleRepository
from app.repositories.workshop_repos import (
    DocumentNumberRepository,
    QuoteRepository,
)
from app.schemas.quotes import (
    QuoteCreate,
    QuoteDecision,
    QuoteItemRead,
    QuoteRead,
    QuoteUpdate,
)
from app.schemas.workshop import WorkOrderRead
from app.services.audit import AuditService
from app.services.context import Principal
from app.services.inventory import InventoryService
from app.services.workshop import WorkOrderService

_IGV = Decimal("0.18")


class QuoteService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = QuoteRepository(db)
        self.numbers = DocumentNumberRepository(db)
        self.audit = AuditService(db)
        self.work_orders = WorkOrderService(db)

    def _recompute(self, quote: Quote, items: list[QuoteItem]) -> None:
        subtotal = Decimal("0")
        for item in items:
            item.subtotal = item.quantity * item.unit_price - item.discount
            subtotal += item.subtotal
        quote.subtotal = subtotal
        quote.tax = (subtotal - quote.discount) * _IGV
        quote.total = subtotal - quote.discount + quote.tax

    async def _get_quote(self, ctx: Principal, quote_id: uuid.UUID) -> Quote:
        quote = await self.repo.get_tenant_or_404(quote_id, ctx.tenant_id)
        return quote

    async def _to_read(self, quote: Quote) -> QuoteRead:
        read = QuoteRead.model_validate(quote)
        items = await self.repo.list_items(quote.id)
        read.items = [QuoteItemRead.model_validate(i) for i in items]
        return read

    async def get(self, ctx: Principal, quote_id: uuid.UUID) -> QuoteRead:
        await set_tenant_context(self.db, ctx.tc())
        return await self._to_read(await self._get_quote(ctx, quote_id))

    async def create(self, ctx: Principal, payload: QuoteCreate) -> QuoteRead:
        await set_tenant_context(self.db, ctx.tc())
        if payload.client_id:
            await ClientRepository(self.db).get_tenant_or_404(payload.client_id, ctx.tenant_id)
        if payload.vehicle_id:
            await VehicleRepository(self.db).get_tenant_or_404(payload.vehicle_id, ctx.tenant_id)
        quote = await self.repo.create(
            tenant_id=ctx.tenant_id,
            branch_id=payload.branch_id,
            client_id=payload.client_id,
            vehicle_id=payload.vehicle_id,
            work_order_id=payload.work_order_id,
            created_by=ctx.user_id,
            valid_until=payload.valid_until,
            terms=payload.terms,
        )
        quote.number = await self.numbers.next_number(ctx.tenant_id, payload.branch_id, doc_type="QUOTE", prefix="COT")
        items = []
        for item in payload.items:
            row = QuoteItem(
                tenant_id=ctx.tenant_id,
                quote_id=quote.id,
                kind=item.kind,
                service_id=item.service_id,
                part_id=item.part_id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                discount=item.discount,
            )
            self.db.add(row)
            items.append(row)
        if not payload.valid_until:
            quote.valid_until = (datetime.now(UTC) + timedelta(days=30)).date()
        self._recompute(quote, items)
        await self.audit.record_raw(ctx, "QUOTE_CREATE", "quotes", quote.id, new_values={"number": quote.number})
        await self.db.commit()
        return await self._to_read(quote)

    async def list(self, ctx: Principal, *, status: str | None, client_id: uuid.UUID | None, page: int, page_size: int):
        await set_tenant_context(self.db, ctx.tc())
        rows, total = await self.repo.list_filtered(
            ctx.tenant_id, status=status, client_id=client_id, page=page, page_size=page_size
        )
        return [await self._to_read(q) for q in rows], total

    async def update(self, ctx: Principal, quote_id: uuid.UUID, payload: QuoteUpdate) -> QuoteRead:
        await set_tenant_context(self.db, ctx.tc())
        quote = await self._get_quote(ctx, quote_id)
        await self.repo.update(quote, **payload.model_dump(exclude_unset=True))
        await self.db.commit()
        return await self._to_read(quote)

    async def send(self, ctx: Principal, quote_id: uuid.UUID) -> QuoteRead:
        await set_tenant_context(self.db, ctx.tc())
        quote = await self._get_quote(ctx, quote_id)
        if quote.status != "DRAFT":
            raise BusinessRuleError(message="Solo se pueden enviar cotizaciones en borrador", code="INVALID_STATE")
        quote.status = "SENT"
        await self.audit.record_raw(ctx, "QUOTE_SEND", "quotes", quote.id)
        await self.db.commit()
        return await self._to_read(quote)

    async def decide(self, ctx: Principal, quote_id: uuid.UUID, approve: bool, payload: QuoteDecision) -> QuoteRead:
        await set_tenant_context(self.db, ctx.tc())
        quote = await self._get_quote(ctx, quote_id)
        if quote.status not in {"SENT", "DRAFT"}:
            raise BusinessRuleError(message="La cotización no está en estado enviado", code="INVALID_STATE")
        quote.status = "APPROVED" if approve else "REJECTED"
        await self.audit.record_raw(
            ctx, "QUOTE_APPROVE" if approve else "QUOTE_REJECT", "quotes", quote.id
        )
        await self.db.commit()
        return await self._to_read(quote)

    async def convert(self, ctx: Principal, quote_id: uuid.UUID) -> WorkOrderRead:
        """Convierte una cotización aprobada en OT: copia ítems y consume repuestos."""
        await set_tenant_context(self.db, ctx.tc())
        quote = await self._get_quote(ctx, quote_id)
        if quote.status != "APPROVED":
            raise BusinessRuleError(message="Solo cotizaciones aprobadas se convierten en OT", code="QUOTE_NOT_APPROVED")
        if quote.work_order_id:
            raise BusinessRuleError(message="La cotización ya tiene una orden de trabajo", code="ALREADY_CONVERTED")
        inv = InventoryService(self.db)
        wo = await self.work_orders.repo.create(
            tenant_id=ctx.tenant_id,
            branch_id=quote.branch_id,
            client_id=quote.client_id,
            vehicle_id=quote.vehicle_id,
            quote_id=quote.id,
            priority="NORMAL",
            status="APPROVED",
            subtotal=quote.subtotal,
            discount=quote.discount,
            tax=quote.tax,
            total=quote.total,
        )
        wo.number = await self.numbers.next_number(ctx.tenant_id, quote.branch_id, doc_type="WORK_ORDER", prefix="OT")
        wo.status = "APPROVED"
        self.work_orders._change_status(ctx, wo, "APPROVED", "Conversión de cotización aprobada")
        items = await self.repo.list_items(quote.id)
        for item in items:
            if item.kind == "SERVICE":
                self.db.add(
                    WorkOrderServiceModel(
                        tenant_id=ctx.tenant_id,
                        work_order_id=wo.id,
                        service_id=item.service_id,
                        service_name=item.description,
                        quantity=item.quantity,
                        price=item.unit_price,
                        discount=item.discount,
                        subtotal=item.subtotal,
                    )
                )
            elif item.kind == "PART" and item.part_id:
                await inv.consume(
                    ctx,
                    branch_id=quote.branch_id,
                    part_id=item.part_id,
                    quantity=item.quantity,
                    reference_id=wo.id,
                    user_id=ctx.user_id,
                )
                from app.models.workshop import WorkOrderPart

                self.db.add(
                    WorkOrderPart(
                        tenant_id=ctx.tenant_id,
                        work_order_id=wo.id,
                        part_id=item.part_id,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        discount=item.discount,
                        subtotal=item.subtotal,
                    )
                )
        quote.status = "CONVERTED"
        quote.work_order_id = wo.id
        await self.audit.record_raw(ctx, "QUOTE_CONVERT", "quotes", quote.id, new_values={"work_order": str(wo.id)})
        await self.db.commit()
        return await self.work_orders.get_full(ctx, wo.id)
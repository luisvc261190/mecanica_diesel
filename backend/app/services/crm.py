"""Servicios CRM: clientes, contactos y vehículos."""
from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import set_tenant_context
from app.core.exceptions import ConflictError
from app.repositories.crm_repos import (
    ClientContactRepository,
    ClientRepository,
    VehicleHistoryRepository,
    VehicleRepository,
)
from app.repositories.workshop_repos import DocumentNumberRepository
from app.schemas.crm import (
    ClientCreate,
    ClientRead,
    ClientUpdate,
    ContactCreate,
    ContactRead,
    ContactUpdate,
)
from app.schemas.vehicles import (
    AssignOwnerRequest,
    VehicleCreate,
    VehicleHistoryRead,
    VehicleRead,
    VehicleUpdate,
)
from app.services.audit import AuditService
from app.services.context import Principal


class ClientService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ClientRepository(db)
        self.numbers = DocumentNumberRepository(db)
        self.audit = AuditService(db)

    async def search(self, ctx: Principal, *, q: str | None, page: int, page_size: int) -> tuple[list[ClientRead], int]:
        await set_tenant_context(self.db, ctx.tc())
        clients, total = await self.repo.search(ctx.tenant_id, q=q, page=page, page_size=page_size)
        return [ClientRead.model_validate(c) for c in clients], total

    async def get(self, ctx: Principal, client_id: uuid.UUID) -> ClientRead:
        await set_tenant_context(self.db, ctx.tc())
        client = await self.repo.get_tenant_or_404(client_id, ctx.tenant_id)
        return ClientRead.model_validate(client)

    async def create(self, ctx: Principal, payload: ClientCreate) -> ClientRead:
        await set_tenant_context(self.db, ctx.tc())
        if payload.doc_type and payload.doc_number:
            existing = await self.repo.by_document(ctx.tenant_id, payload.doc_type, payload.doc_number)
            if existing:
                raise ConflictError(message="Ya existe un cliente con ese documento", code="DUPLICATE_DOCUMENT")
        client = await self.repo.create(**payload.model_dump())
        client.client_code = await self.numbers.next_number(
            ctx.tenant_id, None, doc_type="CLIENT", prefix="CLT"
        )
        await self.audit.record_raw(ctx, "CLIENT_CREATE", "clients", client.id)
        await self.db.commit()
        return ClientRead.model_validate(client)

    async def update(self, ctx: Principal, client_id: uuid.UUID, payload: ClientUpdate) -> ClientRead:
        await set_tenant_context(self.db, ctx.tc())
        client = await self.repo.get_tenant_or_404(client_id, ctx.tenant_id)
        await self.repo.update(client, **payload.model_dump(exclude_unset=True))
        await self.audit.record_raw(ctx, "CLIENT_UPDATE", "clients", client.id)
        await self.db.commit()
        return ClientRead.model_validate(client)

    async def delete(self, ctx: Principal, client_id: uuid.UUID) -> None:
        await set_tenant_context(self.db, ctx.tc())
        client = await self.repo.get_tenant_or_404(client_id, ctx.tenant_id)
        await self.repo.delete(client)
        await self.audit.record_raw(ctx, "CLIENT_DELETE", "clients", client.id)
        await self.db.commit()


class ContactService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ClientContactRepository(db)
        self.clients = ClientRepository(db)
        self.audit = AuditService(db)

    async def _require_client(self, ctx: Principal, client_id: uuid.UUID):
        await set_tenant_context(self.db, ctx.tc())
        return await self.clients.get_tenant_or_404(client_id, ctx.tenant_id)

    async def list(self, ctx: Principal, client_id: uuid.UUID) -> list[ContactRead]:
        await self._require_client(ctx, client_id)
        return [ContactRead.model_validate(c) for c in await self.repo.list_for_client(client_id)]

    async def create(self, ctx: Principal, client_id: uuid.UUID, payload: ContactCreate) -> ContactRead:
        await self._require_client(ctx, client_id)
        contact = await self.repo.create(client_id=client_id, **payload.model_dump())
        if payload.is_primary:
            await self._clear_primary(ctx, client_id, except_id=contact.id)
        await self.db.commit()
        return ContactRead.model_validate(contact)

    async def _clear_primary(self, ctx: Principal, client_id: uuid.UUID, except_id: uuid.UUID | None = None) -> None:
        contacts = await self.repo.list_for_client(client_id)
        for c in contacts:
            if c.id != except_id and c.is_primary:
                c.is_primary = False
        await self.db.flush()

    async def update(self, ctx: Principal, client_id: uuid.UUID, contact_id: uuid.UUID, payload: ContactUpdate) -> ContactRead:
        await self._require_client(ctx, client_id)
        contact = await self.repo.get_tenant_or_404(contact_id, ctx.tenant_id)
        await self.repo.update(contact, **payload.model_dump(exclude_unset=True))
        if payload.is_primary:
            await self._clear_primary(ctx, client_id, except_id=contact.id)
            contact.is_primary = True
        await self.db.commit()
        return ContactRead.model_validate(contact)

    async def delete(self, ctx: Principal, client_id: uuid.UUID, contact_id: uuid.UUID) -> None:
        await self._require_client(ctx, client_id)
        contact = await self.repo.get_tenant_or_404(contact_id, ctx.tenant_id)
        await self.repo.delete(contact)
        await self.db.commit()


class VehicleService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = VehicleRepository(db)
        self.clients = ClientRepository(db)
        self.history = VehicleHistoryRepository(db)
        self.audit = AuditService(db)
        self.numbers = DocumentNumberRepository(db)

    async def search(
        self, ctx: Principal, *, q: str | None, client_id: uuid.UUID | None, page: int, page_size: int
    ) -> tuple[list[VehicleRead], int]:
        await set_tenant_context(self.db, ctx.tc())
        vehicles, total = await self.repo.search(ctx.tenant_id, q=q, client_id=client_id, page=page, page_size=page_size)
        return [VehicleRead.model_validate(v) for v in vehicles], total

    async def get(self, ctx: Principal, vehicle_id: uuid.UUID) -> VehicleRead:
        await set_tenant_context(self.db, ctx.tc())
        vehicle = await self.repo.get_tenant_or_404(vehicle_id, ctx.tenant_id)
        return VehicleRead.model_validate(vehicle)

    async def create(self, ctx: Principal, payload: VehicleCreate) -> VehicleRead:
        await set_tenant_context(self.db, ctx.tc())
        if payload.client_id:
            await self.clients.get_tenant_or_404(payload.client_id, ctx.tenant_id)
        vehicle = await self.repo.create(**payload.model_dump())
        await self.db.flush()
        if payload.client_id:
            await self._link_owner(ctx, vehicle.id, payload.client_id, None)
            vehicle.client_id = payload.client_id
        await self.audit.record_raw(ctx, "VEHICLE_CREATE", "vehicles", vehicle.id)
        await self.db.commit()
        return VehicleRead.model_validate(vehicle)

    async def _link_owner(
        self, ctx: Principal, vehicle_id: uuid.UUID, client_id: uuid.UUID, started_at: date | None
    ) -> None:
        await self.history.end_active(vehicle_id, (started_at or datetime.now(UTC).date()) - timedelta(days=1))
        await self.history.add(
            self.history.model(
                tenant_id=ctx.tenant_id,
                vehicle_id=vehicle_id,
                client_id=client_id,
                started_at=started_at or datetime.now(UTC).date(),
            )
        )
        await self.db.flush()

    async def update(self, ctx: Principal, vehicle_id: uuid.UUID, payload: VehicleUpdate) -> VehicleRead:
        await set_tenant_context(self.db, ctx.tc())
        vehicle = await self.repo.get_tenant_or_404(vehicle_id, ctx.tenant_id)
        await self.repo.update(vehicle, **payload.model_dump(exclude_unset=True))
        if payload.client_id and payload.client_id != vehicle.client_id:
            await self.clients.get_tenant_or_404(payload.client_id, ctx.tenant_id)
            await self._link_owner(ctx, vehicle.id, payload.client_id, None)
        await self.audit.record_raw(ctx, "VEHICLE_UPDATE", "vehicles", vehicle.id)
        await self.db.commit()
        return VehicleRead.model_validate(vehicle)

    async def delete(self, ctx: Principal, vehicle_id: uuid.UUID) -> None:
        await set_tenant_context(self.db, ctx.tc())
        vehicle = await self.repo.get_tenant_or_404(vehicle_id, ctx.tenant_id)
        await self.repo.delete(vehicle)
        await self.audit.record_raw(ctx, "VEHICLE_DELETE", "vehicles", vehicle.id)
        await self.db.commit()

    async def list_for_client(self, ctx: Principal, client_id: uuid.UUID) -> list[VehicleRead]:
        await set_tenant_context(self.db, ctx.tc())
        vehicles = await self.repo.list_for_client(ctx.tenant_id, client_id)
        return [VehicleRead.model_validate(v) for v in vehicles]

    async def assign_owner(self, ctx: Principal, vehicle_id: uuid.UUID, payload: AssignOwnerRequest) -> VehicleRead:
        await set_tenant_context(self.db, ctx.tc())
        vehicle = await self.repo.get_tenant_or_404(vehicle_id, ctx.tenant_id)
        await self.clients.get_tenant_or_404(payload.client_id, ctx.tenant_id)
        await self._link_owner(ctx, vehicle.id, payload.client_id, payload.started_at)
        vehicle.client_id = payload.client_id
        await self.audit.record_raw(
            ctx, "VEHICLE_OWNER", "vehicles", vehicle.id, new_values={"client_id": str(payload.client_id)}
        )
        await self.db.commit()
        return VehicleRead.model_validate(vehicle)

    async def history(self, ctx: Principal, vehicle_id: uuid.UUID) -> list[VehicleHistoryRead]:
        await set_tenant_context(self.db, ctx.tc())
        rows = await self.history.list(where=[self.history.model.vehicle_id == vehicle_id])
        return [VehicleHistoryRead.model_validate(h) for h in rows]
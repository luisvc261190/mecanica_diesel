"""Repositorios CRM: clientes, contactos y vehículos."""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ColumnElement, func, or_, select

from app.models.crm import Client, ClientContact, Vehicle, VehicleClientHistory
from app.repositories.base import BaseRepository


class ClientRepository(BaseRepository[Client]):
    model = Client

    async def search(
        self,
        tenant_id: uuid.UUID,
        *,
        q: str | None = None,
        page: int = 1,
        page_size: int = 20,
        order_by: Any | None = None,
    ) -> tuple[list[Client], int]:
        where: list[ColumnElement[bool]] = [Client.tenant_id == tenant_id]
        if q:
            like = f"%{q}%"
            where.append(
                or_(
                    Client.first_name.ilike(like),
                    Client.last_name.ilike(like),
                    Client.company_name.ilike(like),
                    Client.doc_number.ilike(like),
                    Client.phone.ilike(like),
                    Client.email.ilike(like),
                )
            )
        return await self.list_paginated(
            where=where, order_by=order_by or Client.created_at.desc(), page=page, page_size=page_size
        )

    async def by_document(self, tenant_id: uuid.UUID, doc_type: str, doc_number: str) -> Client | None:
        stmt = select(Client).where(Client.tenant_id == tenant_id, Client.doc_type == doc_type, Client.doc_number == doc_number)
        return (await self.session.execute(stmt)).scalar_one_or_none()


class ClientContactRepository(BaseRepository[ClientContact]):
    model = ClientContact

    async def list_for_client(self, client_id: uuid.UUID) -> list[ClientContact]:
        return await self.list(where=[ClientContact.client_id == client_id], order_by=ClientContact.full_name)


class VehicleRepository(BaseRepository[Vehicle]):
    model = Vehicle

    async def search(
        self,
        tenant_id: uuid.UUID,
        *,
        q: str | None = None,
        client_id: uuid.UUID | None = None,
        page: int = 1,
        page_size: int = 20,
        order_by: Any | None = None,
    ) -> tuple[list[Vehicle], int]:
        where: list[ColumnElement[bool]] = [Vehicle.tenant_id == tenant_id]
        if client_id is not None:
            where.append(Vehicle.client_id == client_id)
        if q:
            like = f"%{q}%"
            where.append(or_(Vehicle.plate.ilike(like), Vehicle.vin.ilike(like), Vehicle.engine_number.ilike(like)))
        return await self.list_paginated(
            where=where, order_by=order_by or Vehicle.created_at.desc(), page=page, page_size=page_size
        )

    async def list_for_client(self, tenant_id: uuid.UUID, client_id: uuid.UUID) -> list[Vehicle]:
        return await self.list(where=[Vehicle.tenant_id == tenant_id, Vehicle.client_id == client_id])


class VehicleHistoryRepository(BaseRepository[VehicleClientHistory]):
    model = VehicleClientHistory

    async def end_active(self, vehicle_id: uuid.UUID, ended_at) -> None:
        stmt = (
            VehicleClientHistory.__table__.update()
            .where(VehicleClientHistory.vehicle_id == vehicle_id, VehicleClientHistory.ended_at.is_(None))
            .values(ended_at=ended_at)
        )
        await self.session.execute(stmt)

    async def count_active(self, client_id: uuid.UUID) -> int:
        stmt = select(func.count()).where(
            VehicleClientHistory.client_id == client_id, VehicleClientHistory.ended_at.is_(None)
        )
        return (await self.session.execute(stmt)).scalar_one()
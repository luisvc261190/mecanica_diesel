"""Auditoría: lectura de registros de audit_logs."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import Query
from pydantic import BaseModel, ConfigDict


class AuditQueryParams:
    def __init__(
        self,
        action: Annotated[str | None, Query()] = None,
        entity: Annotated[str | None, Query()] = None,
        page: Annotated[int, Query(ge=1)] = 1,
    ) -> None:
        self.action = action
        self.entity = entity
        self.page = page


class AuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID | None
    user_id: uuid.UUID | None
    action: str
    entity: str
    entity_id: uuid.UUID | None
    old_values: dict | None
    new_values: dict | None
    ip: str | None
    user_agent: str | None
    created_at: datetime
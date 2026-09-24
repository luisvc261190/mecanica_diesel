"""Archivos adjuntos."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.constants import FileKindT, FileVisibilityT


class FileUploadRequest(BaseModel):
    entity_type: str
    entity_id: uuid.UUID
    category: str | None = None
    visibility: FileVisibilityT = "PRIVATE"


class FileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    url: str
    name: str | None
    mime_type: str | None
    size_bytes: int | None
    category: str | None
    uploaded_by: uuid.UUID | None
    notes: str | None
    created_at: datetime

    kind: FileKindT | None = None
    visibility: FileVisibilityT = "PRIVATE"
    original_name: str | None = None
    storage_key: str | None = None
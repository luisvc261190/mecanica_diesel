"""Servicio de archivos: validación, persistencia en Storage y registro en base."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import set_tenant_context
from app.core.exceptions import BusinessRuleError
from app.models.aux_models import FileAsset
from app.repositories.aux_repos import FileRepository
from app.schemas.files import FileRead, FileUploadRequest
from app.services.audit import AuditService
from app.services.context import Principal
from app.services.storage import get_storage


class FileService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = FileRepository(db)
        self.audit = AuditService(db)
        self.storage = get_storage()
        self._settings = get_settings()

    def _validate(self, content: bytes, mime: str, filename: str) -> None:
        if not content:
            raise BusinessRuleError(message="El archivo está vacío", code="EMPTY_FILE")
        if len(content) > self._settings.max_upload_bytes:
            raise BusinessRuleError(
                message=f"Archivo excede {self._settings.MAX_UPLOAD_SIZE_MB} MB", code="FILE_TOO_LARGE"
            )
        if mime not in self._settings.ALLOWED_UPLOAD_MIMES:
            raise BusinessRuleError(message=f"Tipo de archivo no permitido: {mime}", code="MIME_NOT_ALLOWED")
        if not filename:
            raise BusinessRuleError(message="Nombre de archivo requerido", code="FILENAME_REQUIRED")

    async def upload(
        self,
        ctx: Principal,
        payload: FileUploadRequest,
        *,
        content: bytes,
        mime: str,
        filename: str,
    ) -> FileRead:
        await set_tenant_context(self.db, ctx.tc())
        self._validate(content, mime, filename)
        ext = Path(filename).suffix[:12]
        key = (
            f"{ctx.tenant_id}/{payload.entity_type}/{datetime.now(UTC):%Y/%m}/"
            f"{uuid.uuid4().hex[:16]}{ext}"
        )
        url = await self.storage.save(key=key, data=content, mime=mime)
        file = await self.repo.create(
            tenant_id=ctx.tenant_id,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            url=url,
            name=Path(filename).name[:255],
            mime_type=mime,
            size_bytes=len(content),
            category=payload.category,
            uploaded_by=ctx.user_id,
        )
        await self.audit.record_raw(ctx, "FILE_UPLOAD", "files", file.id, new_values={"url": url})
        await self.db.commit()
        read = FileRead.model_validate(file)
        read.original_name = Path(filename).name
        read.storage_key = key
        return read

    async def list_for_entity(self, ctx: Principal, entity_type: str, entity_id: uuid.UUID) -> list[FileRead]:
        await set_tenant_context(self.db, ctx.tc())
        rows = await self.repo.list(
            where=[
                FileAsset.tenant_id == ctx.tenant_id,
                FileAsset.entity_type == entity_type,
                FileAsset.entity_id == entity_id,
            ],
            order_by=FileAsset.created_at.desc(),
        )
        return [FileRead.model_validate(r) for r in rows]

    async def delete(self, ctx: Principal, file_id: uuid.UUID) -> None:
        await set_tenant_context(self.db, ctx.tc())
        file = await self.repo.get_tenant_or_404(file_id, ctx.tenant_id)
        key = file.url.removeprefix("/uploads/")
        await self.storage.delete(key)
        await self.repo.delete(file)
        await self.audit.record_raw(ctx, "FILE_DELETE", "files", file.id)
        await self.db.commit()
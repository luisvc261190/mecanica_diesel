"""Rutas de archivos adjuntos (multipart)."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_permission
from app.schemas.common import ApiResponse
from app.schemas.files import FileRead, FileUploadRequest
from app.services.context import Principal
from app.services.files import FileService

router = APIRouter(prefix="/files", tags=["files"])


@router.post("", response_model=ApiResponse[FileRead], status_code=201)
async def upload_file(
    entity_type: str = Form(...),
    entity_id: uuid.UUID = Form(...),
    category: str | None = Form(default=None),
    file: UploadFile = File(...),
    principal: Principal = Depends(require_permission("files.upload")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    read = await FileService(db).upload(
        principal,
        FileUploadRequest(entity_type=entity_type, entity_id=entity_id, category=category),
        content=content,
        mime=file.content_type or "application/octet-stream",
        filename=file.filename or "archivo",
    )
    return ApiResponse(data=read, message="Archivo subido")


@router.get("/{entity_type}/{entity_id}", response_model=ApiResponse[list[FileRead]])
async def list_files(
    entity_type: str,
    entity_id: uuid.UUID,
    principal: Principal = Depends(require_permission("files.upload")),
    db: AsyncSession = Depends(get_db),
):
    return ApiResponse(data=await FileService(db).list_for_entity(principal, entity_type, entity_id))


@router.delete("/{file_id}", response_model=ApiResponse[dict])
async def delete_file(
    file_id: uuid.UUID,
    principal: Principal = Depends(require_permission("files.delete")),
    db: AsyncSession = Depends(get_db),
):
    await FileService(db).delete(principal, file_id)
    return ApiResponse(data={"id": str(file_id)}, message="Archivo eliminado")
"""Schemas genéricos compartidos: paginación y envoltorio de respuesta único de la API."""
from __future__ import annotations

from typing import Annotated

from fastapi import Query
from pydantic import BaseModel


class ApiResponse[T](BaseModel):
    """Envoltorio estándar: ``{"data": ..., "message": "..."}``."""

    data: T | None = None
    message: str = "OK"


class ErrorBody(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    error: ErrorBody


class Paginated[T](BaseModel):
    items: list[T]
    page: int
    page_size: int
    total: int
    pages: int

    @classmethod
    def build(cls, items: list[T], page: int, page_size: int, total: int) -> Paginated[T]:
        pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(items=items, page=page, page_size=page_size, total=total, pages=pages)


class PaginationParams:
    def __init__(
        self,
        page: Annotated[int, Query(ge=1)] = 1,
        page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    ) -> None:
        self.page = page
        self.page_size = page_size


class MaskedResponse(BaseModel):
    """Respuesta para operaciones de borrado lógico."""

    id: str
    deleted: bool = True
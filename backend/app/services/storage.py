"""Almacenamiento de archivos (local por defecto; interfaz intercambiable)."""
from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import get_settings


class Storage(ABC):
    @abstractmethod
    async def save(self, *, key: str, data: bytes, mime: str | None = None) -> str:
        """Persiste el contenido y devuelve la URL pública."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Elimina el objeto almacenado."""


class LocalStorage(Storage):
    def __init__(self, base: Path | None = None) -> None:
        self.base = base if base is not None else Path(get_settings().STORAGE_BUCKET)

    async def save(self, *, key: str, data: bytes, mime: str | None = None) -> str:
        destination = self.base / key

        async def _write() -> None:
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(data)

        await asyncio.to_thread(_write)
        return f"/uploads/{key}"

    async def delete(self, key: str) -> None:
        async def _remove() -> None:
            path = self.base / key
            if path.exists():
                path.unlink()

        await asyncio.to_thread(_remove)


def get_storage() -> Storage:
    settings = get_settings()
    if settings.STORAGE_PROVIDER == "local":
        return LocalStorage()
    raise ValueError(f"STORAGE_PROVIDER desconocido: {settings.STORAGE_PROVIDER!r}")
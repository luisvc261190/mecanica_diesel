"""Repositorios AUX: notificaciones y archivos."""
from __future__ import annotations

from app.models.aux_models import FileAsset, Notification
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    model = Notification


class FileRepository(BaseRepository[FileAsset]):
    model = FileAsset
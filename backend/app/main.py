"""Aplicación FastAPI principal (módulo sin dependencias side-effects)."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import api_v1
from app.core.config import get_settings
from app.core.database import dispose_engine
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging
from app.middleware import RequestContextMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.LOG_LEVEL)
    uploads_dir = Path(settings.STORAGE_BUCKET)
    uploads_dir.mkdir(parents=True, exist_ok=True)
    yield
    await dispose_engine()


def create_app() -> FastAPI:
    app = FastAPI(
        title="Laboratorio de Tecnología Diesel",
        description="API multi-tenant para talleres de vehículos diésel.",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)

    app.include_router(api_v1)

    uploads = Path(settings.STORAGE_BUCKET)
    if uploads.exists():
        app.mount("/uploads", StaticFiles(directory=str(uploads)), name="uploads")

    return app


app = create_app()
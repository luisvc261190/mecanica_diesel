from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración central vía variables de entorno. Nunca securas en código."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/ltd"
    SCHEMA_BASELINE_FILE: str = "base_datos/04_schema.sql"

    JWT_SECRET_KEY: str = "change_me_in_production_64_chars_minimum"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    STORAGE_PROVIDER: str = "local"
    STORAGE_BUCKET: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_UPLOAD_MIMES: Annotated[list[str], NoDecode] = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
    ]

    LOG_LEVEL: str = "INFO"
    RATE_LIMIT_ENABLED: bool = False

    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20

    @field_validator("CORS_ORIGINS", "ALLOWED_UPLOAD_MIMES", mode="before")
    @classmethod
    def _split_csv(cls, v: object) -> object:
        # pydantic-settings intenta parsear JSON; con valores planos separados por coma,
        # convertimos explícitamente a lista.
        if isinstance(v, str) and not v.strip().startswith("["):
            return [part.strip() for part in v.split(",") if part.strip()]
        return v

    @property
    def sync_database_url(self) -> str:
        """URL para Alembic y herramientas sync (psycopg3 nativa)."""
        return self.DATABASE_URL.replace("+asyncpg", "+psycopg")

    @property
    def baseline_sql_path(self) -> Path:
        """Ruta absoluta al baseline 04_schema.sql (relativa al repo o absoluta)."""
        p = Path(self.SCHEMA_BASELINE_FILE)
        if not p.is_absolute():
            # Relativo a la raíz del repositorio (mecanicas_tenant)
            return Path(__file__).resolve().parents[3] / p
        return p

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "prod"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
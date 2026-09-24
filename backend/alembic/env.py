"""Entorno Alembic: engine sync (psycopg) y metadata de la app para autogenerate.

El baseline (04_schema.sql) se ejecuta una sola vez en la migración inicial 0001
ejecutándolo dentro de la transacción de Alembic. Para `--autogenerate` conviene
que el esquema de la BD ya tenga el baseline aplicado y versionado.
"""
from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from app.core.config import get_settings
from app.models import *  # noqa: F401,F403  (registra toda la metadata)
from app.models.base import Base
from sqlalchemy import engine_from_config, pool

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().sync_database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Genera SQL sin conexión (uso en planificación/CI)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
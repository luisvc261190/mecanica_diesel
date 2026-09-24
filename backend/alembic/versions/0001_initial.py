"""initial schema: baseline 04_schema.sql + refresh_tokens

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00
"""
from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op
from app.core.config import get_settings
from sqlalchemy.dialects.postgresql import UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def _baseline_sql() -> str:
    """Lee el baseline y lo entrega *sin* sus BEGIN/COMMIT.

    Alembic envuelve cada migración en una transacción; un BEGIN adicional
    fallaría ("there is already a transaction in progress").
    """
    path = get_settings().baseline_sql_path
    if not path.exists():
        raise FileNotFoundError(f"No se encontró el baseline en {path}")
    sql = path.read_text(encoding="utf-8")
    stripped: list[str] = []
    for line in sql.splitlines():
        s = line.strip().upper()
        if s in {"BEGIN", "COMMIT", "BEGIN;", "COMMIT;"}:
            continue
        stripped.append(line)
    return "\n".join(stripped)


def upgrade() -> None:
    # 1) Baseline completo (DLL + RLS + seeds + funciones) dentro de la transacción.
    connection = op.get_bind()
    sql = _baseline_sql()
    # psycopg (sync) acepta scripts multi-statement sin parámetros (protocolo simple).
    connection.connection.execute(sql)

    # 2) Tabla propia de la aplicación que no existe en el baseline.
    op.create_table(
        "refresh_tokens",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])


def downgrade() -> None:
    # El baseline no se revierte (los objetos se gestionan en el esquema versionado);
    # esta migración solo garantiza quitar refresh_tokens.
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
"""Logging estructurado con contexto de request (request_id, user, tenant)."""
from __future__ import annotations

import logging
from contextvars import ContextVar
from typing import Any

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
user_id_var: ContextVar[str] = ContextVar("user_id", default="-")
tenant_id_var: ContextVar[str] = ContextVar("tenant_id", default="-")


class ContextFormatter(logging.Formatter):
    """Formatea cada línea con el contexto de la request de forma estable."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: A003
        record.request_id = request_id_var.get()
        record.ctx_user = user_id_var.get()
        record.ctx_tenant = tenant_id_var.get()
        return super().format(record)

    def formatMessage(self, record: logging.LogRecord) -> str:
        extras: list[str] = [
            f"request_id={record.request_id}",
            f"user={record.ctx_user}",
            f"tenant={record.ctx_tenant}",
        ]
        return f"[{extras[0]} {extras[1]} {extras[2]}] {super().formatMessage(record)}"


def setup_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.setLevel(level.upper())
    handler = logging.StreamHandler()
    handler.setFormatter(ContextFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root.handlers = [handler]


def set_request_context(*, request_id: str | None = None, user_id: str | None = None, tenant_id: str | None = None) -> None:
    """Sincroniza el contexto con el logger (no registra datos sensibles)."""
    context_vars: dict[str, Any] = {}
    if request_id is not None:
        context_vars["request_id"] = request_id
    if user_id is not None:
        context_vars["user_id"] = user_id
    if tenant_id is not None:
        context_vars["tenant_id"] = tenant_id
    for name in ("request_id", "user_id", "tenant_id"):
        if name in context_vars:
            globals()[f"{name}_var"].set(context_vars[name])
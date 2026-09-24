"""Excepciones de dominio y handler global."""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Error base de la API con código para el cliente."""

    status_code: int = 400
    code: str = "ERROR"

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"


class ValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"


class BusinessRuleError(AppError):
    status_code = 409
    code = "BUSINESS_RULE_VIOLATION"


class PermissionDeniedError(AppError):
    status_code = 403
    code = "PERMISSION_DENIED"


class TenantAccessError(AppError):
    status_code = 404
    code = "TENANT_ACCESS_DENIED"


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"


def register_exception_handlers(app: FastAPI) -> None:
    """Registra un solo handler base; Starlette resuelve subclases por MRO."""

    @app.exception_handler(AppError)
    async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:  # noqa: ARG001
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": exc.message}})

    @app.exception_handler(Exception)
    async def _unexpected_handler(request: Request, exc: Exception) -> JSONResponse:  # noqa: ARG001
        # Sin stack-trace al cliente en producción.
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "INTERNAL_ERROR", "message": "Error interno del servidor"}},
        )
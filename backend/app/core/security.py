"""Hashing de contraseñas (pwdlib/Argon2) y JWT (PyJWT)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError

settings = get_settings()
_password_hash = PasswordHash.recommended()  # argon2id por defecto

T = "access"
RT = "refresh"

KEY_TYPE = "typ"


def hash_password(plain: str) -> str:
    return _password_hash.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _password_hash.verify(plain, hashed)
    except Exception:  # hash corrupto o desconocido: nunca afirmar éxito
        return False


def _encode(payload: dict, expires_in: timedelta) -> str:
    now = datetime.now(UTC)
    payload.update({"iat": now, "exp": now + expires_in})
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_access_token(*, user_id: uuid.UUID, tenant_id: uuid.UUID | None, roles: list[str]) -> str:
    return _encode(
        {"sub": str(user_id), "tid": str(tenant_id) if tenant_id else None, "roles": roles, KEY_TYPE: T},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(*, user_id: uuid.UUID, jti: uuid.UUID) -> str:
    return _encode({"sub": str(user_id), "jti": str(jti), KEY_TYPE: RT}, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))


def decode_token(token: str, *, expected_type: str = T) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("El token ha expirado", code="TOKEN_EXPIRED") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Token inválido", code="TOKEN_INVALID") from exc
    if payload.get(KEY_TYPE) != expected_type:
        raise UnauthorizedError("Tipo de token incorrecto", code="TOKEN_TYPE_MISMATCH")
    return payload


def token_payload(token: str, *, expected_type: str = T) -> dict:
    """Decodifica sin validar expiración (para refresh: se valida contra DB)."""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_exp": False},
        )
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Token inválido", code="TOKEN_INVALID") from exc
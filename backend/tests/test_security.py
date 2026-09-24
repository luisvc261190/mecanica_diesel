"""Pruebas unitarias de capa de seguridad: hash y JWT."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    token_payload,
    verify_password,
)


def test_hash_and_verify_roundtrip():
    hashed = hash_password("s3cr3t-password")
    assert hashed != "s3cr3t-password"
    assert verify_password("s3cr3t-password", hashed)
    assert not verify_password("otra-clave", hashed)


def test_verify_rejects_garbage_hash():
    assert not verify_password("x", "no-es-un-hash")


def _settings() -> get_settings():
    return get_settings()


def test_access_token_roundtrip():
    uid, tid = uuid.uuid4(), uuid.uuid4()
    token = create_access_token(user_id=uid, tenant_id=tid, roles=["OWNER"])
    payload = decode_token(token)  # expected_type="access"
    assert payload["sub"] == str(uid)
    assert payload["tid"] == str(tid)
    assert payload["roles"] == ["OWNER"]


def test_refresh_token_type_mismatch_rejected():
    token = create_refresh_token(user_id=uuid.uuid4(), jti=uuid.uuid4())
    with pytest.raises(UnauthorizedError):
        decode_token(token)  # espera "access", recibe "refresh"
    payload = token_payload(token, expected_type="refresh")
    assert payload["jti"]


def test_expired_token_rejected():
    settings = _settings()
    now = datetime.now(UTC)
    expired = jwt.encode(
        {"sub": str(uuid.uuid4()), "tid": None, "roles": [], "typ": "access", "iat": now, "exp": now - timedelta(minutes=1)},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    with pytest.raises(UnauthorizedError):
        decode_token(expired)


def test_tampered_token_rejected():
    token = create_access_token(user_id=uuid.uuid4(), tenant_id=None, roles=[])
    tampered = token[:-2] + ("aa" if not token.endswith("aa") else "bb")
    with pytest.raises(UnauthorizedError):
        decode_token(tampered)
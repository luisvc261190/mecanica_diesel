"""Bootstrap del SUPER_ADMIN de plataforma y reparación del índice de `services`.

Pasos (todo en una sola transacción, atómico):
  1. Repara el índice `uq_service_code` de `services`: el baseline usaba un
     índice PARCIAL (`WHERE code IS NOT NULL`), pero `provision_tenant` hace
     `ON CONFLICT (tenant_id, code)` y PostgreSQL no puede usar un índice
     parcial como target de ON CONFLICT -> error 500 en el onboarding.
     Se reemplaza por un índice único completo (PG sigue permitiendo varios
     NULL para `code`, no cambia la lógica de negocio).
  2. Crea (idempotente) un tenant de plataforma, el usuario superadmin con
     `is_platform_admin = true`, le asigna el rol SUPER_ADMIN y una suscripción
     FREE, y ejecuta `provision_tenant` para ese tenant.

Uso:
  python scripts/bootstrap_superadmin.py --email admin@multilab.pe --password '...'
  Si no se pasa --password se genera una contraseña segura y se imprime.
"""
from __future__ import annotations

import argparse
import asyncio
import selectors
import secrets
import string
import uuid

from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine, dispose_engine
from app.core.security import hash_password


async def _select_one(session, sql: str, **params):
    res = await session.execute(text(sql), params)
    return res.scalar()


async def _select_value(session, sql: str, **params):
    res = await session.execute(text(sql), params)
    return res.scalar()


def _strong_password(length: int = 20) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*-_"
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def run(args) -> None:
    async with engine.begin() as conn:
        # 1. Índice de services: parcial -> completo.
        await conn.execute(text("DROP INDEX IF EXISTS uq_service_code"))
        await conn.execute(
            text(
                """
                CREATE UNIQUE INDEX uq_service_code ON public.services (tenant_id, code)
                """
            )
        )
        print("[OK] Indice uq_service_code reparado (unico completo en services).")

        # 2. Superadmin (idempotente).
        existing_user = await _select_value(
            conn, "SELECT id FROM users WHERE email = :email", email=args.email
        )
        if existing_user is not None:
            print(f"[INFO] El usuario {args.email} ya existe ({existing_user}). Nada que crear.")
            return

        password = args.password or _strong_password()
        password_hash = hash_password(password)

        tenant_id = str(uuid.uuid4())
        user_id = str(uuid.uuid4())

        tenant_slug = args.tenant_slug or "plataforma"
        tenant_name = args.tenant_name or "Plataforma MultiWorkshop"

        await conn.execute(
            text(
                """
                INSERT INTO tenants (id, commercial_name, slug, country, currency, timezone, status)
                VALUES (:tid, :name, :slug, 'PE', 'PEN', 'America/Lima', 'ACTIVE')
                """
            ),
            {"tid": tenant_id, "name": tenant_name, "slug": tenant_slug},
        )

        await conn.execute(
            text(
                """
                INSERT INTO users (id, email, password_hash, full_name, is_active, is_platform_admin)
                VALUES (:uid, :email, :pwd, :full_name, true, true)
                """
            ),
            {"uid": user_id, "email": args.email, "pwd": password_hash, "full_name": args.full_name},
        )

        super_admin_role_id = await _select_value(
            conn, "SELECT id FROM roles WHERE code = 'SUPER_ADMIN'"
        )
        if super_admin_role_id is None:
            raise RuntimeError("No existe el rol SUPER_ADMIN en la BD (seeds no aplicados).")

        await conn.execute(
            text(
                """
                INSERT INTO user_tenant_roles (tenant_id, user_id, role_id)
                VALUES (:tid, :uid, :rid)
                """
            ),
            {"tid": tenant_id, "uid": user_id, "rid": str(super_admin_role_id)},
        )

        free_plan_id = await _select_value(conn, "SELECT id FROM plans WHERE code = 'FREE'")
        if free_plan_id is not None:
            await conn.execute(
                text(
                    """
                    INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, started_at)
                    VALUES (:tid, :pid, 'TRIAL', now())
                    """
                ),
                {"tid": tenant_id, "pid": str(free_plan_id)},
            )
            print("[OK] Suscripcion TRIAL plan FREE creada.")

        await conn.execute(text("SELECT provision_tenant(:tid)"), {"tid": tenant_id})
        print("[OK] provision_tenant ejecutado para el tenant de plataforma (sin errores).")

    print("\n" + "=" * 60)
    print("[+] SUPER_ADMIN creado correctamente:")
    print(f"    Email          : {args.email}")
    if password:
        print(f"    Contrasena     : {password}")
    print(f"    Tenant         : {tenant_name} (slug: {tenant_slug}, id: {tenant_id})")
    print("=" * 60)
    print("Cambia la contrasena despues del primer ingreso.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Crea el SUPER_ADMIN de plataforma")
    parser.add_argument("--email", default="admin@multilab.pe", help="Email del superadmin")
    parser.add_argument("--password", default=None, help="Contrasena (si se omite, se genera)")
    parser.add_argument("--full-name", default="Super Admin Plataforma", help="Nombre completo")
    parser.add_argument("--tenant-name", default="Plataforma MultiWorkshop", help="Nombre del tenant de plataforma")
    parser.add_argument("--tenant-slug", default="plataforma", help="Slug del tenant de plataforma")
    args = parser.parse_args()

    asyncio.run(
        run(args),
        loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
    )
    # close engine after loop
    asyncio.run(
        dispose_engine(),
        loop_factory=lambda: asyncio.SelectorEventLoop(selectors.SelectSelector()),
    )


if __name__ == "__main__":
    main()
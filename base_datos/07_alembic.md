# FASE 8 — ALEMBIC · FastAPI · SQLAlchemy 2 · Neon

## 1. Estrategia general

1. **Baseline**: este `04_schema.sql` es la migración inicial. Se ejecuta UNA vez (rol owner/migrador) y se declara en Alembic como `down_revision=None`.
2. **Versionado**: a partir de aquí, TODA evolución va por migraciones Alembic. Nunca DDL a mano en producción.
3. **Aislamiento**: Alembic se conecta con el **rol owner / migrador** (superuser Neon). RLS NO interfiere (no se usa `FORCE ROW LEVEL SECURITY`), así que `CREATE/ALTER/DROP` fluyen sin contexto de tenant.
4. **Contexto por request**: el rol runtime (`rol_app`) nunca hace DDL. Solo DML dentro de su RLS.

## 2. Estructura de proyecto sugerida

```
backend/
├── alembic.ini
├── migrations/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       ├── 0001_baseline.py          (equivale a 04_schema.sql)
│       ├── 0002_provision_tenant.py  (helper función, si se desea)
│       └── ...
├── app/
│   ├── core/
│   │   ├── config.py
│   │   ├── db.py                 (async engine + session factory)
│   │   ├── security.py           (bcrypt, JWT)
│   │   └── multitenancy.py       (GUC por request)
│   ├── models/                   (SQLAlchemy 2 ORM por módulo)
│   │   ├── platform.py
│   │   ├── organization.py
│   │   ├── crm.py
│   │   ├── workshop.py
│   │   ├── inventory.py
│   │   └── finance.py
│   └── api/
└── alembic env.py tema clave: conectar con DATABASE_URL de migración
```

### `env.py` (puntos clave)

```python
from alembic import context
from app.core.config import settings
from app.models import Base  # importa TODOS los modelos

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL_MIGRATIONS)
target_metadata = Base.metadata

def run_migrations_online():
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    asyncio.run(run_async_migrations(connectable))
```

> ✋ **`DATABASE_URL_MIGRATIONS` ≠ URL de runtime**: las migraciones usan credenciales de owner. La app usa las de `rol_app`.

## 3. Baseline de SQLAlchemy 2 (models)

Todos los modelos multi-tenant comparten un mixin:

```python
import uuid
from sqlalchemy import UUID, Column, DateTime, func, Index, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TenantMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Client(TenantMixin, Base):
    __tablename__ = "clients"
    __table_args__ = (
        Index("uq_client_doc", "tenant_id", "doc_type", "doc_number",
              postgresql_where=text("doc_number IS NOT NULL"), unique=True),
        Index("idx_clients_tenant_status", "tenant_id", "status"),
    )
    first_name: Mapped[str | None] = mapped_column(String(120))
    last_name:  Mapped[str | None] = mapped_column(String(120))
    ...
```

## 4. GUC multi-tenant por request (FastAPI)

```python
# app/core/multitenancy.py
import uuid
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

async def set_tenant_context(db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID,
                             is_platform_admin: bool = False):
    await db.execute(text("SELECT set_config('app.current_tenant_id', :t, true)"),
                     {"t": str(tenant_id)})
    await db.execute(text("SELECT set_config('app.current_user_id', :u, true)"),
                     {"u": str(user_id)})
    await db.execute(text("SET LOCAL app.is_platform_admin = :a"),
                     {"a": "on" if is_platform_admin else "off"})

# app/api/deps.py  — dependencia por request
from fastapi import Depends, HTTPException
async def get_db_tenant(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    tenant = await resolve_effective_tenant(user)          # del juego user_tenant_roles / subdominio
    if tenant is None:
        raise HTTPException(403, "sin tenant asignado")
    await set_tenant_context(db, tenant.id, user.id)
    return db
```

> La dependencia se usa en cada endpoint. Así el frontend NUNCA envía `tenant_id`; el backend lo resuelve del JWT.

### Resolución de tenant (2 opciones típicas)

| Opción | Uso |
|---|---|
| JWT con `{ sub, tenants: [{id, role}] }` | Evita round-trip; el backend valida el rol en cada endpoint. |
| Subdominio/slug del request | `app.dominio.com/<slug>` o `<slug>.dominio.com` → se resuelve `tenants.slug` → se valida que el user tenga rol en ese tenant. |

## 5. Numeración legible desde SQLAlchemy

```python
result = await db.execute(text(
    "SELECT next_document_number(:tenant, :branch, 'WORK_ORDER', 'OT', :year)"
), {...})
ot_number = result.scalar()
order = WorkOrder(number=ot_number, ...)
```
Llave dentro de la misma transacción que crea la OT.

## 6. Ciclo de migraciones (flujo de trabajo)

```
1. Editar modelos (SQLAlchemy)
2. poetry run alembic revision --autogenerate -m "add suppliers"
3. Revisar el archivo generado (nunca confiar ciego en autogenerate)
4. poetry run alembic upgrade head        (rol migrador/owner)
5. poetry run alembic history --verbose   (auditoría de versiones)
```

**Buenas prácticas específicas de este esquema**
- Índices únicos parciales y `NULLS NOT DISTINCT`: autogenerate no siempre los captura; declararlos con `__table_args__` o añadirlos manualmente en la migración.
- CHECKs de estados: agregar siempre como `CHECK (status IN (...))` con nombre (`op.op('create_check_constraint')`) para poder `drop`/`add` limpios.
- RLS y políticas: **no** se versionan con SQLAlchemy metadata; se gestionan con migraciones Alembic `op.execute(...)` (CREATE POLICY / ALTER TABLE) para mantener una fuente de verdad por versión.
- JSONB: usar `sqlalchemy.dialects.postgresql.JSONB`.

Ejemplo de migración con RLS:

```python
def upgrade():
    op.execute("ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY p_suppliers_tenant ON suppliers FOR ALL
        USING (tenant_id = current_tenant() OR is_platform_admin())
        WITH CHECK (tenant_id = current_tenant() OR is_platform_admin())
    """)

def downgrade():
    op.execute("DROP POLICY IF EXISTS p_suppliers_tenant ON suppliers")
    op.execute("ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY")
```

## 7. Neon — recomendaciones de operación

- **Pooling**: usar el endpoint *Pooled* de Neon (supabase/pgBouncer-compatible) para los asientos `rol_app`; el endpoint *Direct* para migraciones.
- **Branching**: por PR/QA con un CLI (Neon branch) para probar migraciones sin tocar producción.
- **Autoscale**: empezar en cómputo mínimo; escalar según métricas.
- **Backups / PITR**: habilitados por Neon; la auditoría en BD es complementaria.
- **Pre-requisito de versiones**: usar el `CREATE EXTENSION pgcrypto`/`citext` (Neon los permite) y corroborar la versión activa (15+) para `NULLS NOT DISTINCT` y `security_invoker`.

## 8. Nota de migración para el futuro

- Para evolucionar estados de OT: `op.execute("ALTER TABLE work_orders DROP CONSTRAINT work_orders_status_check")` + nuevo CHECK en **la misma** migración con `op.execute("""ALTER TABLE work_orders ADD CONSTRAINT ... CHECK (status IN (...))""")`.
- Si se añade particionado: convertir la tabla en particionada implica `CREATE TABLE ... PARTITION BY` + mover datos; planificar en ventana de mantenimiento (o usar particionado por creación desde el inicio en tablas-LOG como `audit_logs`).
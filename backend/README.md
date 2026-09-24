# Backend — Laboratorio de Tecnología Diesel

API REST multi-tenant (FastAPI + SQLAlchemy async + PostgreSQL) para el SaaS de
talleres de mecánica diésel. El esquema vive en `base_datos/` (baseline + Alembic);
el aislamiento por tenant lo aplica PostgreSQL mediante **RLS + GUC de sesión**
(`app.current_tenant_id`, `app.current_user_id`), nunca el cliente.

## Stack

- Python 3.13, FastAPI, Uvicorn, pydantic v2
- SQLAlchemy 2.0 (async con `asyncpg`-compatible; sync con `psycopg3` para Alembic)
- Alembic 1.20 (migraciones tras el baseline)
- Ruff (lint) + pytest

## Puesta en marcha

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -e ".[dev]"

copy .env.example .env   # editar DATABASE_URL y JWT_SECRET_KEY
```

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | URL async (`postgresql+asyncpg://` o `…+psycopg://`). Neon requiere `?sslmode=require`. |
| `SCHEMA_BASELINE_FILE` | Ruta al baseline `04_schema.sql` relativa a la raíz del repo. |
| `JWT_SECRET_KEY` | Clave HS256 (≥64 chars en producción). |
| `STORAGE_BUCKET` | Directorio local de adjuntos (montado en `/uploads`). |

## Base de datos

1. Aplicar baseline una sola vez (rol con privilegios):
   ```bash
   psql "$DATABASE_URL" -f ../base_datos/04_schema.sql
   ```
2. Versionar con Alembic (tabla `refresh_tokens` se crea aquí, además de clave `alembic_version`):
   ```bash
   alembic upgrade head            # ONLINE, contra la BD
   alembic upgrade head --sql      # OFF-LINE, plan de SQL
   ```
3. Autogenerado contra una BD que ya esté al head:
   ```bash
   alembic revision --autogenerate -m "descripcion"
   ```

> La migración inicial `0001` ejecuta el baseline completo dentro de su propia
> transacción (sin sus `BEGIN/COMMIT`) y luego crea `refresh_tokens`.

## Ejecutar y validar

```bash
uvicorn app.main:app --reload
# http://localhost:8000/docs  •  /api/v1/health

python -m ruff check app alembic tests
python -m pytest -q                 # 31 unitarias (sin BD / sin red)
python -c "import app.main"         # sanity de import completo (FastAPI + Depends)
```

## Arquitectura

```
app/
├── api/            routers /api/v1/* + deps (JWT, RBAC, tenant)
├── core/           settings, database, security(JWT), exceptions, permissions(RBAC), logging
├── models/         mapeos ORM (reflejan base_datos/04_schema.sql)
├── repositories/   capa de acceso genérica + módulos
├── schemas/        contratos pydantic (request/response, envelopes, constantes)
└── services/       servicios de negocio (usuarios, workshop, inventario, pagos, quotes, archivos…)
alembic/            migraciones versionadas
```

Filosofía clave:

- **Envoltorio único**: `{"data": ...}` y `{"error": {"code","message"}}`; 80 endpoints.
- **Tenant**: el `Principal` (sub, tid, roles) sale del JWT firmado; cada request
  setea el GUC vía `set_tenant_context` en su transacción. RLS hace el resto.
- **RBAC**: permisos en `core/permissions.py`; dependencias `require_permission(*...)`.
- **Dinero**: siempre `Decimal`/`NUMERIC(12,2)`; IGV 18%; nunca float.
- **Números documentos**: función `next_document_number` del baseline
  (OT con prefijo `OT/{año}-`, presupuestos `COT/`, clientes `CLT/`).

## Notas

- Pruebas de integración con PostgreSQL real (RLS, transacciones, RLS por tenant)
  están pendientes de un engine de CI con Postgres; los unit tests cubren lógica,
  JWT, RBAC y schemas sin BD.
- En producción: `ENVIRONMENT=production` y rotar `JWT_SECRET_KEY`.
- RLS requiere que el rol de la app sea el `SET app.current_tenant_id` propio;
  Super Admin pasa con `SET LOCAL app.is_platform_admin = 'on'`.
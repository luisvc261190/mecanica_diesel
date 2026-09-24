# Laboratorio de Tecnología Diesel — Plataforma SaaS Multi-Tenant

Base de datos de una plataforma SaaS (shared db + shared schema + `tenant_id` + **RLS**) para talleres y empresas de vehículos diésel. El primer tenant es **Laboratorio de Tecnología Diesel**, pero la arquitectura sirve para 1 → 10 000 tenants.

Stack objetivo: **Neon PostgreSQL + FastAPI + SQLAlchemy 2 + Alembic + React/TypeScript**. Sin facturación electrónica ni SUNAT en esta versión (solo cotizaciones, órdenes, pagos internos y saldos).

---

## Entregables (Fases)

| Fase | Archivo | Contenido |
|---|---|---|
| 1 | [`01_arquitectura.md`](01_arquitectura.md) | Arquitectura multi-tenant, aislamiento, RLS, RBAC, módulos, escalabilidad |
| 2–3 | [`02_modelo_datos_y_relaciones.md`](02_modelo_datos_y_relaciones.md) | Todas las entidades (propósito, PK/FK/índices/constraints) y el mapa de relaciones |
| 4 | [`03_erd.md`](03_erd.md) | Diagrama ERD (Mermaid) |
| 5 | [`04_schema.sql`](04_schema.sql) | **SQL PostgreSQL completo**: tablas, UUID, FKs, constraints, índices, triggers, soft delete, RLS + políticas, seeds, `provision_tenant()` |
| 6 | [`05_seguridad_multitenant.md`](05_seguridad_multitenant.md) | Flujo Usuario→JWT→tenant_id→Backend→PostgreSQL→RLS (impide fuga entre tenants) |
| 7 | [`06_validacion.md`](06_validacion.md) | Auditoría del modelo: duplicidad, FKs, normalización, índices, RLS, integridad, escalabilidad, seguridad |
| 8 | [`07_alembic.md`](07_alembic.md) | Llevar el esquema a FastAPI + SQLAlchemy 2 + Alembic + Neon y estrategia de migraciones |

---

## Arranque rápido

```bash
# 1) En Neon: crear base y ejecutar el baseline con un rol owner
psql "$DATABASE_URL" -f 04_schema.sql

# 2) Probar una sesión aislada (ver 05_seguridad_multitenant.md)
BEGIN;
SELECT set_config('app.current_tenant_id', '<uuid>', true);
SELECT * FROM clients;   -- devuelve solo el tenant actual
COMMIT;
```

> La migración 0001_baseline de Alembic debe ser equivalente a `04_schema.sql` (ver fase 8).

## Decisiones clave

- **UUID** interno como PK; números legibles (`OT-2026-000001`, `COT-2026-000001`) generados por `next_document_number()` con anti-colisión.
- **Dinero** `NUMERIC(12,2)`, **fechas** `TIMESTAMPTZ`, **soft delete** en entidades históricas.
- **Únicos multi-tenant** siempre sobre `(tenant_id, …)` (placa, VIN, SKU, doc. cliente, nº OT/COT).
- Estados evolutivos con `CHECK` (fácil de migrar); catálogos reales (marcas, modelos, tipos, combustibles, unidades) globales sin RLS.
- `provision_tenant(<tenant_id>)` crea settings + sucursal principal + servicios base.
- FASE 2 (fuera de este SQL): suppliers, purchase orders, notificaciones avanzadas, garantías avanzadas, reportes. FUTURO: facturación electrónica/SUNAT, pagos online, móvil, OBD/telemetría.

## Orden de prioridades del proyecto

**SEGURIDAD → AISLAMIENTO MULTI-TENANT → SIMPLICIDAD → INTEGRIDAD → ESCALABILIDAD → RENDIMIENTO → MANTENIBILIDAD**
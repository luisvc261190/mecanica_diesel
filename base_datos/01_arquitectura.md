# LABORATORIO DE TECNOLOGÍA DIESEL — SaaS Multi-Tenant

## FASE 1 — ARQUITECTURA

> **Plataforma SaaS de talleres y empresas de vehículos diésel.**
> Primer tenant: *Laboratorio de Tecnología Diesel*.
> **No** es una base para una sola empresa: es la base de la plataforma.

---

## 1. Arquitectura multi-tenant elegida

**Shared Database + Shared Schema + `tenant_id` + RLS**

```
Una sola base de datos PostgreSQL (Neon)
Una sola estructura de tablas (mismo schema)
Múltiples empresas (tenants)
Cada fila empresarial lleva tenant_id UUID NOT NULL
```

| Patrón | ¿Uso? | Motivo |
|---|---|---|
| Base por tenant (database-per-tenant) | NO | Inviable para 1.000 o 10.000 tenants; migraciones 10.000 veces; Neon lo complica. |
| Schema por tenant (schema-per-tenant) | NO | Alembic debe replicar migraciones por schema; backups y pooling complejos. |
| **Shared database + tenant_id + RLS** | **SÍ** | Escala lineal, migraciones únicas, un solo esquema, aislamiento garantizado por base de datos (RLS), ideal para inicio con Neon. |

**Prioridades del proyecto en orden:**
`SEGURIDAD → AISLAMIENTO MULTI-TENANT → SIMPLICIDAD → INTEGRIDAD → ESCALABILIDAD → RENDIMIENTO → MANTENIBILIDAD`

---

## 2. Aislamiento de datos — Row Level Security (RLS)

Toda tabla que contiene datos de empresa tiene **`tenant_id UUID NOT NULL`**.

Además de la columna, se impone **RLS a nivel de PostgreSQL**: el dato no se puede leer ni escribir si el `tenant_id` de la fila no coincide con el del contexto de ejecución.

### Mecánica

1. Al inicio de cada request, el backend ejecuta:
   ```sql
   SELECT set_config('app.current_tenant_id', $1::text, true);  -- true = local a la transacción
   SELECT set_config('app.current_user_id',  $2::text, true);
   SET LOCAL app.is_platform_admin = 'off';
   ```
2. Cada tabla activa `ENABLE ROW LEVEL SECURITY` con una política:
   ```sql
   CREATE POLICY p_<tabla>_tenant ON <tabla>
     FOR ALL
     USING (tenant_id = current_tenant() OR is_platform_admin())
     WITH CHECK (tenant_id = current_tenant() OR is_platform_admin());
   ```
3. Si la sesión no setea el tenant, `current_tenant()` = `NULL` y **ninguna fila** de tablas multi-tenant es visible (defensa en profundidad).
4. El superusuario de plataforma (o rol de migración) setea `app.is_platform_admin = 'on'` y puede administrar sin la política de tenant (operaciones de plataforma, migraciones, jobs).

### Cómo conviven este patrón con migraciones, jobs y admins (lo importante)

| Actor | Solución |
|---|---|
| **Alembic / migraciones** | Se conectan con el rol **owner/superuser** de la base. RLS **no** se aplica a superusuarios (salvo que se fuerce con `FORCE ROW LEVEL SECURITY`, que aquí NO usamos). Las migraciones crean/alteran tablas sin fricción. |
| **Jobs internos (cron, workers, emails)** | Se conectan como rol de plataforma con privilegio `BYPASSRLS`, o setean `app.is_platform_admin = 'on'` en la sesión (nuestra política lo respeta). Nunca dejan `current_tenant_id` sin definir si trabajan para un tenant. |
| **Super Admin de plataforma** | Setea `app.is_platform_admin = 'on'`. Ve todo (operación de soporte), aunque recomendamos que la lógica de negocio restrinja sus endpoints. |
| **Backend normal** | Nunca setea `is_platform_admin`. Solo define el tenant y el usuario del JWT. |

> **Regla de diseño RLS:** las políticas usan el *GUC* de sesión (`app.*`), NUNCA un valor `WHERE` enviado por el frontend. El frontend no puede elegir tenant.

---

## 3. RBAC — Roles y permisos

### Ámbito

- **Roles de plataforma** (`scope = PLATFORM`): `SUPER_ADMIN`.
- **Roles por tenant** (`scope = TENANT`): `OWNER, ADMIN, SUPERVISOR, RECEPTION, TECHNICIAN, MECHANIC, WAREHOUSE, CASHIER`.

### Estructura

```
users  (cuenta de acceso, global, email único)
 └── user_tenant_roles  (usuario + tenant + rol)   ← RBAC por tenant
 └── employees  (persona que trabaja en el tenant) ← opcionalmente vinculada a un user
```

Un mismo usuario puede ser `ADMIN` en el Tenant A y `TECHNICIAN` en el Tenant B usando **una sola cuenta**:

```
Juan (users) 
 ├── user_tenant_roles: (Tenant A, ADMIN)
 └── user_tenant_roles: (Tenant B, TECHNICIAN)
```

### Separación clave

- **`users`** = identidad/credenciales de acceso (hash de contraseña, email, activo). Global al SaaS.
- **`employees`** = personas que trabajan para un tenant (datos HR: documento, especialidad, fecha de ingreso). Por tenant.
- No todo empleado tiene `user_id`: un empleado puede existir sin acceso al sistema.

### Patrón recomendado en backend

El JWT debe contener índices de qué `(tenant_id, rol)` permite cada token, o el backend resuelve el role por request consultando `user_tenant_roles`. El `effective_tenant` para RLS sale **del backend**, a partir del JWT/sesión — nunca del body del request.

---

## 4. Usuarios, empleados y sucursales

```
TENANT
 ├─ SUCURSALES (1..N)          branches
 ├─ EMPLEADO (1..N)            employees  (tenant_id, branch_id?, user_id?)
 ├─ CONFIGURACIÓN              tenant_settings (moneda, zona horaria, numeración, marca)
 └─ USUARIOS CON ROLES         users ← user_tenant_roles → roles
```

Cada operación del taller (recepción, orden, inventario, caja) se asocia a una **sucursal**, lo que permite el modelo multi-sucursal sin rediseño.

---

## 5. Módulos (arquitectura conceptual)

```
PLATFORM        tenants · plans · tenant_subscriptions · users · roles · permissions
ORGANIZATION    branches · employees · tenant_settings · document_sequences
CRM             clients · client_contacts · vehicle_client_history
VEHICLES        vehicles · vehicle_brands · vehicle_models · vehicle_types · fuels · transmissions
WORKSHOP        appointments · vehicle_receptions · work_orders · work_order_services ·
                work_order_technicians · labor_entries · work_order_parts ·
                work_order_status_history · checklists · diagnostics (+ hallazgos, pruebas, códigos)
QUOTATIONS      quotes · quote_items
INVENTORY       parts · part_categories · inventory · inventory_movements
FINANCE         payments
WARRANTIES      warranties · warranty_claims
FILES           files
AUDIT           audit_logs
NOTIFY          notifications
```

**Simplificaciones aplicadas al modelo original:**
- `platform_users` se resuelve con `users.is_platform_admin` + rol `SUPER_ADMIN` (no duplicamos tablas).
- `inventory` es *stock por sucursal* (`tenant+branch+part`); `inventory_movements` reconstruye el historial.
- `fault_codes` es un catálogo global; los hallazgos se vinculan mediante `diagnostic_finding_fault_codes`.
- `services` es un catálogo **por tenant** (cada taller cobra/personaliza sus servicios; la provisión inserta una lista base).
- `purchase_orders` y `purchase_order_items` quedan en **FASE 2** (solo se dejaron `suppliers` fuera del SQL; ver validación).

---

## 6. Numeración y UUID

- **PK:** UUID (`gen_random_uuid()`), internas y no mostrables.
- **Números legibles:** `OT-2026-000001`, `COT-2026-000001` generados por la función `next_document_number()` sobre la tabla `document_sequences` (secuencia por `tenant + branch + tipo + año`, con `FOR UPDATE` para evitar colisiones).

---

## 7. Escalabilidad (1 → 10 000+ tenants)

- PostgreSQL maneja decenas de millones de filas sumando miles de tenants con **índices compuestos que arrancan en `tenant_id`**.
- El conteo de tenants no degrada las consultas de un tenant concreto porque los índices están particionados lógicamente por `tenant_id`.
- RLS añade un predicado por consulta; el costo es aceptable e indexable.
- Neon permite: pooling (PgBouncer/cuotas), autoscaling de cómputo, branching para entornos QA/pre-prod.

**Ventajas:** un solo código, una migración, un backup, operación simple.
**Limitaciones:** una tabla gigante compartida (mitigado con índices y particionamiento futuro), ruido entre tenants en queries agregadas de plataforma (mitigado con RLS/roles), riesgos de "vecino ruidoso" (mitigado con pool y límites por plan).

---

## 8. Stack objetivo (declarado)

`FastAPI + SQLAlchemy 2 (async) + Alembic + Pydantic + React/TypeScript + Neon PostgreSQL`.

Toda la evolución del modelo se hará por **Alembic**; el SQL de este proyecto es la migración inicial (baseline).
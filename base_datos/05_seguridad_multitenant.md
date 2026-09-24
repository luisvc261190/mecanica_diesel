# FASE 6 — SEGURIDAD MULTI-TENANT

## Cómo impide el sistema que un tenant acceda a datos de otro

```
Usuario
   │ 1. login (backend): valida credenciales → firma JWT
   ▼
JWT  { sub: user_id, ... }   (SE RECOMIENDA NO meter tenant_id en el JWT)
   │ 2. backend: resuelve rol y tenant efectivo desde user_tenant_roles
   ▼
Backend  tenant_id = de la sesión/contexto (NUNCA del body/frontend)
   │ 3. por cada request: SELECT set_config('app.current_tenant_id', id, true)
   │                        SELECT set_config('app.current_user_id',  id, true)
   ▼
Capa de aplicación (FastAPI/service):   WHERE ... tenant_id = contexte         ← defensa #2
   │ 4. la query va a PostgreSQL con el GUC de sesión ya definido
   ▼
PostgreSQL  RLS:  USING (tenant_id = current_tenant() OR is_platform_admin()) ← defensa #1
```

Si el backend entrega `tenant_id = 'TENANT_B'` al frontend y este lo manipula, **la fila simplemente no aparece**: la política usa el GUC `app.current_tenant_id`, que SOLO el backend puede setear; el frontend no tiene conexión directa a PostgreSQL.

### Capas de defensa

| # | Capa | Mecanismo |
|---|---|---|
| 1 | **PostgreSQL RLS** | Bloquea por base de datos. Imposible de omitir desde SQL de aplicación. |
| 2 | **Backend** | El `tenant_id` efectivo sale del JWT/sesión, no del request. |
| 3 | **RBAC** | Cada rol ve/opera solo lo que le corresponde por módulo (aprobación, caja, inventario…). |
| 4 | **Auditoría** | `audit_logs` registra `tenant_id`, `user_id`, acción, `old/new values`, IP y user-agent. |
| 5 | **Integridad** | FKs + únicos multi-tenant `(tenant_id, …)` impiden datos huérfanos o duplicados entre tenants. |

### Reglas críticas

1. **El frontend jamás decide tenant**: el backend lo deduce de la sesión/autenticación.
2. **`is_platform_admin` es GUC interno**: el backend normal lo deja `off`; solo jobs/soporte lo encienden explícitamente.
3. **Contraseñas**: únicamente `password_hash` (bcrypt/argon2 a nivel de app; la BD no guarda texto plano).
4. **Mínimo privilegio**: roles de BD por capas (migrador vs. runtime), y el rol de runtime de la app solo tiene los grants que necesita.
5. **No confiar en un único `WHERE tenant_id`**: es la capa 2, pero la capa 1 (RLS) es la garantía.
6. **Soft delete ≠ auditoría**: `deleted_at` oculta filas; `audit_logs` nunca se borra y guarda `old/new_values`.

### Roles de base de datos recomendados (Neon)

```
rol_migrador    (owner): Alembic. CREATE/ALTER. Superuser implícito → RLS no bloquea.
rol_app          (runtime): SELECT/INSERT/UPDATE/DELETE por tablas de app.
  → el backend abre asientos de rol_app en la piscina de conexiones
rol_admin_support: BYPASSRLS para soporte/jobs (oro — usarlo con juicio).
```

### Sesión típica por request

```sql
BEGIN;
SELECT set_config('app.current_tenant_id', $1, true);   -- tenant efectivo
SELECT set_config('app.current_user_id',  $2, true);    -- usuario efectivo
SET LOCAL app.is_platform_admin = 'off';
... consultas de la app ...
COMMIT;  -- el GUC local se limpia al terminar la transacción
```

> En SQLAlchemy (async) se ejecuta dentro del `transaction` de cada request; el pool descarta el GUC al liberar la conexión porque `set_config(..., true)` lo acota a la transacción.

### Qué pasa si no se setea el tenant

`current_tenant()` retorna `NULL` → toda `SELECT/INSERT/UPDATE/DELETE` sobre tablas multi-tenant devuelve **0 filas** (o error controlado). Es un "cerrojo de fábrica": falla de forma segura.

### Verificación (prueba de aislamiento)

```sql
-- como rol_app, sin tenant
SELECT * FROM clients;              -- 0 filas (RLS)

-- sesión Tenant A
SELECT set_config('app.current_tenant_id','<TENANT_A>', true);
INSERT INTO clients(tenant_id, first_name, last_name) VALUES('<TENANT_A>','Ana','Pérez');

-- sesión Tenant B (otra conexión)
SELECT set_config('app.current_tenant_id','<TENANT_B>', true);
SELECT * FROM clients;              -- NO ve la fila de A
UPDATE clients SET last_name = 'HACKED' WHERE last_name='Pérez';  -- 0 filas afectadas
```
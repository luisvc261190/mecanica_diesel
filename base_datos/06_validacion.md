# FASE 7 — VALIDACIÓN DEL MODELO (AUDITORÍA)

## 1. Duplicidad

| Riesgo | Estado | Solución |
|---|---|---|
| Placa repetida entre tenants | ✔ Resuelto | `UNIQUE(tenant_id, plate)` parcial |
| VIN repetido | ✔ Resuelto | `UNIQUE(tenant_id, vin)` parcial |
| Email de usuario repetido | ✔ Resuelto | `users.email CITEXT UNIQUE` (global, caso-insensible) |
| Doc. de cliente repetido en el mismo tenant | ✔ Resuelto | `UNIQUE(tenant_id, doc_type, doc_number)` parcial |
| SKU de repuesto repetido | ✔ Resuelto | `UNIQUE(tenant_id, sku)` |
| Nº de OT/COT | ✔ Resuelto | únicos parciales por tenant + secuencia con bloqueo |
| Sucursal con mismo código | ✔ Resuelto | `UNIQUE(tenant_id, code)` |
| Servicio duplicado en tenant | ✔ Resuelto | `UNIQUE(tenant_id, name)` y `UNIQUE(tenant_id, code)` |

## 2. Relaciones incorrectas

| Revisión | Resultado |
|---|---|
| `work_orders(client, vehicle)` | ✔ Obligatorios (`NOT NULL`) y dentro del mismo tenant por RLS; la app valida coherencia tenant en el servicio. |
| Ciclo `work_orders ⇄ quotes` | ✔ Ambos lados opcionales (**NULL-ables**): no hay ciclo real protegido. |
| `diagnostics(work_order_id)` | Campo de enlace lógico sin FK (para evitar triple dependencia); la FK formal está en `work_orders.diagnostic_id`. |
| `files`, `audit_logs`, `inventory_movements.reference` | ✔ Polimórficos a propósito (menos acoplamiento); se validan en capa de aplicación. |
| `client_contacts` / `quote_items` / `labor_entries` | ✔ Hijos atados por FK; `tenant_id` redundante en el hijo (control RLS y consultas eficientes). |

## 3. Normalización

- **Hallazgos** normalizados en `diagnostic_findings` (1 falla = 1 fila), nunca texto multifunción.
- **Estados/métodos/tipos** con CHECK en lugar de tablas de catálogo pequeñas (fáciles de evolucionar con migración).
- **Catálogos reales** (`vehicle_brands`, `vehicle_models`, `vehicle_types`, `fuels`, `transmissions`, `part_categories`, `units_of_measure`, `fault_codes`) globales y referenciados por FK → no texto repetido.
- **Dinero**: `NUMERIC(12,2)` en todos los importes (nunca float).
- No se crearon catálogos innecesarios (se evitó `party`/`supplier_address` etc. en MVP).

## 4. Falta de tenant_id

- Todas las tablas de datos de empresa definidas llevan `tenant_id UUID NOT NULL`.
- Excepciones **intencionales y documentadas**:
  - catálogos globales compartidos (brands, models, types, fuels, transmissions, units, fault_codes, part_categories, plans, roles, permissions);
  - hijos (`checklist_items`, `role_permissions`) que heredan el tenant del padre (RLS vía EXISTS);
  - `audit_logs.tenant_id NULL` para acciones de plataforma.
- Checklist heurística aplicada: *¿qué pasaría si dos tenants usaran esta tabla?* → exige tenant_id.

## 5. Índices faltantes / sobrantes

- Índices compuestos multi-tenant en todas las rutas calientes (listados, dashboard, expediente de vehículo).
- Faltó (pequeño, recomendado en fase 2): índice `(tenant_id, vehicle_id)` en `work_orders` **ya existe** (`idx_work_orders_vehicle`); también `diagnostics(tenant_id, work_order_id)` para cruzar diagnóstico↔OT (añadir cuando se consolide el flujo diagnóstico). `role_permissions` usa la PK compuesta.

## 6. Problemas de RLS

| Punto | Requiere atención |
|---|---|
| `user_tenant_roles` | La política tipo "miembro del tenant / Super Admin" permite a cualquier miembro gestionar roles dentro del tenant. El control fino (solo ADMIN/OWNER reparten roles) debe vivirse en RBAC de app. |
| `services` ocupados en `quote_items`/`work_order_services` | El tenant_id incluido permite `JOIN` sin salir del contexto. |
| Catálogos globales | Solo lectura pública; escritura restringida por privilege de rol de BD. |
| Views | `v_work_order_payment_status` usa `security_invoker = true` (Neon 15+). |

## 7. Integridad

- FKs con `REFERENCES` directo protegen contra huérfanos.
- `inventory.quantity >= 0` y `payments.amount > 0`, `work_order_parts.quantity > 0`, `quote_items.quantity > 0`.
- **Suficiente, no excesivo**: no se usaron `ON DELETE CASCADE` a propósito — el soft delete + auditoría preservan la trazabilidad y la app orquesta el borrado lógico.

## 8. Escalabilidad

- Una tabla compartida: aquí el tamaño va por datos de negocio, no por tenants. Índices `(tenant_id, ...)` hacen que cada tenant lea solo su rango.
- `document_sequences` usa `UNIQUE NULLS NOT DISTINCT` + advisory lock por (tenant, branch, tipo, año) → sin carreras en 10 000 tenants.
- Si una tabla explota (p. ej. `audit_logs`, `inventory_movements`), se particiona por rango sobre `created_at` en Fase 2 sin cambiar la app.

## 9. Seguridad

- Passwords solo hash (columna `password_hash`, nunca en UPDATE de auditoría).
- GUC de sesión para RLS: no existe exposición al frontend.
- `is_platform_admin` OFF por defecto.
- RBAC por rol por tenant + `role_permissions` para módulos finos.
- Auditoría inmutable (sin `deleted_at`, sin UPDATE definido para negocio).

## 10. Puntos abiertos / decisiones tomadas

| Decisión | Justificación | Alternativa |
|---|---|---|
| `suppliers` y `purchase_orders` **no** en SQL | Se clasifican explícitamente como FASE 2 (segmento 24 del prompt). | Añadir en una migración Alembic posterior. |
| `platform_users` fusionado en `users` | `users.is_platform_admin` + rol `SUPER_ADMIN` evita duplicar identidad. | Tabla separada si la plataforma creciera con módulos propios. |
| Estados con CHECK | Autodocumenta; evolucionar = `ALTER TABLE ... DROP CONSTRAINT/ADD CONSTRAINT`. | Enumerados nativos (más rígidos para migrar). |
| Fuel como nivel de tanque (texto) en recepción | Variable libre (1/8, 25% …), sin catálogo rígido. | Enum si se estandariza. |
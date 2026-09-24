# FASE 2 / 3 — MODELO DE DATOS Y RELACIONES

> Convenciones del proyecto:
> - PK = `UUID` (interna). Números legibles a través de `document_sequences`.
> - Fechas = `TIMESTAMPTZ`. Dinero = `NUMERIC(12,2)`. Nunca `FLOAT/REAL/DOUBLE`.
> - Toda tabla de datos de empresa lleva `tenant_id UUID NOT NULL`.
> - Las tablas con `deleted_at` usan *soft delete* (no se destruye trazabilidad).
> - Índices y únicos multi-tenant: siempre empiezan por `tenant_id`.

---

## 1. PLATFORM

### `plans`
Catálogo de planes del SaaS (FREE, BASIC, PROFESSIONAL, ENTERPRISE — códigos de ejemplo).
- PK `id` · `code UNIQUE` · `name` · `description` · `price NUMERIC(12,2)` · `currency` · `billing_cycle`
- Límites preparados como columnas (NULL = ilimitado): `max_users`, `max_branches`, `max_clients`, `max_vehicles`, `max_monthly_orders`, `storage_bytes`
- `features JSONB` · `is_active` · `sort_order`
- **Sin tenant_id** (catálogo global). No implementa cobros automáticos.

### `tenants`
Cada empresa del SaaS.
- PK `id` · `commercial_name` · `legal_name` · `tax_id` (RUC) · `slug UNIQUE` (p. ej. `laboratorio-tecnologia-diesel`) · `phone` · `email` · `address` · `logo_url`
- `country CHAR(2)` · `currency CHAR(3)` · `timezone VARCHAR(64)` (default `America/Lima`) · `status` (`ACTIVE|SUSPENDED|CANCELLED|PENDING`)
- `settings JSONB` (config no modelable) · `created_at/updated_at/deleted_at`
- Índices: `slug` (único), `status`. El slug queda preparado para URLs `app.dominio/<slug>` o subdominio `<slug>.dominio`.

### `tenant_subscriptions`
Contrato tenant↔plan. Estados: `TRIAL|ACTIVE|PAST_DUE|SUSPENDED|CANCELLED|EXPIRED`.
- FK `tenant_id`→`tenants`, FK `plan_id`→`plans` · `started_at` · `current_period_start/end` · `trial_ends_at` · `canceled_at` · `metadata JSONB`
- Índice único parcial: **una** suscripción activa por tenant.

### `roles`
Catálogo de roles. `code UNIQUE` + `scope` (`PLATFORM|TENANT`).

### `permissions`
Catálogo de permisos finos (opcional, preparado).
`role_permissions` = mapeo rol→permiso.

### `users`
Cuenta de acceso al SaaS (global).
- PK `id` · `email CITEXT UNIQUE` · `password_hash` (nunca texto plano) · `full_name` · `phone` · `is_active` · `is_platform_admin` (Super Admin) · `last_login_at` · `deleted_at`
- RLS: el usuario ve su propia fila; el Super Admin todo.

### `user_tenant_roles`
RBAC por tenant. `UNIQUE(tenant_id, user_id, role_id)`.
Un usuario con distintos roles en distintos tenants = varias filas.

---

## 2. ORGANIZATION

### `branches`
Sucursales del tenant (1..N).
- FK `tenant_id` · `name` · `code UNIQUE(tenant_id, code)` · `address` · `phone` · `email` · `status` · `settings JSONB`

### `employees`
Trabajadores del tenant (independientes del acceso al sistema).
- FK `tenant_id` · FK `branch_id`? · FK `user_id`? (opcional, vinculación con cuenta)
- `first_name` · `last_name` · `document_type` · `document_number` · `phone` · `email` · `job_title` · `specialty` (p. ej. inyección, turbo) · `hire_date` · `status` (`ACTIVE|INACTIVE`) · `notes`
- Índices: `(tenant_id, status)`, `(tenant_id, document_number)`, `(tenant_id, user_id)`.

### `tenant_settings`
Configuración por tenant (1 fila por tenant).
- FK `tenant_id UNIQUE` · `currency` · `timezone` · `brand_color` · `logo_url`
- Formato de numeración: `quote_number_format`, `work_order_number_format`
- Flags: `require_approval_for_work`, `show_prices_in_documents` · `extra JSONB`

### `document_sequences`
Contador por `tenant + branch + tipo + año` (`UNIQUE NULLS NOT DISTINCT`). Alimentado por la función `next_document_number()` con `FOR UPDATE` (anti-colisión).

---

## 3. CRM

### `clients`
Clientes del tenant (persona natural o empresa).
- FK `tenant_id` · `client_code` (único por tenant si existe) · `client_type` (`PERSON|COMPANY`)
- Persona: `first_name` + `last_name` · Empresa: `company_name`
- `doc_type` (`DNI|RUC|CE|PASSPORT`) · `doc_number` → **único por tenant** (índice parcial `WHERE doc_number IS NOT NULL`)
- `phone` · `secondary_phone` · `email` · `address` · `city` · `notes` · `status` · `deleted_at`

### `client_contacts`
Contactos adicionales de un cliente. FK `client_id` + `is_primary` + `full_name/phone/email`.

---

## 4. VEHICLES + CATÁLOGOS

Catálogos globales (sin tenant_id, compartidos): `vehicle_brands`, `vehicle_models` (FK brand), `vehicle_types`, `fuels`, `transmissions`, `fault_codes`, `part_categories`, `units_of_measure`.

### `vehicles`
- FK `tenant_id` · FK `client_id` (propietario actual) · `plate` → **único por tenant** (índice parcial) · `vin` (único parcial por tenant) · `engine_number`
- FK `brand_id` · `model_id` · `type_id` · `year` · `fuel_id` · `transmission_id` · `color` · `capacity_note` · `odometer` (km actual) · `status` (`ACTIVE|INACTIVE|SOLD|SCRAPPED`) · `notes`
- Índices: `(tenant_id, plate)`, `(tenant_id, client_id)`, `(tenant_id, vin)`.

### `vehicle_client_history`
Historial de propietarios para soportar cambio de cliente.
- FK `vehicle_id` · FK `client_id` · `started_at` · `ended_at`

---

## 5. WORKSHOP

### `appointments`
Cita previa (puede convertirse en recepción).
- FK `branch_id` · `client_id` · `vehicle_id` · `scheduled_at` · `duration_minutes` · `status` (`SCHEDULED|CONFIRMED|ARRIVED|COMPLETED|CANCELLED|NO_SHOW`) · `reason` · `symptoms` · `notes`

### `vehicle_receptions`
Recepción real del vehículo.
- FK `branch_id` · `appointment_id`? · FK `client_id` · `vehicle_id` · FK `received_by`→employees
- `received_at` · `odometer` · `fuel_level` · `reason` · `reported_symptoms` (síntomas reportados) · `observations` · `accessories` · `visible_damage` · `status` (`OPEN|IN_DIAGNOSIS|…`)
- Índices: `(tenant_id, vehicle_id)`, `(tenant_id, appointment_id)`, `(tenant_id, received_at)`.

### `diagnostics`
Diagnóstico general (vinculado a orden y/o recepción).
- FK `branch_id` · FK `vehicle_id` · FK `reception_id`? · FK `work_order_id`? · FK `performed_by`→employees
- `performed_at` · `summary` · `recommendations` · `resolution_status`

### `diagnostic_findings`
Hallazgo técnico (uno por línea, nunca múltiples fallas en un texto).
- FK `diagnostic_id` · `area` · `description` · `symptom` · `probable_cause` · `confirmed_cause` · `resolution` · `is_confirmed` · `severity` (`LOW|MEDIUM|HIGH|CRITICAL`)

### `diagnostic_tests`
Pruebas/scaners realizadas. FK `diagnostic_id` + `test_type` (p. ej. `SCANNER_COMPUTER`, `PRESSURE_TEST`) + `result` + `performed_at` + FK `performed_by`.

### `diagnostic_finding_fault_codes`
N:M hallazgo↔código de falla (OBD). FK `finding_id` + FK `fault_code_id`.

### `work_orders`
**Centro operativo del taller.**
- FK `branch_id` · `client_id` · `vehicle_id` · `reception_id`? · `diagnostic_id`? · `quote_id`? (via ALTER, circular 2 vías permitida con NULLs)
- `number` (humano, vía `next_document_number`, p. ej. `OT-2026-000001`, no es PK) · `status` (`RECEIVED|DIAGNOSIS|QUOTED|WAITING_APPROVAL|APPROVED|IN_PROGRESS|WAITING_PARTS|PAUSED|QUALITY_CONTROL|COMPLETED|READY_FOR_PICKUP|DELIVERED|CANCELLED`) · `priority`
- FK `responsible_employee_id` →employees · FK `supervisor_employee_id` →employees
- `opened_at` · `closed_at` · montos (`subtotal`, `discount`, `tax`, `total` NUMERIC(12,2)) · `notes`
- Índices: `(tenant_id, branch_id, status)`, `(tenant_id, client_id)`, `(tenant_id, vehicle_id)`, `(tenant_id, number)`, `(tenant_id, opened_at)`.
- Los estados son `VARCHAR` + CHECK inicial; evolucionan con migración (documentado en FASE 7).

### `work_order_status_history`
Historial de cambios de estado (trazabilidad de la orden).
- FK `work_order_id` · `from_status` · `to_status` · FK `changed_by`→users · `changed_at` · `notes`

### `work_order_services`
Servicios de la orden (snapshot de precio/nombre).
- FK `work_order_id` + FK `service_id` + `service_name` + `quantity` + `price` + `discount` + `subtotal`

### `work_order_technicians`
Técnicos asignados (M:N con datos).
- FK `work_order_id` + FK `employee_id` + `role_in_job` + `assigned_at` + `finished_at` + `hours_worked` + `notes`

### `labor_entries`
Mano de obra por línea.
- FK `work_order_id` + FK `employee_id` + FK `service_id`? + `hours` + `hourly_rate` + `discount` + `subtotal` + `notes`

### `work_order_parts`
Repuestos utilizados.
- FK `work_order_id` + FK `part_id` + `quantity` + `unit_price` + `discount` + `subtotal` + FK `technician_id`?→employees + `used_at`
- Permite responder: “repuestos históricamente usados en este vehículo” (join con `work_orders`).

### `checklists` / `checklist_items`
Checklist de recepción/entrega (`kind RECEPTION|DELIVERY`).
- `checklists`: FK `work_order_id` + FK `checked_by` + `completed_at` + `notes`
- `checklist_items`: FK `checklist_id` + `item_name` (luces, lunas, neumáticos, combustible, accesorios, documentos…) + `is_ok` + `observation`. Las fotos se asocian vía `files`.

---

## 6. QUOTATIONS

### `quotes`
Cotización.
- `number` (humano `COT-2026-…`) · FK `branch_id` · `client_id` · `vehicle_id` · FK `work_order_id`? (si nace de una orden) · FK `created_by`→employees
- `status` (`DRAFT|SENT|APPROVED|REJECTED|EXPIRED|CONVERTED`) · `valid_until` · `terms`
- Montos `subtotal/discount/tax/total` · `deleted_at`
- Aprobada ⇒ se convierte en **orden de trabajo** (`work_orders.quote_id → quotes`).

### `quote_items`
Líneas de la cotización.
- FK `quote_id` · `kind` (`SERVICE|PART`) · FK `service_id`? · FK `part_id`? · `description` · `quantity` · `unit_price` · `discount` · `subtotal`

---

## 7. INVENTORY / FINANCE

### `services`
Catálogo de servicios **por tenant** (cada taller define el suyo; la provisión inserta una base).
- FK `tenant_id` · `code UNIQUE(tenant_id, code)` · `name` · `category` · `unit` · `default_price` · `is_active`

### `parts`
Repuesto **por tenant**.
- FK `tenant_id` + FK `part_category_id` + FK `unit_id` + `sku UNIQUE(tenant_id, sku)` (índice parcial) + `name` + `brand` + `purchase_price` + `sale_price` + `reorder_level` + `location` + `status`

### `inventory`
Stock **por sucursal**.
- `UNIQUE(tenant_id, branch_id, part_id)` + `quantity` + `updated_at`. No se corrige a mano: se ajusta vía movimientos.

### `inventory_movements`
Historial de movimientos (reconstruye el inventario).
- `type` (`PURCHASE|SALE|WORK_ORDER_USAGE|RETURN|ADJUSTMENT|TRANSFER|INITIAL_STOCK`) · `quantity` · `unit_cost` · FK `branch_id` · FK `user_id` (quién) · FK `part_id`
- Referencia polimórfica: `reference_type` (WORK_ORDER, PURCHASE_ORDER, ADJUSTMENT…) + `reference_id` (sin FK rígida).
- Índices: `(tenant_id, part_id, moved_at)`, `(tenant_id, reference_type, reference_id)`.

### `payments`
Pagos internos de una orden (sin facturación electrónica/SUNAT).
- FK `work_order_id` · FK `branch_id` · FK `received_by`→employees
- `amount` · `paid_at` · `method` (`EFECTIVO|TRANSFERENCIA|TARJETA|YAPE|PLIN|OTRO`) · `reference` · `status` (`PENDING|COMPLETED|REVERSED|FAILED`) · `observation`
- Totales por orden (total / pagado / saldo) se calculan agregando `work_orders.total` menos `SUM(payments.amount)` (vista recomendada).

---

## 8. WARRANTIES · FILES · NOTIFY · AUDIT

### `warranties`
Garantía de una reparación.
- FK `work_order_id` · `vehicle_id` · `client_id` · `start_date` · `end_date` · `max_odometer` · `conditions` · `status` (`ACTIVE|USED|EXPIRED|CANCELLED`)

### `warranty_claims`
Reclamos de garantía. FK `warranty_id` + FK `work_order_id`? + `claim_date` + `description` + `status` (`OPEN|REJECTED|APPROVED|IN_REPAIR|RESOLVED`) + `resolution`.

### `files`
Metadatos de archivos (URL, no blob). Preparado para S3/Cloudinary.
- FK `tenant_id` · `entity_type` + `entity_id` (polimórfico) · `url` · `name` · `mime_type` · `size_bytes` · `category` (RECEIPT_PHOTO, DOCUMENT…) · FK `uploaded_by`→users · `notes`

### `notifications`
Notificaciones internas (sin Whatsapp/correo por ahora).
- FK `user_id` · `type` (QUOTE_APPROVED, VEHICLE_READY, PAYMENT_PENDING…) · `title` · `body` · `data JSONB` · `is_read` · `read_at`

### `audit_logs`
Auditoría independiente del soft delete (no se borra jamás).
- FK `tenant_id`? (NULL para acciones de plataforma) · FK `user_id` · `action` (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, APPROVE_QUOTE, CHANGE_WORK_ORDER_STATUS, REGISTER_PAYMENT, INVENTORY_ADJUSTMENT…) · `entity` · `entity_id` · `old_values JSONB` · `new_values JSONB` · `ip` · `user_agent` · `created_at`

---

# FASE 3 — RELACIONES

```
TENANTS
 ├── tenant_subscriptions → plans
 ├── branches (1..N)
 ├── employees (tenants ← branch?, users?)
 ├── tenant_settings (1:1)
 ├── user_tenant_roles (users ↔ roles, por tenant)
 ├── clients (1..N) ── client_contacts
 ├── clients ── vehicles (propietario actual) ── vehicle_client_history (historial)
 ├── vehicles ── appointments ── vehicle_receptions ── work_orders
 ├── work_orders ── work_order_status_history
 ├── work_orders ── work_order_services → services
 ├── work_orders ── work_order_technicians → employees
 ├── work_orders ── labor_entries → employees/services
 ├── work_orders ── work_order_parts → parts/employees
 ├── work_orders ── checklists ── checklist_items
 ├── diagnostics ── diagnostic_findings ── diagnostic_finding_fault_codes → fault_codes
 ├── diagnostics ── diagnostic_tests → employees
 ├── quotes ── quote_items → parts/services
 ├── work_orders ⇄ quotes (2 vías opcionales: OT→COT y COT→OT)
 ├── parts ── inventory (por sucursal) ── inventory_movements
 ├── payments → work_orders/branches/employees
 ├── warranties → work_orders/vehicles/clients ── warranty_claims
 ├── files (polimórfico hacia cualquier entidad)
 ├── notifications → users
 └── audit_logs (cualquier entidad, cualquier tenant)
```

**Flujo funcional garantizado por el modelo:**
```
Nuevo cliente → nuevo vehículo → cita (opcional) → recepción →
diagnóstico (hallazgos) → cotización → aprobación → orden de trabajo →
técnicos → servicios → labor → repuestos (salida de inventario) →
historias de estado → control de calidad → listo → pagos → entrega → historial completo
```

El **expediente del vehículo** se obtiene uniendo: `vehicles` + `vehicle_client_history` + `work_orders` + `work_order_services` + `work_order_parts` + `labor_entries` + `diagnostics` + `payments` + `warranties` + `files` — todo indexado por `tenant_id` + `vehicle_id`.
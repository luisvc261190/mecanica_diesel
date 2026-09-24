-- ============================================================================
-- SaaS MULTI-TENANT — LABORATORIO DE TECNOLOGÍA DIESEL
-- Base de datos PostgreSQL (compatible Neon 15+)
--
-- Arquitectura: SHARED DATABASE + SHARED SCHEMA + tenant_id + RLS
-- Propagación:  este script es el baseline. Luego todo se versiona con Alembic.
--
-- Cómo ejecutar en Neon (rol con privilegios de owner):
--   psql "$DATABASE_URL" -f 04_schema.sql
--
-- Contexto por sesión (lo setea el backend por request, usando transacción):
--   SELECT set_config('app.current_tenant_id', '<uuid>', true);
--   SELECT set_config('app.current_user_id',    '<uuid>', true);
--   -- SET LOCAL app.is_platform_admin = 'on';   (SOLO Super Admin / jobs)
--
-- Notas:
--   * PK siempre UUID (gen_random_uuid de pgcrypto / builtin PG13+)
--   * Dinero NUMERIC(12,2). Fechas TIMESTAMPTZ. NUNCA float para montos.
--   * Únicos multi-tenant siempre incluyen tenant_id (índices parciales para NULLs).
--   * RLS: todas las tablas de datos de empresa; políticas por tenant + bypass Super Admin.
--   * Los estados con CHECK pueden evolucionar: ALTER TABLE ... DROP CONSTRAINT + nueva.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 0. EXTENSIONES Y FUNCIONES DE AYUDA
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- email case-insensitive

-- Devuelve el tenant del contexto de sesión (NULL si no se setea).
CREATE OR REPLACE FUNCTION current_tenant() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

-- Devuelve el usuario del contexto de sesión (NULL si no se setea).
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

-- True cuando la sesión actúa como administrador de plataforma (jobs, soporte).
CREATE OR REPLACE FUNCTION is_platform_admin() RETURNS BOOLEAN AS $$
  SELECT coalesce(current_setting('app.is_platform_admin', true), '') = 'on';
$$ LANGUAGE sql STABLE;

-- Trigger genérico de updated_at.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. PLATFORM — PLANES Y TENANTS
-- ============================================================================

CREATE TABLE plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(50)  NOT NULL UNIQUE,
  name              VARCHAR(120) NOT NULL,
  description       TEXT,
  price             NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          CHAR(3)      NOT NULL DEFAULT 'PEN',
  billing_cycle     VARCHAR(20)  NOT NULL DEFAULT 'MONTHLY'
                     CHECK (billing_cycle IN ('MONTHLY','YEARLY','ONCE')),
  max_users         INT,
  max_branches      INT,
  max_clients       INT,
  max_vehicles      INT,
  max_monthly_orders INT,
  storage_bytes     BIGINT,
  features          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  is_active         BOOLEAN      NOT NULL DEFAULT true,
  sort_order        INT          NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
COMMENT ON TABLE plans IS 'Catálogo de planes del SaaS (FREE/BASIC/PROFESSIONAL/ENTERPRISE).';

CREATE TABLE tenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_name   VARCHAR(200) NOT NULL,
  legal_name        VARCHAR(200),
  tax_id            VARCHAR(30),
  slug              VARCHAR(120) NOT NULL UNIQUE,
  phone             VARCHAR(40),
  email             VARCHAR(255),
  address           TEXT,
  logo_url          TEXT,
  country           CHAR(2)      NOT NULL DEFAULT 'PE',
  currency          CHAR(3)      NOT NULL DEFAULT 'PEN',
  timezone          VARCHAR(64)  NOT NULL DEFAULT 'America/Lima',
  status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE'
                     CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CANCELLED')),
  settings          JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  CONSTRAINT tenants_slug_lowercase CHECK (slug = lower(slug)),
  CONSTRAINT tenants_slug_format CHECK (slug ~* '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);
COMMENT ON TABLE tenants IS 'Cada empresa del SaaS (primer cliente: Laboratorio de Tecnología Diesel).';

CREATE TABLE tenant_subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  plan_id             UUID NOT NULL REFERENCES plans(id),
  status              VARCHAR(20) NOT NULL DEFAULT 'TRIAL'
                        CHECK (status IN ('TRIAL','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED')),
  trial_ends_at       TIMESTAMPTZ,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_start TIMESTAMPTZ,
  current_period_end  TIMESTAMPTZ,
  canceled_at         TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_tenant_status ON tenant_subscriptions (tenant_id, status);
-- Una sola suscripción ACTIVE/TRIAL por tenant (parcial).
CREATE UNIQUE INDEX uq_subscriptions_active ON tenant_subscriptions (tenant_id)
  WHERE status IN ('ACTIVE','TRIAL');

-- ============================================================================
-- 2. RBAC — ROLES, PERMISOS, USUARIOS
-- ============================================================================

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  scope       VARCHAR(20) NOT NULL DEFAULT 'TENANT'
                CHECK (scope IN ('PLATFORM','TENANT')),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE roles IS 'Catálogo de roles. scope PLATFORM (SUPER_ADMIN) o TENANT (OWNER, ADMIN, ...).';

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(80) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  module      VARCHAR(60),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id),
  permission_id UUID NOT NULL REFERENCES permissions(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             CITEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  full_name         VARCHAR(200) NOT NULL,
  phone             VARCHAR(40),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  is_platform_admin BOOLEAN NOT NULL DEFAULT false,
  last_login_at     TIMESTAMPTZ,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);
COMMENT ON TABLE users IS 'Cuenta de acceso al SaaS (global). NO guardar contraseñas en texto plano.';

CREATE TABLE user_tenant_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  role_id    UUID NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_tenant_role UNIQUE (tenant_id, user_id, role_id)
);
COMMENT ON TABLE user_tenant_roles IS 'RBAC por tenant: un usuario tiene un rol distinto por tenant.';

CREATE INDEX idx_user_roles_user  ON user_tenant_roles (user_id);
CREATE INDEX idx_user_roles_tenant ON user_tenant_roles (tenant_id);

-- ============================================================================
-- 3. ORGANIZATION — SUCURSALES, EMPLEADOS, SETTINGS, SECUENCIAS
-- ============================================================================

CREATE TABLE branches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  name       VARCHAR(160) NOT NULL,
  code       VARCHAR(40) NOT NULL,
  address    TEXT,
  phone      VARCHAR(40),
  email      VARCHAR(255),
  status     VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('ACTIVE','INACTIVE')),
  settings   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT uq_branch_code UNIQUE (tenant_id, code)
);
COMMENT ON TABLE branches IS 'Sucursales del tenant (1..N). La mayoría de operaciones se asocian a una.';

CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  branch_id       UUID REFERENCES branches(id),
  user_id         UUID REFERENCES users(id),
  first_name      VARCHAR(120) NOT NULL,
  last_name       VARCHAR(120) NOT NULL,
  document_type   VARCHAR(20)  CHECK (document_type IN ('DNI','CE','RUC','PASSPORT')),
  document_number VARCHAR(30),
  phone           VARCHAR(40),
  email           VARCHAR(255),
  job_title       VARCHAR(120),
  specialty       VARCHAR(120),
  hire_date       DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','INACTIVE')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
COMMENT ON TABLE employees IS 'Trabajadores del tenant (independientes del acceso al sistema).';

CREATE INDEX idx_employees_tenant_status ON employees (tenant_id, status);
CREATE INDEX idx_employees_tenant_branch ON employees (tenant_id, branch_id);
CREATE INDEX idx_employees_tenant_doc    ON employees (tenant_id, document_number);
CREATE INDEX idx_employees_user          ON employees (user_id);

CREATE TABLE tenant_settings (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                  UUID NOT NULL UNIQUE REFERENCES tenants(id),
  currency                   CHAR(3)      NOT NULL DEFAULT 'PEN',
  timezone                   VARCHAR(64)  NOT NULL DEFAULT 'America/Lima',
  brand_color                VARCHAR(20),
  logo_url                   TEXT,
  quote_number_format        VARCHAR(60)  NOT NULL DEFAULT 'COT-{YEAR}-{SEQ6}',
  work_order_number_format   VARCHAR(60)  NOT NULL DEFAULT 'OT-{YEAR}-{SEQ6}',
  require_approval_for_work  BOOLEAN NOT NULL DEFAULT true,
  show_prices_in_documents   BOOLEAN NOT NULL DEFAULT true,
  document_header            TEXT,
  extra                      JSONB  NOT NULL DEFAULT '{}'::jsonb,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE tenant_settings IS 'Configuración por tenant (1 fila por tenant).';

CREATE TABLE document_sequences (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  branch_id  UUID REFERENCES branches(id),
  doc_type   VARCHAR(20) NOT NULL,
  prefix     VARCHAR(20) NOT NULL DEFAULT 'OT',
  year       INT  NOT NULL,
  last_value BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_doc_seq UNIQUE NULLS NOT DISTINCT (tenant_id, branch_id, doc_type, year)
);
COMMENT ON TABLE document_sequences IS 'Contador para números legibles (OT-2026-000001) por tenant/branch/tipo/año.';

-- Genera el siguiente número legible de documento, con bloqueo anti-colisión.
CREATE OR REPLACE FUNCTION next_document_number(
  p_tenant_id UUID,
  p_branch_id UUID,
  p_doc_type  VARCHAR,
  p_prefix    VARCHAR,
  p_year      INT
) RETURNS VARCHAR AS $$
DECLARE
  v_seq BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || '|' ||
                                                 coalesce(p_branch_id::text, '') || '|' ||
                                                 p_doc_type || '|' || p_year, 0));

  SELECT last_value INTO v_seq
    FROM document_sequences
   WHERE tenant_id = p_tenant_id
     AND branch_id IS NOT DISTINCT FROM p_branch_id
     AND doc_type = p_doc_type
     AND year = p_year
     FOR UPDATE;

  IF v_seq IS NULL THEN
    INSERT INTO document_sequences (tenant_id, branch_id, doc_type, prefix, year, last_value)
    VALUES (p_tenant_id, p_branch_id, p_doc_type, p_prefix, p_year, 1)
    ON CONFLICT DO NOTHING
    RETURNING last_value INTO v_seq;
    IF v_seq IS NULL THEN
      SELECT last_value INTO v_seq
        FROM document_sequences
       WHERE tenant_id = p_tenant_id
         AND branch_id IS NOT DISTINCT FROM p_branch_id
         AND doc_type = p_doc_type
         AND year = p_year
         FOR UPDATE;
      UPDATE document_sequences
         SET last_value = last_value + 1
       WHERE tenant_id = p_tenant_id
         AND branch_id IS NOT DISTINCT FROM p_branch_id
         AND doc_type = p_doc_type
         AND year = p_year
      RETURNING last_value INTO v_seq;
    END IF;
  ELSE
    UPDATE document_sequences
       SET last_value = last_value + 1
     WHERE tenant_id = p_tenant_id
       AND branch_id IS NOT DISTINCT FROM p_branch_id
       AND doc_type = p_doc_type
       AND year = p_year
    RETURNING last_value INTO v_seq;
  END IF;

  RETURN p_prefix || '-' || p_year || '-' || lpad(v_seq::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. CATÁLOGOS GLOBALES (compartidos por todos los tenants, sin RLS)
-- ============================================================================

CREATE TABLE vehicle_brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(120) NOT NULL UNIQUE,
  slug       VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_models (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   UUID NOT NULL REFERENCES vehicle_brands(id),
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_brand_model UNIQUE (brand_id, name)
);

CREATE TABLE vehicle_types (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(40) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fuels (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(40) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transmissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(40) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE units_of_measure (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(40) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fault_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(30) NOT NULL UNIQUE,
  description TEXT,
  system      VARCHAR(120),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE fault_codes IS 'Catálogo de códigos de error (OBD / fabricante). Se enlaza a hallazgos.';

CREATE TABLE part_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code       VARCHAR(40) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. CRM — CLIENTES, CONTACTOS, RELACIÓN CLIENTE-VEHÍCULO
-- ============================================================================

CREATE TABLE clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  client_code     VARCHAR(40),
  client_type     VARCHAR(20) NOT NULL DEFAULT 'PERSON'
                    CHECK (client_type IN ('PERSON','COMPANY')),
  first_name      VARCHAR(120),
  last_name       VARCHAR(120),
  company_name    VARCHAR(200),
  doc_type        VARCHAR(20) CHECK (doc_type IN ('DNI','CE','RUC','PASSPORT')),
  doc_number      VARCHAR(30),
  phone           VARCHAR(40),
  secondary_phone VARCHAR(40),
  email           VARCHAR(255),
  address         TEXT,
  city            VARCHAR(120),
  notes           TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
COMMENT ON TABLE clients IS 'Clientes del tenant (persona o empresa). Documento único por tenant.';

CREATE UNIQUE INDEX uq_client_doc ON clients (tenant_id, doc_type, doc_number)
  WHERE doc_number IS NOT NULL;
CREATE UNIQUE INDEX uq_client_code ON clients (tenant_id, client_code)
  WHERE client_code IS NOT NULL;
CREATE INDEX idx_clients_tenant_status ON clients (tenant_id, status);
CREATE INDEX idx_clients_tenant_name  ON clients (tenant_id, last_name, first_name);

CREATE TABLE client_contacts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  client_id  UUID NOT NULL REFERENCES clients(id),
  full_name  VARCHAR(200) NOT NULL,
  phone      VARCHAR(40),
  email      VARCHAR(255),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_client_contacts_client ON client_contacts (client_id);

-- ============================================================================
-- 6. VEHÍCULOS
-- ============================================================================

CREATE TABLE vehicles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  client_id       UUID REFERENCES clients(id),
  plate           VARCHAR(20),
  vin             VARCHAR(30),
  engine_number   VARCHAR(30),
  brand_id        UUID REFERENCES vehicle_brands(id),
  model_id        UUID REFERENCES vehicle_models(id),
  type_id         UUID REFERENCES vehicle_types(id),
  fuel_id         UUID REFERENCES fuels(id),
  transmission_id UUID REFERENCES transmissions(id),
  year            SMALLINT,
  color           VARCHAR(60),
  capacity_note   VARCHAR(120),
  odometer        INT NOT NULL DEFAULT 0,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','INACTIVE','SOLD','SCRAPPED')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
COMMENT ON TABLE vehicles IS 'Vehículo del tenant. Placa y VIN únicos por tenant (índices parciales).';

CREATE UNIQUE INDEX uq_vehicle_plate ON vehicles (tenant_id, plate) WHERE plate IS NOT NULL;
CREATE UNIQUE INDEX uq_vehicle_vin   ON vehicles (tenant_id, vin)   WHERE vin IS NOT NULL;
CREATE INDEX idx_vehicles_tenant_client  ON vehicles (tenant_id, client_id);
CREATE INDEX idx_vehicles_tenant_model   ON vehicles (tenant_id, model_id);

CREATE TABLE vehicle_client_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  client_id  UUID NOT NULL REFERENCES clients(id),
  started_at DATE NOT NULL,
  ended_at   DATE,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE vehicle_client_history IS 'Historial de propietarios: permite cambiar de cliente sin perder expediente.';

CREATE INDEX idx_vehicle_history_vehicle ON vehicle_client_history (vehicle_id, started_at DESC);
CREATE INDEX idx_vehicle_history_client  ON vehicle_client_history (client_id);

-- ============================================================================
-- 7. SERVICIOS (catálogo por tenant) E INVENTARIO
-- ============================================================================

CREATE TABLE services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  code          VARCHAR(40),
  name          VARCHAR(160) NOT NULL,
  category      VARCHAR(120),
  unit          VARCHAR(40)  NOT NULL DEFAULT 'SERVICIO',
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,
  CONSTRAINT uq_service_name UNIQUE (tenant_id, name)
);
COMMENT ON TABLE services IS 'Catálogo de servicios por tenant (diagnóstico, inyección, turbo, frenos...).';
CREATE UNIQUE INDEX uq_service_code ON services (tenant_id, code);

CREATE TABLE parts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  part_category_id UUID REFERENCES part_categories(id),
  unit_id          UUID REFERENCES units_of_measure(id),
  sku              VARCHAR(60) NOT NULL,
  name             VARCHAR(200) NOT NULL,
  brand            VARCHAR(120),
  purchase_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_level    NUMERIC(12,2) NOT NULL DEFAULT 0,
  location         VARCHAR(120),
  status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                     CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ,
  CONSTRAINT uq_part_sku UNIQUE (tenant_id, sku)
);
COMMENT ON TABLE parts IS 'Repuestos por tenant. SKU único por tenant.';

CREATE INDEX idx_parts_tenant_category ON parts (tenant_id, part_category_id);
CREATE INDEX idx_parts_tenant_name     ON parts (tenant_id, name);

CREATE TABLE inventory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  branch_id  UUID NOT NULL REFERENCES branches(id),
  part_id    UUID NOT NULL REFERENCES parts(id),
  quantity   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_inventory_branch_part UNIQUE (tenant_id, branch_id, part_id)
);
COMMENT ON TABLE inventory IS 'Stock por part por sucursal. Se ajusta SOLO vía inventory_movements.';

CREATE TABLE inventory_movements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  branch_id      UUID REFERENCES branches(id),
  part_id        UUID NOT NULL REFERENCES parts(id),
  user_id        UUID REFERENCES users(id),
  type           VARCHAR(30) NOT NULL
                   CHECK (type IN ('PURCHASE','SALE','WORK_ORDER_USAGE','RETURN',
                                   'ADJUSTMENT','TRANSFER','INITIAL_STOCK')),
  quantity       NUMERIC(12,2) NOT NULL,
  unit_cost      NUMERIC(12,2),
  reference_type VARCHAR(40),
  reference_id   UUID,
  notes          TEXT,
  moved_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE inventory_movements IS 'Historial de movimientos de inventario (reconstruible). reference es polimórfico.';

CREATE INDEX idx_inv_mov_part_time    ON inventory_movements (tenant_id, part_id, moved_at);
CREATE INDEX idx_inv_mov_reference    ON inventory_movements (tenant_id, reference_type, reference_id);
CREATE INDEX idx_inv_mov_branch_time  ON inventory_movements (tenant_id, branch_id, moved_at);

-- ============================================================================
-- 8. WORKSHOP — CITAS, RECEPCIÓN, DIAGNÓSTICO, ÓRDENES
-- ============================================================================

CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  branch_id        UUID NOT NULL REFERENCES branches(id),
  client_id        UUID REFERENCES clients(id),
  vehicle_id       UUID REFERENCES vehicles(id),
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  status           VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED'
                     CHECK (status IN ('SCHEDULED','CONFIRMED','ARRIVED','COMPLETED','CANCELLED','NO_SHOW')),
  reason           TEXT,
  symptoms         TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
COMMENT ON TABLE appointments IS 'Cita previa (puede convertirse en recepción).';

CREATE INDEX idx_appointments_branch_time ON appointments (tenant_id, branch_id, scheduled_at);
CREATE INDEX idx_appointments_status      ON appointments (tenant_id, status);
CREATE INDEX idx_appointments_vehicle     ON appointments (tenant_id, vehicle_id);

CREATE TABLE vehicle_receptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  branch_id        UUID NOT NULL REFERENCES branches(id),
  appointment_id   UUID REFERENCES appointments(id),
  client_id        UUID NOT NULL REFERENCES clients(id),
  vehicle_id       UUID NOT NULL REFERENCES vehicles(id),
  received_by      UUID REFERENCES employees(id),
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  odometer         INT,
  fuel_level       VARCHAR(20),
  reason           TEXT,
  reported_symptoms TEXT,
  observations     TEXT,
  accessories      TEXT,
  visible_damage   TEXT,
  status           VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                     CHECK (status IN ('OPEN','IN_DIAGNOSIS','DIAGNOSED','DONE','CANCELLED')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
COMMENT ON TABLE vehicle_receptions IS 'Recepción real del vehículo (odómetro, combustible, síntomas, daños).';

CREATE INDEX idx_receptions_vehicle ON vehicle_receptions (tenant_id, vehicle_id);
CREATE INDEX idx_receptions_appt    ON vehicle_receptions (tenant_id, appointment_id);
CREATE INDEX idx_receptions_time    ON vehicle_receptions (tenant_id, received_at);

CREATE TABLE diagnostics (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  branch_id        UUID REFERENCES branches(id),
  vehicle_id       UUID NOT NULL REFERENCES vehicles(id),
  reception_id     UUID REFERENCES vehicle_receptions(id),
  work_order_id    UUID,
  performed_by     UUID REFERENCES employees(id),
  performed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary          TEXT,
  recommendations  TEXT,
  resolution_status VARCHAR(20) NOT NULL DEFAULT 'UNRESOLVED'
                      CHECK (resolution_status IN ('UNRESOLVED','PARTIAL','RESOLVED')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
COMMENT ON TABLE diagnostics IS 'Diagnóstico. work_order_id es un enlace lógico (sin FK rígida) para evitar un ciclo; la FK formal es work_orders.diagnostic_id -> diagnostics (nullable).';

CREATE INDEX idx_diagnostics_vehicle ON diagnostics (tenant_id, vehicle_id);

CREATE TABLE diagnostic_findings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  diagnostic_id    UUID NOT NULL REFERENCES diagnostics(id),
  area             VARCHAR(120),
  symptom          TEXT,
  description      TEXT NOT NULL,
  probable_cause   TEXT,
  confirmed_cause  TEXT,
  is_confirmed     BOOLEAN NOT NULL DEFAULT false,
  resolution       TEXT,
  severity         VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
                     CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);
COMMENT ON TABLE diagnostic_findings IS 'Un hallazgo por fila (nunca múltiples fallas en un texto).';

CREATE INDEX idx_findings_diagnostic ON diagnostic_findings (diagnostic_id);

CREATE TABLE diagnostic_tests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  diagnostic_id UUID NOT NULL REFERENCES diagnostics(id),
  test_type     VARCHAR(80) NOT NULL,
  result        TEXT,
  performed_by  UUID REFERENCES employees(id),
  performed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tests_diagnostic ON diagnostic_tests (diagnostic_id);

CREATE TABLE diagnostic_finding_fault_codes (
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  finding_id    UUID NOT NULL REFERENCES diagnostic_findings(id),
  fault_code_id UUID NOT NULL REFERENCES fault_codes(id),
  PRIMARY KEY (finding_id, fault_code_id)
);

CREATE TABLE work_orders (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID NOT NULL REFERENCES tenants(id),
  branch_id              UUID NOT NULL REFERENCES branches(id),
  client_id              UUID NOT NULL REFERENCES clients(id),
  vehicle_id             UUID NOT NULL REFERENCES vehicles(id),
  reception_id           UUID REFERENCES vehicle_receptions(id),
  diagnostic_id          UUID REFERENCES diagnostics(id),
  quote_id               UUID,
  number                 VARCHAR(40),
  status                 VARCHAR(40) NOT NULL DEFAULT 'RECEIVED'
                           CHECK (status IN (
                             'RECEIVED','DIAGNOSIS','QUOTED','WAITING_APPROVAL','APPROVED',
                             'IN_PROGRESS','WAITING_PARTS','PAUSED','QUALITY_CONTROL',
                             'COMPLETED','READY_FOR_PICKUP','DELIVERED','CANCELLED')),
  priority               VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
                           CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  responsible_employee_id UUID REFERENCES employees(id),
  supervisor_employee_id  UUID REFERENCES employees(id),
  opened_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at              TIMESTAMPTZ,
  subtotal               NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount               NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax                    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ
);
COMMENT ON TABLE work_orders IS 'Centro operativo del taller. Número humano OT-2026-000001 vía next_document_number().';

CREATE UNIQUE INDEX uq_work_order_number ON work_orders (tenant_id, number) WHERE number IS NOT NULL;
CREATE INDEX idx_work_orders_branch_status ON work_orders (tenant_id, branch_id, status);
CREATE INDEX idx_work_orders_client        ON work_orders (tenant_id, client_id);
CREATE INDEX idx_work_orders_vehicle       ON work_orders (tenant_id, vehicle_id);
CREATE INDEX idx_work_orders_opened        ON work_orders (tenant_id, opened_at DESC);

-- La FK circular COT↔OT se cierra en la sección 9, después de crear quotes.
--   ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_quote
--     FOREIGN KEY (quote_id) REFERENCES quotes(id);

CREATE TABLE work_order_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  from_status   VARCHAR(40),
  to_status     VARCHAR(40) NOT NULL,
  changed_by    UUID REFERENCES users(id),
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes         TEXT
);
COMMENT ON TABLE work_order_status_history IS 'Trazabilidad de estados de cada orden (evoluciona con CHECK en work_orders).';

CREATE INDEX idx_wo_status_history_wo ON work_order_status_history (work_order_id, changed_at);

CREATE TABLE work_order_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  service_id    UUID REFERENCES services(id),
  service_name  VARCHAR(160) NOT NULL,
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 1,
  price         NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wo_services_wo ON work_order_services (work_order_id);

CREATE TABLE work_order_technicians (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  role_in_job   VARCHAR(120),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ,
  hours_worked  NUMERIC(8,2),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_wo_technician UNIQUE (work_order_id, employee_id)
);
CREATE INDEX idx_wo_tech_employee ON work_order_technicians (employee_id);

CREATE TABLE labor_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  employee_id   UUID NOT NULL REFERENCES employees(id),
  service_id    UUID REFERENCES services(id),
  hours         NUMERIC(8,2) NOT NULL DEFAULT 0,
  hourly_rate   NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_labor_wo ON labor_entries (work_order_id);
CREATE INDEX idx_labor_employee ON labor_entries (employee_id);

CREATE TABLE work_order_parts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  part_id       UUID NOT NULL REFERENCES parts(id),
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  technician_id UUID REFERENCES employees(id),
  used_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wo_parts_wo   ON work_order_parts (work_order_id);
CREATE INDEX idx_wo_parts_part ON work_order_parts (part_id);

CREATE TABLE checklists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  kind          VARCHAR(20) NOT NULL CHECK (kind IN ('RECEPTION','DELIVERY')),
  checked_by    UUID REFERENCES employees(id),
  completed_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklists_wo ON checklists (work_order_id, kind);

CREATE TABLE checklist_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES checklists(id),
  item_name    VARCHAR(200) NOT NULL,
  is_ok        BOOLEAN,
  observation  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checklist_items ON checklist_items (checklist_id);

-- ============================================================================
-- 9. QUOTATIONS
-- ============================================================================

CREATE TABLE quotes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  client_id     UUID NOT NULL REFERENCES clients(id),
  vehicle_id    UUID REFERENCES vehicles(id),
  work_order_id UUID,
  number        VARCHAR(40),
  created_by    UUID REFERENCES employees(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                  CHECK (status IN ('DRAFT','SENT','APPROVED','REJECTED','EXPIRED','CONVERTED')),
  valid_until   DATE,
  terms         TEXT,
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax           NUMERIC(12,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
COMMENT ON TABLE quotes IS 'Cotización. Aprobada se convierte en orden de trabajo.';

CREATE UNIQUE INDEX uq_quote_number ON quotes (tenant_id, number) WHERE number IS NOT NULL;
CREATE INDEX idx_quotes_status  ON quotes (tenant_id, status);
CREATE INDEX idx_quotes_client  ON quotes (tenant_id, client_id);
CREATE INDEX idx_quotes_vehicle ON quotes (tenant_id, vehicle_id);

CREATE TABLE quote_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  quote_id    UUID NOT NULL REFERENCES quotes(id),
  kind        VARCHAR(20) NOT NULL CHECK (kind IN ('SERVICE','PART')),
  service_id  UUID REFERENCES services(id),
  part_id     UUID REFERENCES parts(id),
  description VARCHAR(250) NOT NULL,
  quantity    NUMERIC(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal    NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quote_items_quote ON quote_items (quote_id);

-- FK circular work_orders.quote_id -> quotes y cierre del otro lado (ambos opcionales).
ALTER TABLE work_orders
  ADD CONSTRAINT fk_work_orders_quote FOREIGN KEY (quote_id) REFERENCES quotes(id);
ALTER TABLE quotes
  ADD CONSTRAINT fk_quotes_work_order FOREIGN KEY (work_order_id) REFERENCES work_orders(id);

-- ============================================================================
-- 10. FINANCE — PAGOS
-- ============================================================================

CREATE TABLE payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  work_order_id UUID NOT NULL REFERENCES work_orders(id),
  branch_id   UUID REFERENCES branches(id),
  received_by UUID REFERENCES employees(id),
  amount      NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  paid_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  method      VARCHAR(20) NOT NULL
                CHECK (method IN ('EFECTIVO','TRANSFERENCIA','TARJETA','YAPE','PLIN','OTRO')),
  reference   VARCHAR(120),
  status      VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
                CHECK (status IN ('PENDING','COMPLETED','REVERSED','FAILED')),
  observation TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
COMMENT ON TABLE payments IS 'Pagos internos de la orden. Saldo pendiente = total orden − sum(payments).';

CREATE INDEX idx_payments_wo    ON payments (tenant_id, work_order_id);
CREATE INDEX idx_payments_time  ON payments (tenant_id, paid_at);

-- Visa: total/pagado/saldo por orden. security_invoker => aplica RLS del usuario consultante.
CREATE OR REPLACE VIEW v_work_order_payment_status
WITH (security_invoker = true) AS
SELECT
  wo.id              AS work_order_id,
  wo.tenant_id,
  wo.total,
  coalesce(p.tot_pagado, 0) AS total_pagado,
  wo.total - coalesce(p.tot_pagado, 0) AS saldo_pendiente
FROM work_orders wo
LEFT JOIN (
  SELECT work_order_id, sum(amount) AS tot_pagado
    FROM payments
   WHERE status = 'COMPLETED' AND deleted_at IS NULL
   GROUP BY work_order_id
) p ON p.work_order_id = wo.id;

-- ============================================================================
-- 11. WARRANTIES
-- ============================================================================

CREATE TABLE warranties (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  work_order_id  UUID NOT NULL REFERENCES work_orders(id),
  vehicle_id     UUID NOT NULL REFERENCES vehicles(id),
  client_id      UUID NOT NULL REFERENCES clients(id),
  start_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date       DATE,
  max_odometer   INT,
  conditions     TEXT,
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE','USED','EXPIRED','CANCELLED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_warranties_wo     ON warranties (tenant_id, work_order_id);
CREATE INDEX idx_warranties_vehicle ON warranties (tenant_id, vehicle_id);

CREATE TABLE warranty_claims (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id),
  warranty_id    UUID NOT NULL REFERENCES warranties(id),
  work_order_id  UUID REFERENCES work_orders(id),
  claim_date     TIMESTAMPTZ NOT NULL DEFAULT now(),
  description    TEXT NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                   CHECK (status IN ('OPEN','REJECTED','APPROVED','IN_REPAIR','RESOLVED')),
  resolution     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);
CREATE INDEX idx_warranty_claims_warranty ON warranty_claims (warranty_id);

-- ============================================================================
-- 12. FILES · NOTIFICATIONS · AUDIT
-- ============================================================================

CREATE TABLE files (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  entity_type VARCHAR(60) NOT NULL,
  entity_id   UUID NOT NULL,
  url         TEXT NOT NULL,
  name        VARCHAR(255),
  mime_type   VARCHAR(120),
  size_bytes  BIGINT,
  category    VARCHAR(60),
  uploaded_by UUID REFERENCES users(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE files IS 'Metadatos de archivos (URL). Preparado para S3/Cloudinary. entity es polimórfico.';

CREATE INDEX idx_files_entity  ON files (tenant_id, entity_type, entity_id);
CREATE INDEX idx_files_category ON files (tenant_id, category);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  type       VARCHAR(60) NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  data       JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE notifications IS 'Notificaciones internas (WhatsApp/correo en FASE 2).';

CREATE INDEX idx_notifications_user ON notifications (tenant_id, user_id, is_read);

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID,
  user_id     UUID REFERENCES users(id),
  action      VARCHAR(60) NOT NULL,
  entity      VARCHAR(60) NOT NULL,
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip          VARCHAR(64),
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE audit_logs IS 'Auditoría inmutable e independiente del soft delete. tenant_id NULL = acción de plataforma.';

CREATE INDEX idx_audit_tenant_time ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity      ON audit_logs (entity, entity_id);
CREATE INDEX idx_audit_user        ON audit_logs (user_id);

-- Refresh tokens (plataforma): NO tiene tenant_id -> sin RLS. Rotación/revocación en AuthService.
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id),
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  user_agent  VARCHAR(255),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE refresh_tokens IS 'Refresh tokens con hash (sha256). El token crudo jamás se persiste.';
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- ============================================================================
-- 13. TRIGGERS set_updated_at
-- ============================================================================

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'plans','tenants','tenant_subscriptions','roles','permissions','branches','employees',
    'tenant_settings','document_sequences','clients','client_contacts','vehicles',
    'services','parts','inventory_movements','appointments','vehicle_receptions',
    'diagnostics','diagnostic_findings','work_orders','work_order_status_history',
    'checklists','quotes','payments','warranties','warranty_claims'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON %1$s
                    FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END;
$$;

-- ============================================================================
-- 14. ROW LEVEL SECURITY
-- ============================================================================

-- ---- Tablas de datos de empresa: aislamiento por tenant + bypass Super Admin ----
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'tenant_subscriptions','user_tenant_roles','branches','employees','tenant_settings',
    'document_sequences','clients','client_contacts','vehicles','vehicle_client_history',
    'services','parts','inventory','inventory_movements','appointments','vehicle_receptions',
    'diagnostics','diagnostic_findings','diagnostic_tests','diagnostic_finding_fault_codes',
    'work_orders','work_order_status_history','work_order_services','work_order_technicians',
    'labor_entries','work_order_parts','checklists','quotes','quote_items','payments',
    'warranties','warranty_claims','files','notifications'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %1$s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY p_%1$s_tenant ON %1$s FOR ALL
         USING (tenant_id = current_tenant() OR is_platform_admin())
         WITH CHECK (tenant_id = current_tenant() OR is_platform_admin())', t);
  END LOOP;
END;
$$;

-- ---- checklist_items (hijo sin tenant_id): a través de su checklist padre ----
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_checklist_items_tenant ON checklist_items
  FOR ALL
  USING (EXISTS (SELECT 1 FROM checklists c
                  WHERE c.id = checklist_items.checklist_id
                    AND (c.tenant_id = current_tenant() OR is_platform_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM checklists c
                       WHERE c.id = checklist_items.checklist_id
                         AND (c.tenant_id = current_tenant() OR is_platform_admin())));

-- ---- users: la cuenta se ve a sí misma; el Super Admin todo ----
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_users_self ON users
  FOR ALL
  USING (id = current_user_id() OR is_platform_admin())
  WITH CHECK (id = current_user_id() OR is_platform_admin());

-- ---- tenants: fila propia + Super Admin ----
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_tenants_self ON tenants
  FOR ALL
  USING (id = current_tenant() OR is_platform_admin())
  WITH CHECK (id = current_tenant() OR is_platform_admin());

-- ---- audit_logs: INSERT libre (el sistema siempre registra); SELECT restringido ----
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY p_audit_insert ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY p_audit_select ON audit_logs FOR SELECT
  USING (tenant_id = current_tenant() OR is_platform_admin());

-- ---- Catálogos compartidos (plans, roles, permissions, brands, models, types,
--       fuels, transmissions, units, fault_codes, part_categories, role_permissions,
--       quote_items ya cubierto): SIN RLS. La escritura se restringe por rol DB/app. ----

-- ============================================================================
-- 15. SEEDS
-- ============================================================================

-- Planes (códigos de ejemplo, los nombres definitivos pueden cambiar).
INSERT INTO plans (id, code, name, description, price, billing_cycle,
                   max_users, max_branches, max_clients, max_vehicles, max_monthly_orders, sort_order)
VALUES
  ('00000000-0000-0000-0000-000000000001','FREE','Free','Plan gratuito de prueba',0,'MONTHLY',3,1,50,50,30,1),
  ('00000000-0000-0000-0000-000000000002','BASIC','Basic','Plan básico para talleres pequeños',79.90,'MONTHLY',5,1,500,500,150,2),
  ('00000000-0000-0000-0000-000000000003','PROFESSIONAL','Professional','Plan completo multi-sucursal',149.90,'MONTHLY',20,3,2000,2000,800,3),
  ('00000000-0000-0000-0000-000000000004','ENTERPRISE','Enterprise','Plan sin límites',299.90,'MONTHLY',NULL,NULL,NULL,NULL,NULL,4)
ON CONFLICT (code) DO NOTHING;

-- Roles.
INSERT INTO roles (id, code, name, scope, description) VALUES
  ('00000000-0000-0000-0000-000000000010','SUPER_ADMIN','Super Admin de Plataforma','PLATFORM','Control total de la plataforma'),
  ('00000000-0000-0000-0000-000000000011','OWNER','Dueño','TENANT','Propietario del taller'),
  ('00000000-0000-0000-0000-000000000012','ADMIN','Administrador','TENANT','Administra el taller'),
  ('00000000-0000-0000-0000-000000000013','SUPERVISOR','Supervisor','TENANT','Supervisa trabajos'),
  ('00000000-0000-0000-0000-000000000014','RECEPTION','Recepción','TENANT','Atención y recepción'),
  ('00000000-0000-0000-0000-000000000015','TECHNICIAN','Técnico','TENANT','Ejecuta diagnósticos y reparaciones'),
  ('00000000-0000-0000-0000-000000000016','MECHANIC','Mecánico','TENANT','Ejecuta reparaciones'),
  ('00000000-0000-0000-0000-000000000017','WAREHOUSE','Almacén','TENANT','Controla inventario'),
  ('00000000-0000-0000-0000-000000000018','CASHIER','Cajero','TENANT','Registra pagos')
ON CONFLICT (code) DO NOTHING;

-- Permisos de ejemplo.
INSERT INTO permissions (id, code, name, module) VALUES
  ('00000000-0000-0000-0000-000000000020','work_orders.view','Ver órdenes','WORKSHOP'),
  ('00000000-0000-0000-0000-000000000021','work_orders.create','Crear órdenes','WORKSHOP'),
  ('00000000-0000-0000-0000-000000000022','work_orders.update_status','Cambiar estado de orden de trabajo','WORKSHOP'),
  ('00000000-0000-0000-0000-000000000023','quotes.approve','Aprobar cotizaciones','QUOTATIONS'),
  ('00000000-0000-0000-0000-000000000024','payments.register','Registrar pagos','FINANCE'),
  ('00000000-0000-0000-0000-000000000025','inventory.adjust','Ajustar inventario','INVENTORY'),
  ('00000000-0000-0000-0000-000000000026','users.manage','Gestionar usuarios y roles','IDENTITY')
ON CONFLICT (code) DO NOTHING;

-- Catálogo global de tipos de vehículo.
INSERT INTO vehicle_types (id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000030','CAMION','Camión'),
  ('00000000-0000-0000-0000-000000000031','CAMIONETA','Camioneta'),
  ('00000000-0000-0000-0000-000000000032','BUS','Bus'),
  ('00000000-0000-0000-0000-000000000033','TRACTOR','Tracto / remolque'),
  ('00000000-0000-0000-0000-000000000034','MAQUINARIA','Maquinaria pesada'),
  ('00000000-0000-0000-0000-000000000035','GENERADOR','Grupo electrógeno'),
  ('00000000-0000-0000-0000-000000000036','AUTOMOVIL','Automóvil'),
  ('00000000-0000-0000-0000-000000000037','OTRO','Otro')
ON CONFLICT (code) DO NOTHING;

-- Combustibles.
INSERT INTO fuels (id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000040','DIESEL','Diésel'),
  ('00000000-0000-0000-0000-000000000041','BIODIESEL','Biodiésel'),
  ('00000000-0000-0000-0000-000000000042','GASOLINA','Gasolina'),
  ('00000000-0000-0000-0000-000000000043','GAS','Gas / GLP / GNV'),
  ('00000000-0000-0000-0000-000000000044','ELECTRICO','Eléctrico'),
  ('00000000-0000-0000-0000-000000000045','HIBRIDO','Híbrido')
ON CONFLICT (code) DO NOTHING;

-- Transmisiones.
INSERT INTO transmissions (id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000050','MANUAL','Manual'),
  ('00000000-0000-0000-0000-000000000051','AUTOMATICA','Automática'),
  ('00000000-0000-0000-0000-000000000052','SEMIAUTOMATICA','Semiautomática')
ON CONFLICT (code) DO NOTHING;

-- Unidades de medida.
INSERT INTO units_of_measure (id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000060','UNIDAD','Unidad'),
  ('00000000-0000-0000-0000-000000000061','KIT','Kit'),
  ('00000000-0000-0000-0000-000000000062','LITRO','Litro'),
  ('00000000-0000-0000-0000-000000000063','GALON','Galón'),
  ('00000000-0000-0000-0000-000000000064','CAJA','Caja'),
  ('00000000-0000-0000-0000-000000000065','PAR','Par'),
  ('00000000-0000-0000-0000-000000000066','METRO','Metro'),
  ('00000000-0000-0000-0000-000000000067','SERVICIO','Servicio')
ON CONFLICT (code) DO NOTHING;

-- Categorías de repuestos.
INSERT INTO part_categories (id, code, name) VALUES
  ('00000000-0000-0000-0000-000000000070','MOTOR','Motor'),
  ('00000000-0000-0000-0000-000000000071','INYECCION','Sistema de inyección'),
  ('00000000-0000-0000-0000-000000000072','TURBO','Turbo'),
  ('00000000-0000-0000-0000-000000000073','FILTROS','Filtros'),
  ('00000000-0000-0000-0000-000000000074','LUBRICANTES','Lubricantes'),
  ('00000000-0000-0000-0000-000000000075','FRENOS','Frenos'),
  ('00000000-0000-0000-0000-000000000076','SUSPENSION','Suspensión'),
  ('00000000-0000-0000-0000-000000000077','TRANSMISION','Transmisión'),
  ('00000000-0000-0000-0000-000000000078','ELECTRICO','Eléctrico'),
  ('00000000-0000-0000-0000-000000000079','GENERAL','General')
ON CONFLICT (code) DO NOTHING;

-- Marcas de ejemplo y algunos modelos.
INSERT INTO vehicle_brands (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000080','Volvo','volvo'),
  ('00000000-0000-0000-0000-000000000081','Mercedes-Benz','mercedes-benz'),
  ('00000000-0000-0000-0000-000000000082','Scania','scania'),
  ('00000000-0000-0000-0000-000000000083','MAN','man'),
  ('00000000-0000-0000-0000-000000000084','Toyota','toyota'),
  ('00000000-0000-0000-0000-000000000085','Nissan','nissan'),
  ('00000000-0000-0000-0000-000000000086','Mitsubishi','mitsubishi'),
  ('00000000-0000-0000-0000-000000000087','Caterpillar','caterpillar'),
  ('00000000-0000-0000-0000-000000000088','Cummins','cummins'),
  ('00000000-0000-0000-0000-000000000089','Otro','otro')
ON CONFLICT (id) DO NOTHING;
INSERT INTO vehicle_models (id, brand_id, name) VALUES
  ('00000000-0000-0000-0000-000000000090','00000000-0000-0000-0000-000000000080','FH 500'),
  ('00000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000081','Actros'),
  ('00000000-0000-0000-0000-000000000092','00000000-0000-0000-0000-000000000082','R 450'),
  ('00000000-0000-0000-0000-000000000093','00000000-0000-0000-0000-000000000084','Hilux')
ON CONFLICT (id) DO NOTHING;

-- Códigos de falla de ejemplo (OBD genéricos diésel).
INSERT INTO fault_codes (id, code, description, system) VALUES
  ('00000000-0000-0000-0000-000000000100','P0087','Rail de combustible, presión demasiado baja','Combustible'),
  ('00000000-0000-0000-0000-000000000101','P0088','Rail de combustible, presión demasiado alta','Combustible'),
  ('00000000-0000-0000-0000-000000000102','P0093','Fuga grande detectada en sistema de combustible','Combustible'),
  ('00000000-0000-0000-0000-000000000103','P0234','Sobreboost del turbo','Turbo'),
  ('00000000-0000-0000-0000-000000000104','P0299','Turbo, presión por debajo del umbral','Turbo'),
  ('00000000-0000-0000-0000-000000000105','P0401','EGR flujo insuficiente','Emisiones'),
  ('00000000-0000-0000-0000-000000000106','P0541','Sensor de temperatura del combustible','Sensores')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 16. FUNCIÓN DE PROVISIÓN DE TENANT
--    Crea la configuración mínima (settings, sucursal principal y servicios base).
--    EJECUTA:  SELECT provision_tenant('<uuid de tenants.id>');
--    (Las cuentas de usuario y sus roles las crea la aplicación.)
-- ============================================================================

CREATE OR REPLACE FUNCTION provision_tenant(p_tenant_id UUID) RETURNS VOID AS $$
BEGIN
  INSERT INTO tenant_settings (tenant_id) VALUES (p_tenant_id)
    ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO branches (tenant_id, name, code, status)
  VALUES (p_tenant_id, 'Sucursal Principal', 'PRINCIPAL', 'ACTIVE')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  INSERT INTO services (tenant_id, code, name, category, unit, default_price) VALUES
    (p_tenant_id,'DIAG','Diagnóstico general','Diagnóstico','SERVICIO',0),
    (p_tenant_id,'MPREV','Mantenimiento preventivo','Mantenimiento','SERVICIO',0),
    (p_tenant_id,'MOTOR','Reparación de motor','Motor','SERVICIO',0),
    (p_tenant_id,'INYECC','Sistema de inyección','Sistema de combustible','SERVICIO',0),
    (p_tenant_id,'SCR','Servicio de inyectores','Sistema de combustible','SERVICIO',0),
    (p_tenant_id,'TURBO','Reparación de turbo','Turbo','SERVICIO',0),
    (p_tenant_id,'FRENOS','Sistema de frenos','Frenos','SERVICIO',0),
    (p_tenant_id,'SUSP','Suspensión','Suspensión','SERVICIO',0),
    (p_tenant_id,'TRANS','Transmisión','Transmisión','SERVICIO',0),
    (p_tenant_id,'ELEC','Electricidad / electrónica','Eléctrico','SERVICIO',0),
    (p_tenant_id,'REFRIG','Refrigeración','Refrigeración','SERVICIO',0),
    (p_tenant_id,'CQ','Control de calidad','Calidad','SERVICIO',0)
  ON CONFLICT (tenant_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIN DEL BASELINE
-- ============================================================================

COMMIT;
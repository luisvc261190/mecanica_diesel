/** Tipos espejo del OpenAPI del backend (FastAPI). Los montos Decimal se serializan como string. */

export type UUID = string;
export type Money = string;
export type ISO = string;

export interface ApiEnvelope<T> {
  data: T | null;
  message: string;
}

export interface ApiErrorBody {
  error?: { code: string; message: string };
  detail?: string | Array<{ msg: string; loc: string[] }>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export interface UserSession {
  id: UUID;
  email: string;
  full_name: string;
  roles: string[];
  tenant_id: UUID | null;
  is_platform_admin: boolean;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserSession;
}

export interface TenantRead {
  id: UUID;
  commercial_name: string;
  legal_name: string | null;
  tax_id: string | null;
  slug: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  country: string;
  currency: string;
  timezone: string;
  status: string;
  settings: Record<string, unknown>;
}

export interface Plan {
  id: UUID;
  code: string;
  name: string;
  description: string | null;
  price: Money;
  currency: string;
  billing_cycle: string;
  max_users: number | null;
  max_branches: number | null;
  max_clients: number | null;
  max_vehicles: number | null;
  max_monthly_orders: number | null;
  storage_bytes: number | null;
  features: Record<string, unknown>;
  is_active: boolean;
}

export interface Subscription {
  id: UUID;
  tenant_id: UUID;
  plan: Plan | null;
  status: string;
  trial_ends_at: string | null;
  started_at: ISO;
  current_period_start: string | null;
  current_period_end: string | null;
}

// ── Clientes ────────────────────────────────────────────────────────────────

export interface Client {
  id: UUID;
  tenant_id: UUID;
  client_code: string | null;
  client_type: "PERSON" | "COMPANY";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  doc_type: string | null;
  doc_number: string | null;
  phone: string | null;
  secondary_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  status: string;
  notes: string | null;
}

export interface ClientContact {
  id: UUID;
  client_id: UUID;
  full_name: string;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
}

// ── Vehículos ───────────────────────────────────────────────────────────────

export interface Vehicle {
  id: UUID;
  tenant_id: UUID;
  client_id: UUID | null;
  plate: string | null;
  vin: string | null;
  engine_number: string | null;
  brand_id: UUID | null;
  model_id: UUID | null;
  type_id: UUID | null;
  fuel_id: UUID | null;
  transmission_id: UUID | null;
  year: number | null;
  color: string | null;
  capacity_note: string | null;
  odometer: number;
  status: string;
  notes: string | null;
}

export interface VehicleHistory {
  id: UUID;
  vehicle_id: UUID;
  client_id: UUID;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export interface CatalogOption {
  id: UUID;
  name: string;
  code: string | null;
  kind: "brand" | "model" | "type" | "fuel" | "transmission" | "unit" | "category";
}

// ── Taller: servicios, citas, recepciones, diagnósticos, OTs ───────────────

export interface Service {
  id: UUID;
  code: string | null;
  name: string;
  category: string | null;
  unit: string;
  default_price: Money;
  is_active: boolean;
}

export interface Appointment {
  id: UUID;
  branch_id: UUID;
  client_id: UUID | null;
  vehicle_id: UUID | null;
  scheduled_at: ISO;
  duration_minutes: number;
  status: string;
  reason: string | null;
  symptoms: string | null;
  notes: string | null;
}

export interface Reception {
  id: UUID;
  branch_id: UUID;
  appointment_id: UUID | null;
  client_id: UUID;
  vehicle_id: UUID;
  received_by: UUID | null;
  received_at: ISO;
  odometer: number | null;
  fuel_level: string | null;
  reason: string | null;
  reported_symptoms: string | null;
  observations: string | null;
  accessories: string | null;
  visible_damage: string | null;
  status: string;
}

export interface Diagnostic {
  id: UUID;
  branch_id: UUID | null;
  vehicle_id: UUID;
  reception_id: UUID | null;
  work_order_id: UUID | null;
  performed_by: UUID | null;
  performed_at: ISO;
  summary: string | null;
  recommendations: string | null;
  resolution_status: string;
}

export interface Finding {
  id: UUID;
  diagnostic_id: UUID;
  area: string | null;
  symptom: string | null;
  description: string;
  probable_cause: string | null;
  confirmed_cause: string | null;
  is_confirmed: boolean;
  severity: string;
  resolution: string | null;
  fault_code_ids: UUID[];
}

export interface DiagnosticTest {
  id: UUID;
  diagnostic_id: UUID;
  test_type: string;
  result: string | null;
  performed_by: UUID | null;
  performed_at: ISO;
  notes: string | null;
}

export interface WorkOrderServiceRow {
  id: UUID;
  work_order_id: UUID;
  service_id: UUID | null;
  service_name: string;
  quantity: Money;
  price: Money;
  discount: Money;
  subtotal: Money;
}

export interface WorkOrderTechnician {
  id: UUID;
  work_order_id: UUID;
  employee_id: UUID;
  role_in_job: string | null;
  assigned_at: ISO;
  finished_at: ISO | null;
  hours_worked: Money | null;
  notes: string | null;
}

export interface LaborEntry {
  id: UUID;
  work_order_id: UUID;
  employee_id: UUID;
  service_id: UUID | null;
  hours: Money;
  hourly_rate: Money;
  discount: Money;
  subtotal: Money;
  notes: string | null;
}

export interface WorkOrderPart {
  id: UUID;
  work_order_id: UUID;
  part_id: UUID;
  quantity: Money;
  unit_price: Money;
  discount: Money;
  subtotal: Money;
  technician_id: UUID | null;
  used_at: ISO;
}

export interface WorkOrderStatusHistory {
  id: UUID;
  work_order_id: UUID;
  from_status: string | null;
  to_status: string;
  changed_by: UUID | null;
  changed_at: ISO;
  notes: string | null;
}

export interface WorkOrder {
  id: UUID;
  branch_id: UUID;
  client_id: UUID;
  vehicle_id: UUID;
  reception_id: UUID | null;
  diagnostic_id: UUID | null;
  quote_id: UUID | null;
  number: string | null;
  status: string;
  priority: string;
  responsible_employee_id: UUID | null;
  supervisor_employee_id: UUID | null;
  opened_at: ISO;
  closed_at: ISO | null;
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  notes: string | null;
  services: WorkOrderServiceRow[];
  parts: WorkOrderPart[];
  labor: LaborEntry[];
  technicians: WorkOrderTechnician[];
  status_history: WorkOrderStatusHistory[];
  total_paid: Money;
}

export interface Checklist {
  id: UUID;
  work_order_id: UUID;
  kind: string;
  checked_by: UUID | null;
  completed_at: ISO | null;
  notes: string | null;
  items: Array<{ id: UUID; checklist_id: UUID; item_name: string; is_ok: boolean | null; observation: string | null }>;
}

// ── Cotizaciones ────────────────────────────────────────────────────────────

export interface QuoteItem {
  id: UUID;
  quote_id: UUID;
  kind: "SERVICE" | "PART";
  service_id: UUID | null;
  part_id: UUID | null;
  description: string;
  quantity: Money;
  unit_price: Money;
  discount: Money;
  subtotal: Money;
}

export interface Quote {
  id: UUID;
  branch_id: UUID;
  client_id: UUID;
  vehicle_id: UUID | null;
  work_order_id: UUID | null;
  number: string | null;
  created_by: UUID | null;
  status: string;
  valid_until: string | null;
  terms: string | null;
  subtotal: Money;
  discount: Money;
  tax: Money;
  total: Money;
  created_at: ISO;
  items: QuoteItem[];
}

// ── Inventario ──────────────────────────────────────────────────────────────

export interface Part {
  id: UUID;
  part_category_id: UUID | null;
  unit_id: UUID | null;
  sku: string;
  name: string;
  brand: string | null;
  purchase_price: Money;
  sale_price: Money;
  reorder_level: Money;
  location: string | null;
  status: string;
}

export interface StockLevel {
  branch_id: UUID;
  part_id: UUID;
  quantity: Money;
  updated_at: ISO | null;
  part_name?: string;
}

export interface Movement {
  id: UUID;
  branch_id: UUID | null;
  part_id: UUID;
  user_id: UUID | null;
  type: string;
  quantity: Money;
  unit_cost: Money | null;
  reference_type: string | null;
  reference_id: UUID | null;
  notes: string | null;
  moved_at: ISO;
  created_at: ISO;
}

// ── Pagos y garantías ───────────────────────────────────────────────────────

export interface Payment {
  id: UUID;
  work_order_id: UUID;
  branch_id: UUID | null;
  received_by: UUID | null;
  amount: Money;
  paid_at: ISO;
  method: string;
  reference: string | null;
  status: string;
  observation: string | null;
}

export interface Balance {
  work_order_id: UUID;
  total: Money;
  total_paid: Money;
  balance: Money;
}

export interface Warranty {
  id: UUID;
  work_order_id: UUID;
  vehicle_id: UUID;
  client_id: UUID;
  start_date: string;
  end_date: string | null;
  max_odometer: number | null;
  conditions: string | null;
  status: string;
}

export interface Claim {
  id: UUID;
  warranty_id: UUID;
  work_order_id: UUID | null;
  claim_date: ISO;
  description: string;
  status: string;
  resolution: string | null;
}

// ── Organización ────────────────────────────────────────────────────────────

export interface Branch {
  id: UUID;
  tenant_id: UUID;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  settings: Record<string, unknown>;
  created_at: ISO;
}

export interface Employee {
  id: UUID;
  tenant_id: UUID;
  branch_id: UUID | null;
  user_id: UUID | null;
  first_name: string;
  last_name: string;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  email: string | null;
  job_title: string | null;
  specialty: string | null;
  hire_date: string | null;
  status: string;
  notes: string | null;
}

export interface TenantSettings {
  id: UUID;
  tenant_id: UUID;
  currency: string;
  timezone: string;
  brand_color: string | null;
  logo_url: string | null;
  quote_number_format: string;
  work_order_number_format: string;
  require_approval_for_work: boolean;
  show_prices_in_documents: boolean;
  document_header: string | null;
  extra: Record<string, unknown>;
}

// ── Usuarios ────────────────────────────────────────────────────────────────

export interface User {
  id: UUID;
  email: string;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
  last_login_at: ISO | null;
  roles: string[];
}

export interface Role {
  id: UUID;
  code: string;
  name: string;
  scope: string;
  description: string | null;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export interface DashboardSummary {
  work_orders_open: number;
  work_orders_in_progress: number;
  work_orders_ready: number;
  quotes_pending: number;
  clients_total: number;
  vehicles_total: number;
  appointments_today: number;
  appointments_scheduled: number;
  revenue_today: Money;
  revenue_month: Money;
  parts_low_stock: number;
  parts_total: number;
  technicians_active: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

// ── Archivos ────────────────────────────────────────────────────────────────

export interface FileAsset {
  id: UUID;
  entity_type: string;
  entity_id: UUID;
  url: string;
  name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  category: string | null;
  uploaded_by: UUID | null;
  notes: string | null;
  created_at: ISO;
  kind: string | null;
  visibility: string;
  original_name: string | null;
  storage_key: string | null;
}
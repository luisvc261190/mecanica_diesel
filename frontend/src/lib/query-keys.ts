export const queryKeys = {
  tenants: ["tenants"] as const,

  summary: ["dashboard", "summary"] as const,
  dashboardBranches: ["dashboard", "branches"] as const,
  notifications: ["dashboard", "notifications"] as const,
  workOrderCounts: ["workshop", "work-orders", "counts"] as const,
  appointmentCounts: ["workshop", "appointments", "counts"] as const,

  clients: (page: number, q: string) => ["clients", { page, q }] as const,
  client: (id: string) => ["clients", id] as const,
  clientContacts: (id: string) => ["clients", id, "contacts"] as const,
  clientVehicles: (id: string) => ["clients", id, "vehicles"] as const,

  vehicles: (page: number, q: string, clientId?: string) => ["vehicles", { page, q, clientId }] as const,
  vehicle: (id: string) => ["vehicles", id] as const,
  vehicleHistory: (id: string) => ["vehicles", id, "history"] as const,
  vehicleWorkOrders: (id: string) => ["vehicles", id, "work-orders"] as const,

  appointments: (day: string) => ["workshop", "appointments", "day", day] as const,
  appointment: (id: string) => ["workshop", "appointments", id] as const,

  workOrders: (page: number, q: string, status?: string) => ["workshop", "work-orders", { page, q, status }] as const,
  workOrder: (id: string) => ["workshop", "work-orders", id] as const,

  quotes: (page: number, q: string, status?: string) => ["quotes", { page, q, status }] as const,
  quote: (id: string) => ["quotes", id] as const,

  parts: (page: number, q: string) => ["inventory", "parts", { page, q }] as const,
  part: (id: string) => ["inventory", "parts", id] as const,
  partMovements: (id: string, page: number) => ["inventory", "parts", id, "movements", page] as const,
  lowStock: ["inventory", "low-stock"] as const,

  payments: () => ["payments"] as const,

  users: (page: number, q: string) => ["users", { page, q }] as const,
  roles: ["users", "roles"] as const,

  branches: ["tenant", "branches"] as const,
  tenant: ["tenant"] as const,
  tenantSettings: ["tenant", "settings"] as const,
  services: (page: number, q: string) => ["workshop", "services", { page, q }] as const,
} as const;
import { apiGet, apiPatch, apiPost, apiDelete } from "@/services/api/http";
import type { Branch, Paginated, Plan, Role, Service, Subscription, TenantSettings, User, TenantRead } from "@/types/domain";

export const tenantApi = {
  get: () => apiGet<TenantRead>("/tenant"),
  update: (payload: { commercial_name?: string; legal_name?: string; tax_id?: string; phone?: string; email?: string; address?: string; country?: string; currency?: string; timezone?: string }) =>
    apiPatch<TenantRead>("/tenant", payload),
  settings: {
    get: () => apiGet<TenantSettings>("/tenant/settings"),
    update: (payload: Partial<TenantSettings>) => apiPatch<TenantSettings>("/tenant/settings", payload),
  },
  plans: () => apiGet<Plan[]>("/tenant/plans"),
  subscription: () => apiGet<Subscription>("/tenant/subscription"),
};

export const branchesApi = {
  list: () => apiGet<Branch[]>("/tenant/branches"),
};

export const usersApi = {
  list: (params: { q?: string; page?: number; page_size?: number }) => apiGet<Paginated<User>>("/users", params),
  get: (id: string) => apiGet<User>(`/users/${id}`),
  create: (payload: { email: string; full_name: string; phone?: string; password: string; role_code?: string }) =>
    apiPost<User>("/users", payload),
  update: (id: string, payload: Partial<User>) => apiPatch<User>(`/users/${id}`, payload),
  roles: () => apiGet<Role[]>("/users/roles"),
  assignRole: (id: string, roleCode: string) => apiPost<void>(`/users/${id}/roles`, { role_code: roleCode }),
  removeRole: (id: string, roleCode: string) => apiDelete<void>(`/users/${id}/roles/${roleCode}`),
};

export const servicesApi = {
  list: (params: { q?: string; page?: number; page_size?: number }) => apiGet<Paginated<Service>>("/workshop/services", params),
  create: (payload: { code?: string; name: string; category?: string; unit?: string; default_price: number; is_active?: boolean }) =>
    apiPost<Service>("/workshop/services", payload),
  update: (id: string, payload: Partial<Service>) => apiPatch<Service>(`/workshop/services/${id}`, payload),
  remove: (id: string) => apiDelete<void>(`/workshop/services/${id}`),
};
import { apiGet, apiPatch, apiPost } from "@/services/api/http";
import type { Paginated, User } from "@/types/domain";

export interface PlatformUser extends User {
  tenant_id: string | null;
  tenant_name: string | null;
}

export interface PlatformTenantCreatePayload {
  company_name: string;
  slug: string;
  admin_email: string;
  admin_full_name: string;
  admin_phone?: string;
  password: string;
  plan_code?: string;
  currency?: string;
  country?: string;
}

export interface PlatformTenantCreated {
  tenant: { id: string; slug: string; commercial_name: string };
  owner_email: string;
  owner_full_name: string;
  plan_code: string | null;
}

export const platformApi = {
  createTenant: (payload: PlatformTenantCreatePayload) => apiPost<PlatformTenantCreated>("/platform/tenants", payload),
  listUsers: (params: { q?: string; page?: number; page_size?: number }) =>
    apiGet<Paginated<PlatformUser>>("/platform/users", params),
  updateUser: (id: string, payload: { full_name?: string; phone?: string; is_active?: boolean }) =>
    apiPatch<PlatformUser>(`/platform/users/${id}`, payload),
  resetPassword: (id: string, password: string) =>
    apiPost<PlatformUser>(`/platform/users/${id}/password`, { password }),
};
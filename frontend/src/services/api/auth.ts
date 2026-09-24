import { apiGet, apiPost } from "@/services/api/http";
import type { TenantRead, TokenPair } from "@/types/domain";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface OnboardingPayload {
  company_name: string;
  slug: string;
  owner_email: string;
  owner_full_name: string;
  owner_phone?: string;
  password: string;
  branch_name?: string;
  branch_code?: string;
  plan_code?: string;
  currency?: string;
  country?: string;
}

export async function login(payload: LoginPayload): Promise<TokenPair> {
  return apiPost<TokenPair>("/auth/login", payload);
}

export async function refreshToken(refresh_token: string): Promise<TokenPair> {
  return apiPost<TokenPair>("/auth/refresh", { refresh_token }, { auth: false });
}

export async function logout(refresh_token: string): Promise<void> {
  await apiPost<null>("/auth/logout", { refresh_token }, { auth: false }).catch(() => null);
}

export async function getMyTenants(): Promise<TenantRead[]> {
  return apiGet<TenantRead[]>("/auth/tenants");
}

export async function selectTenant(tenantId: string): Promise<TokenPair> {
  return apiPost<TokenPair>(`/auth/tenants/${tenantId}/select`);
}

export async function onboarding(payload: OnboardingPayload): Promise<{ tenant: TenantRead; token: TokenPair }> {
  return apiPost("/auth/onboarding", payload);
}
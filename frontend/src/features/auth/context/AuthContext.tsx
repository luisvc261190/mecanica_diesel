import * as React from "react";

import { queryClient } from "@/app/providers/query-client";
import { login as loginApi, logout as logoutApi, refreshToken as refreshTokens, selectTenant as selectTenantApi, getMyTenants, onboarding as onboardingApi } from "@/services/api/auth";
import type { LoginPayload, OnboardingPayload } from "@/services/api/auth";
import { configureAccessToken, configureRefresh } from "@/services/api/http";
import { tokenStore, clearAuthStorage } from "@/services/storage/tokens";
import type { TenantRead, TokenPair, UserSession } from "@/types/domain";

// ── RBAC (espejo de backend/core/permissions.py) ────────────────────────────
export const PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  OWNER: ["*"],
  ADMIN: ["*"],
  SUPERVISOR: [
    "dashboard.view", "clients.view", "clients.create", "clients.update", "vehicles.view", "vehicles.create",
    "vehicles.update", "work_orders.view", "work_orders.create", "work_orders.update_status", "quotes.view",
    "quotes.create", "quotes.approve", "payments.view", "diagnostics.view", "diagnostics.create",
    "inventory.view", "files.upload",
  ],
  RECEPTION: ["dashboard.view", "clients.view", "clients.create", "vehicles.view", "work_orders.view", "quotes.view", "files.upload"],
  TECHNICIAN: ["dashboard.view", "vehicles.view", "work_orders.view", "diagnostics.view", "diagnostics.create", "diagnostics.update", "labor.create", "labor.update", "parts.view", "files.upload"],
  MECHANIC: ["dashboard.view", "vehicles.view", "work_orders.view", "diagnostics.view", "diagnostics.create", "diagnostics.update", "labor.create", "labor.update", "parts.view", "files.upload"],
  WAREHOUSE: ["dashboard.view", "parts.view", "parts.create", "parts.update", "inventory.view", "inventory.movements", "inventory.adjust", "audit.view"],
  CASHIER: ["dashboard.view", "clients.view", "payments.view", "payments.register", "quotes.view", "work_orders.view"],
};

interface AuthContextValue {
  user: UserSession | null;
  accessToken: string | null;
  tenants: TenantRead[];
  selectedTenant: TenantRead | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  login: (payload: LoginPayload) => Promise<TokenPair>;
  onboarding: (payload: OnboardingPayload) => Promise<void>;
  logout: () => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

function inferTenant(pair: TokenPair, list: TenantRead[]): TenantRead | null {
  return list.find((t) => t.id === pair.user.tenant_id) ?? list[0] ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserSession | null>(null);
  const [accessToken, setAccessToken] = React.useState<string | null>(null);
  const [tenants, setTenants] = React.useState<TenantRead[]>([]);
  const [selectedTenant, setSelectedTenant] = React.useState<TenantRead | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Ref espejo del access token: hace que el provider lea el valor ACTUAL de forma
  // síncrona, aunque React aún no haya re-renderizado tras setAccessToken.
  const accessTokenRef = React.useRef<string | null>(null);

  const applyTokenPair = React.useCallback((pair: TokenPair) => {
    tokenStore.refresh.set(pair.refresh_token);
    accessTokenRef.current = pair.access_token;
    setAccessToken(pair.access_token);
    setUser(pair.user);
  }, []);

  React.useEffect(() => {
    configureAccessToken(() => accessTokenRef.current);
  }, []);

  React.useEffect(() => {
    configureRefresh(
      async () => {
        const rt = tokenStore.refresh.get();
        if (!rt) return false;
        try {
          const pair = await refreshTokens(rt);
          applyTokenPair(pair);
          return true;
        } catch {
          return false;
        }
      },
      () => {
        clearAuthStorage();
        accessTokenRef.current = null;
        setUser(null);
        setAccessToken(null);
      },
    );
    return () => configureRefresh(null);
  }, [applyTokenPair]);

  // Restaura la sesión al recargar (si hay refresh token).
  const restore = React.useCallback(async () => {
    const rt = tokenStore.refresh.get();
    if (!rt) {
      setIsLoading(false);
      return;
    }
    try {
      const pair = await refreshTokens(rt);
      applyTokenPair(pair);
      const list = await getMyTenants();
      setTenants(list);
      setSelectedTenant(inferTenant(pair, list));
    } catch {
      clearAuthStorage();
    } finally {
      setIsLoading(false);
    }
  }, [applyTokenPair]);

  React.useEffect(() => {
    void restore();
  }, [restore]);

  const login = React.useCallback(
    async (payload: LoginPayload): Promise<TokenPair> => {
      const pair = await loginApi(payload);
      applyTokenPair(pair);
      const list = await getMyTenants();
      setTenants(list);
      setSelectedTenant(inferTenant(pair, list));
      queryClient.invalidateQueries();
      return pair;
    },
    [applyTokenPair],
  );

  const onboarding = React.useCallback(
    async (payload: OnboardingPayload) => {
      const res = await onboardingApi(payload);
      applyTokenPair(res.token);
      const list = await getMyTenants();
      setTenants(list);
      setSelectedTenant(inferTenant(res.token, list));
      queryClient.invalidateQueries();
    },
    [applyTokenPair],
  );

  const logout = React.useCallback(async () => {
    const rt = tokenStore.refresh.get();
    if (rt) await logoutApi(rt).catch(() => null);
    clearAuthStorage();
    accessTokenRef.current = null;
    setUser(null);
    setAccessToken(null);
    setTenants([]);
    setSelectedTenant(null);
    queryClient.clear();
  }, []);

  const selectTenantFor = React.useCallback(
    async (tenantId: string) => {
      const pair = await selectTenantApi(tenantId);
      applyTokenPair(pair);
      const target = tenants.find((t) => t.id === tenantId) ?? selectedTenant;
      setSelectedTenant(target ?? null);
      queryClient.invalidateQueries();
    },
    [applyTokenPair, tenants, selectedTenant],
  );

  const permissions = React.useMemo(() => {
    if (!user) return [];
    const roles = user.roles ?? [];
    if (roles.some((role) => (PERMISSIONS[role] ?? []).includes("*"))) return ["*"];
    return Array.from(new Set(roles.flatMap((role) => PERMISSIONS[role] ?? [])));
  }, [user]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      tenants,
      selectedTenant,
      isAuthenticated: Boolean(user),
      isLoading,
      permissions,
      login,
      onboarding,
      logout,
      selectTenant: selectTenantFor,
      can: (permission: string) => permissions.includes("*") || permissions.includes(permission),
    }),
    [user, accessToken, tenants, selectedTenant, isLoading, permissions, login, onboarding, logout, selectTenantFor],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
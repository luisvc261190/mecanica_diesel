import * as React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/context/AuthContext";
import { AppLoading } from "@/components/feedback/loading";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user, selectedTenant } = useAuth();
  const location = useLocation();

  if (isLoading) return <AppLoading />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user && !user.is_platform_admin && !selectedTenant) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AppLoading />;
  if (isAuthenticated) return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function PermissionRoute({ permission, children }: { permission: string; children?: React.ReactNode }) {
  const { can } = useAuth();
  const location = useLocation();
  if (!can(permission)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-lg font-medium">No tienes permiso para ver esta sección</p>
        <p className="text-sm text-muted-foreground">Contacta con un administrador si consideras que es un error.</p>
        <a href={`/app?from=${encodeURIComponent(location.pathname)}`} className="text-sm text-primary underline">
          Volver al inicio
        </a>
      </div>
    );
  }
  return <React.Fragment>{children ?? <Outlet />}</React.Fragment>;
}
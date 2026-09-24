import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Menu, Search } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useCommandPalette } from "@/components/layout/command-palette-provider";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { apiGet } from "@/services/api/http";
import { queryKeys } from "@/lib/query-keys";
import { useAuth } from "@/features/auth/context/AuthContext";

interface AppNotification {
  id: string;
  message: string;
  created_at: string;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  clientes: "Clientes",
  vehiculos: "Vehículos",
  citas: "Citas",
  recepciones: "Recepciones",
  diagnosticos: "Diagnósticos",
  cotizaciones: "Cotizaciones",
  ordenes: "Órdenes de trabajo",
  inventario: "Inventario",
  pagos: "Pagos",
  reportes: "Reportes",
  configuracion: "Configuración",
};

function usePageTitle(): string {
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  const section = segments[1] ?? "dashboard";
  const base = PAGE_TITLES[section] ?? "Dashboard";
  if (segments.length > 2) {
    if (section === "cotizaciones") return "Cotización";
    if (section === "ordenes") return "Orden de trabajo";
    if (section === "clientes") return "Detalle de cliente";
    if (section === "vehiculos") return "Detalle de vehículo";
    if (section === "inventario") return "Repuesto";
  }
  return base;
}

function NotificationsPopover() {
  const { selectedTenant } = useAuth();
  const [open, setOpen] = useState(false);

  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => apiGet<{ items: AppNotification[] }>("/dashboard/notifications", { page: 1, page_size: 5 }),
    enabled: open && !!selectedTenant,
  });

  const items = notifications.data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notificaciones">
          <Bell />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {items.length > 0 ? (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              {items.length}
            </span>
          ) : null}
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {notifications.isPending ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Cargando...</div>
          ) : null}
          {!notifications.isPending && items.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">No tienes notificaciones.</div>
          ) : null}
          {items.map((n) => (
            <div key={n.id} className="px-4 py-3">
              <p className="text-sm">{n.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {format(new Date(n.created_at), "d MMM, HH:mm", { locale: es })}
              </p>
            </div>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function Topbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const { open } = useCommandPalette();
  const title = usePageTitle();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileMenu} aria-label="Abrir menú">
        <Menu />
      </Button>

      <span className="min-w-0 text-sm font-semibold">{title}</span>

      <button
        type="button"
        onClick={() => open()}
        className="ml-auto flex h-9 min-w-0 max-w-xs flex-1 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground sm:max-w-[280px]"
        aria-label="Buscar (Ctrl+K)"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">Buscar...</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-2 hidden md:block">
        <TenantSwitcher />
      </div>

      <NotificationsPopover />
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
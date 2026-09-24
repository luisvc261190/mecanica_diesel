import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CornerDownLeft, Search, Users, Truck, Wrench, FileText, Package, LayoutDashboard, Building2, Settings } from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/services/api/http";
import type { Client, Paginated, Vehicle, WorkOrder } from "@/types/domain";
import { cn } from "@/lib/utils";

interface CommandPaletteContextValue {
  open: () => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = React.useContext(CommandPaletteContext);
  if (!ctx) throw new Error("useCommandPalette debe usarse dentro de <AppShell>");
  return ctx;
}

interface SearchResultGroup {
  id: string;
  label: string;
  items: Array<{ id: string; title: string; subtitle?: string; path: string; icon: React.ComponentType<{ className?: string }> }>;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const open = React.useCallback(() => setIsOpen(true), []);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandPaletteContext.Provider value={{ open }}>
      {children}
      {isOpen ? <GlobalSearchDialog onClose={() => setIsOpen(false)} /> : null}
    </CommandPaletteContext.Provider>
  );
}

function GlobalSearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const search = useQuery({
    queryKey: ["global-search", query],
    queryFn: async () => {
      const q = { q: query, page_size: 3 };
      const [clients, vehicles, workOrders] = await Promise.all([
        apiGet<Paginated<Client>>("/clients", q),
        apiGet<Paginated<Vehicle>>("/vehicles", q),
        apiGet<Paginated<WorkOrder>>("/workshop/work-orders", q),
      ]);
      return { clients, vehicles, workOrders };
    },
    enabled: query.trim().length >= 2,
    staleTime: 0,
  });

  const groups = React.useMemo<SearchResultGroup[]>(() => {
    const list: SearchResultGroup[] = [];
    const data = search.data;
    if (data) {
      if (data.clients.items.length > 0) {
        list.push({
          id: "clients",
          label: "Clientes",
          items: data.clients.items.slice(0, 4).map((c) => ({
            id: c.id,
            title: c.first_name || c.company_name || c.client_code || "Cliente",
            subtitle: c.doc_number ? `${c.doc_type ?? ""} ${c.doc_number}` : c.phone ?? undefined,
            path: `/app/clientes/${c.id}`,
            icon: Users,
          })),
        });
      }
      if (data.vehicles.items.length > 0) {
        list.push({
          id: "vehicles",
          label: "Vehículos",
          items: data.vehicles.items.slice(0, 4).map((v) => ({
            id: v.id,
            title: v.plate ?? v.vin ?? "Vehículo",
            subtitle: `${v.year ?? ""} ${v.odometer ?? ""} km`.trim(),
            path: `/app/vehiculos/${v.id}`,
            icon: Truck,
          })),
        });
      }
      if (data.workOrders.items.length > 0) {
        list.push({
          id: "work-orders",
          label: "Órdenes de trabajo",
          items: data.workOrders.items.slice(0, 4).map((w) => ({
            id: w.id,
            title: w.number ?? "OT",
            subtitle: w.status,
            path: `/app/ordenes/${w.id}`,
            icon: Wrench,
          })),
        });
      }
    }
    return list;
  }, [search.data]);

  const actions: SearchResultGroup = {
    id: "actions",
    label: "Acciones",
    items: [
      { id: "go-dashboard", title: "Ir al dashboard", path: "/app/dashboard", icon: LayoutDashboard },
      { id: "go-clients", title: "Ir a clientes", path: "/app/clientes", icon: Users },
      { id: "go-vehicles", title: "Ir a vehículos", path: "/app/vehiculos", icon: Truck },
      { id: "go-work-orders", title: "Ir a órdenes", path: "/app/ordenes", icon: Wrench },
      { id: "go-quotes", title: "Ir a cotizaciones", path: "/app/cotizaciones", icon: FileText },
      { id: "go-inventory", title: "Ir a inventario", path: "/app/inventario", icon: Package },
      { id: "go-reports", title: "Ir a reportes", path: "/app/reportes", icon: LayoutDashboard },
      { id: "go-branches", title: "Configuración", path: "/app/configuracion", icon: Building2 },
      { id: "logout", title: "Cerrar sesión", path: "/login", icon: Settings },
    ],
  };

  const hasResults = query.trim().length >= 2 && groups.length > 0;
  const showActionsOnly = query.trim().length < 2;

  const groupsToRender: SearchResultGroup[] = showActionsOnly ? [actions] : hasResults ? [...groups, actions] : [];

  const totalItems = groupsToRender.reduce((acc, g) => acc + g.items.length, 0);

  React.useEffect(() => {
    setSelected(0);
  }, [query]);

  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      const target = groupsToRender.flatMap((g) => g.items)[selected];
      if (target) go(target.path);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((s) => Math.min(s + 1, totalItems - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (event.key === "Escape") {
      onClose();
    }
  }

  let flat = 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="top-[15%] max-w-xl translate-y-0 p-0">
        <DialogTitle className="sr-only">Búsqueda global</DialogTitle>
        <DialogDescription className="sr-only">
          Busca clientes, vehículos, órdenes de trabajo y cotizaciones.
        </DialogDescription>
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar clientes, placas, VIN, órdenes..."
            className="h-12 border-0 bg-transparent px-0 focus-visible:ring-0"
            aria-label="Buscar"
          />
        </div>
        {search.isPending && query.trim().length >= 2 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">Buscando...</div>
        ) : null}
        {!search.isPending && query.trim().length >= 2 && groups.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground">Sin resultados para "{query}"</div>
        ) : null}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {groupsToRender.map((group) => (
            <div key={group.id} className="mb-1">
              <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
                const index = flat++;
                const isActive = index === selected;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => go(item.path)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm",
                      isActive ? "bg-accent text-accent-foreground" : "text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.title}</span>
                      {item.subtitle ? (
                        <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                      ) : null}
                    </span>
                    {isActive ? <CornerDownLeft className="size-3.5 text-muted-foreground" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
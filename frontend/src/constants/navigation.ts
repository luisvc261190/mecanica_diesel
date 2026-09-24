import {
  LayoutDashboard,
  Users,
  Truck,
  CalendarClock,
  ClipboardList,
  Stethoscope,
  FileText,
  Wrench,
  Package,
  HandCoins,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  permission?: string;
  end?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Dashboard", path: "/app/dashboard", icon: LayoutDashboard, end: true, permission: "dashboard.view" }],
  },
  {
    title: "Clientes",
    items: [
      { label: "Clientes", path: "/app/clientes", icon: Users, permission: "clients.view" },
      { label: "Vehículos", path: "/app/vehiculos", icon: Truck, permission: "vehicles.view" },
    ],
  },
  {
    title: "Taller",
    items: [
      { label: "Citas", path: "/app/citas", icon: CalendarClock },
      { label: "Recepciones", path: "/app/recepciones", icon: ClipboardList },
      { label: "Diagnósticos", path: "/app/diagnosticos", icon: Stethoscope },
      { label: "Cotizaciones", path: "/app/cotizaciones", icon: FileText, permission: "quotes.view" },
      { label: "Órdenes", path: "/app/ordenes", icon: Wrench, permission: "work_orders.view" },
    ],
  },
  {
    title: "Operación",
    items: [
      { label: "Inventario", path: "/app/inventario", icon: Package, permission: "inventory.view" },
      { label: "Pagos", path: "/app/pagos", icon: HandCoins, permission: "payments.view" },
      { label: "Reportes", path: "/app/reportes", icon: BarChart3 },
    ],
  },
  {
    items: [{ label: "Configuración", path: "/app/configuracion", icon: Settings, permission: "users.manage" }],
  },
];
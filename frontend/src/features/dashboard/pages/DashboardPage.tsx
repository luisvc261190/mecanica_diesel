import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  FileText,
  Package,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { WORK_ORDER_STATUS } from "@/constants/status";
import { useAuth } from "@/features/auth/context/AuthContext";
import { apiGet } from "@/services/api/http";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { DashboardSummary, Paginated, WorkOrder } from "@/types/domain";

export function DashboardPage() {
  const { selectedTenant, user } = useAuth();
  const navigate = useNavigate();

  const summary = useQuery({
    queryKey: ["dashboard", "summary", selectedTenant?.id],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
    enabled: !!selectedTenant,
  });

  const recent = useQuery({
    queryKey: ["dashboard", "recent-work-orders", selectedTenant?.id],
    queryFn: () => apiGet<Paginated<WorkOrder>>("/workshop/work-orders", { page: 1, page_size: 6 }),
    enabled: !!selectedTenant,
  });

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: es });

  const data = summary.data;
  const flow = [
    { label: "Pendientes (recibidas / cotizadas)", count: data?.work_orders_open ?? 0, status: "RECEIVED", filter: "RECEIVED" },
    { label: "En reparación", count: data?.work_orders_in_progress ?? 0, status: "IN_PROGRESS", filter: "IN_PROGRESS" },
    { label: "Listas / por entregar", count: data?.work_orders_ready ?? 0, status: "READY_FOR_PICKUP", filter: "READY_FOR_PICKUP" },
  ];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title={`Hola, ${user?.full_name?.split(" ")[0] ?? "bienvenido"} 👋`}
        description={`${selectedTenant?.commercial_name ?? "Resumen"} · ${today}`}
      />

      {summary.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
<StatCard
              label="OTs abiertas"
              value={formatNumber(data.work_orders_open)}
              hint={`${formatNumber(data.work_orders_in_progress)} en proceso`}
              icon={<Wrench />}
            />
            <StatCard
              label="Clientes"
              value={formatNumber(data.clients_total)}
              hint={`${formatNumber(data.vehicles_total)} vehículos`}
              icon={<Users />}
            />
            <StatCard
              label="Ingresos de hoy"
              value={formatCurrency(data.revenue_today)}
              hint={`${formatNumber(data.appointments_today)} citas hoy`}
              icon={<BadgeDollarSign />}
              tone="success"
            />
            <StatCard
              label="Repuestos críticos"
              value={formatNumber(data.parts_low_stock)}
              hint={`${formatNumber(data.parts_total)} repuestos en stock`}
              icon={<Package />}
              tone={data.parts_low_stock > 0 ? "warning" : "success"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Flujo del taller</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/app/ordenes")}>
                  Ver todas
                  <ArrowRight />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {flow.map((stage) => (
                    <button
                      key={stage.status}
                      type="button"
                      onClick={() => navigate(`/app/ordenes?status=${stage.filter}`)}
                      className="rounded-lg border p-4 text-left transition-colors hover:bg-accent/50"
                    >
                      <StatusBadge meta={WORK_ORDER_STATUS[stage.status] ?? stage.status} />
                      <p className="mt-2 text-2xl font-bold">{formatNumber(stage.count)}</p>
                      <p className="text-xs text-muted-foreground">{stage.label}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Pendientes</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/app/cotizaciones")}>
                  <FileText />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <span>Cotizaciones por aprobar</span>
                  </div>
                  <span className="font-semibold">{formatNumber(data.quotes_pending)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    <span>Citas agendadas</span>
                  </div>
                  <span className="font-semibold">{formatNumber(data.appointments_scheduled)}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 text-muted-foreground" />
                    <span>Técnicos activos</span>
                  </div>
                  <span className="font-semibold">{formatNumber(data.technicians_active)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Órdenes recientes</CardTitle>
            </CardHeader>
            <CardContent>
              {recent.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : null}
              {recent.data?.items.length ? (
                <div className="divide-y">
                  {recent.data.items.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => navigate(`/app/ordenes/${order.id}`)}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-accent/40"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{order.number ?? "OT"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {format(new Date(order.opened_at), "d MMM yyyy', 'HH:mm", { locale: es })}
                        </span>
                      </span>
                      <StatusBadge label={WORK_ORDER_STATUS[order.status]?.label ?? order.status} />
                    </button>
                  ))}
                </div>
              ) : !recent.isPending ? (
                <div className="py-6 text-center">
                  <p className="text-sm text-muted-foreground">Aún no hay órdenes de trabajo.</p>
                  <Button className="mt-3" size="sm" onClick={() => navigate("/app/recepciones")}>
                    Crear primera OT
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
export default DashboardPage;

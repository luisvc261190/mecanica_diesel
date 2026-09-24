import { useQuery } from "@tanstack/react-query";
import { BarChart3, BadgeDollarSign, CalendarClock, Package, Users, Wrench } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/shared/data-table";
import { appointmentsApi } from "@/features/appointments/api";
import { workOrdersApi } from "@/features/work-orders/api";
import { inventoryApi } from "@/features/inventory/api";
import { WORK_ORDER_FLOW, WORK_ORDER_STATUS } from "@/constants/status";
import { apiGet } from "@/services/api/http";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { DashboardSummary, WorkOrder } from "@/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

export function ReportsPage() {
  const summary = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
  });

  const woCounts = useQuery({ queryKey: ["work-orders", "counts"], queryFn: workOrdersApi.counts });
  const apptCounts = useQuery({ queryKey: ["appointments", "counts"], queryFn: appointmentsApi.counts });
  const lowStock = useQuery({ queryKey: ["inventory", "low-stock"], queryFn: inventoryApi.lowStock });
  const recent = useQuery({
    queryKey: ["work-orders", "recent"],
    queryFn: () => workOrdersApi.list({ page: 1, page_size: 10 }),
  });

  const columns: Array<ColumnDef<WorkOrder>> = [
    {
      id: "ot",
      header: "OT",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.number ?? row.original.id.slice(0, 8)}</span>,
    },
    { accessorKey: "status", header: "Estado", cell: ({ row }) => <StatusBadge meta={WORK_ORDER_STATUS[row.original.status]} /> },
    {
      id: "total",
      header: "Total",
      cell: ({ row }) => <span className="tabular">{formatCurrency(Number(row.original.total))}</span>,
    },
  ];

  const data = summary.data;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader title="Reportes" description="Indicadores del taller y actividad reciente." icon={<BarChart3 />} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Wrench />} label="OT abiertas" value={formatNumber(data?.work_orders_open ?? 0)} loading={summary.isPending} />
        <StatCard icon={<Users />} label="Clientes" value={formatNumber(data?.clients_total ?? 0)} loading={summary.isPending} />
        <StatCard icon={<BadgeDollarSign />} label="Cotizaciones pendientes" value={formatNumber(data?.quotes_pending ?? 0)} loading={summary.isPending} />
        <StatCard icon={<Package />} label="Repuestos con bajo stock" value={formatNumber(lowStock.data?.length ?? 0)} loading={lowStock.isPending} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-4" />
              Órdenes por estado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {WORK_ORDER_FLOW.map((s) => {
              const count = woCounts.data?.[s] ?? 0;
              return (
                <div key={s} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <StatusBadge meta={WORK_ORDER_STATUS[s]} />
                  <span className="tabular font-semibold">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4" />
              Citas por estado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {apptCounts.data
              ? Object.entries(apptCounts.data).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <StatusBadge meta={{ label: status, tone: "default" }} />
                    <span className="tabular font-semibold">{count}</span>
                  </div>
                ))
              : <p className="text-sm text-muted-foreground">Cargando...</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Órdenes de trabajo recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={recent.data?.items ?? []}
            loading={recent.isPending}
            error={recent.isError}
            onRetry={() => void recent.refetch()}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default ReportsPage;
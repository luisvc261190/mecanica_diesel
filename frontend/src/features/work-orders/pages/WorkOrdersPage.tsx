import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Wrench } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { WorkOrderCreateDialog } from "@/features/work-orders/components/WorkOrderCreateDialog";
import { workOrdersApi } from "@/features/work-orders/api";
import { clientsApi } from "@/features/clients/api";
import { WORK_ORDER_PRIORITY, WORK_ORDER_STATUS } from "@/constants/status";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useAuth } from "@/features/auth/context/AuthContext";
import { cn } from "@/lib/utils";
import type { Client, WorkOrder } from "@/types/domain";

function ClientName({ clientId }: { clientId: string }) {
  const client = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => clientsApi.get(clientId),
    retry: false,
  });
  const c = client.data as Client | undefined;
  if (!c) return <span className="text-muted-foreground">{clientId.slice(0, 8)}</span>;
  return (
    <span className="font-medium">
      {c.client_type === "COMPANY" ? c.company_name : `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
    </span>
  );
}

const STATUS_TABS = [
  { label: "Todas", value: "ALL" },
  ...Object.entries(WORK_ORDER_STATUS).map(([value, meta]) => ({ label: meta.label, value })),
];

export function WorkOrdersPage() {
  const navigate = useNavigate();
  const { can, selectedTenant } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const statusParam = searchParams.get("status") ?? "ALL";

  const orders = useQuery({
    queryKey: ["work-orders", "list", statusParam, search, page, selectedTenant?.id],
    queryFn: () =>
      workOrdersApi.list({
        status: statusParam === "ALL" ? undefined : statusParam,
        q: search || undefined,
        page,
        page_size: 15,
      }),
  });

  const counts = useQuery({
    queryKey: ["work-orders", "counts", selectedTenant?.id],
    queryFn: workOrdersApi.counts,
  });

  const columns: Array<ColumnDef<WorkOrder>> = [
    {
      id: "numero",
      header: "N°",
      cell: ({ row }) => (
        <button type="button" onClick={() => navigate(`/app/ordenes/${row.original.id}`)} className="font-mono font-medium hover:underline">
          {row.original.number ?? row.original.id.slice(0, 8)}
        </button>
      ),
    },
    {
      id: "cliente",
      header: "Cliente",
      cell: ({ row }) => <ClientName clientId={row.original.client_id} />,
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => <StatusBadge meta={WORK_ORDER_STATUS[row.original.status]} />,
    },
    {
      id: "prioridad",
      header: "Prioridad",
      cell: ({ row }) => (
        <StatusBadge meta={WORK_ORDER_PRIORITY[row.original.priority]} label={WORK_ORDER_PRIORITY[row.original.priority]?.label} />
      ),
    },
    {
      id: "abierta",
      header: "Abierta",
      cell: ({ row }) => <span className="text-muted-foreground">{formatDateTime(row.original.opened_at)}</span>,
    },
    {
      id: "total",
      header: () => <span className="text-right">Total</span>,
      cell: ({ row }) => <span className="font-medium tabular">{formatCurrency(row.original.total)}</span>,
    },
    {
      id: "acciones",
      header: () => <span className="sr-only">Abrir</span>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/app/ordenes/${row.original.id}`)}>
            Ver
          </Button>
        </div>
      ),
    },
  ];

  const setStatus = (value: string) => {
    setPage(1);
    if (value === "ALL") {
      const next = new URLSearchParams(searchParams);
      next.delete("status");
      setSearchParams(next, { replace: true });
    } else {
      setSearchParams({ status: value }, { replace: true });
    }
  };

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Órdenes de trabajo"
        description="Gestiona el flujo del taller de punta a punta."
        icon={<Wrench />}
        actions={
          can("work_orders.create") ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Nueva OT
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => {
            const active = statusParam === tab.value;
            const count = tab.value === "ALL" ? null : counts.data?.[tab.value];
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {tab.label}
                {count !== undefined && count !== null ? <span className="ml-1.5 text-xs opacity-80">({count})</span> : null}
              </button>
            );
          })}
        </div>

        <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por número de OT..." className="sm:w-72" />
      </div>

      <DataTable
        columns={columns}
        data={orders.data?.items ?? []}
        loading={orders.isPending}
        error={orders.isError}
        onRetry={() => void orders.refetch()}
        emptyTitle="Sin órdenes de trabajo"
        emptyDescription="Crea tu primera OT iniciando una recepción o con 'Nueva OT'."
        page={page}
        pageSize={15}
        total={orders.data?.total ?? 0}
        onPageChange={setPage}
      />

      <WorkOrderCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(wo) => navigate(`/app/ordenes/${wo.id}`)}
      />
    </div>
  );
}

export default WorkOrdersPage;
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { FileText, Plus } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { quotesApi } from "@/features/quotes/api";
import { clientsApi } from "@/features/clients/api";
import { QUOTE_STATUS } from "@/constants/status";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuth } from "@/features/auth/context/AuthContext";
import type { Quote } from "@/types/domain";

function ClientName({ clientId }: { clientId: string }) {
  const client = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => clientsApi.get(clientId),
    retry: false,
  });
  const c = client.data;
  if (!c) return <span className="text-muted-foreground">{clientId.slice(0, 8)}</span>;
  return (
    <span className="font-medium">
      {c.client_type === "COMPANY" ? c.company_name : `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
    </span>
  );
}

export function QuotesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);

  const quotes = useQuery({
    queryKey: ["quotes", "list", status, page],
    queryFn: () => quotesApi.list({ status: status === "ALL" ? undefined : status, page, page_size: 15 }),
  });

  const columns: Array<ColumnDef<Quote>> = [
    {
      id: "numero",
      header: "N°",
      cell: ({ row }) => (
        <button type="button" onClick={() => navigate(`/app/cotizaciones/${row.original.id}`)} className="font-mono font-medium hover:underline">
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
      cell: ({ row }) => <StatusBadge meta={QUOTE_STATUS[row.original.status]} />,
    },
    {
      id: "creada",
      header: "Creada",
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.created_at)}</span>,
    },
    {
      id: "valida",
      header: "Válida hasta",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.valid_until ? formatDate(row.original.valid_until) : "—"}</span>,
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
          <Button variant="ghost" size="sm" onClick={() => navigate(`/app/cotizaciones/${row.original.id}`)}>
            Ver
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Cotizaciones"
        description="Presupuestos de servicios y repuestos."
        icon={<FileText />}
        actions={
          can("quotes.create") ? (
            <Button onClick={() => navigate("/app/cotizaciones/nueva")}>
              <Plus />
              Nueva cotización
            </Button>
          ) : null
        }
      />

      <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos los estados</SelectItem>
          {Object.entries(QUOTE_STATUS).map(([key, meta]) => (
            <SelectItem key={key} value={key}>
              {meta.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={quotes.data?.items ?? []}
        loading={quotes.isPending}
        error={quotes.isError}
        onRetry={() => void quotes.refetch()}
        emptyTitle="Sin cotizaciones"
        emptyDescription="Crea la primera cotización con 'Nueva cotización'."
        page={page}
        pageSize={15}
        total={quotes.data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}

export default QuotesPage;
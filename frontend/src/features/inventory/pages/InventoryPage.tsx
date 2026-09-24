import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { inventoryApi } from "@/features/inventory/api";
import { PartFormDialog } from "@/features/inventory/components/PartFormDialog";
import { PART_STATUS } from "@/constants/status";
import { formatCurrency } from "@/lib/format";
import { getApiErrorMessage } from "@/services/api/http";
import { useAuth } from "@/features/auth/context/AuthContext";
import type { Part } from "@/types/domain";

export function InventoryPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [deleting, setDeleting] = useState<Part | null>(null);

  const parts = useQuery({
    queryKey: ["inventory", "parts", "list", search, page],
    queryFn: () => inventoryApi.list({ q: search || undefined, page, page_size: 15 }),
  });

  const lowStock = useQuery({
    queryKey: ["inventory", "low-stock"],
    queryFn: inventoryApi.lowStock,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.remove(id),
    onSuccess: () => {
      toast.success("Repuesto eliminado");
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setDeleting(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const lowCount = lowStock.data?.length ?? 0;

  const columns: Array<ColumnDef<Part>> = [
    {
      id: "nombre",
      header: "Repuesto",
      cell: ({ row }) => (
        <button type="button" onClick={() => navigate(`/app/inventario/${row.original.id}`)} className="text-left hover:underline">
          <span className="block font-medium">{row.original.name}</span>
          <span className="block font-mono text-xs text-muted-foreground">{row.original.sku}</span>
        </button>
      ),
    },
    {
      accessorKey: "brand",
      header: "Marca",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.brand ?? "—"}</span>,
    },
    {
      id: "precio",
      header: "Precios",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          Venta <span className="font-medium text-foreground">{formatCurrency(row.original.sale_price)}</span>
        </span>
      ),
    },
    {
      id: "stock",
      header: "Punto pedido",
      cell: ({ row }) => <span className="text-muted-foreground">{Number(row.original.reorder_level ?? 0)}</span>,
    },
    {
      id: "ubicacion",
      header: "Ubicación",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.location ?? "—"}</span>,
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => <StatusBadge meta={PART_STATUS[row.original.status]} />,
    },
    {
      id: "acciones",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex justify-end gap-1">
            {can("parts.update") ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Editar"
                onClick={() => {
                  setEditing(p);
                  setFormOpen(true);
                }}
              >
                <Pencil />
              </Button>
            ) : null}
            {can("parts.create") ? (
              <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Eliminar" onClick={() => setDeleting(p)}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Inventario"
        description="Repuestos, precios y niveles de stock."
        icon={<Package />}
        actions={
          can("parts.create") ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Nuevo repuesto
            </Button>
          ) : null
        }
      />

      {lowCount > 0 ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex flex-wrap items-center gap-3 py-3">
            <AlertTriangle className="size-5 text-warning" />
            <p className="flex-1 text-sm">
              <span className="font-semibold">{lowCount} repuesto(s)</span> por debajo del punto de pedido. Revisa el stock y repón cuando sea necesario.
            </p>
            <Badge variant="warning">{lowCount}</Badge>
          </CardContent>
        </Card>
      ) : null}

      <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por SKU, nombre o marca..." className="sm:w-72" />

      <DataTable
        columns={columns}
        data={parts.data?.items ?? []}
        loading={parts.isPending}
        error={parts.isError}
        onRetry={() => void parts.refetch()}
        emptyTitle="Sin repuestos registrados"
        emptyDescription="Crea tu primer repuesto con 'Nuevo repuesto'."
        page={page}
        pageSize={15}
        total={parts.data?.total ?? 0}
        onPageChange={setPage}
      />

      <PartFormDialog open={formOpen} onOpenChange={setFormOpen} part={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Eliminar ${deleting?.name ?? "el repuesto"}?`}
        description="Se quitará del catálogo. Los movimientos históricos se conservan."
        confirmLabel="Eliminar"
        tone="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

export default InventoryPage;
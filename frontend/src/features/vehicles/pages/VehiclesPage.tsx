import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useAuth } from "@/features/auth/context/AuthContext";
import { vehiclesApi } from "@/features/vehicles/api";
import { VehicleFormDialog } from "@/features/vehicles/components/VehicleFormDialog";
import { formatPlate } from "@/lib/format";
import { getApiErrorMessage } from "@/services/api/http";
import type { Vehicle } from "@/types/domain";

export function VehiclesPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

  const vehicles = useQuery({
    queryKey: ["vehicles", "list", search, page],
    queryFn: () =>
      vehiclesApi.list({
        q: search || undefined,
        page,
        page_size: 15,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => vehiclesApi.remove(id),
    onSuccess: () => {
      toast.success("Vehículo eliminado");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setDeleting(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Array<ColumnDef<Vehicle>> = [
    {
      id: "placa",
      header: "Placa",
      cell: ({ row }) => <span className="font-mono font-semibold">{formatPlate(row.original.plate)}</span>,
    },
    {
      id: "identificacion",
      header: "Identificación",
      cell: ({ row }) => {
        const v = row.original;
        return (
          <span className="block text-muted-foreground">
            {v.vin ? `VIN ${v.vin}` : v.engine_number ? `Motor ${v.engine_number}` : "—"}
          </span>
        );
      },
    },
    {
      id: "anio",
      header: "Año",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.year ?? "—"}</span>,
    },
    {
      id: "color",
      header: "Color",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.color ?? "—"}</span>,
    },
    {
      id: "odometro",
      header: "Odómetro",
      cell: ({ row }) => <span className="text-muted-foreground">{Number(row.original.odometer).toLocaleString("es-PE")} km</span>,
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => <StatusBadge label={row.original.status} />,
    },
    {
      id: "acciones",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const v = row.original;
        return (
          <div className="flex justify-end gap-1">
            {can("vehicles.update") ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Editar"
                onClick={() => {
                  setEditing(v);
                  setFormOpen(true);
                }}
              >
                <Pencil />
              </Button>
            ) : null}
            {can("vehicles.create") ? (
              <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Eliminar" onClick={() => setDeleting(v)}>
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
        title="Vehículos"
        description="Flota atendida por tu taller, asociada a clientes."
        icon={<Truck />}
        actions={
          can("vehicles.create") ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus />
              Registrar vehículo
            </Button>
          ) : null
        }
      />

      <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por placa, VIN o motor..." className="sm:w-72" />

      <DataTable
        columns={columns}
        data={vehicles.data?.items ?? []}
        loading={vehicles.isPending}
        error={vehicles.isError}
        onRetry={() => void vehicles.refetch()}
        emptyTitle="No hay vehículos registrados"
        emptyDescription="Registra el primer vehículo de tu flota."
        page={page}
        pageSize={15}
        total={vehicles.data?.total ?? 0}
        onPageChange={setPage}
      />

      <VehicleFormDialog open={formOpen} onOpenChange={setFormOpen} vehicle={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Eliminar el vehículo ${formatPlate(deleting?.plate) ?? "—"}?`}
        description="Se quitará de tu registro. Considera marcarlo como INACTIVE si tiene historial."
        confirmLabel="Eliminar"
        tone="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

export default VehiclesPage;

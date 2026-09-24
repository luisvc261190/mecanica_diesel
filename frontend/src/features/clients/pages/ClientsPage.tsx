import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/context/AuthContext";
import { ClientFormDialog } from "@/features/clients/components/ClientFormDialog";
import { clientsApi } from "@/features/clients/api";
import { getApiErrorMessage } from "@/services/api/http";
import { DOC_TYPE } from "@/constants/status";
import type { Client } from "@/types/domain";

export function ClientsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [clientType, setClientType] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const clients = useQuery({
    queryKey: ["clients", "list", search, clientType, page],
    queryFn: () =>
      clientsApi.list({
        q: search || undefined,
        client_type: clientType === "ALL" ? undefined : clientType,
        page,
        page_size: 15,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientsApi.remove(id),
    onSuccess: () => {
      toast.success("Cliente eliminado");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeleting(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const columns: Array<ColumnDef<Client>> = [
    {
      id: "nombre",
      header: () => <span>Cliente</span>,
      cell: ({ row }) => {
        const c = row.original;
        const name = c.client_type === "COMPANY" && c.company_name ? c.company_name : `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
        return (
          <button type="button" onClick={() => navigate(`/app/clientes/${c.id}`)} className="text-left hover:underline">
            <span className="block font-medium">{name || "—"}</span>
            {c.client_code ? <span className="block text-xs text-muted-foreground">{c.client_code}</span> : null}
          </button>
        );
      },
    },
    {
      accessorKey: "doc_number",
      header: "Documento",
      cell: ({ row }) => {
        const c = row.original;
        return (
          <span className="text-muted-foreground">
            {c.doc_type ? (DOC_TYPE[c.doc_type] ?? c.doc_type) : "—"} {c.doc_number ?? ""}
          </span>
        );
      },
    },
    {
      accessorKey: "phone",
      header: "Teléfono",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.phone ?? "—"}</span>,
    },
    {
      id: "ubicacion",
      header: "Ubicación",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {[row.original.city, row.original.address].filter(Boolean).join(", ") || "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => <StatusBadge label={row.original.status === "ACTIVE" ? "Activo" : "Inactivo"} dot={row.original.status === "ACTIVE"} />,
    },
    {
      id: "acciones",
      header: () => <span className="sr-only">Acciones</span>,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Acciones de ${c.id}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/app/clientes/${c.id}`)}>
                Ver detalle
              </DropdownMenuItem>
              {can("clients.update") ? (
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(c);
                    setFormOpen(true);
                  }}
                >
                  <Pencil />
                  Editar
                </DropdownMenuItem>
              ) : null}
              {can("clients.create") ? (
                <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(c)}>
                  <Trash2 />
                  Eliminar
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Clientes"
        description="Registro de personas y empresas que atiende tu taller."
        icon={<Users />}
        actions={
          can("clients.create") ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <UserPlus />
              Nuevo cliente
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} placeholder="Buscar por nombre, código o documento..." className="sm:w-72" />
        <Select value={clientType} onValueChange={(v) => { setClientType(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los tipos</SelectItem>
            <SelectItem value="PERSON">Personas</SelectItem>
            <SelectItem value="COMPANY">Empresas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={clients.data?.items ?? []}
        loading={clients.isPending}
        error={clients.isError}
        onRetry={() => void clients.refetch()}
        emptyTitle="No hay clientes registrados"
        emptyDescription="Crea tu primer cliente con el botón 'Nuevo cliente'."
        page={page}
        pageSize={15}
        total={clients.data?.total ?? 0}
        onPageChange={setPage}
      />

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Eliminar a ${deleting ? (deleting.company_name ?? `${deleting.first_name ?? ""} ${deleting.last_name ?? ""}`.trim() ?? "este cliente") : ""}?`}
        description="Esta acción no se puede deshacer. Considera inhabilitarlo si tiene historial."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        tone="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
export default ClientsPage;

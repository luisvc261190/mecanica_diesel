import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Mail, MapPin, Pencil, Phone, Plus, Trash2, Truck, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { clientsApi } from "@/features/clients/api";
import { ClientFormDialog } from "@/features/clients/components/ClientFormDialog";
import { VehicleFormDialog } from "@/features/vehicles/components/VehicleFormDialog";
import { getApiErrorMessage } from "@/services/api/http";
import { DOC_TYPE } from "@/constants/status";
import { useAuth } from "@/features/auth/context/AuthContext";
import { format } from "date-fns";

export function ClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [removeContactId, setRemoveContactId] = useState<string | null>(null);

  const client = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => clientsApi.get(clientId!),
    enabled: Boolean(clientId),
  });

  const vehicles = useQuery({
    queryKey: ["vehicles", "by-client", clientId],
    queryFn: () => clientsApi.vehicles(clientId!),
    enabled: Boolean(clientId),
  });

  const contacts = useQuery({
    queryKey: ["clients", clientId, "contacts"],
    queryFn: () => clientsApi.contacts(clientId!),
    enabled: Boolean(clientId),
  });

  const removeContact = async (contactId: string) => {
    try {
      await clientsApi.removeContact(clientId!, contactId);
      toast.success("Contacto eliminado");
      void contacts.refetch();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setRemoveContactId(null);
    }
  };

  if (client.isError) return <ErrorState onRetry={() => void client.refetch()} className="p-6" />;

  const c = client.data;
  const displayName = c
    ? c.client_type === "COMPANY" && c.company_name
      ? c.company_name
      : `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()
    : "";

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate("/app/clientes")} aria-label="Atrás">
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{displayName || "Cliente"}</h1>
          <p className="text-sm text-muted-foreground">
            {c?.client_code} · {c?.client_type === "COMPANY" ? "Empresa" : "Persona"} ·{" "}
            {c ? format(new Date(), "yyyy") : ""}
          </p>
        </div>
        {can("clients.update") ? (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            Editar
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {c?.client_type === "COMPANY" ? <Building2 className="size-4 text-muted-foreground" /> : <UserIcon className="size-4 text-muted-foreground" />}
              Información
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              <span>{c?.phone ?? "Sin teléfono"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <span>{c?.email ?? "Sin correo"}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{[c?.address, c?.city].filter(Boolean).join(", ") ?? "Sin dirección"}</span>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">Documento</p>
            <p className="font-medium">
              {c?.doc_type ? (DOC_TYPE[c.doc_type] ?? c.doc_type) : "—"} {c?.doc_number ?? ""}
            </p>
            {c?.notes ? (
              <>
                <Separator />
                <p className="text-xs text-muted-foreground">Notas</p>
                <p>{c.notes}</p>
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Tabs defaultValue="vehiculos">
            <TabsList>
              <TabsTrigger value="vehiculos">Vehículos ({vehicles.data?.total ?? 0})</TabsTrigger>
              <TabsTrigger value="contactos">Contactos ({contacts.data?.length ?? 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="vehiculos" className="mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Vehículos asociados a este cliente.</p>
                {can("vehicles.create") ? (
                  <Button size="sm" onClick={() => setAddVehicleOpen(true)}>
                    <Plus />
                    Registrar
                  </Button>
                ) : null}
              </div>
              <div className="mt-3 space-y-2">
                {vehicles.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                {!vehicles.isPending && vehicles.data?.items.length === 0 ? (
                  <EmptyState title="Sin vehículos" description="Registra el primer vehículo de este cliente." />
                ) : null}
                {vehicles.data?.items.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => navigate(`/app/vehiculos/${v.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <Truck className="size-5 text-muted-foreground" />
                    <span className="flex-1">
                      <span className="block font-mono font-semibold">{v.plate ?? v.vin ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {v.year ?? "—"} · {v.color ?? "—"} · {Number(v.odometer).toLocaleString("es-PE")} km
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="contactos" className="mt-4 space-y-2">
              {contacts.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
              {!contacts.isPending && contacts.data?.length === 0 ? (
                <EmptyState title="Sin contactos" description="Puedes agregar contactos de referencia." />
              ) : null}
              {contacts.data?.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {contact.full_name} {contact.is_primary ? <span className="text-xs text-primary">· Principal</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {contact.phone ?? "—"} · {contact.email ?? "—"}
                    </p>
                  </div>
                  {can("clients.update") ? (
                    <Button variant="ghost" size="icon-sm" className="text-destructive" aria-label="Eliminar contacto" onClick={() => setRemoveContactId(contact.id)}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={c} />

      <VehicleFormDialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen} presetClientId={clientId} onSuccess={() => void vehicles.refetch()} />

      <ConfirmDialog
        open={Boolean(removeContactId)}
        onOpenChange={(o) => !o && setRemoveContactId(null)}
        title="¿Eliminar contacto?"
        description="Se quitará la referencia de contacto de este cliente."
        confirmLabel="Eliminar"
        tone="destructive"
        onConfirm={() => removeContactId && void removeContact(removeContactId)}
      />
    </div>
  );
}

export default ClientDetailPage;
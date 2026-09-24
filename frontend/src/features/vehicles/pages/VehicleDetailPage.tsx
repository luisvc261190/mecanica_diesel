import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Truck } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ErrorState } from "@/components/feedback/error-state";
import { vehiclesApi } from "@/features/vehicles/api";
import { VehicleFormDialog } from "@/features/vehicles/components/VehicleFormDialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatPlate } from "@/lib/format";
import { useAuth } from "@/features/auth/context/AuthContext";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export function VehicleDetailPage() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const vehicle = useQuery({
    queryKey: ["vehicles", vehicleId],
    queryFn: () => vehiclesApi.get(vehicleId!),
    enabled: Boolean(vehicleId),
  });

  const history = useQuery({
    queryKey: ["vehicles", vehicleId, "history"],
    queryFn: () => vehiclesApi.history(vehicleId!),
    enabled: Boolean(vehicleId),
  });

  if (vehicle.isError) return <ErrorState onRetry={() => void vehicle.refetch()} className="p-6" />;

  const v = vehicle.data;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)} aria-label="Atrás">
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{v ? formatPlate(v.plate) ?? v.vin ?? "Vehículo" : "Cargando..."}</h1>
          <p className="text-sm text-muted-foreground">Detalle del vehículo</p>
        </div>
        {v && can("vehicles.update") ? (
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil />
            Editar
          </Button>
        ) : null}
      </div>

      {v ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Truck className="size-4 text-muted-foreground" />
                  Ficha del vehículo
                </span>
              </CardTitle>
              <StatusBadge label={v.status} />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Placa" value={formatPlate(v.plate)} />
                <Field label="Año" value={v.year ? String(v.year) : ""} />
                <Field label="Odómetro" value={v.odometer ? `${Number(v.odometer).toLocaleString("es-PE")} km` : ""} />
                <Field label="VIN / Chasis" value={v.vin} />
                <Field label="Motor" value={v.engine_number} />
                <Field label="Color" value={v.color} />
                <Field label="Capacidad" value={v.capacity_note} />
                <Field label="Cliente ID" value={v.client_id} />
              </div>
              <Separator className="my-4" />
              <div>
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="text-sm">{v.notes || "Sin notas."}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de propietarios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {history.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
              {!history.isPending && history.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin historial registrado.</p>
              ) : null}
              {history.data?.map((h) => (
                <div key={h.id} className="border-l-2 border-primary pl-3">
                  <p className="text-sm font-medium">{h.client_id}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(h.started_at), "dd/MM/yyyy", { locale: es })}
                    {h.ended_at ? ` — ${format(new Date(h.ended_at), "dd/MM/yyyy", { locale: es })}` : " — actualidad"}
                  </p>
                  {h.notes ? <p className="mt-1 text-xs text-muted-foreground">{h.notes}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {v ? (
        <VehicleFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          vehicle={v}
          onSuccess={() => vehicle.refetch()}
        />
      ) : null}
    </div>
  );
}

export default VehicleDetailPage;
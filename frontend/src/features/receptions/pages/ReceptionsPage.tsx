import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardList, ClipboardPlus, Wrench } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { WorkOrderCreateDialog } from "@/features/work-orders/components/WorkOrderCreateDialog";
import { receptionsApi } from "@/features/receptions/api";
import { clientsApi } from "@/features/clients/api";
import { vehiclesApi } from "@/features/vehicles/api";
import { branchesApi } from "@/features/settings/api";
import { getApiErrorMessage } from "@/services/api/http";
import type { Client, Paginated, Vehicle } from "@/types/domain";

export function ReceptionsPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [otOpen, setOtOpen] = useState(false);

  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [observations, setObservations] = useState("");
  const [accessories, setAccessories] = useState("");
  const [visibleDamage, setVisibleDamage] = useState("");
  const [fuel, setFuel] = useState("");
  const [odometer, setOdometer] = useState("");

  const clients = useQuery({
    queryKey: ["clients", "search", query],
    queryFn: () => clientsApi.list({ q: query || undefined, page_size: 6 }),
  });

  const vehicles = useQuery({
    queryKey: ["vehicles", "by-client", client?.id, vehicleQuery],
    queryFn: () =>
      client ? vehiclesApi.list({ client_id: client.id, page_size: 100 }) : Promise.resolve({ items: [], page: 1, page_size: 100, total: 0, pages: 0 } as Paginated<Vehicle>),
    enabled: Boolean(client),
  });

  const branches = useQuery({ queryKey: ["tenant", "branches"], queryFn: branchesApi.list });

  const filteredVehicles = useMemo(() => {
    const items = vehicles.data?.items ?? [];
    const q = vehicleQuery.toLowerCase();
    if (!q) return items;
    return items.filter((v) => [v.plate, v.vin, v.engine_number].some((x) => x?.toLowerCase().includes(q)));
  }, [vehicles.data, vehicleQuery]);

  const mutation = useMutation({
    mutationFn: () =>
      receptionsApi.create({
        branch_id: branches.data?.[0]?.id ?? "",
        client_id: client!.id,
        vehicle_id: vehicle!.id,
        odometer: odometer ? Number(odometer) : undefined,
        fuel_level: fuel || undefined,
        reason: reason || undefined,
        reported_symptoms: symptoms || undefined,
        observations: observations || undefined,
        accessories: accessories || undefined,
        visible_damage: visibleDamage || undefined,
      }),
    onSuccess: () => {
      toast.success("Vehículo recepcionado");
      setStep(1);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const selectVehicle = (v: Vehicle) => {
    setVehicle(v);
    if (!odometer && v.odometer) setOdometer(String(v.odometer));
  };

  const reset = () => {
    setStep(1);
    setClient(null);
    setVehicle(null);
    setVehicleQuery("");
    setReason("");
    setSymptoms("");
    setObservations("");
    setAccessories("");
    setVisibleDamage("");
    setFuel("");
    setOdometer("");
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader
        title="Recepción de vehículos"
        description="Paso a paso: selecciona cliente y vehículo, registra el ingreso."
        icon={<ClipboardList />}
      />

      <div className="flex items-center gap-2 text-sm">
        <span className={step === 1 ? "font-semibold text-primary" : "text-muted-foreground"}>1 · Cliente y vehículo</span>
        <ArrowRight className="size-4 text-muted-foreground" />
        <span className={step === 2 ? "font-semibold text-primary" : "text-muted-foreground"}>2 · Datos del ingreso</span>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Selecciona el vehículo a recepcionar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <SearchInput value={query} onValueChange={setQuery} placeholder="Buscar cliente por nombre o documento..." className="mt-1 w-full" />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {clients.data?.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClient(c);
                      setVehicle(null);
                    }}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent/50 ${client?.id === c.id ? "border-primary bg-primary/10" : ""}`}
                  >
                    <span className="block font-medium">
                      {c.client_type === "COMPANY" ? c.company_name : `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {c.doc_type ? `${c.doc_type} ` : ""}{c.doc_number ?? ""}{c.phone ? ` · ${c.phone}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {client ? (
              <div className="space-y-2">
                <Label>Vehículo</Label>
                <SearchInput
                  value={vehicleQuery}
                  onValueChange={setVehicleQuery}
                  placeholder="Buscar por placa, VIN o motor..."
                  className="w-full"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {filteredVehicles.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => selectVehicle(v)}
                      className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent/50 ${vehicle?.id === v.id ? "border-primary bg-primary/10" : ""}`}
                    >
                      <span className="block font-mono font-semibold">{v.plate ?? v.vin ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.year ?? "—"} · {v.color ?? "—"} · {Number(v.odometer).toLocaleString("es-PE")} km
                      </span>
                    </button>
                  ))}
                  {filteredVehicles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Este cliente no tiene vehículos registrados.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <Separator />
            <div className="flex justify-end">
              <Button disabled={!client || !vehicle} onClick={() => setStep(2)}>
                Continuar
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Registrar ingreso</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Cliente</Label>
              <Input readOnly value={client?.company_name ?? `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim()} />
            </div>
            <div>
              <Label>Vehículo</Label>
              <Input readOnly value={vehicle?.plate ?? vehicle?.vin ?? "—"} />
            </div>
            <div>
              <Label>Odómetro (km)</Label>
              <Input type="number" min={0} value={odometer} onChange={(e) => setOdometer(e.target.value)} />
            </div>
            <div>
              <Label>Nivel de combustible</Label>
              <Input value={fuel} onChange={(e) => setFuel(e.target.value)} placeholder="Ej. 3/4" />
            </div>
            <div className="sm:col-span-2">
              <Label>Motivo de ingreso</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Mantenimiento preventivo" />
            </div>
            <div className="sm:col-span-2">
              <Label>Síntomas reportados</Label>
              <Input value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Ruido, vibración, revisar frenos..." />
            </div>
            <div>
              <Label>Accesorios</Label>
              <Input value={accessories} onChange={(e) => setAccessories(e.target.value)} placeholder="Llanta de repuesto, gata, radio..." />
            </div>
            <div>
              <Label>Daños visibles</Label>
              <Input value={visibleDamage} onChange={(e) => setVisibleDamage(e.target.value)} placeholder="Rayones, abolladuras..." />
            </div>
            <div className="sm:col-span-2">
              <Label>Observaciones</Label>
              <Input value={observations} onChange={(e) => setObservations(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={reset}>
                Volver
              </Button>
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                <ClipboardPlus />
                {mutation.isPending ? "Recepcionando..." : "Recepcionar vehículo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* CTA para crear OT */}
      <Card className="border-dashed">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <Wrench className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              ¿Vehículo listo? Inicia la orden de trabajo en el acto.
            </p>
          </div>
          <Button variant="outline" onClick={() => setOtOpen(true)}>
            Crear OT
          </Button>
        </CardContent>
      </Card>

      <WorkOrderCreateDialog
        open={otOpen}
        onOpenChange={setOtOpen}
        presetClientId={client?.id}
        presetVehicleId={vehicle?.id}
      />
    </div>
  );
}

export default ReceptionsPage;
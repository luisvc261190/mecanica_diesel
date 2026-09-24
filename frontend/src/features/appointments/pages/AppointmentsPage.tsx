import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { CalendarClock, Check, Trash2, UserCheck, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { appointmentsApi } from "@/features/appointments/api";
import { branchesApi } from "@/features/settings/api";
import { APPOINTMENT_STATUS } from "@/constants/status";
import { getApiErrorMessage } from "@/services/api/http";
import type { Appointment } from "@/types/domain";

export function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [confirmDelete, setConfirmDelete] = useState<Appointment | null>(null);

  const counts = useQuery({ queryKey: ["appointments", "counts"], queryFn: appointmentsApi.counts });

  const day = useQuery({
    queryKey: ["appointments", "day", date],
    queryFn: () => appointmentsApi.day({ day: new Date(`${date}T00:00:00`).toISOString() }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["appointments"] });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => appointmentsApi.update(id, { status }),
    onSuccess: () => {
      toast.success("Cita actualizada");
      invalidate();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => appointmentsApi.remove(id),
    onSuccess: () => {
      toast.success("Cita eliminada");
      invalidate();
      setConfirmDelete(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const sorted = useMemo(
    () => [...(day.data ?? [])].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    [day.data],
  );

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader
        title="Citas"
        description="Agenda de ingresos al taller."
        icon={<CalendarClock />}
        actions={<NewAppointmentDialog />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || format(new Date(), "yyyy-MM-dd"))}
          className="w-auto"
          aria-label="Día"
        />
        <Card className="flex-1">
          <CardContent className="flex flex-wrap items-center gap-4 py-3 text-sm">
            {counts.data
              ? Object.entries(counts.data).slice(0, 5).map(([key, value]) => (
                  <span key={key} className="flex items-center gap-2">
                    <StatusBadge meta={APPOINTMENT_STATUS[key]} />
                    <span className="tabular">{value}</span>
                  </span>
                ))
              : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        {day.isPending ? <p className="text-sm text-muted-foreground">Cargando citas del día...</p> : null}
        {!day.isPending && sorted.length === 0 ? (
          <EmptyState title="Sin citas este día" description="Usa el botón 'Nueva cita' para agendar el ingreso." />
        ) : null}
        {sorted.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
            <div className="flex h-10 w-12 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
              <span className="text-xs font-semibold">{format(parseISO(a.scheduled_at), "HH:mm")}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.reason || "Ingreso al taller"}</p>
              <p className="text-xs text-muted-foreground">
                {a.client_id ? `Cliente ${a.client_id.slice(0, 8)}` : "Sin cliente asignado"} · {a.duration_minutes} min
                {a.vehicle_id ? ` · Vehículo ${a.vehicle_id.slice(0, 8)}` : ""}
              </p>
            </div>
            <StatusBadge meta={APPOINTMENT_STATUS[a.status]} />
            <div className="flex gap-1">
              {a.status === "SCHEDULED" ? (
                <Button size="icon-sm" variant="outline" title="Confirmar" onClick={() => statusMutation.mutate({ id: a.id, status: "CONFIRMED" })}>
                  <Check />
                </Button>
              ) : null}
              {a.status === "CONFIRMED" ? (
                <Button size="icon-sm" variant="outline" title="Marcar llegada" onClick={() => statusMutation.mutate({ id: a.id, status: "ARRIVED" })}>
                  <UserCheck />
                </Button>
              ) : null}
              {!["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status) ? (
                <Button size="icon-sm" variant="outline" title="Cancelar" onClick={() => statusMutation.mutate({ id: a.id, status: "CANCELLED" })}>
                  <X />
                </Button>
              ) : null}
              <Button size="icon-sm" variant="ghost" className="text-destructive" title="Eliminar" onClick={() => setConfirmDelete(a)}>
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="¿Eliminar esta cita?"
        description="Se quitará de la agenda de forma permanente."
        confirmLabel="Eliminar"
        tone="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
      />
    </div>
  );
}

function NewAppointmentDialog() {
  const queryClient = useQueryClient();
  const branches = useQuery({ queryKey: ["tenant", "branches"], queryFn: branchesApi.list });
  const [scheduled, setScheduled] = useState("");
  const [duration, setDuration] = useState("60");
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      appointmentsApi.create({
        branch_id: branches.data?.[0]?.id ?? "",
        scheduled_at: new Date(scheduled).toISOString(),
        duration_minutes: Number(duration),
        reason: reason || undefined,
        symptoms: symptoms || undefined,
      }),
    onSuccess: () => {
      toast.success("Cita creada");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setScheduled("");
      setReason("");
      setSymptoms("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <>
      <Button onClick={() => setConfirmOpen(true)}>Nueva cita</Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o);
          if (!o) void 0;
        }}
        title="Nueva cita"
        description="Programa el ingreso del vehículo al taller."
        confirmLabel={mutation.isPending ? "Creando..." : "Crear cita"}
        loading={mutation.isPending}
        onConfirm={() => scheduled && mutation.mutate()}
      >
        <div className="space-y-3 py-2">
          <div>
            <Label>Fecha y hora</Label>
            <Input type="datetime-local" className="mt-1" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
          </div>
          <div>
            <Label>Duración (min)</Label>
            <Input type="number" min={15} step={15} className="mt-1" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div>
            <Label>Motivo</Label>
            <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Mantenimiento preventivo" />
          </div>
          <div>
            <Label>Síntomas</Label>
            <Input className="mt-1" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Ruido al frenar, vibraciones..." />
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}

export default AppointmentsPage;
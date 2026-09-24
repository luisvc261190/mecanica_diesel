import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardPlus, Plus, ScanSearch, Stethoscope, Wrench } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { diagnosticsApi } from "@/features/diagnostics/api";
import { vehiclesApi } from "@/features/vehicles/api";
import { branchesApi } from "@/features/settings/api";
import { DIAGNOSTIC_RESOLUTION_STATUS, SEVERITY, DIAGNOSTIC_TEST_TYPE } from "@/constants/status";
import { getApiErrorMessage } from "@/services/api/http";
import type { Diagnostic, Vehicle } from "@/types/domain";

type Step = "vehicle" | "create" | "findings";

export function DiagnosticsPage() {
  const [step, setStep] = useState<Step>("vehicle");
  const [query, setQuery] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);

  const [summary, setSummary] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [resolution, setResolution] = useState("PENDING");

  const vehicles = useQuery({
    queryKey: ["vehicles", "search", query],
    queryFn: () => vehiclesApi.list({ q: query || undefined, page_size: 8 }),
  });

  const branches = useQuery({ queryKey: ["tenant", "branches"], queryFn: branchesApi.list });

  const createMutation = useMutation({
    mutationFn: () =>
      diagnosticsApi.create({
        branch_id: branches.data?.[0]?.id ?? undefined,
        vehicle_id: vehicle!.id,
        summary: summary || undefined,
        recommendations: recommendations || undefined,
        resolution_status: resolution,
      }),
    onSuccess: (d) => {
      setDiagnostic(d);
      setStep("findings");
      toast.success("Diagnóstico creado");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const reset = () => {
    setStep("vehicle");
    setVehicle(null);
    setQuery("");
    setDiagnostic(null);
    setSummary("");
    setRecommendations("");
    setResolution("PENDING");
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader title="Diagnóstico" description="Registra el diagnóstico técnico del vehículo." icon={<Stethoscope />} />

      <div className="flex items-center gap-2 text-sm">
        <span className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${step === "vehicle" ? "bg-primary" : "bg-primary/40"}`} /> Vehículo
        </span>
        <ArrowLeft className="size-3 -scale-x-100 text-muted-foreground" />
        <span className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${step === "create" ? "bg-primary" : step === "findings" ? "bg-primary/60" : "bg-muted"}`} /> Síntesis
        </span>
        <ArrowLeft className="size-3 -scale-x-100 text-muted-foreground" />
        <span className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${step === "findings" ? "bg-primary" : "bg-muted"}`} /> Hallazgos y pruebas
        </span>
      </div>

      {step === "vehicle" ? (
        <Card>
          <CardHeader>
            <CardTitle>Selecciona el vehículo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <SearchInput value={query} onValueChange={setQuery} placeholder="Buscar por placa, VIN o motor..." className="w-full sm:w-96" />
            <div className="grid gap-2 sm:grid-cols-2">
              {vehicles.data?.items.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVehicle(v)}
                  className={`rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent/50 ${vehicle?.id === v.id ? "border-primary bg-primary/10" : ""}`}
                >
                  <span className="block font-mono font-semibold">{v.plate ?? v.vin ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {v.year ?? "—"} · {v.color ?? "—"} · {Number(v.odometer).toLocaleString("es-PE")} km
                  </span>
                </button>
              ))}
              {vehicles.data && vehicles.data.items.length === 0 && !vehicles.isPending ? (
                <p className="text-sm text-muted-foreground">Sin resultados. Registra primero el vehículo.</p>
              ) : null}
            </div>
            <Separator />
            <div className="flex justify-end">
              <Button disabled={!vehicle} onClick={() => setStep("create")}>
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "create" ? (
        <Card>
          <CardHeader>
            <CardTitle>Crear diagnóstico</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Vehículo</Label>
                <Input readOnly value={vehicle?.plate ?? vehicle?.vin ?? "—"} />
              </div>
              <div>
                <Label>Resultado</Label>
                <Select value={resolution} onValueChange={setResolution}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIAGNOSTIC_RESOLUTION_STATUS).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Síntesis del diagnóstico</Label>
              <Textarea className="mt-1" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Falla detectada, componentes revisados..." rows={3} />
            </div>
            <div>
              <Label>Recomendaciones</Label>
              <Textarea className="mt-1" value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("vehicle")}>
                Volver
              </Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                <ClipboardPlus />
                {createMutation.isPending ? "Creando..." : "Guardar diagnóstico"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "findings" && diagnostic ? (
        <DiagnosticRecall diagnostic={diagnostic} onReset={reset} />
      ) : null}
    </div>
  );
}

function DiagnosticRecall({ diagnostic, onReset }: { diagnostic: Diagnostic; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <FindingsSection diagnosticId={diagnostic.id} />
      <TestsSection diagnosticId={diagnostic.id} />
      <Button variant="outline" onClick={onReset}>
        <ScanSearch />
        Nuevo diagnóstico
      </Button>
    </div>
  );
}

function FindingsSection({ diagnosticId }: { diagnosticId: string }) {
  const [desc, setDesc] = useState("");
  const [area, setArea] = useState("");
  const [symptom, setSymptom] = useState("");
  const [cause, setCause] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [openForm, setOpenForm] = useState(false);

  const findings = useQuery({
    queryKey: ["diagnostics", diagnosticId, "findings"],
    queryFn: () => diagnosticsApi.findings(diagnosticId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      diagnosticsApi.addFinding(diagnosticId, {
        description: desc,
        area: area || undefined,
        symptom: symptom || undefined,
        probable_cause: cause || undefined,
        severity,
      }),
    onSuccess: () => {
      toast.success("Hallazgo agregado");
      findings.refetch();
      setDesc("");
      setArea("");
      setSymptom("");
      setCause("");
      setOpenForm(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Hallazgos</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpenForm((o) => !o)}>
          <Plus />
          Agregar hallazgo
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {openForm ? (
          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <Label>Síntoma</Label>
              <Input className="mt-1" value={symptom} onChange={(e) => setSymptom(e.target.value)} placeholder="Ej. Ruido al girar a la derecha" />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input className="mt-1" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Qué se observó al inspeccionar..." />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Área</Label>
                <Input className="mt-1" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Suspensión, motor..." />
              </div>
              <div>
                <Label>Severidad</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEVERITY).map(([key, meta]) => (
                      <SelectItem key={key} value={key}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Causa probable</Label>
              <Input className="mt-1" value={cause} onChange={(e) => setCause(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !desc}>
                {addMutation.isPending ? "Guardando..." : "Guardar hallazgo"}
              </Button>
            </div>
          </div>
        ) : null}

        {findings.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
        {!findings.isPending && findings.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin hallazgos registrados.</p>
        ) : null}
        <div className="space-y-2">
          {findings.data?.map((f) => (
            <div key={f.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{f.symptom ?? f.description}</span>
                <StatusBadge meta={SEVERITY[f.severity]} />
              </div>
              <p className="mt-1 text-muted-foreground">{f.description}</p>
              {f.probable_cause ? <p className="mt-1 text-xs text-muted-foreground">Causa probable: {f.probable_cause}</p> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TestsSection({ diagnosticId }: { diagnosticId: string }) {
  const [testType, setTestType] = useState("SCAN");
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [openForm, setOpenForm] = useState(false);

  const tests = useQuery({
    queryKey: ["diagnostics", diagnosticId, "tests"],
    queryFn: () => diagnosticsApi.tests(diagnosticId),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      diagnosticsApi.addTest(diagnosticId, {
        test_type: testType,
        result: result || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success("Prueba registrada");
      tests.refetch();
      setResult("");
      setNotes("");
      setOpenForm(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Pruebas y mediciones</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpenForm((o) => !o)}>
          <Plus />
          Registrar prueba
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {openForm ? (
          <div className="space-y-3 rounded-lg border p-3">
            <div>
              <Label>Tipo de prueba</Label>
              <Select value={testType} onValueChange={setTestType}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DIAGNOSTIC_TEST_TYPE).map(([key, meta]) => (
                    <SelectItem key={key} value={key}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Resultado</Label>
              <Input className="mt-1" value={result} onChange={(e) => setResult(e.target.value)} placeholder="Ej. DTC P0301 · cilindro 1 falla" />
            </div>
            <div>
              <Label>Notas</Label>
              <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                {addMutation.isPending ? "Guardando..." : "Guardar prueba"}
              </Button>
            </div>
          </div>
        ) : null}

        {tests.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
        {!tests.isPending && tests.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin pruebas registradas.</p>
        ) : null}
        <div className="space-y-2">
          {tests.data?.map((t) => (
            <div key={t.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Wrench className="size-3.5 text-muted-foreground" />
                  {DIAGNOSTIC_TEST_TYPE[t.test_type]?.label ?? t.test_type}
                </span>
                <StatusBadge meta={{ label: t.result ?? "—", tone: "default" }} />
              </div>
              {t.notes ? <p className="mt-1 text-xs text-muted-foreground">{t.notes}</p> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default DiagnosticsPage;
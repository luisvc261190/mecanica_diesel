import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { quotesApi, type QuoteItemPayload } from "@/features/quotes/api";
import { clientsApi } from "@/features/clients/api";
import { vehiclesApi } from "@/features/vehicles/api";
import { branchesApi } from "@/features/settings/api";
import { getApiErrorMessage } from "@/services/api/http";
import { formatCurrency } from "@/lib/format";
import type { Paginated, Vehicle } from "@/types/domain";

const schema = z.object({
  branch_id: z.string().min(1, "Elige una sucursal"),
  client_id: z.string().min(1, "Selecciona un cliente"),
  vehicle_id: z.string().optional(),
  valid_until: z.string().optional(),
  terms: z.string().optional(),
});

type FormValues = z.output<typeof schema>;

interface Row {
  id: string;
  kind: "SERVICE" | "PART";
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
}

function newRow(): Row {
  return { id: crypto.randomUUID(), kind: "SERVICE", description: "", quantity: "1", unit_price: "", discount: "0" };
}

export function QuoteCreatePage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { vehicle_id: "" },
  });

  const branches = useQuery({ queryKey: ["tenant", "branches"], queryFn: branchesApi.list });
  const clients = useQuery({ queryKey: ["clients", "list", "early"], queryFn: () => clientsApi.list({ page_size: 100 }) });

  const clientId = form.watch("client_id");
  const vehicles = useQuery({
    queryKey: ["vehicles", "by-client", clientId],
    queryFn: () => (clientId ? vehiclesApi.list({ client_id: clientId, page_size: 100 }) : Promise.resolve({ items: [], page: 1, page_size: 100, total: 0, pages: 0 } as Paginated<Vehicle>)),
    enabled: Boolean(clientId),
  });

  useEffect(() => {
    if (branches.data?.length && !form.getValues("branch_id")) {
      form.setValue("branch_id", branches.data[0].id);
    }
  }, [branches.data, form]);

  const updateRow = (id: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const totals = useMemo(() => {
    const net = rows.reduce((acc, r) => acc + (Number(r.quantity || 0) * Number(r.unit_price || 0) - Number(r.discount || 0)), 0);
    const discount = rows.reduce((acc, r) => acc + Number(r.discount || 0), 0);
    const subtotal = Math.max(net, 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;
    return { subtotal, discount, tax, total };
  }, [rows]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const items: QuoteItemPayload[] = rows
        .filter((r) => r.description.trim() && Number(r.unit_price || 0) > 0)
        .map((r) => ({
          kind: r.kind,
          description: r.description.trim(),
          quantity: Number(r.quantity || 1),
          unit_price: Number(r.unit_price || 0),
          discount: Number(r.discount || 0),
        }));
      return quotesApi.create({
        branch_id: values.branch_id,
        client_id: values.client_id,
        vehicle_id: values.vehicle_id || undefined,
        valid_until: values.valid_until ? new Date(values.valid_until).toISOString() : undefined,
        terms: values.terms || undefined,
        items,
      });
    },
    onSuccess: (quote) => {
      toast.success("Cotización creada");
      navigate(`/app/cotizaciones/${quote.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function onSubmit(values: FormValues) {
    if (rows.every((r) => !r.description.trim() || !Number(r.unit_price)) ) {
      toast.error("Agrega al menos un ítem con descripción y precio");
      return;
    }
    mutation.mutate(values);
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate("/app/cotizaciones")} aria-label="Atrás">
          <ArrowLeft />
        </Button>
        <PageHeader title="Nueva cotización" description="Arma el presupuesto con servicios y repuestos." />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Encabezado</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="branch_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sucursal</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Elegir" />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.data?.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.data?.items.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.client_type === "COMPANY" ? c.company_name : `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehículo (opcional)</FormLabel>
                    <FormControl>
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sin vehículo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sin vehículo</SelectItem>
                          {vehicles.data?.items.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.plate ?? v.vin ?? v.id} {v.year ? ` · ${v.year}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Válida hasta</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Ítems</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setRows((prev) => [...prev, newRow()])}>
                <Plus />
                Agregar ítem
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-2 items-end gap-2 rounded-lg border p-3 sm:grid-cols-12">
                  <div className="col-span-2 sm:col-span-2">
                    <Label>Tipo</Label>
                    <Select value={row.kind} onValueChange={(v) => updateRow(row.id, { kind: v as "SERVICE" | "PART" })}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SERVICE">Servicio</SelectItem>
                        <SelectItem value="PART">Repuesto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 sm:col-span-5">
                    <Label>Descripción</Label>
                    <Input
                      placeholder={row.kind === "PART" ? "Ej. Kit de embrague" : "Ej. Mantenimiento preventivo"}
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Cant.</Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>P. unit.</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.unit_price}
                      onChange={(e) => updateRow(row.id, { unit_price: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-1">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.discount}
                      placeholder="Desc."
                      onChange={(e) => updateRow(row.id, { discount: e.target.value })}
                      aria-label="Descuento"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      disabled={rows.length === 1}
                      onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))}
                      aria-label="Quitar ítem"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}

              <Separator />

              <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular">{formatCurrency(String(totals.subtotal))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="tabular">-{formatCurrency(String(totals.discount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IGV (18%)</span>
                  <span className="tabular">{formatCurrency(String(totals.tax))}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="tabular">{formatCurrency(String(totals.total))}</span>
                </div>
              </div>

              <FormField
                control={form.control}
                name="terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Condiciones</FormLabel>
                    <FormControl>
                      <textarea
                        className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Validez de precios, garantía, forma de pago..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full lg:w-auto" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {mutation.isPending ? "Creando cotización..." : "Crear cotización"}
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}

export default QuoteCreatePage;
import { useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { workOrdersApi } from "@/features/work-orders/api";
import { clientsApi } from "@/features/clients/api";
import { vehiclesApi } from "@/features/vehicles/api";
import { branchesApi } from "@/features/settings/api";
import { WORK_ORDER_PRIORITY } from "@/constants/status";
import { getApiErrorMessage } from "@/services/api/http";
import type { Paginated, Vehicle, WorkOrder } from "@/types/domain";

const schema = z.object({
  branch_id: z.string().min(1, "Elige una sucursal"),
  client_id: z.string().min(1, "Selecciona un cliente"),
  vehicle_id: z.string().min(1, "Selecciona un vehículo"),
  priority: z.string().default("NORMAL"),
  notes: z.string().optional(),
});

type FormValues = z.output<typeof schema>;

interface WorkOrderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (workOrder: WorkOrder) => void;
  presetClientId?: string;
  presetVehicleId?: string;
}

export function WorkOrderCreateDialog({ open, onOpenChange, onSuccess, presetClientId, presetVehicleId }: WorkOrderCreateDialogProps) {
  const queryClient = useQueryClient();
  const [clientSearch, setClientSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { priority: "NORMAL" },
  });

  const { client_id } = form.watch();

  const vehicles = useQuery({
    queryKey: ["vehicles", "by-client", client_id],
    queryFn: () => (client_id ? vehiclesApi.list({ client_id, page_size: 100 }) : Promise.resolve({ items: [], page: 1, page_size: 100, total: 0, pages: 0 } as Paginated<Vehicle>)),
    enabled: open && Boolean(client_id),
  });

  const branches = useQuery({
    queryKey: ["tenant", "branches"],
    queryFn: branchesApi.list,
  });

  const clients = useQuery({
    queryKey: ["clients", "search", clientSearch],
    queryFn: () => clientsApi.list({ q: clientSearch || undefined, page_size: 8 }),
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setClientSearch("");
      setVehicleSearch("");
      form.reset({
        branch_id: branches.data?.[0]?.id ?? "",
        client_id: presetClientId ?? "",
        vehicle_id: presetVehicleId ?? "",
        priority: "NORMAL",
        notes: "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetClientId, presetVehicleId]);

  useEffect(() => {
    if (!client_id && presetClientId) {
      form.setValue("client_id", presetClientId);
    }
  }, [client_id, presetClientId, form]);

  const vehicleFiltered = useMemo(() => {
    const items = vehicles.data?.items ?? [];
    const q = vehicleSearch.toLowerCase();
    if (!q) return items;
    return items.filter((v) => [v.plate, v.vin, v.engine_number].some((x) => x?.toLowerCase().includes(q)));
  }, [vehicles.data, vehicleSearch]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      workOrdersApi.create({
        branch_id: values.branch_id,
        client_id: values.client_id,
        vehicle_id: values.vehicle_id,
        priority: values.priority,
        notes: values.notes || undefined,
      }),
    onSuccess: (saved) => {
      toast.success(`OT ${saved.number ?? ""} creada`);
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      onSuccess?.(saved);
      onOpenChange(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva orden de trabajo</DialogTitle>
          <DialogDescription>Selecciona la sucursal, el cliente y el vehículo.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="branch_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sucursal</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegir sucursal" />
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
                    {presetClientId ? (
                      <Input value="Cliente preseleccionado" readOnly disabled />
                    ) : (
                      <div className="space-y-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Buscar cliente..."
                            className="pl-8"
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                          />
                        </div>
                        <Select value={field.value || undefined} onValueChange={(v) => { field.onChange(v); setVehicleSearch(""); }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar cliente" />
                          </SelectTrigger>
                          <SelectContent>
                            {clients.data?.items.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.client_type === "COMPANY" ? c.company_name : `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim()}
                                {(c.doc_number ? ` · ${c.doc_number}` : "")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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
                  <FormLabel>Vehículo</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar por placa, VIN..."
                          className="pl-8"
                          value={vehicleSearch}
                          onChange={(e) => setVehicleSearch(e.target.value)}
                          disabled={!client_id}
                        />
                      </div>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={client_id ? "Seleccionar vehículo" : "Primero elige el cliente"} />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleFiltered.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.plate ?? v.vin ?? v.id} {v.year ? ` · ${v.year}` : ""}
                            </SelectItem>
                          ))}
                          {vehicleFiltered.length === 0 ? <SelectItem value="__none__" disabled>Sin resultados</SelectItem> : null}
                        </SelectContent>
                      </Select>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridad</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(WORK_ORDER_PRIORITY).map(([key, meta]) => (
                          <SelectItem key={key} value={key}>
                            {meta.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />

            <Separator />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Síntomas reportados, instrucciones al técnico, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                Crear OT
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
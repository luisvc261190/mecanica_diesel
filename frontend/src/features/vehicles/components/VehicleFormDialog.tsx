import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { vehiclesApi } from "@/features/vehicles/api";
import { getApiErrorMessage } from "@/services/api/http";
import type { Vehicle } from "@/types/domain";

const schema = z.object({
  client_id: z.string().optional(),
  plate: z.string().optional(),
  vin: z.string().optional(),
  engine_number: z.string().optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional().or(z.literal("")),
  color: z.string().optional(),
  capacity_note: z.string().optional(),
  odometer: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
});

type FormValues = z.output<typeof schema>;

interface VehicleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (vehicle: Vehicle) => void;
  vehicle?: Vehicle | null;
  presetClientId?: string;
}

export function VehicleFormDialog({ open, onOpenChange, onSuccess, vehicle, presetClientId }: VehicleFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(vehicle);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: { client_id: presetClientId ?? "", odometer: 0 },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        vehicle
          ? {
              client_id: vehicle.client_id ?? presetClientId ?? "",
              plate: vehicle.plate ?? "",
              vin: vehicle.vin ?? "",
              engine_number: vehicle.engine_number ?? "",
              year: vehicle.year ? Number(vehicle.year) : "",
              color: vehicle.color ?? "",
              capacity_note: vehicle.capacity_note ?? "",
              odometer: vehicle.odometer ?? 0,
              notes: vehicle.notes ?? "",
            }
          : {
              client_id: presetClientId ?? "",
              plate: "",
              vin: "",
              engine_number: "",
              year: "",
              color: "",
              capacity_note: "",
              odometer: 0,
              notes: "",
            },
      );
    }
  }, [open, vehicle, presetClientId, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: Record<string, unknown> = {
        ...values,
        client_id: values.client_id || null,
        plate: values.plate?.toUpperCase() || null,
        vin: values.vin?.toUpperCase() || null,
        engine_number: values.engine_number?.toUpperCase() || null,
        year: typeof values.year === "number" ? values.year : null,
        odometer: Number(values.odometer ?? 0),
        notes: values.notes || null,
      };
      return isEdit && vehicle ? vehiclesApi.update(vehicle.id, payload) : vehiclesApi.create(payload);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? "Vehículo actualizado" : "Vehículo registrado");
      queryClient.invalidateQueries({ queryKey: ["vehicles"] });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar vehículo" : "Registrar vehículo"}</DialogTitle>
          <DialogDescription>Los campos marcados con UUID de catálogo no están disponibles en la API actual.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="plate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Placa</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC-123" className="uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Año</FormLabel>
                    <FormControl>
                      <Input placeholder="2020" inputMode="numeric" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VIN / Chasis</FormLabel>
                    <FormControl>
                      <Input placeholder="8APXXXXXXXXXXXXXX" className="uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="engine_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motor</FormLabel>
                    <FormControl>
                      <Input placeholder="N° de motor" className="uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input placeholder="Blanco" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="odometer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Odómetro (km)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="capacity_note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacidad</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej. 3 toneladas, 20 pasajeros" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Observaciones del vehículo"
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
                {isEdit ? "Guardar cambios" : "Registrar vehículo"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
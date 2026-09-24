import { useForm } from "react-hook-form";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DOC_TYPE } from "@/constants/status";
import { clientsApi } from "@/features/clients/api";
import { getApiErrorMessage } from "@/services/api/http";
import type { Client } from "@/types/domain";

const schema = z.object({
  client_type: z.enum(["PERSON", "COMPANY"]),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company_name: z.string().optional(),
  doc_type: z.string().optional(),
  doc_number: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (client: Client) => void;
  client?: Client | null;
}

export function ClientFormDialog({ open, onOpenChange, onSuccess, client }: ClientFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(client);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      client_type: "PERSON",
      doc_type: "DNI",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        client
          ? {
              client_type: client.client_type as "PERSON" | "COMPANY",
              first_name: client.first_name ?? "",
              last_name: client.last_name ?? "",
              company_name: client.company_name ?? "",
              doc_type: client.doc_type ?? "DNI",
              doc_number: client.doc_number ?? "",
              phone: client.phone ?? "",
              email: client.email ?? "",
              address: client.address ?? "",
              city: client.city ?? "",
              notes: client.notes ?? "",
            }
          : {
              client_type: "PERSON",
              first_name: "",
              last_name: "",
              company_name: "",
              doc_type: "DNI",
              doc_number: "",
              phone: "",
              email: "",
              address: "",
              city: "",
              notes: "",
            },
      );
    }
  }, [open, client, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload: Record<string, unknown> = {
        ...values,
        email: values.email || null,
        first_name: values.first_name || null,
        last_name: values.last_name || null,
        company_name: values.company_name || null,
        doc_type: values.client_type === "COMPANY" ? "RUC" : values.doc_type,
        doc_number: values.doc_number || null,
        phone: values.phone || null,
        address: values.address || null,
        city: values.city || null,
        notes: values.notes || null,
      };
      return isEdit && client ? clientsApi.update(client.id, payload) : clientsApi.create(payload);
    },
    onSuccess: (saved) => {
      toast.success(isEdit ? "Cliente actualizado" : "Cliente creado");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onSuccess?.(saved);
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }

  const isCompany = form.watch("client_type") === "COMPANY";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Actualiza la información del cliente." : "Registra un nuevo cliente en tu taller."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="client_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de cliente</FormLabel>
                  <FormControl>
                    <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                      <TabsList className="w-full">
                        <TabsTrigger value="PERSON" className="flex-1">
                          Persona
                        </TabsTrigger>
                        <TabsTrigger value="COMPANY" className="flex-1">
                          Empresa
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isCompany ? (
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Razón social</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Transportes XYZ S.A.C." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <>
                  <FormField
                    control={form.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Juan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Apellido</FormLabel>
                        <FormControl>
                          <Input placeholder="Pérez" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {!isCompany ? (
                <FormField
                  control={form.control}
                  name="doc_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Doc.</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DOC_TYPE).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : (
                <div className="flex items-end pb-1 text-sm text-muted-foreground">
                  <Label>RUC</Label>
                </div>
              )}
              <FormField
                control={form.control}
                name="doc_number"
                render={({ field }) => (
                  <FormItem className={isCompany ? "sm:col-span-2" : ""}>
                    <FormLabel>Número de documento</FormLabel>
                    <FormControl>
                      <Input placeholder={isCompany ? "20XXXXXXXXX" : "70XXXXXX"} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input placeholder="+51 999 999 999" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="cliente@correo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input placeholder="Av. Principal 123" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <FormControl>
                      <Input placeholder="Lima" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <textarea
                      className="flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Preferencias, datos de contacto del vehículo, etc."
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
                {isEdit ? "Guardar cambios" : "Crear cliente"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, ChevronDown, Package, Wrench } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { workOrdersApi } from "@/features/work-orders/api";
import { clientsApi } from "@/features/clients/api";
import { vehiclesApi } from "@/features/vehicles/api";
import { branchesApi } from "@/features/settings/api";
import { servicesApi } from "@/features/settings/api";
import { inventoryApi } from "@/features/inventory/api";
import { paymentsApi } from "@/features/payments/api";
import type { WorkOrderPart } from "@/types/domain";
import { WORK_ORDER_ACTIONS, WORK_ORDER_PRIORITY, WORK_ORDER_STATUS, PAYMENT_METHOD } from "@/constants/status";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getApiErrorMessage } from "@/services/api/http";
import { useAuth } from "@/features/auth/context/AuthContext";

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

function PartName({ partId }: { partId: string }) {
  const part = useQuery({
    queryKey: ["inventory", "parts", partId],
    queryFn: () => inventoryApi.get(partId),
    retry: false,
  });
  return <>{part.data?.name ?? partId.slice(0, 8)}</>;
}

export function WorkOrderDetailPage() {
  const { workOrderId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const [addPartOpen, setAddPartOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [selectedService, setSelectedService] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("EFECTIVO");
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const order = useQuery({
    queryKey: ["work-orders", workOrderId],
    queryFn: () => workOrdersApi.get(workOrderId!),
    enabled: Boolean(workOrderId),
    refetchInterval: 30_000,
  });

  const client = useQuery({
    queryKey: ["clients", order.data?.client_id],
    queryFn: () => clientsApi.get(order.data!.client_id),
    enabled: Boolean(order.data?.client_id),
  });

  const vehicle = useQuery({
    queryKey: ["vehicles", order.data?.vehicle_id],
    queryFn: () => vehiclesApi.get(order.data!.vehicle_id),
    enabled: Boolean(order.data?.vehicle_id),
  });

  const branches = useQuery({ queryKey: ["tenant", "branches"], queryFn: branchesApi.list });

  const parts = useQuery({
    queryKey: ["inventory", "parts", "search", ""],
    queryFn: () => inventoryApi.list({ page_size: 100 }),
    enabled: addPartOpen,
  });

  const services = useQuery({
    queryKey: ["services", "list"],
    queryFn: () => servicesApi.list({ page_size: 100 }),
    enabled: addServiceOpen,
  });

  const payments = useQuery({
    queryKey: ["payments", "work-orders", workOrderId],
    queryFn: () => paymentsApi.listForWorkOrder(workOrderId!),
    enabled: Boolean(workOrderId),
  });

  const totalPaid = useMemo(() => payments.data?.reduce((acc, p) => acc + Number(p.amount), 0) ?? 0, [payments.data]);
  const wo = order.data;
  const balance = wo ? Number(wo.total) - totalPaid : 0;

  const invalidateOrder = () => queryClient.invalidateQueries({ queryKey: ["work-orders", workOrderId] });

  const actionMutation = useMutation({
    mutationFn: (action: string) => workOrdersApi.action(workOrderId!, action),
    onSuccess: () => {
      toast.success("Estado actualizado");
      invalidateOrder();
      setConfirmAction(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const payMutation = useMutation({
    mutationFn: (amount: string) =>
      paymentsApi.register({
        work_order_id: workOrderId!,
        branch_id: wo?.branch_id,
        amount,
        method: payMethod,
      }),
    onSuccess: () => {
      toast.success("Pago registrado");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      invalidateOrder();
      setPayOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const addPartMutation = useMutation({
    mutationFn: () => workOrdersApi.addPart(workOrderId!, selectedPart, partQty),
    onSuccess: () => {
      toast.success("Repuesto agregado a la OT");
      invalidateOrder();
      setAddPartOpen(false);
      setSelectedPart("");
      setPartQty(1);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const addServiceMutation = useMutation({
    mutationFn: () => {
      const svc = services.data?.items.find((s) => s.id === selectedService);
      return workOrdersApi.addService(workOrderId!, {
        service_id: selectedService,
        service_name: svc?.name ?? "",
        quantity: 1,
        price: svc ? Number(svc.default_price) : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Servicio agregado a la OT");
      invalidateOrder();
      setAddServiceOpen(false);
      setSelectedService("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (order.isError) return <ErrorState onRetry={() => void order.refetch()} className="p-6" />;

  const actions = wo ? WORK_ORDER_ACTIONS[wo.status] ?? [] : [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate("/app/ordenes")} aria-label="Atrás">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{wo?.number ?? "Orden de trabajo"}</h1>
          <p className="text-sm text-muted-foreground">OT creada el {wo ? formatDateTime(wo.opened_at) : ""}</p>
        </div>
        {wo ? (
          <div className="flex items-center gap-2">
            {wo.status !== "DELIVERED" && wo.status !== "CANCELLED" && can("work_orders.update_status") && actions.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    Acción
                    <ChevronDown />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {actions.map((a) => (
                    <DropdownMenuItem key={a.action} onClick={() => setConfirmAction(a.action)}>
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {can("payments.register") && wo.status !== "CANCELLED" && balance > 0 ? (
              <Button variant="outline" onClick={() => setPayOpen(true)}>
                <Banknote />
                Registrar pago
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {wo ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatusBadge meta={WORK_ORDER_STATUS[wo.status]} />
            <StatusBadge meta={WORK_ORDER_PRIORITY[wo.priority]} />
            <Badge variant="outline">Total {formatCurrency(wo.total)}</Badge>
            <Badge variant={balance > 0 ? "secondary" : "success"}>
              {balance > 0 ? `Saldo ${formatCurrency(balance)}` : "Pagado"}
            </Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Información</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <DetailRow label="Cliente" value={(client.data?.company_name ?? `${client.data?.first_name ?? ""} ${client.data?.last_name ?? ""}`.trim()) || client.data?.id} />
                <DetailRow label="Vehículo" value={[vehicle.data?.year, vehicle.data?.plate, vehicle.data?.vin].filter(Boolean).join(" · ") || vehicle.data?.id} />
                <DetailRow label="Sucursal" value={branches.data?.find((b) => b.id === wo.branch_id)?.name} />
                <DetailRow label="Cierre" value={wo.closed_at ? formatDateTime(wo.closed_at) : "—"} />
              </CardContent>
              <Separator className="my-3" />
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">Notas</p>
                <p className="text-sm">{wo.notes || "Sin notas."}</p>
              </CardContent>
            </Card>

            <div className="space-y-6 lg:col-span-2">
              <Tabs defaultValue="detalle">
                <TabsList>
                  <TabsTrigger value="detalle">Detalle ({wo.services.length + wo.parts.length + wo.labor.length})</TabsTrigger>
                  <TabsTrigger value="pagos">Pagos ({payments.data?.length ?? 0})</TabsTrigger>
                  <TabsTrigger value="historial">Historial ({wo.status_history.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="detalle" className="space-y-4">
                  {(can("parts.view") ? true : false) && !["DELIVERED", "CANCELLED"].includes(wo.status) ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setAddServiceOpen(true)} disabled={services.isPending}>
                        <Wrench />
                        Agregar servicio
                      </Button>
                      {can("parts.view") ? (
                        <Button size="sm" variant="outline" onClick={() => setAddPartOpen(true)} disabled={parts.isPending}>
                          <Package />
                          Agregar repuesto
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {wo.services.length > 0 ? (
                    <div>
                      <p className="mb-2 text-sm font-medium">Servicios</p>
                      <div className="divide-y rounded-lg border">
                        {wo.services.map((s) => (
                          <div key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span>{s.service_name}</span>
                            <span className="font-medium tabular">{formatCurrency(s.price)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {wo.parts.length > 0 ? (
                    <div>
                      <p className="mb-2 text-sm font-medium">Repuestos</p>
                      <div className="divide-y rounded-lg border">
                        {wo.parts.map((p: WorkOrderPart) => (
                          <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span>
                              <PartName partId={p.part_id} /> <span className="text-muted-foreground">x{p.quantity}</span>
                            </span>
                            <span className="font-medium tabular">{formatCurrency(p.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {wo.labor.length > 0 ? (
                    <div>
                      <p className="mb-2 text-sm font-medium">Mano de obra</p>
                      <div className="divide-y rounded-lg border">
                        {wo.labor.map((l) => (
                          <div key={l.id} className="flex items-center justify-between px-3 py-2 text-sm">
                            <span>
                              {l.notes ?? "Mano de obra"} <span className="text-muted-foreground">· {l.hours} h</span>
                            </span>
                            <span className="font-medium tabular">{formatCurrency(l.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {wo.services.length === 0 && wo.parts.length === 0 && wo.labor.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Sin líneas todavía. Agrega servicios y repuestos para conformar la OT.
                    </p>
                  ) : null}

                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular">{formatCurrency(wo.subtotal)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Descuento</span>
                      <span className="tabular">-{formatCurrency(wo.discount)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">IGV</span>
                      <span className="tabular">{formatCurrency(wo.tax)}</span>
                    </div>
                    <Separator className="my-1.5" />
                    <div className="flex justify-between py-0.5">
                      <span className="font-semibold">Total</span>
                      <span className="font-semibold tabular">{formatCurrency(wo.total)}</span>
                    </div>
                    <div className="flex justify-between py-0.5">
                      <span className="text-muted-foreground">Pagado</span>
                      <span className="tabular">{formatCurrency(totalPaid)}</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="pagos" className="space-y-2">
                  {payments.data?.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Sin pagos registrados.</p>
                  ) : null}
                  {payments.data?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{formatCurrency(p.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD[p.method] ?? p.method} · {formatDateTime(p.paid_at)} {p.reference ? `· ${p.reference}` : ""}
                        </p>
                      </div>
                      <StatusBadge label={p.status} dot={false} />
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="historial" className="space-y-2">
                  {wo.status_history.map((h) => (
                    <div key={h.id} className="border-l-2 border-primary pl-3">
                      <p className="text-sm font-medium">{h.from_status ?? "—"} → {h.to_status}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.changed_by ? `${h.changed_by} · ` : ""}{formatDateTime(h.changed_at)}
                      </p>
                      {h.notes ? <p className="text-xs text-muted-foreground">{h.notes}</p> : null}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      )}

      {/* Registrar pago */}
      <ConfirmDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        title={`Registrar pago de ${formatCurrency(Math.max(balance, 0))}`}
        description="Elige el método de pago y confirma el cobro de la OT."
        confirmLabel={payMutation.isPending ? "Procesando..." : "Registrar"}
        cancelLabel="Cancelar"
        loading={payMutation.isPending}
        onConfirm={() => payMutation.mutate(String(Math.max(balance, 0)))}
      >
        <div className="space-y-3 py-2">
          <p className="text-sm font-medium">Monto a cobrar</p>
          <p className="text-2xl font-bold tabular text-primary">{formatCurrency(Math.max(balance, 0))}</p>
          <Select value={payMethod} onValueChange={setPayMethod}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHOD).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>

      {/* Agregar repuesto */}
      <ConfirmDialog
        open={addPartOpen}
        onOpenChange={(o) => {
          setAddPartOpen(o);
          if (!o) setSelectedPart("");
        }}
        title="Agregar repuesto a la OT"
        description="Selecciona un repuesto y la cantidad a consumir."
        confirmLabel={addPartMutation.isPending ? "Agregando..." : "Agregar"}
        loading={addPartMutation.isPending}
        onConfirm={() => selectedPart && addPartMutation.mutate()}
      >
        <div className="space-y-3 py-2">
          <Select value={selectedPart} onValueChange={setSelectedPart}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elegir repuesto" />
            </SelectTrigger>
            <SelectContent>
              {parts.data?.items.map((part) => (
                <SelectItem key={part.id} value={part.id}>
                  {part.sku} · {part.name} · {formatCurrency(part.sale_price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="number"
            min={1}
            value={partQty}
            onChange={(e) => setPartQty(Math.max(1, Number(e.target.value)))}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            placeholder="Cantidad"
          />
        </div>
      </ConfirmDialog>

      {/* Agregar servicio */}
      <ConfirmDialog
        open={addServiceOpen}
        onOpenChange={(o) => {
          setAddServiceOpen(o);
          if (!o) setSelectedService("");
        }}
        title="Agregar servicio a la OT"
        description="Selecciona un servicio del catálogo."
        confirmLabel={addServiceMutation.isPending ? "Agregando..." : "Agregar"}
        loading={addServiceMutation.isPending}
        onConfirm={() => selectedService && addServiceMutation.mutate()}
      >
        <div className="space-y-3 py-2">
          <Select value={selectedService} onValueChange={setSelectedService}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elegir servicio" />
            </SelectTrigger>
            <SelectContent>
              {services.data?.items.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · {formatCurrency(s.default_price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>

      {/* Acción de estado */}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title="Confirmar acción"
        description={`Aplicando "${actions.find((a) => a.action === confirmAction)?.label ?? confirmAction}" a la orden.`}
        confirmLabel="Confirmar"
        loading={actionMutation.isPending}
        onConfirm={() => confirmAction && actionMutation.mutate(confirmAction)}
      />
    </div>
  );
}

export default WorkOrderDetailPage;
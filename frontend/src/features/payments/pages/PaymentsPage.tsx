import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RotateCcw, Wallet } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { paymentsApi } from "@/features/payments/api";
import { workOrdersApi } from "@/features/work-orders/api";
import { PAYMENT_METHOD, PAYMENT_STATUS } from "@/constants/status";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getApiErrorMessage } from "@/services/api/http";
import type { Payment, WorkOrder } from "@/types/domain";

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [reference, setReference] = useState("");
  const [reversing, setReversing] = useState<Payment | null>(null);

  const orders = useQuery({
    queryKey: ["work-orders", "list", q],
    queryFn: () => workOrdersApi.list({ q: q || undefined, page_size: 10 }),
  });

  const balance = useQuery({
    queryKey: ["payments", "balance", selected?.id],
    queryFn: () => (selected ? paymentsApi.balance(selected.id) : Promise.resolve(null)),
    enabled: Boolean(selected),
  });

  const payments = useQuery({
    queryKey: ["payments", "by-work-order", selected?.id],
    queryFn: () => (selected ? paymentsApi.listForWorkOrder(selected.id) : Promise.resolve([])),
    enabled: Boolean(selected),
  });

  const payMutation = useMutation({
    mutationFn: () =>
      paymentsApi.register({
        work_order_id: selected!.id,
        amount: Number(amount),
        method,
        reference: reference || undefined,
      }),
    onSuccess: () => {
      toast.success("Pago registrado");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setPayOpen(false);
      setAmount("");
      setReference("");
      void balance.refetch();
      void payments.refetch();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const reverseMutation = useMutation({
    mutationFn: (id: string) => paymentsApi.reverse(id),
    onSuccess: () => {
      toast.success("Pago reversado");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setReversing(null);
      void balance.refetch();
      void payments.refetch();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const pendingAmount = Number(balance.data?.balance ?? 0);
  const defaultAmount = selected ? String(Math.max(pendingAmount, 0)) : "";

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <PageHeader title="Cobros" description="Registra y reversa pagos por orden de trabajo." icon={<Wallet />} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecciona una orden de trabajo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SearchInput value={q} onValueChange={setQ} placeholder="Buscar OT por número o cliente..." className="w-full sm:w-96" />
          {orders.isPending ? <p className="text-sm text-muted-foreground">Buscando...</p> : null}
          <div className="grid gap-2">
            {orders.data?.items.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  setSelected(o);
                  setAmount(String(Number(o.total) - Number(o.total_paid)));
                }}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent/50 ${selected?.id === o.id ? "border-primary bg-primary/10" : ""}`}
              >
                <span>
                  <span className="font-mono font-medium">{o.number ?? o.id.slice(0, 8)}</span>
                  <span className="ml-2 text-muted-foreground">Saldo {formatCurrency(Number(o.total) - Number(o.total_paid))}</span>
                </span>
                <StatusBadge meta={{ label: o.status, tone: "default" }} />
              </button>
            ))}
            {!orders.isPending && orders.data?.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin resultados.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Resumen</CardTitle>
              <Button size="sm" onClick={() => setPayOpen(true)}>
                <Plus />
                Registrar pago
              </Button>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span>Total de la OT</span>
                <span className="font-medium">{formatCurrency(Number(balance.data?.total ?? 0))}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span>Pagado</span>
                <span className="font-medium">{formatCurrency(Number(balance.data?.total_paid ?? 0))}</span>
              </div>
              <div className="flex justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <span className="font-semibold">Saldo pendiente</span>
                <span className="font-semibold">{formatCurrency(pendingAmount)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagos registrados</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
              {!payments.isPending && payments.data?.length === 0 ? (
                <EmptyState title="Sin pagos" description="Registra el primer pago con el botón superior." />
              ) : null}
              <div className="space-y-2">
                {payments.data?.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {formatCurrency(p.amount)} <span className="text-xs text-muted-foreground">· {PAYMENT_METHOD[p.method] ?? p.method}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(p.paid_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge meta={PAYMENT_STATUS[p.status]} />
                      {p.status === "COMPLETED" ? (
                        <Button size="icon-sm" variant="ghost" title="Reversar" onClick={() => setReversing(p)}>
                          <RotateCcw />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState title="Elige una orden" description="Selecciona una OT arriba para ver su saldo y pagos." />
      )}

      <ConfirmDialog
        open={payOpen}
        onOpenChange={(o) => { setPayOpen(o); if (!o) setAmount(""); }}
        title="Registrar pago"
        description="Asocia un cobro a la orden de trabajo seleccionada."
        confirmLabel={payMutation.isPending ? "Registrando..." : "Registrar pago"}
        loading={payMutation.isPending}
        onConfirm={() => payMutation.mutate()}
      >
        <div className="space-y-3 py-2">
          <div>
            <Label>Monto</Label>
            <Input type="number" min={0.01} className="mt-1" value={amount || defaultAmount} placeholder={defaultAmount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Método</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="mt-1">
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
          <div>
            <Label>Referencia</Label>
            <Input className="mt-1" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Nro. de voucher, operación..." />
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={Boolean(reversing)}
        onOpenChange={(o) => !o && setReversing(null)}
        title="¿Reversar este pago?"
        description="El monto volverá al saldo pendiente de la orden."
        confirmLabel="Reversar"
        tone="destructive"
        loading={reverseMutation.isPending}
        onConfirm={() => reversing && reverseMutation.mutate(reversing.id)}
      />
    </div>
  );
}

export default PaymentsPage;
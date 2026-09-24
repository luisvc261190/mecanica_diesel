import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, FileText, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ErrorState } from "@/components/feedback/error-state";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { quotesApi } from "@/features/quotes/api";
import { clientsApi } from "@/features/clients/api";
import { vehiclesApi } from "@/features/vehicles/api";
import { QUOTE_STATUS } from "@/constants/status";
import { formatCurrency, formatDate } from "@/lib/format";
import { getApiErrorMessage } from "@/services/api/http";
import { useAuth } from "@/features/auth/context/AuthContext";

export function QuoteDetailPage() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const quote = useQuery({
    queryKey: ["quotes", quoteId],
    queryFn: () => quotesApi.get(quoteId!),
    enabled: Boolean(quoteId),
  });

  const client = useQuery({
    queryKey: ["clients", quote.data?.client_id],
    queryFn: () => clientsApi.get(quote.data!.client_id),
    enabled: Boolean(quote.data?.client_id),
  });

  const vehicle = useQuery({
    queryKey: ["vehicles", quote.data?.vehicle_id],
    queryFn: () => vehiclesApi.get(quote.data!.vehicle_id!),
    enabled: Boolean(quote.data?.vehicle_id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quotes", quoteId] });

  const actionMutation = useMutation({
    mutationFn: (action: string) => {
      if (action === "approve") return quotesApi.approve(quoteId!);
      if (action === "reject") return quotesApi.reject(quoteId!);
      return quotesApi.send(quoteId!);
    },
    onSuccess: () => {
      toast.success("Cotización actualizada");
      invalidate();
      setConfirmAction(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const convertMutation = useMutation({
    mutationFn: () => quotesApi.convert(quoteId!),
    onSuccess: (workOrder) => {
      toast.success("Cotización convertida a OT");
      invalidate();
      setConfirmAction(null);
      navigate(`/app/ordenes/${workOrder.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (quote.isError) return <ErrorState onRetry={() => void quote.refetch()} className="p-6" />;

  const q = quote.data;
  const clientName =
    (client.data?.company_name ?? `${client.data?.first_name ?? ""} ${client.data?.last_name ?? ""}`.trim()) || "—";

  const actions = q
    ? [
        ...((["DRAFT", "SENT"].includes(q.status) ? [{ action: "approve" as const, label: "Aprobar", icon: Check }] : [])),
        ...(q.status === "DRAFT" ? [{ action: "send" as const, label: "Enviar", icon: Send }] : []),
        ...((["DRAFT", "SENT", "APPROVED"].includes(q.status) ? [{ action: "convert" as const, label: "Convertir a OT", icon: FileText }] : [])),
        ...(q.status === "SENT" ? [{ action: "reject" as const, label: "Rechazar", icon: X }] : []),
      ]
    : [];

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate("/app/cotizaciones")} aria-label="Atrás">
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold">{q?.number ?? "Cotización"}</h1>
          <p className="text-sm text-muted-foreground">
            Para {clientName} {vehicle.data ? `· ${vehicle.data.plate ?? vehicle.data.vin ?? ""}` : ""}
          </p>
        </div>
        {q ? (
          <div className="flex items-center gap-2">
            <StatusBadge meta={QUOTE_STATUS[q.status]} />
            {actions.length > 0 && can("quotes.approve") ? (
              actions.map((a) => (
                <Button key={a.action} variant={a.action === "reject" ? "outline" : "default"} size="sm" onClick={() => setConfirmAction(a.action)}>
                  <a.icon />
                  {a.label}
                </Button>
              ))
            ) : null}
          </div>
        ) : null}
      </div>

      {q ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Ítems</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {q.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium">{item.description}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {item.kind === "SERVICE" ? "Servicio" : "Repuesto"} · x{item.quantity}
                      </span>
                    </span>
                    <span className="font-medium tabular">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                {q.items.length === 0 ? <p className="px-3 py-6 text-center text-sm text-muted-foreground">Sin ítems.</p> : null}
              </div>

              <div className="ml-auto mt-4 w-full max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular">{formatCurrency(q.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descuento</span>
                  <span className="tabular">-{formatCurrency(q.discount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IGV</span>
                  <span className="tabular">{formatCurrency(q.tax)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="tabular">{formatCurrency(q.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Creada</p>
                <p>{formatDate(q.created_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Válida hasta</p>
                <p>{q.valid_until ? formatDate(q.valid_until) : "—"}</p>
              </div>
              {q.terms ? (
                <>
                  <Separator />
                  <div>
                    <p className="text-xs text-muted-foreground">Condiciones</p>
                    <p>{q.terms}</p>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onOpenChange={(o) => !o && setConfirmAction(null)}
        title={confirmAction === "convert" ? "¿Convertir a orden de trabajo?" : `¿${confirmAction === "reject" ? "Rechazar" : confirmAction === "send" ? "Enviar" : "Aprobar"} cotización?`}
        description={
          confirmAction === "convert"
            ? "Se creará una OT con los ítems aprobados de esta cotización."
            : "Esta acción actualizará el estado de la cotización."
        }
        confirmLabel={confirmAction === "convert" ? "Convertir" : "Confirmar"}
        loading={actionMutation.isPending || convertMutation.isPending}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction === "convert") convertMutation.mutate();
          else actionMutation.mutate(confirmAction);
        }}
      />
    </div>
  );
}

export default QuoteDetailPage;
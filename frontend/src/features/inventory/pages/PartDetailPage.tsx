import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowLeftRight, Gauge, Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { inventoryApi } from "@/features/inventory/api";
import { PartFormDialog } from "@/features/inventory/components/PartFormDialog";
import { branchesApi } from "@/features/settings/api";
import { MOVEMENT_TYPE, PART_STATUS } from "@/constants/status";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getApiErrorMessage } from "@/services/api/http";
import { useAuth } from "@/features/auth/context/AuthContext";

export function PartDetailPage() {
  const { partId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustBranch, setAdjustBranch] = useState("");
  const [newQty, setNewQty] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [qty, setQty] = useState("1");

  const part = useQuery({
    queryKey: ["inventory", "parts", partId],
    queryFn: () => inventoryApi.get(partId!),
    enabled: Boolean(partId),
  });

  const branches = useQuery({ queryKey: ["tenant", "branches"], queryFn: branchesApi.list });

  const movements = useQuery({
    queryKey: ["inventory", "parts", partId, "movements"],
    queryFn: () => inventoryApi.movements(partId!, { page: 1, page_size: 50 }),
    enabled: Boolean(partId),
  });

  const stocks = useQuery({
    queryKey: ["inventory", "parts", partId, "stock"],
    queryFn: () =>
      Promise.all(
        (branches.data ?? []).map(async (b) => ({
          branch: b,
          stock: await inventoryApi.stock(b.id, partId!).catch(() => null),
        })),
      ),
    enabled: Boolean(partId) && (branches.data?.length ?? 0) > 0 && !editOpen,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory"] });
    void movements.refetch();
    void stocks.refetch();
  };

  const adjustMutation = useMutation({
    mutationFn: () => inventoryApi.adjust({ branch_id: adjustBranch, part_id: partId!, new_quantity: Number(newQty) }),
    onSuccess: () => {
      toast.success("Stock ajustado");
      invalidate();
      setAdjustOpen(false);
      setNewQty("");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const transferMutation = useMutation({
    mutationFn: () => inventoryApi.transfer({ source_branch_id: source, target_branch_id: target, part_id: partId!, quantity: Number(qty) }),
    onSuccess: () => {
      toast.success("Stock transferido");
      invalidate();
      setTransferOpen(false);
      setQty("1");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (part.isError) return <ErrorState onRetry={() => void part.refetch()} className="p-6" />;

  const p = part.data;

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate("/app/inventario")} aria-label="Atrás">
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{p?.name ?? "Repuesto"}</h1>
          <p className="font-mono text-sm text-muted-foreground">{p?.sku}</p>
        </div>
        {p && can("inventory.adjust") ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight />
              Transferir
            </Button>
            <Button size="sm" onClick={() => setAdjustOpen(true)}>
              <Gauge />
              Ajustar stock
            </Button>
          </div>
        ) : null}
      </div>

      {p ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Stock por sucursal</CardTitle>
                <StatusBadge meta={PART_STATUS[p.status]} />
              </CardHeader>
              <CardContent>
                {stocks.isPending ? <p className="text-sm text-muted-foreground">Cargando stock...</p> : null}
                {!stocks.isPending && stocks.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin sucursales configuradas.</p>
                ) : null}
                <div className="space-y-2">
                  {stocks.data?.map(({ branch, stock }) => {
                    const qtyValue = stock ? Number(stock.quantity) : 0;
                    const low = qtyValue <= Number(p.reorder_level ?? 0);
                    return (
                      <div key={branch.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span className="font-medium">{branch.name}</span>
                        <Badge variant={low ? "warning" : "outline"}>{qtyValue} unidades{low ? " · bajo" : ""}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Movimientos recientes</CardTitle>
              </CardHeader>
              <CardContent>
                {movements.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
                {!movements.isPending && movements.data?.items.length === 0 ? (
                  <EmptyState title="Sin movimientos" description="Los usos, compras y ajustes aparecerán aquí." />
                ) : null}
                <div className="divide-y rounded-lg border">
                  {movements.data?.items.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">
                          {MOVEMENT_TYPE[m.type]?.label ?? m.type} <span className="text-muted-foreground">· {m.quantity}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(m.moved_at)} {m.notes ? `· ${m.notes}` : ""}
                        </p>
                      </div>
                      {m.unit_cost ? <span className="tabular text-muted-foreground">{formatCurrency(m.unit_cost)}</span> : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Ficha</CardTitle>
              {can("parts.update") ? (
                <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(true)} aria-label="Editar repuesto">
                  <Pencil />
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Marca</p>
                <p>{p.brand ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Costo de compra</p>
                <p>{formatCurrency(p.purchase_price)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Precio de venta</p>
                <p className="font-semibold">{formatCurrency(p.sale_price)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Punto de pedido</p>
                <p>{Number(p.reorder_level ?? 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ubicación</p>
                <p>{p.location ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <PartFormDialog open={editOpen} onOpenChange={setEditOpen} part={p} />

      {/* Ajuste de stock */}
      <ConfirmDialog
        open={adjustOpen}
        onOpenChange={(o) => { setAdjustOpen(o); if (!o) setNewQty(""); }}
        title="Ajustar stock"
        description="Define el conteo real del repuesto en la sucursal."
        confirmLabel={adjustMutation.isPending ? "Ajustando..." : "Ajustar"}
        loading={adjustMutation.isPending}
        onConfirm={() => adjustMutation.mutate()}
      >
        <div className="space-y-3 py-2">
          <div>
            <Label>Sucursal</Label>
            <Select value={adjustBranch} onValueChange={setAdjustBranch}>
              <SelectTrigger className="w-full mt-1">
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
          </div>
          <div>
            <Label>Nueva cantidad</Label>
            <Input type="number" min={0} className="mt-1" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
          </div>
        </div>
      </ConfirmDialog>

      {/* Transferencia */}
      <ConfirmDialog
        open={transferOpen}
        onOpenChange={(o) => { setTransferOpen(o); if (!o) setQty("1"); }}
        title="Transferir stock"
        description="Mueve unidades entre sucursales."
        confirmLabel={transferMutation.isPending ? "Transfiriendo..." : "Transferir"}
        loading={transferMutation.isPending}
        onConfirm={() => transferMutation.mutate()}
      >
        <div className="space-y-3 py-2">
          <div>
            <Label>Sucursal origen</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="mt-1 w-full">
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
          </div>
          <div>
            <Label>Sucursal destino</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger className="mt-1 w-full">
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
          </div>
          <div>
            <Label>Cantidad</Label>
            <Input type="number" min={1} className="mt-1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}

export default PartDetailPage;
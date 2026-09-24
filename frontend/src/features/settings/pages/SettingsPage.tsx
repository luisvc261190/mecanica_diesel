import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, KeyRound, Layers, Pencil, Plus, Settings2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { tenantApi, branchesApi, usersApi, servicesApi } from "@/features/settings/api";
import { platformApi, type PlatformUser } from "@/features/platform/api";
import { useAuth } from "@/features/auth/context/AuthContext";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getApiErrorMessage } from "@/services/api/http";

export function SettingsPage() {
  return (
    <div className="space-y-6 p-4 lg:p-6">
      <PageHeader title="Configuración" description="Empresa, sucursales, usuarios, servicios y suscripción." icon={<Settings2 />} />

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">
            <Building2 />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="sucursales">Sucursales</TabsTrigger>
          <TabsTrigger value="usuarios">
            <Users />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="servicios">
            <Layers />
            Servicios
          </TabsTrigger>
          <TabsTrigger value="suscripcion">Suscripción</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa">
          <CompanyTab />
        </TabsContent>
        <TabsContent value="sucursales">
          <BranchesTab />
        </TabsContent>
        <TabsContent value="usuarios">
          <UsersTab />
        </TabsContent>
        <TabsContent value="servicios">
          <ServicesTab />
        </TabsContent>
        <TabsContent value="suscripcion">
          <SubscriptionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyTab() {
  const queryClient = useQueryClient();
  const tenant = useQuery({ queryKey: ["tenant"], queryFn: tenantApi.get });
  const settings = useQuery({ queryKey: ["tenant", "settings"], queryFn: tenantApi.settings.get });

  const [form, setForm] = useState<Record<string, string>>({});
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  const resolved = tenant.data;
  const current = Object.keys(form).length
    ? form
    : {
        commercial_name: resolved?.commercial_name ?? "",
        legal_name: resolved?.legal_name ?? "",
        tax_id: resolved?.tax_id ?? "",
        phone: resolved?.phone ?? "",
        email: resolved?.email ?? "",
        address: resolved?.address ?? "",
        currency: resolved?.currency ?? "",
        timezone: resolved?.timezone ?? "",
      };

  const saveMutation = useMutation({
    mutationFn: () =>
      tenantApi.update(
        {
          commercial_name: current.commercial_name,
          legal_name: current.legal_name || undefined,
          tax_id: current.tax_id || undefined,
          phone: current.phone || undefined,
          email: current.email || undefined,
          address: current.address || undefined,
        },
      ),
    onSuccess: () => {
      toast.success("Empresa actualizada");
      queryClient.invalidateQueries({ queryKey: ["tenant"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: () => tenantApi.settings.update({ require_approval_for_work: Boolean(toggles.approval), show_prices_in_documents: Boolean(toggles.prices) }),
    onSuccess: () => {
      toast.success("Preferencias guardadas");
      queryClient.invalidateQueries({ queryKey: ["tenant", "settings"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (tenant.isPending) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const s = settings.data;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Datos de la empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(
            [
              ["commercial_name", "Nombre comercial"],
              ["legal_name", "Razón social"],
              ["tax_id", "RUC"],
              ["phone", "Teléfono"],
              ["email", "Email"],
              ["address", "Dirección"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input
                className="mt-1"
                value={current[key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Label>Moneda</Label>
            <Input readOnly className="mt-1" value={resolved?.currency ?? "PEN"} />
          </div>
          <div>
            <Label>Zona horaria</Label>
            <Input readOnly className="mt-1" value={resolved?.timezone ?? "America/Lima"} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Requiere aprobación para trabajar</p>
              <p className="text-xs text-muted-foreground">Las OT esperarán aprobación antes de iniciar la reparación.</p>
            </div>
            <Switch
              checked={toggles.approval ?? s?.require_approval_for_work ?? false}
              onCheckedChange={(v) => setToggles((t) => ({ ...t, approval: v }))}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mostrar precios en documentos</p>
              <p className="text-xs text-muted-foreground">Incluye montos en cotizaciones y órdenes.</p>
            </div>
            <Switch
              checked={toggles.prices ?? s?.show_prices_in_documents ?? true}
              onCheckedChange={(v) => setToggles((t) => ({ ...t, prices: v }))}
            />
          </div>
          <Button variant="outline" onClick={() => saveSettingsMutation.mutate()} disabled={saveSettingsMutation.isPending}>
            {saveSettingsMutation.isPending ? "Guardando..." : "Guardar preferencias"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BranchesTab() {
  const branches = useQuery({ queryKey: ["tenant", "branches"], queryFn: branchesApi.list });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sucursales</CardTitle>
      </CardHeader>
      <CardContent>
        {branches.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {branches.data?.map((b) => (
            <div key={b.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{b.name}</span>
                <StatusBadge meta={{ label: b.status, tone: b.status === "ACTIVE" ? "success" : "muted" }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {b.address ?? "Sin dirección"} {b.phone ? ` · ${b.phone}` : ""}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const { can, user, logout } = useAuth();
  const queryClient = useQueryClient();
  const isPlatformAdmin = Boolean(user?.is_platform_admin);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlatformUser | null>(null);
  const [resetTarget, setResetTarget] = useState<PlatformUser | null>(null);
  const [search, setSearch] = useState("");

  const users = useQuery({
    queryKey: ["users", search],
    queryFn: () =>
      isPlatformAdmin
        ? platformApi.listUsers({ page_size: 50, q: search || undefined })
        : usersApi.list({ page_size: 50, q: search || undefined }),
  });
  const roles = useQuery({ queryKey: ["users", "roles"], queryFn: usersApi.roles, enabled: !isPlatformAdmin });

  const rows = (users.data?.items ?? []) as PlatformUser[];

  const createMutation = useMutation({
    mutationFn: (payload: { email: string; full_name: string; password: string; role_code?: string; phone?: string }) => usersApi.create(payload),
    onSuccess: () => {
      toast.success("Usuario creado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      isPlatformAdmin ? platformApi.updateUser(id, { is_active }) : usersApi.update(id, { is_active }),
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { full_name: string; phone?: string; is_active: boolean } }) =>
      isPlatformAdmin ? platformApi.updateUser(id, payload) : usersApi.update(id, payload),
    onSuccess: () => {
      toast.success("Usuario actualizado");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditTarget(null);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => platformApi.resetPassword(id, password),
    onSuccess: (_data, vars) => {
      toast.success("Contraseña restablecida");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setResetTarget(null);
      if (vars.id === user?.id) {
        toast.info("Vuelve a iniciar sesión con tu nueva contraseña.");
        void logout();
      }
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const canToggleActive = (u: PlatformUser) => !u.is_platform_admin && u.id !== user?.id;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Usuarios</CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
          {!isPlatformAdmin && can("users.create") ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus />
              Agregar usuario
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {users.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
        {isPlatformAdmin && !users.isPending ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Vista de plataforma: se muestran los usuarios de todas las empresas. Solo el Super Admin puede restablecer contraseñas.
          </p>
        ) : null}
        <div className="space-y-2">
          {rows.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{u.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {u.email}
                  {u.tenant_name ? ` · ${u.tenant_name}` : ""}
                  {u.roles.length ? ` · ${u.roles.join(", ")}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge meta={{ label: u.is_active ? "Activo" : "Inactivo", tone: u.is_active ? "success" : "muted" }} />
                {can("users.update") ? (
                  <Button size="icon-sm" variant="ghost" onClick={() => setEditTarget(u)} aria-label="Editar usuario">
                    <Pencil />
                  </Button>
                ) : null}
                {can("users.update") && canToggleActive(u) ? (
                  <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate({ id: u.id, is_active: !u.is_active })}>
                    {u.is_active ? "Desactivar" : "Activar"}
                  </Button>
                ) : null}
                {isPlatformAdmin ? (
                  <Button size="icon-sm" variant="ghost" onClick={() => setResetTarget(u)} aria-label="Restablecer contraseña">
                    <KeyRound />
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!users.isPending && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No se encontraron usuarios.</p>
          ) : null}
        </div>
      </CardContent>

      {createOpen && !isPlatformAdmin ? (
        <CreateUserDialog
          roles={roles.data ?? []}
          onClose={() => setCreateOpen(false)}
          onSubmit={(v) => createMutation.mutate(v)}
          loading={createMutation.isPending}
        />
      ) : null}
      {editTarget ? (
        <EditUserDialog
          user={editTarget}
          isSelf={editTarget.id === user?.id}
          onClose={() => setEditTarget(null)}
          onSubmit={(payload) => editMutation.mutate({ id: editTarget.id, payload })}
          loading={editMutation.isPending}
        />
      ) : null}
      {resetTarget ? (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
          onSubmit={(password) => resetMutation.mutate({ id: resetTarget.id, password })}
          loading={resetMutation.isPending}
        />
      ) : null}
    </Card>
  );
}

function CreateUserDialog({
  roles,
  onClose,
  onSubmit,
  loading,
}: {
  roles: Array<{ code: string; name: string }>;
  onClose: () => void;
  onSubmit: (v: { email: string; full_name: string; password: string; role_code?: string; phone?: string }) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STAFF");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nuevo usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nombre completo</Label>
            <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Contraseña</Label>
            <Input type="password" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label>Rol</Label>
            <select className="mt-1 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
              {roles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => onSubmit({ email, full_name: fullName, password, role_code: role })}
              disabled={loading || !email || !fullName || password.length < 8}
            >
              {loading ? "Creando..." : <><UserPlus /> Crear usuario</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EditUserDialog({
  user,
  isSelf,
  onClose,
  onSubmit,
  loading,
}: {
  user: PlatformUser;
  isSelf: boolean;
  onClose: () => void;
  onSubmit: (v: { full_name: string; phone?: string; is_active: boolean }) => void;
  loading: boolean;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [isActive, setIsActive] = useState(user.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Editar usuario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input readOnly className="mt-1" value={user.email} />
            <p className="mt-1 text-xs text-muted-foreground">El email no se puede cambiar porque es el acceso del usuario.</p>
          </div>
          <div>
            <Label>Nombre completo</Label>
            <Input className="mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input className="mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Cuenta activa</p>
              <p className="text-xs text-muted-foreground">
                {isSelf ? "Tu propia cuenta no puede desactivarse." : "Permite el inicio de sesión."}
              </p>
            </div>
            <Switch checked={isActive} disabled={isSelf || user.is_platform_admin} onCheckedChange={setIsActive} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => onSubmit({ full_name: fullName, phone: phone || undefined, is_active: isActive })}
              disabled={loading || fullName.length < 2}
            >
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
  onSubmit,
  loading,
}: {
  user: PlatformUser;
  onClose: () => void;
  onSubmit: (password: string) => void;
  loading: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length >= 8 && password !== confirm;
  const valid = password.length >= 8 && password === confirm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Restablecer contraseña</CardTitle>
          <p className="text-sm text-muted-foreground">
            Se asignará una nueva contraseña a {user.email}. Deberá volver a iniciar sesión.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nueva contraseña</Label>
            <Input
              type="password"
              className="mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
            />
          </div>
          <div>
            <Label>Confirmar contraseña</Label>
            <Input type="password" className="mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {mismatch ? <p className="mt-1 text-xs text-destructive">Las contraseñas no coinciden.</p> : null}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => onSubmit(password)} disabled={loading || !valid}>
              {loading ? "Guardando..." : <><KeyRound /> Restablecer</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ServicesTab() {
  const queryClient = useQueryClient();
  const services = useQuery({ queryKey: ["services"], queryFn: () => servicesApi.list({ page_size: 100 }) });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", category: "", default_price: "" });

  const createMutation = useMutation({
    mutationFn: () =>
      servicesApi.create({
        name: form.name,
        code: form.code || undefined,
        category: form.category || undefined,
        default_price: Number(form.default_price),
      }),
    onSuccess: () => {
      toast.success("Servicio creado");
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setCreateOpen(false);
      setForm({ name: "", code: "", category: "", default_price: "" });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.remove(id),
    onSuccess: () => {
      toast.success("Servicio eliminado");
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Servicios</CardTitle>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus />
          Agregar servicio
        </Button>
      </CardHeader>
      <CardContent>
        {services.isPending ? <p className="text-sm text-muted-foreground">Cargando...</p> : null}
        <div className="space-y-2">
          {services.data?.items.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.code ?? "sin código"} · {s.category ?? "sin categoría"} · {s.unit}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatCurrency(Number(s.default_price))}</span>
                <StatusBadge meta={{ label: s.is_active ? "Activo" : "Inactivo", tone: s.is_active ? "success" : "muted" }} />
                <Button size="icon-sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(s.id)} aria-label="Eliminar servicio">
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Nuevo servicio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nombre</Label>
                <Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Código</Label>
                  <Input className="mt-1" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Input className="mt-1" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Precio por defecto</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={form.default_price}
                  onChange={(e) => setForm((f) => ({ ...f, default_price: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => createMutation.mutate()} disabled={!form.name}>
                  {createMutation.isPending ? "Creando..." : "Crear servicio"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </Card>
  );
}

function SubscriptionTab() {
  const subscription = useQuery({ queryKey: ["subscription"], queryFn: tenantApi.subscription });

  const sub = subscription.data;
  if (subscription.isPending) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Suscripción</CardTitle>
        <StatusBadge meta={{ label: sub?.status ?? "—", tone: "default" }} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="font-medium">{sub?.plan?.name ?? "Sin plan"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Precio</p>
            <p className="font-medium">{formatCurrency(Number(sub?.plan?.price ?? 0))} / {sub?.plan?.billing_cycle ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Usuarios máximos</p>
            <p>{sub?.plan?.max_users ?? "Ilimitado"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sucursales máximas</p>
            <p>{sub?.plan?.max_branches ?? "Ilimitado"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inicio del periodo</p>
            <p>{sub?.current_period_start ? formatDateTime(sub.current_period_start) : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fin del periodo</p>
            <p>{sub?.current_period_end ? formatDateTime(sub.current_period_end) : "—"}</p>
          </div>
        </div>
        {sub?.trial_ends_at ? (
          <Separator />
        ) : null}
        {sub?.plan ? <p className="text-muted-foreground">{sub.plan.description}</p> : null}
      </CardContent>
    </Card>
  );
}

export default SettingsPage;
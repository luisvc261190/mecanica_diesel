import { Building2, Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/context/AuthContext";
import { cn } from "@/lib/utils";

export function TenantSwitcher() {
  const { tenants, selectedTenant, selectTenant } = useAuth();

  if (tenants.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="line-clamp-1 font-semibold">{selectedTenant?.commercial_name ?? "—"}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" aria-label="Cambiar empresa">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="line-clamp-1 max-w-40">{selectedTenant?.commercial_name ?? "Elegir empresa"}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Empresa activa</DropdownMenuLabel>
        {tenants.map((tenant) => (
          <DropdownMenuItem
            key={tenant.id}
            onClick={() => void selectTenant(tenant.id)}
            className="flex items-start gap-2 py-2"
          >
            <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">
              <span className="block font-medium">{tenant.commercial_name}</span>
              <span className="block text-xs text-muted-foreground">{tenant.slug}</span>
            </span>
            {selectedTenant?.id === tenant.id ? <Check className={cn("size-4 text-primary")} /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2 pb-1 text-xs text-muted-foreground">
          El acceso se cambia siempre a través del servidor (JWT + tenant).
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
import { Loader2 } from "lucide-react";

export function AppLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <div className="flex items-center gap-2 text-primary">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm font-medium">Cargando...</span>
      </div>
    </div>
  );
}
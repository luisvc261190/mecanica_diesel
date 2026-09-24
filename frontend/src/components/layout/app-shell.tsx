import * as React from "react";
import { Outlet } from "react-router-dom";

import { CommandPaletteProvider } from "@/components/layout/command-palette-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <CommandPaletteProvider>
      <div className="min-h-screen bg-background text-foreground">
        <div className="flex min-h-screen">
          <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />
            <main className="min-w-0 flex-1">
              <React.Suspense
                fallback={
                  <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
                    Cargando...
                  </div>
                }
              >
                <Outlet />
              </React.Suspense>
            </main>
          </div>
        </div>
      </div>
    </CommandPaletteProvider>
  );
}
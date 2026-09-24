import * as React from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8">
        <div className="rounded-full bg-destructive/10 p-4 text-destructive">
          <AlertOctagon className="size-8" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-semibold">Algo salió mal</h1>
          <p className="mt-1 text-sm text-muted-foreground">Puedes intentar recargar la página para continuar.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            window.location.reload();
          }}
        >
          <RotateCcw />
          Recargar
        </Button>
      </div>
    );
  }
}
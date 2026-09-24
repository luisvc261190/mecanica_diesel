import * as React from "react";
import { RouterProvider } from "react-router-dom";

import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { ErrorBoundary } from "@/components/feedback/error-boundary";

export function App() {
  return (
    <AppProviders>
      <ErrorBoundary>
        <React.Suspense fallback={null}>
          <RouterProvider router={router} />
        </React.Suspense>
      </ErrorBoundary>
    </AppProviders>
  );
}
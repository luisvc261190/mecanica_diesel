import { createBrowserRouter, Navigate } from "react-router-dom";
import { lazy } from "react";

import { GuestRoute, ProtectedRoute, PermissionRoute } from "@/app/router/guards";
import { AppShell } from "@/components/layout/app-shell";

const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const OnboardingPage = lazy(() => import("@/features/auth/pages/OnboardingPage"));

const DashboardPage = lazy(() => import("@/features/dashboard/pages/DashboardPage"));
const ClientsPage = lazy(() => import("@/features/clients/pages/ClientsPage"));
const ClientDetailPage = lazy(() => import("@/features/clients/pages/ClientDetailPage"));
const VehiclesPage = lazy(() => import("@/features/vehicles/pages/VehiclesPage"));
const VehicleDetailPage = lazy(() => import("@/features/vehicles/pages/VehicleDetailPage"));
const AppointmentsPage = lazy(() => import("@/features/appointments/pages/AppointmentsPage"));
const ReceptionsPage = lazy(() => import("@/features/receptions/pages/ReceptionsPage"));
const DiagnosticsPage = lazy(() => import("@/features/diagnostics/pages/DiagnosticsPage"));
const QuotesPage = lazy(() => import("@/features/quotes/pages/QuotesPage"));
const QuoteDetailPage = lazy(() => import("@/features/quotes/pages/QuoteDetailPage"));
const QuoteCreatePage = lazy(() => import("@/features/quotes/pages/QuoteCreatePage"));
const WorkOrdersPage = lazy(() => import("@/features/work-orders/pages/WorkOrdersPage"));
const WorkOrderDetailPage = lazy(() => import("@/features/work-orders/pages/WorkOrderDetailPage"));
const InventoryPage = lazy(() => import("@/features/inventory/pages/InventoryPage"));
const PartDetailPage = lazy(() => import("@/features/inventory/pages/PartDetailPage"));
const PaymentsPage = lazy(() => import("@/features/payments/pages/PaymentsPage"));
const ReportsPage = lazy(() => import("@/features/reports/pages/ReportsPage"));
const SettingsPage = lazy(() => import("@/features/settings/pages/SettingsPage"));

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/onboarding", element: <OnboardingPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/app",
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/app/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          {
            element: <PermissionRoute permission="clients.view" />,
            children: [
              { path: "clientes", element: <ClientsPage /> },
              { path: "clientes/:clientId", element: <ClientDetailPage /> },
            ],
          },
          {
            element: <PermissionRoute permission="vehicles.view" />,
            children: [
              { path: "vehiculos", element: <VehiclesPage /> },
              { path: "vehiculos/:vehicleId", element: <VehicleDetailPage /> },
            ],
          },
          { path: "citas", element: <AppointmentsPage /> },
          { path: "recepciones", element: <ReceptionsPage /> },
          { path: "diagnosticos", element: <DiagnosticsPage /> },
          {
            element: <PermissionRoute permission="quotes.view" />,
            children: [
              { path: "cotizaciones", element: <QuotesPage /> },
              { path: "cotizaciones/nueva", element: <QuoteCreatePage /> },
              { path: "cotizaciones/:quoteId", element: <QuoteDetailPage /> },
            ],
          },
          {
            element: <PermissionRoute permission="work_orders.view" />,
            children: [
              { path: "ordenes", element: <WorkOrdersPage /> },
              { path: "ordenes/:workOrderId", element: <WorkOrderDetailPage /> },
            ],
          },
          { path: "inventario", element: <InventoryPage /> },
          { path: "inventario/:partId", element: <PartDetailPage /> },
          { path: "pagos", element: <PaymentsPage /> },
          { path: "reportes", element: <ReportsPage /> },
          { path: "configuracion", element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "/", element: <Navigate to="/app" replace /> },
  { path: "*", element: <Navigate to="/app" replace /> },
]);
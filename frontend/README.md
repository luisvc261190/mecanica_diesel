# Laboratorio Diesel — Frontend

SPA React para la plataforma multi-tenant de gestión de talleres mecánicos.
Consume la API FastAPI `backend/` (`/api/v1`).

## Stack

- **React 19** + **TypeScript 5.8** (modo estricto, `noUnusedLocals`/`noUnusedParameters`)
- **Vite 6** + Tailwind CSS v4 (plugin `@tailwindcss/vite`)
- **@tanstack/react-query** (servidor) y **@tanstack/react-table** (tablas de datos)
- **react-router-dom** v7 con rutas `lazy()` (defaul exports obligatorios) + guards de auth/permissions
- **react-hook-form** + **zod** (`zodResolver`) para formularios
- **recharts** (reportes), **date-fns** (fechas, locale `es`), **sonner** (toasts)
- UI shadcn-style **hecha a mano** sobre primitivos Radix (`src/components/ui/*`)
- **Vitest** + Testing Library para unit tests (`npm run test`)

## Requisitos

- Node 20+ (probado con Node 24)
- El backend corriendo en `http://localhost:8000` (`uvicorn app.main:app --reload`)

## Instalación y scripts

```bash
npm install

npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run typecheck  # tsc -b --noEmit
npm run lint       # eslint . --max-warnings 0
npm run build      # tsc -b && vite build
npm run test       # vitest run
npm run format     # prettier (src/**/*.{ts,tsx,css})
```

## Variables de entorno

Copia `.env` a partir de `.env.example` (o déjala con los defaults):

| Variable          | Default                  | Descripción                     |
| ----------------- | ------------------------ | ------------------------------- |
| `VITE_API_URL`    | `http://localhost:8000` | Base de la API (sin `/api/v1`) |

Si `VITE_API_URL` es relativo, se usa el origin actual (útil para servir junto al backend).

## Estructura

```
src/
├── app/             # bootstrap: router, providers (auth/theme/query), guards
├── components/
│   ├── feedback/    # error-state, empty-state, confirm-dialog, error-boundary
│   ├── layout/      # app-shell, topbar, sidebar, tenant-switcher, command palette
│   ├── shared/      # page-header, status-badge, stat-card
│   └── ui/          # componentes base shadcn-style (button, dialog, form, select…)
├── constants/
│   └── status.ts    # etiquetas/tonos/iconos de TODOS los estados (espejo del backend)
├── features/        # 1 feature = 1 carpeta (api.ts, pages/, components/)
│   ├── auth/ clients/ vehicles/ appointments/ receptions/ diagnostics/
│   ├── quotes/ work-orders/ inventory/ payments/ reports/ settings/ dashboard/
├── lib/             # format.ts, utils.ts, query-keys.ts, env.ts
├── services/
│   ├── api/         # client http (envelope, refresh, errores) + wrappers por dominio
│   └── storage/     # tokenStore (refresh en localStorage: ltd.refresh_token)
├── test/setup.ts    # setup vitest (sonner mock, matchMedia, cleanup)
├── types/domain.ts  # tipos espejo del OpenAPI del backend (montos Decimal = string)
```

## Convenciones

- **Envelope de la API**: toda respuesta es `{ data, message }`. `apiGet<T>(path, query?)`
  desempaqueta `data` automáticamente; los `400/422/…` lanzan `ApiError` con
  `getApiErrorMessage(error, fallback?)` para pantallas.
- **Auth**: access token en memoria (proveedor `configureAccessToken`), refresh token en
  `localStorage` (`ltd.refresh_token`). El client rota el access token automáticamente ante
  `401` (`configureRefresh`) y dispara el cierre de sesión si el refresh falla.
- **RBAC**: `PERMISSIONS` en `AuthContext` es espejo de `backend/core/permissions.py`.
  Solo oculta UI; la seguridad real la aplica el backend.
- **Rutas lazy y fallbacks**: cada página exporta `export default <Page>`. IDs de recurso
  se leen con `useParams`; los títulos se obtienen del detalle vía `useQuery`.
- **Estados/estatus**: nunca escribir tonos/etiquetas ad-hoc; usar los mapas de
  `constants/status.ts` y el componente `StatusBadge` (`variant` incluye `success`,
  `warning`, `info`, `muted`, `primary`, …).
- **Formularios (RHF + zod)**: patrón con `ControllerProps` de `src/components/ui/form.tsx`;
  con `zodResolver` y campos `z.coerce().default()` tipa `FormValues = z.output<typeof schema>`
  y castea el resolver como `Resolver<FormValues>` (el typing nativo del resolver no
  recomienda el `Control` de RHF).
- **Paginated**: la API devuelve `{ items, page, page_size, total, pages }`; el cast de
  respuestas vacías debe construir el objeto completo.
- **Decimales**: el backend serializa `Decimal` como string; convertir con `Number(…)` al
  enviar y formatear con `formatCurrency`/`formatNumber` (es-PE, S/).
- **Migraciones de shadcn**: `src/components/ui/*` son propios (sin `tw-animate-css`).
  Preferir editar el componente base en vez de parchear cada llamador.

## UI / navegación

Rutas en `src/app/router/index.tsx`, protegidas por `ProtectedRoute` (sesión) y
`PermissionRoute` (permiso puntual). Las rutas de detalle usan segmentos en español
(`/app/clientes/:clientId`, `/app/ordenes/:workOrderId`, …).

Páginas sin endpoint de listado (recepciones, diagnósticos, pagos) se modelaron como
flujos/wizards y pagos por OT según los routers disponibles en el OpenAPI del backend.
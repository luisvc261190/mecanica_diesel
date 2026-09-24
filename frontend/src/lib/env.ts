export const ENV = {
  API_URL: (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api/v1",
  APP_NAME: (import.meta.env.VITE_APP_NAME as string | undefined) ?? "Laboratorio de Tecnología Diesel",
  QUERY_STALE_TIME: Number(import.meta.env.VITE_QUERY_STALE_TIME ?? 30000),
} as const;
import { ENV } from "@/lib/env";
import type { ApiErrorBody, ApiEnvelope } from "@/types/domain";

const API_URL = ENV.API_URL;
const DEFAULT_TIMEOUT_MS = 30000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type AccessTokenProvider = () => string | null;
let accessTokenProvider: AccessTokenProvider = () => null;
let refreshHandler: (() => Promise<boolean>) | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let refreshing: Promise<boolean> | null = null;

/** El AuthProvider conecta la lectura del access token en memoria. */
export function configureAccessToken(provider: AccessTokenProvider): void {
  accessTokenProvider = provider;
}

/** El AuthProvider registra la lógica de rotación de refresh token. */
export function configureRefresh(handler: (() => Promise<boolean>) | null, onExpired?: () => void): void {
  refreshHandler = handler;
  sessionExpiredHandler = onExpired ?? null;
}

async function attemptRefresh(): Promise<boolean> {
  if (!refreshHandler) return false;
  if (!refreshing) {
    refreshing = refreshHandler().finally(() => {
      refreshing = null;
    });
  }
  try {
    const ok = await refreshing;
    if (!ok) sessionExpiredHandler?.();
    return ok;
  } catch {
    return false;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  formData?: FormData;
  auth?: boolean;
  skipRefresh?: boolean;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(path.startsWith("http") ? path : `${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function requestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getApiErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

async function performFetch<T>(path: string, options: Required<Pick<RequestOptions, "method">> & RequestOptions): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  const headers = new Headers(options.headers);
  headers.set("X-Request-ID", requestId());
  if (options.formData) {
    headers.set("X-Upload-From", "web");
  } else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false) {
    const token = accessTokenProvider();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method,
      headers,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(408, "REQUEST_TIMEOUT", "La solicitud tardó demasiado en responder.");
    }
    throw new ApiError(0, "NETWORK_ERROR", "No pudimos conectar con el servidor. Verifica tu conexión.");
  } finally {
    window.clearTimeout(timeout);
  }

  if (response.status === 401 && options.auth !== false && !options.skipRefresh) {
    const retried = await refreshThenRetry();
    if (retried) {
      // Reintenta con auth activo: el provider ya devuelve el token fresco (ref síncrono).
      return performFetch<T>(path, { ...options, skipRefresh: true });
    }
  }

  const text = await response.text();
  let parsed: ApiEnvelope<T> | ApiErrorBody | null = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as ApiEnvelope<T> | ApiErrorBody;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const body = parsed as ApiErrorBody | null;
    const message =
      (body?.error as { message?: string } | undefined)?.message ??
      extractDetailMessage(body?.detail) ??
      `Ocurrió un error inesperado (${response.status}).`;
    const code = (body?.error as { code?: string } | undefined)?.code ?? `HTTP_${response.status}`;
    throw new ApiError(response.status, code, message);
  }

  if (parsed === null || typeof (parsed as ApiEnvelope<T>).data === "undefined") {
    return parsed as T;
  }
  return (parsed as ApiEnvelope<T>).data as T;
}

function extractDetailMessage(detail: ApiErrorBody["detail"]): string | null {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first && typeof first === "object" && "msg" in first) return String(first.msg);
  }
  return null;
}

async function refreshThenRetry(): Promise<boolean> {
  return attemptRefresh();
}

export async function apiGet<T>(path: string, query?: RequestOptions["query"], options?: Omit<RequestOptions, "method" | "body" | "query">): Promise<T> {
  return performFetch<T>(path, { ...options, method: "GET", query });
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return performFetch<T>(path, { ...options, method: "POST", body });
}

export async function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return performFetch<T>(path, { ...options, method: "PATCH", body });
}

export async function apiPut<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return performFetch<T>(path, { ...options, method: "PUT", body });
}

export async function apiDelete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
  return performFetch<T>(path, { ...options, method: "DELETE", body: undefined });
}
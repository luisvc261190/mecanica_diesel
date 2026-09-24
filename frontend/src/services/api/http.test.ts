import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet, ApiError, configureAccessToken, configureRefresh, getApiErrorMessage } from "@/services/api/http";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("http client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    configureRefresh(null);
    configureAccessToken(() => null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("desenvuelve { data } y adjunta el Bearer token", async () => {
    configureAccessToken(() => "token-123");
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "1" }, message: "ok" }));

    const result = await apiGet<{ id: string }>("/clients/1");

    expect(result).toEqual({ id: "1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/clients/1");
    expect((init?.headers as Headers).get("Authorization")).toBe("Bearer token-123");
  });

  it("serializa los query params ignorando vacíos", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: null, message: "ok" }));

    await apiGet("/clients", { q: "", page: 2, status: undefined, client_type: null });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.has("q")).toBe(false);
    expect(parsed.searchParams.has("status")).toBe(false);
    expect(parsed.searchParams.has("client_type")).toBe(false);
  });

  it("lanza ApiError con mensaje del detail en array", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ detail: [{ msg: "campo inválido", loc: ["body", "sku"] }] }, 422),
    );

    await expect(apiGet("/parts/1")).rejects.toMatchObject({
      status: 422,
      code: "HTTP_422",
      message: "campo inválido",
    });
  });

  it("lanza ApiError con el error.message cuando existe", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "PART_NOT_FOUND", message: "Repuesto no existe" } }, 404),
    );

    await expect(apiGet("/parts/999")).rejects.toMatchObject({
      status: 404,
      code: "PART_NOT_FOUND",
      message: "Repuesto no existe",
    });
  });

  it("rota el access token ante 401 y reintenta una vez", async () => {
    configureAccessToken(() => "old-token");
    const refresh = vi.fn().mockResolvedValue(true);
    configureRefresh(refresh);

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { code: "UNAUTHORIZED", message: "vencido" } }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: { ok: 1 }, message: "ok" }));

    const result = await apiGet<{ ok: number }>("/dashboard");

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: 1 });
  });

  it("no reintenta si el refresh falla y propaga el error", async () => {
    configureAccessToken(() => "old");
    configureRefresh(vi.fn().mockResolvedValue(false));

    fetchMock.mockResolvedValue(jsonResponse({ error: { code: "UNAUTHORIZED", message: "vencido" } }, 401));

    await expect(apiGet("/dashboard")).rejects.toMatchObject({ status: 401 });
  });
});

describe("getApiErrorMessage", () => {
  it("devuelve el mensaje de un ApiError", () => {
    const err = new ApiError(400, "BAD_REQUEST", "petición inválida");
    expect(getApiErrorMessage(err)).toBe("petición inválida");
  });

  it("usa el fallback ante errores desconocidos", () => {
    expect(getApiErrorMessage("boom")).toBe("Ocurrió un error inesperado.");
    expect(getApiErrorMessage("boom", "personalizado")).toBe("personalizado");
  });
});
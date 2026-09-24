import { afterEach, describe, expect, it } from "vitest";

import { clearAuthStorage, tokenStore } from "@/services/storage/tokens";

describe("tokenStore", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("persiste y recupera el refresh token", () => {
    expect(tokenStore.refresh.get()).toBeNull();
    tokenStore.refresh.set("jwt-refresh");
    expect(tokenStore.refresh.get()).toBe("jwt-refresh");
  });

  it("limpia el token", () => {
    tokenStore.refresh.set("jwt-refresh");
    tokenStore.refresh.clear();
    expect(tokenStore.refresh.get()).toBeNull();
  });

  it("clearAuthStorage elimina el refresh token", () => {
    tokenStore.refresh.set("jwt-refresh");
    clearAuthStorage();
    expect(tokenStore.refresh.get()).toBeNull();
  });
});
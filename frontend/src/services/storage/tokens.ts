const REFRESH_TOKEN_KEY = "ltd.refresh_token";

/** El access token vive en memoria; el refresh token en localStorage (estrategia del backend: rotación vía body). */
export const tokenStore = {
  refresh: {
    get(): string | null {
      return window.localStorage.getItem(REFRESH_TOKEN_KEY);
    },
    set(token: string): void {
      window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
    },
    clear(): void {
      window.localStorage.removeItem(REFRESH_TOKEN_KEY);
    },
  },
};

export function clearAuthStorage(): void {
  tokenStore.refresh.clear();
}
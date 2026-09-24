import { QueryClient } from "@tanstack/react-query";

import { ENV } from "@/lib/env";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ENV.QUERY_STALE_TIME,
      gcTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
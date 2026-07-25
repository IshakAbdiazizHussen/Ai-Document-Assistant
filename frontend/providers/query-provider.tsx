"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/lib/api/client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: (failureCount, error) => {
              // status 0 means no response came back at all (dropped
              // connection, timeout, a cookie/CORS-blocked request never
              // reaching the server as authenticated) — exactly the kind
              // of transient/flaky-network failure worth retrying harder
              // on mobile. A real 4xx response (401, 404, 429...) means the
              // server answered and said no — retrying the identical
              // request won't change that answer, so don't waste time on it.
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

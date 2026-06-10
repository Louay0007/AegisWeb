"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createQueryClient } from "./query-client";

type DataLayerProviderProps = {
  children: ReactNode;
};

/**
 * Hosts the singleton QueryClient. We deliberately create it inside
 * `useState` so that:
 *   - Each browser session gets exactly one client (memoized).
 *   - Server renders don't share a client across requests.
 *   - Hot reloads during dev don't leak caches.
 */
export function DataLayerProvider({ children }: DataLayerProviderProps) {
  const [client] = useState(() => createQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

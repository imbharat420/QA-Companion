"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";
import { readApiSettings, useApiRevision, useAppearance } from "@/store/settingsStore";

/**
 * One QueryClient per app instance, created lazily inside state so React
 * StrictMode's double-render doesn't produce two caches.
 *
 * Defaults are tuned for a desktop app reading a local backend: data is cheap
 * to refetch but re-rendering a dense workbench is not, so we lean on a real
 * staleTime and keep previous data visible while a new query resolves.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        /**
         * Keep the last successful page on screen during a filter change
         * instead of flashing a skeleton — but NEVER across a data-source
         * switch. Query keys are `[apiMode, ...]`, so a mode change produces a
         * new key whose previous data belongs to the old adapter; carrying it
         * over would leave mock numbers on screen while the status bar claims
         * the app is talking to a REST backend.
         */
        placeholderData: <T,>(prev: T, prevQuery?: { queryKey: readonly unknown[] }) => {
          if (!prevQuery) return prev;
          return prevQuery.queryKey[0] === readApiSettings().mode ? prev : undefined;
        },
      },
      mutations: { retry: 0 },
    },
  });
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const apiRevision = useApiRevision();
  const { reduceMotion, density } = useAppearance();
  const firstRevision = useRef(apiRevision);

  /**
   * THE ONE-CLICK API SWITCH, second half.
   *
   * `settingsStore` bumps `apiRevision` whenever the data source changes
   * (mode, base URL, headers). Every cached response belongs to the old
   * source, so we drop the cache and let mounted screens refetch. No reload,
   * no per-page wiring.
   */
  useEffect(() => {
    if (apiRevision === firstRevision.current) return;
    queryClient.clear();
    void queryClient.refetchQueries({ type: "active" });
  }, [apiRevision, queryClient]);

  // Appearance prefs are global and cheap to express as data attributes, so
  // components can style off them without subscribing to the store.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.density = density;
    root.dataset.reduceMotion = reduceMotion ? "true" : "false";
  }, [density, reduceMotion]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={350} skipDelayDuration={120}>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          closeButton
          toastOptions={{
            classNames: {
              toast:
                "!bg-popover !border-border !text-foreground !rounded-[var(--radius-md)] !font-sans !text-xs",
              description: "!text-muted-foreground",
              actionButton: "!bg-primary !text-primary-foreground",
            },
          }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

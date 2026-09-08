"use client";

import { Skeleton } from "@/components/ui/Skeleton";

export interface LoadingStateProps {
  rows?: number;
  variant?: "table" | "cards" | "panel";
}

/**
 * Skeletons shaped like the thing that is coming, so the layout doesn't jump
 * when the data lands. `aria-busy` + one live label is enough for assistive
 * tech; the bars themselves are already aria-hidden.
 */
export function LoadingState({ rows = 6, variant = "table" }: LoadingStateProps) {
  const count = Math.max(1, rows);

  return (
    <div data-testid="loading-state" data-variant={variant} aria-busy="true" className="w-full">
      <span className="sr-only" role="status">
        Loading…
      </span>

      {variant === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="surface-card flex flex-col gap-3 p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-[var(--radius-sm)]" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-2.5 w-full" />
              <Skeleton className="h-2.5 w-4/5" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "panel" ? (
        <div className="surface-card flex flex-col gap-3 p-4">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-2.5 w-full" />
          {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} className={i % 3 === 2 ? "h-2.5 w-2/3" : "h-2.5 w-full"} />
          ))}
          <Skeleton className="h-24 w-full rounded-[var(--radius-md)]" />
        </div>
      ) : null}

      {variant === "table" ? (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/70">
          <div className="flex items-center gap-4 border-b border-border bg-elevated px-3 py-2">
            <Skeleton className="h-2.5 w-24" />
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-2.5 w-20" />
            <div className="flex-1" />
            <Skeleton className="h-2.5 w-12" />
          </div>
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/40 px-3 py-2.5 last:border-0">
              <Skeleton className="size-4 rounded-full" />
              <Skeleton className="h-2.5 flex-1" />
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

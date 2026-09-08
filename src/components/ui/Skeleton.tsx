"use client";

import { cn } from "@/lib/utils";

/**
 * The shimmer needs a wide background to travel across, hence the 200% size —
 * the `shimmer` keyframes in globals.css animate background-position, not
 * transform, so the highlight sweeps without moving the element.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      data-testid="skeleton"
      className={cn(
        "animate-shimmer rounded-[var(--radius-sm)] bg-muted",
        "bg-[linear-gradient(90deg,transparent_0%,hsl(var(--foreground)/0.07)_50%,transparent_100%)] bg-[length:200%_100%] bg-no-repeat",
        className,
      )}
    />
  );
}

"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Warms a route on hover/focus so navigation feels instant, and remembers what
 * it already warmed — Next dedupes internally, but this avoids the churn of
 * calling prefetch on every mousemove-triggered re-render.
 */
export function usePrefetchRoute() {
  const router = useRouter();
  const seen = useRef<Set<string>>(new Set());

  return useCallback(
    (href: string) => {
      if (seen.current.has(href)) return;
      seen.current.add(href);
      router.prefetch(href);
    },
    [router],
  );
}

"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Written out rather than interpolated so Tailwind can see every class. */
const COLUMNS: Record<2 | 3 | 4 | 5, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
};

export interface StatGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4 | 5;
}

export function StatGrid({ children, columns = 4 }: StatGridProps) {
  return (
    <div data-testid="stat-grid" className={cn("grid gap-3", COLUMNS[columns])}>
      {children}
    </div>
  );
}

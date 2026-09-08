"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

export interface ChartFrameProps {
  /** Summary of the plotted series — a canvas of lines is invisible without it. */
  label: string;
  height: number;
  testId?: string;
  className?: string;
  /** Exactly one recharts chart: ResponsiveContainer clones it with width/height. */
  children: React.ReactElement;
}

/**
 * The shared shell for every recharts wrapper here: the accessible `role="img"`
 * boundary plus the sizing container. `role="img"` also hides the SVG's own
 * generated nodes from screen readers, which is what we want — the label is the
 * accessible representation of the chart.
 */
export const ChartFrame = React.memo(function ChartFrame({
  label,
  height,
  testId,
  className,
  children,
}: ChartFrameProps) {
  return (
    <div
      role="img"
      aria-label={label}
      data-testid={testId}
      className={cn("w-full", className)}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
});

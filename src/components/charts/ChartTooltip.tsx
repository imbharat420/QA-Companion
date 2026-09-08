"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** The recharts payload rows we actually read, narrowed from its `any`-typed props. */
export interface TooltipRow {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  /** Pie/donut sectors carry their colour on the row payload, not on `color`. */
  payload?: { fill?: string };
}

export interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: readonly TooltipRow[];
  formatValue?: (value: number) => string;
  formatLabel?: (label: string | number) => string;
  /** Drop the header row for charts whose x value carries no meaning (donuts). */
  hideLabel?: boolean;
}

/**
 * The popover surface every chart tooltip sits on. Exported because the
 * waterfall and donut render bespoke bodies but must look identical.
 */
export const TooltipSurface = React.memo(function TooltipSurface({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid="chart-tooltip"
      className={cn(
        "pointer-events-none min-w-[7.5rem] rounded-[var(--radius-md)] border border-border",
        "bg-popover px-2.5 py-2 text-popover-foreground shadow-xl",
        className,
      )}
    >
      {children}
    </div>
  );
});

const renderValue = (value: TooltipRow["value"], format?: (n: number) => string): string =>
  typeof value === "number" ? (format ? format(value) : String(value)) : String(value ?? "—");

/**
 * Hand to recharts as `content={<ChartTooltip … />}` — it clones the element with
 * `active`/`payload`/`label`, which is why those props are optional.
 */
export const ChartTooltip = React.memo(function ChartTooltip({
  active,
  label,
  payload,
  formatValue,
  formatLabel,
  hideLabel = false,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <TooltipSurface>
      {!hideLabel && label !== undefined && label !== "" ? (
        <p className="label-mono mb-1.5 text-[10px]">{formatLabel ? formatLabel(label) : label}</p>
      ) : null}
      <ul className="flex flex-col gap-1">
        {payload.map((row, index) => (
          <li key={`${String(row.dataKey ?? row.name ?? index)}`} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color ?? row.payload?.fill ?? "hsl(var(--muted-foreground))" }}
            />
            <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">{row.name}</span>
            <span className="text-code tabular-nums text-foreground">
              {renderValue(row.value, formatValue)}
            </span>
          </li>
        ))}
      </ul>
    </TooltipSurface>
  );
});

"use client";

import { memo, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
// Deep import, not the "@/components/charts" barrel: Sparkline is hand-drawn
// SVG, and the barrel would drag recharts into every card that shows one.
import { Sparkline } from "@/components/charts/Sparkline";
import { StatusBadge, toneTextClass } from "@/components/shared";
import { cn, formatBytes, formatDuration } from "@/lib/utils";
import { routes } from "@/config/nav";
import type { PerfMetric, PerfMetricId } from "@/lib/api/types";

export type MetricTone = "success" | "warning" | "error";

/** `rating` is the fixture's own scoring — never recomputed here, only coloured. */
export const RATING_TONE: Record<PerfMetric["rating"], MetricTone> = {
  good: "success",
  "needs-improvement": "warning",
  poor: "error",
};

/**
 * A metric's own unit decides its formatting; the value, its budget and its
 * trend axis all go through this so the three can be compared by eye.
 */
export function formatMetricValue(value: number, unit: PerfMetric["unit"]): string {
  switch (unit) {
    case "ms":
      return formatDuration(value);
    case "s":
      return formatDuration(value * 1000);
    case "kb":
      return formatBytes(value * 1024);
    case "score":
      return value.toFixed(2);
  }
}

/** Signed change, e.g. "+440ms" / "-0.02". */
const formatDelta = (delta: number, unit: PerfMetric["unit"]): string =>
  `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${formatMetricValue(Math.abs(delta), unit)}`;

export interface MetricCardProps {
  metric: PerfMetric;
  /** Highlights the card whose history the trend chart is plotting. */
  selected?: boolean;
  onSelect?: (id: PerfMetricId) => void;
  /** Run the `delta` is measured against — the fixtures' previous run. */
  baselineRun?: string;
  /** Finding this metric's regression is already filed as, if any. */
  findingId?: string;
  testId?: string;
}

function MetricCardImpl({
  metric,
  selected = false,
  onSelect,
  baselineRun,
  findingId,
  testId,
}: MetricCardProps) {
  const { id, label, value, unit, budget, rating, delta, history } = metric;
  const tid = testId ?? `perf-metric-${id}`;
  const tone = RATING_TONE[rating];
  const over = value > budget;

  // A shared scale for the fill and the budget tick, with headroom so a bar at
  // budget never reads as "maxed out".
  const scale = Math.max(value, budget) * 1.12 || 1;
  const fillPct = Math.min(100, (value / scale) * 100);
  const budgetPct = Math.min(100, (budget / scale) * 100);

  // Perf metrics invert the usual sign reading: bigger is slower is worse.
  const DeltaIcon = delta === 0 ? Minus : delta > 0 ? ArrowUp : ArrowDown;
  const deltaTone = delta === 0 ? "muted" : delta > 0 ? "error" : "success";

  const select = useCallback(() => onSelect?.(id), [id, onSelect]);

  // Memoized: Sparkline is memoized too, and a fresh array would defeat it.
  const spark = useMemo(() => history.map((point) => point.value), [history]);

  return (
    <div
      data-testid={tid}
      data-rating={rating}
      data-selected={selected || undefined}
      className={cn(
        "surface-card flex flex-col overflow-hidden transition-[border-color,box-shadow] duration-150",
        selected && "border-primary/50 ring-1 ring-primary/40",
      )}
    >
      <button
        type="button"
        onClick={select}
        aria-pressed={selected}
        disabled={!onSelect}
        data-testid={`${tid}-select`}
        className={cn(
          "flex flex-1 flex-col gap-2 p-3.5 text-left",
          onSelect ? "hover:bg-muted/30" : "cursor-default",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="label-mono">{id.toUpperCase()}</span>
          <StatusBadge status={rating} size="xs" />
        </div>

        <div className="flex items-end justify-between gap-3">
          <span
            data-testid={`${tid}-value`}
            className={cn(
              "font-display text-2xl font-semibold leading-none tracking-tight tabular-nums",
              over && "text-error",
            )}
          >
            {formatMetricValue(value, unit)}
          </span>
          <span aria-hidden className="shrink-0 pb-0.5">
            <Sparkline data={spark} tone={tone} width={72} height={24} showArea />
          </span>
        </div>

        <p className="truncate text-[11px] leading-none text-muted-foreground" title={label}>
          {label}
        </p>

        <div className="relative mt-0.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              aria-hidden
              className={cn("h-full rounded-full bg-current", toneTextClass(tone))}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <span
            aria-hidden
            data-testid={`${tid}-budget-marker`}
            className="absolute -top-1 h-[14px] w-px bg-foreground/70"
            style={{ left: `${budgetPct}%` }}
          />
        </div>

        <div className="flex items-baseline justify-between gap-2 text-[10px]">
          <span className="font-mono uppercase tracking-[0.04em] text-subtle-foreground">
            Budget {formatMetricValue(budget, unit)}
          </span>
          <span
            data-testid={`${tid}-budget-state`}
            className={cn("font-mono tabular-nums", over ? "font-semibold text-error" : "text-muted-foreground")}
          >
            {over
              ? `${formatMetricValue(value - budget, unit)} over`
              : `${formatMetricValue(budget - value, unit)} left`}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] leading-none">
          <span
            data-testid={`${tid}-delta`}
            className={cn(
              "inline-flex items-center gap-0.5 font-mono font-semibold tabular-nums",
              toneTextClass(deltaTone),
            )}
          >
            <DeltaIcon className="size-3" aria-hidden />
            {formatDelta(delta, unit)}
          </span>
          <span className="truncate text-muted-foreground">
            {baselineRun ? `vs ${baselineRun}` : "vs previous run"}
          </span>
        </div>
      </button>

      {over || findingId ? (
        <div className="flex items-center justify-between gap-2 border-t border-border/50 px-3.5 py-2">
          {over ? (
            <Link
              href={routes.findings({ category: "performance" })}
              data-testid={`${tid}-budget-link`}
              className="text-[11px] font-medium text-error hover:underline"
            >
              Budget failed
            </Link>
          ) : (
            <span className="text-[11px] text-muted-foreground">Within budget</span>
          )}
          {findingId ? (
            <Link
              href={routes.finding(findingId)}
              data-testid={`${tid}-finding`}
              className="text-code text-muted-foreground hover:text-foreground hover:underline"
            >
              {findingId}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export const MetricCard = memo(MetricCardImpl);

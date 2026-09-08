"use client";

import * as React from "react";
import type { Tone } from "@/lib/api/types";

/* ============================================================================
   CHART THEME
   ----------------------------------------------------------------------------
   Recharts takes colour STRINGS, not class names, so this file is the ONLY
   place in the app that spells out `hsl(var(--token))`. It is still a token —
   never a hex — so theme switching keeps working for free.
   ========================================================================= */

const CHART_RAMP = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"] as const;

/** The 6 categorical chart tokens, ready to hand to recharts. */
export const CHART_COLORS: readonly string[] = CHART_RAMP.map((v) => `hsl(var(${v}))`);

type SemanticTone =
  | "primary"
  | "accent"
  | "muted"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "thinking"
  | "planning"
  | "executing"
  | "waiting"
  | "idle";

/** Every tone a chart accepts: the domain `Tone`, our semantic names, or a raw ramp slot. */
export type ChartTone = Tone | SemanticTone | `chart-${1 | 2 | 3 | 4 | 5 | 6}`;

const TONE_VARS: Record<Tone | SemanticTone, string> = {
  primary: "--primary",
  accent: "--accent",
  muted: "--muted-foreground",

  success: "--status-success",
  warning: "--status-waiting",
  error: "--status-error",
  info: "--sev-low",
  thinking: "--status-thinking",
  planning: "--status-planning",
  executing: "--status-executing",
  waiting: "--status-waiting",
  idle: "--status-idle",

  critical: "--sev-critical",
  high: "--sev-high",
  medium: "--sev-medium",
  low: "--sev-low",

  // The palette names from types.ts `Tone`, which badges and group cards also use.
  cyan: "--status-executing",
  amber: "--status-waiting",
  red: "--status-error",
  green: "--status-success",
  violet: "--status-thinking",
  neutral: "--status-idle",
};

/** Token name for a tone, e.g. "critical" -> "--sev-critical". */
export function toneVar(tone: string): string {
  if (tone in TONE_VARS) return TONE_VARS[tone as Tone | SemanticTone];
  if (/^chart-[1-6]$/.test(tone)) return `--${tone}`;
  // Unknown tone: hash into the categorical ramp. A chart with several unmapped
  // series then stays readable instead of drawing every series the same colour.
  let h = 0;
  for (let i = 0; i < tone.length; i += 1) h = (h * 31 + tone.charCodeAt(i)) | 0;
  return CHART_RAMP[Math.abs(h) % CHART_RAMP.length];
}

/** Tone -> colour string. Pass `alpha` for a translucent variant (gradient stops). */
export const toneColor = (tone: string, alpha?: number): string =>
  alpha === undefined ? `hsl(var(${toneVar(tone)}))` : `hsl(var(${toneVar(tone)}) / ${alpha})`;

/** Spread onto every XAxis / YAxis: 10px mono ticks, no axis line, no tick line. */
export const AXIS_PROPS = {
  tick: {
    fill: "hsl(var(--muted-foreground))",
    fontSize: 10,
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
  },
  axisLine: false,
  tickLine: false,
  tickMargin: 8,
} as const;

/** Spread onto CartesianGrid: horizontal rules only. */
export const GRID_PROPS = {
  horizontal: true,
  vertical: false,
  stroke: "hsl(var(--border) / 0.4)",
  strokeDasharray: "3 3",
} as const;

/**
 * Spread onto <Tooltip>. The visible surface is <ChartTooltip>; this only kills
 * recharts' wrapper chrome and tints the hover cursor. `stroke` serves the line
 * cursor, `fill` the bar cursor — one object covers both chart families.
 */
export const TOOLTIP_STYLE = {
  cursor: { stroke: "hsl(var(--border))", strokeWidth: 1, fill: "hsl(var(--foreground) / 0.06)" },
  wrapperStyle: { outline: "none", zIndex: 30 },
  animationDuration: 120,
} as const;

/** One row of chart data. Deliberately loose: domain interfaces (TrendPoint,
 *  ResourceEntry, ...) have no index signature, so anything stricter would force
 *  every caller to cast. Recharts reads rows by `dataKey`, never we ourselves. */
export type ChartDatum = object;

export interface SeriesSpec {
  /** Property on each datum holding this series' value. */
  key: string;
  label: string;
  /** Omit to take the next slot of the categorical ramp by position. */
  tone?: ChartTone;
}

/** Colour for a series: its own tone, else its position in the ramp. */
export const seriesColor = (series: SeriesSpec, index: number): string =>
  series.tone ? toneColor(series.tone) : CHART_COLORS[index % CHART_COLORS.length];

/** Spread onto <Legend>: mono micro-caps, matching our .label-mono. */
export const LEGEND_PROPS = {
  iconType: "circle",
  iconSize: 7,
  wrapperStyle: {
    fontSize: 10,
    fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "hsl(var(--muted-foreground))",
    paddingTop: 6,
  },
} as const;

/** Props every cartesian wrapper in this directory takes. */
export interface CartesianChartProps {
  data: ChartDatum[];
  /** Property holding the category / x value. */
  xKey: string;
  series: SeriesSpec[];
  height?: number;
  stacked?: boolean;
  showLegend?: boolean;
  formatY?: (value: number) => string;
  testId?: string;
  className?: string;
}

/** Standard aria-label for a cartesian chart, so screen readers get the gist. */
export function chartAriaLabel(
  kind: string,
  series: readonly Pick<SeriesSpec, "label">[],
  points: number,
): string {
  const names = series.map((s) => s.label).join(", ");
  return `${kind} chart of ${names || "no series"} across ${points} ${points === 1 ? "point" : "points"}`;
}

/**
 * Reduced motion, read ONCE on mount — the app writes the user's preference to
 * `documentElement.dataset.reduceMotion` (AppProviders), and the OS media query
 * covers people who never opened Settings. Returns false during prerender, so
 * there is no hydration mismatch.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    setReduced(
      document.documentElement.dataset.reduceMotion === "true" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);
  return reduced;
}

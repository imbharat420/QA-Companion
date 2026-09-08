"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { toneColor, usePrefersReducedMotion, type ChartTone } from "./ChartTheme";

export interface GaugeChartProps {
  value: number;
  max?: number;
  label?: string;
  /** Defaults to a traffic-light read of value/max — pass one to override. */
  tone?: ChartTone;
  size?: number;
  testId?: string;
  className?: string;
}

const thresholdTone = (ratio: number): ChartTone =>
  ratio >= 0.9 ? "success" : ratio >= 0.5 ? "warning" : "error";

/**
 * Semi-circular score dial as inline SVG. Recharts can fake this with a half
 * RadialBarChart, but that is a whole chart tree for two arcs and a number.
 */
export const GaugeChart = React.memo(function GaugeChart({
  value,
  max = 100,
  label,
  tone,
  size = 160,
  testId = "gauge-chart",
  className,
}: GaugeChartProps) {
  const reduced = usePrefersReducedMotion();

  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const stroke = Math.max(8, size * 0.075);
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const arc = `M ${center - radius} ${center} A ${radius} ${radius} 0 0 1 ${center + radius} ${center}`;
  // Semicircle length: the dash offset that follows is the whole animation.
  const length = Math.PI * radius;
  const viewHeight = center + stroke / 2 + (label ? 20 : 4);

  return (
    <svg
      role="img"
      aria-label={`${label ?? "Score"}: ${Math.round(value)} of ${max}`}
      data-testid={testId}
      width={size}
      height={viewHeight}
      viewBox={`0 0 ${size} ${viewHeight}`}
      className={cn("shrink-0", className)}
    >
      <path
        d={arc}
        fill="none"
        stroke="hsl(var(--border) / 0.6)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={arc}
        fill="none"
        stroke={toneColor(tone ?? thresholdTone(ratio))}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={length}
        strokeDashoffset={length * (1 - ratio)}
        style={reduced ? undefined : { transition: "stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      />
      <text
        x={center}
        y={center - size * 0.04}
        textAnchor="middle"
        data-testid={`${testId}-value`}
        className="fill-foreground font-mono font-semibold tabular-nums"
        style={{ fontSize: size * 0.22 }}
      >
        {Math.round(value)}
      </text>
      {label ? (
        <text
          x={center}
          y={center + 16}
          textAnchor="middle"
          className="fill-muted-foreground font-mono uppercase"
          style={{ fontSize: 10, letterSpacing: "0.04em" }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
});

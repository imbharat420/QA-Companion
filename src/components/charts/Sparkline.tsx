"use client";

import * as React from "react";
import { cn, formatCompact } from "@/lib/utils";
import { toneColor, type ChartTone } from "./ChartTheme";

export interface SparklineProps {
  data: number[];
  tone?: ChartTone;
  width?: number;
  height?: number;
  showArea?: boolean;
  testId?: string;
  className?: string;
}

/**
 * Deliberately hand-drawn SVG rather than recharts: a dashboard renders a dozen
 * of these inside StatTiles, and each ResponsiveContainer would add a resize
 * observer plus a full chart tree for 60 pixels of line.
 */
export const Sparkline = React.memo(function Sparkline({
  data,
  tone = "primary",
  width = 64,
  height = 20,
  showArea = false,
  testId = "sparkline",
  className,
}: SparklineProps) {
  if (data.length === 0) return null;

  const stroke = toneColor(tone);
  const inset = 1.5; // keeps the 1.5px stroke inside the viewBox at the extremes
  const plot = height - inset * 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  // A flat series (or a single sample) has no span, so it sits down the middle
  // instead of being pinned to the floor by a 0 ratio.
  const norm = (value: number) => (max === min ? 0.5 : (value - min) / (max - min));
  const stepX = data.length > 1 ? width / (data.length - 1) : width;

  const points = (data.length > 1 ? data : [data[0], data[0]]).map(
    (value, index) => `${(index * stepX).toFixed(2)},${(inset + (1 - norm(value)) * plot).toFixed(2)}`,
  );

  const first = data[0];
  const last = data[data.length - 1];
  const direction = last > first ? "rising" : last < first ? "falling" : "flat";

  return (
    <svg
      role="img"
      aria-label={`Sparkline, ${direction}: ${formatCompact(first)} to ${formatCompact(last)} over ${data.length} points`}
      data-testid={testId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
    >
      {showArea ? (
        <path
          d={`M ${points.join(" L ")} L ${width},${height} L 0,${height} Z`}
          fill={toneColor(tone, 0.18)}
          stroke="none"
        />
      ) : null}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});

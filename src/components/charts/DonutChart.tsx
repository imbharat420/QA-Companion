"use client";

import * as React from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { cn, formatCompact } from "@/lib/utils";
import {
  CHART_COLORS,
  TOOLTIP_STYLE,
  toneColor,
  usePrefersReducedMotion,
  type ChartTone,
} from "./ChartTheme";
import { ChartFrame } from "./ChartFrame";
import { ChartTooltip } from "./ChartTooltip";

export interface DonutSlice {
  name: string;
  value: number;
  tone?: ChartTone;
}

export interface DonutChartProps {
  data: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  height?: number;
  /** Ring width in px. */
  thickness?: number;
  testId?: string;
  className?: string;
}

const MARGIN = { top: 0, right: 0, bottom: 0, left: 0 };

export const DonutChart = React.memo(function DonutChart({
  data,
  centerLabel,
  centerValue,
  height = 200,
  thickness = 18,
  testId = "donut-chart",
  className,
}: DonutChartProps) {
  const reduced = usePrefersReducedMotion();

  const outerRadius = Math.max(24, height / 2 - 8);
  const innerRadius = Math.max(8, outerRadius - thickness);

  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const label = `Donut chart, total ${formatCompact(total)}: ${
    data.map((slice) => `${slice.name} ${slice.value}`).join(", ") || "no data"
  }`;

  return (
    <div className={cn("relative w-full", className)} data-testid={testId}>
      <ChartFrame label={label} height={height}>
        <PieChart margin={MARGIN}>
          <Tooltip {...TOOLTIP_STYLE} content={<ChartTooltip hideLabel />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={data.length > 1 ? 2 : 0}
            // The card colour between sectors reads as a gap, not a border.
            stroke="hsl(var(--card))"
            strokeWidth={1}
            isAnimationActive={!reduced}
          >
            {data.map((slice, index) => (
              <Cell
                key={slice.name}
                fill={slice.tone ? toneColor(slice.tone) : CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ChartFrame>

      {centerValue || centerLabel ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          {centerValue ? (
            <span className="font-mono text-lg font-semibold tabular-nums leading-none text-foreground">
              {centerValue}
            </span>
          ) : null}
          {centerLabel ? <span className="label-mono text-[10px]">{centerLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
});

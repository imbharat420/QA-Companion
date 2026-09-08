"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import {
  AXIS_PROPS,
  GRID_PROPS,
  LEGEND_PROPS,
  TOOLTIP_STYLE,
  chartAriaLabel,
  seriesColor,
  usePrefersReducedMotion,
  type CartesianChartProps,
} from "./ChartTheme";
import { ChartFrame } from "./ChartFrame";
import { ChartTooltip } from "./ChartTooltip";

export interface AreaTrendChartProps extends CartesianChartProps {
  yDomain?: [number, number];
}

const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const ACTIVE_DOT = { r: 3, strokeWidth: 0 };

export const AreaTrendChart = React.memo(function AreaTrendChart({
  data,
  xKey,
  series,
  height = 220,
  stacked = false,
  showLegend = false,
  yDomain,
  formatY,
  testId = "area-trend-chart",
  className,
}: AreaTrendChartProps) {
  const reduced = usePrefersReducedMotion();
  // Gradient ids must be unique per instance — two charts on one page would
  // otherwise share (and fight over) the same <linearGradient>.
  const uid = React.useId().replace(/:/g, "");

  return (
    <ChartFrame
      label={chartAriaLabel("Area", series, data.length)}
      height={height}
      testId={testId}
      className={className}
    >
      <AreaChart data={data} margin={MARGIN}>
        <defs>
          {series.map((spec, index) => {
            const color = seriesColor(spec, index);
            return (
              <linearGradient key={spec.key} id={`${uid}-${spec.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={40} domain={yDomain} tickFormatter={formatY} />
        <Tooltip {...TOOLTIP_STYLE} content={<ChartTooltip formatValue={formatY} />} />
        {showLegend ? <Legend {...LEGEND_PROPS} /> : null}
        {series.map((spec, index) => (
          <Area
            key={spec.key}
            type="monotone"
            dataKey={spec.key}
            name={spec.label}
            stroke={seriesColor(spec, index)}
            strokeWidth={2}
            fill={`url(#${uid}-${spec.key})`}
            activeDot={ACTIVE_DOT}
            stackId={stacked ? "trend" : undefined}
            isAnimationActive={!reduced}
          />
        ))}
      </AreaChart>
    </ChartFrame>
  );
});

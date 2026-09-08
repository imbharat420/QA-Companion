"use client";

import * as React from "react";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
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

/** `stacked` is absent on purpose: recharts <Line> has no stackId. A stacked
 *  trend is an area chart — use <AreaTrendChart stacked />. */
export interface TrendLineChartProps extends Omit<CartesianChartProps, "stacked"> {
  /** Lock the value axis, e.g. `[0, 100]` for percentages. */
  yDomain?: [number, number];
}

/* Hoisted: recharts elements are PureComponents, so a fresh literal each render
   would defeat their shallow prop check. */
const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
const ACTIVE_DOT = { r: 3, strokeWidth: 0 };

export const TrendLineChart = React.memo(function TrendLineChart({
  data,
  xKey,
  series,
  height = 220,
  showLegend = false,
  yDomain,
  formatY,
  testId = "trend-line-chart",
  className,
}: TrendLineChartProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <ChartFrame
      label={chartAriaLabel("Line", series, data.length)}
      height={height}
      testId={testId}
      className={className}
    >
      <LineChart data={data} margin={MARGIN}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey={xKey} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} width={40} domain={yDomain} tickFormatter={formatY} />
        <Tooltip {...TOOLTIP_STYLE} content={<ChartTooltip formatValue={formatY} />} />
        {showLegend ? <Legend {...LEGEND_PROPS} /> : null}
        {series.map((spec, index) => (
          <Line
            key={spec.key}
            type="monotone"
            dataKey={spec.key}
            name={spec.label}
            stroke={seriesColor(spec, index)}
            strokeWidth={2}
            dot={false}
            activeDot={ACTIVE_DOT}
            isAnimationActive={!reduced}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
});

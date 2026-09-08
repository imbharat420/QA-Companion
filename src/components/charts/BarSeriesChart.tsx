"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
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

export interface BarSeriesChartProps extends CartesianChartProps {
  /** Bars run left-to-right with the categories down the Y axis. */
  horizontal?: boolean;
}

const MARGIN = { top: 8, right: 8, bottom: 0, left: 0 };
/** Bands, not values, run across a horizontal chart — so the rules flip with it. */
const GRID_CROSS_VALUE = { ...GRID_PROPS, horizontal: false, vertical: true };
const RADIUS_UP: [number, number, number, number] = [3, 3, 0, 0];
const RADIUS_RIGHT: [number, number, number, number] = [0, 3, 3, 0];

export const BarSeriesChart = React.memo(function BarSeriesChart({
  data,
  xKey,
  series,
  horizontal = false,
  stacked = false,
  showLegend = false,
  height = 220,
  formatY,
  testId = "bar-series-chart",
  className,
}: BarSeriesChartProps) {
  const reduced = usePrefersReducedMotion();
  const radius = horizontal ? RADIUS_RIGHT : RADIUS_UP;

  return (
    <ChartFrame
      label={chartAriaLabel("Bar", series, data.length)}
      height={height}
      testId={testId}
      className={className}
    >
      <BarChart data={data} margin={MARGIN} layout={horizontal ? "vertical" : "horizontal"}>
        <CartesianGrid {...(horizontal ? GRID_CROSS_VALUE : GRID_PROPS)} />
        {/*
          Both axes stay DIRECT children of BarChart. Recharts 2.x discovers its
          axes by walking `children` and does not descend into Fragments, so
          wrapping the pair in `<>…</>` silently yields a chart with no axes at
          all — every bar then renders full-width and they overlap into one block.
        */}
        <XAxis
          {...(horizontal
            ? { type: "number" as const, tickFormatter: formatY }
            : { dataKey: xKey })}
          {...AXIS_PROPS}
        />
        <YAxis
          {...(horizontal
            ? { type: "category" as const, dataKey: xKey, width: 104 }
            : { width: 40, tickFormatter: formatY })}
          {...AXIS_PROPS}
        />
        <Tooltip {...TOOLTIP_STYLE} content={<ChartTooltip formatValue={formatY} />} />
        {showLegend ? <Legend {...LEGEND_PROPS} /> : null}
        {series.map((spec, index) => (
          <Bar
            key={spec.key}
            dataKey={spec.key}
            name={spec.label}
            fill={seriesColor(spec, index)}
            stackId={stacked ? "bars" : undefined}
            // Only the outermost segment of a stack gets the rounded cap.
            radius={stacked && index !== series.length - 1 ? undefined : radius}
            maxBarSize={28}
            isAnimationActive={!reduced}
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
});

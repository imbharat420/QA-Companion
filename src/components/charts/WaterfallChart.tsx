"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceDot, Tooltip, XAxis, YAxis } from "recharts";
import { formatBytes, formatDuration, truncateMiddle } from "@/lib/utils";
import type { ResourceEntry } from "@/lib/api/types";
import { AXIS_PROPS, GRID_PROPS, TOOLTIP_STYLE, toneColor, type ChartTone } from "./ChartTheme";
import { ChartFrame } from "./ChartFrame";
import { TooltipSurface } from "./ChartTooltip";

export interface WaterfallChartProps {
  resources: ResourceEntry[];
  height?: number;
  testId?: string;
  className?: string;
}

/** Resource kind -> ramp slot, so a scan of the waterfall groups by type. */
const TYPE_TONE: Record<ResourceEntry["type"], ChartTone> = {
  document: "chart-1",
  script: "chart-2",
  stylesheet: "chart-3",
  image: "chart-4",
  xhr: "chart-5",
  font: "chart-6",
  media: "medium",
  other: "neutral",
};

interface WaterfallRow {
  id: string;
  label: string;
  /** Stacked spacer that positions the bar at its start time. */
  offset: number;
  /** Drawn length; see the floor applied below. */
  duration: number;
  color: string;
  entry: ResourceEntry;
}

const MARGIN = { top: 4, right: 12, bottom: 0, left: 0 };
const GRID_TIME = { ...GRID_PROPS, horizontal: false, vertical: true };
const RADIUS: [number, number, number, number] = [2, 2, 2, 2];
const ROW_H = 18;

const shortName = (url: string): string => {
  const path = url.split(/[?#]/)[0];
  const segments = path.split("/").filter(Boolean);
  return truncateMiddle(segments[segments.length - 1] || path, 22);
};

interface WaterfallTooltipProps {
  active?: boolean;
  payload?: readonly { payload?: WaterfallRow }[];
}

const WaterfallTooltip = React.memo(function WaterfallTooltip({ active, payload }: WaterfallTooltipProps) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const { entry } = row;

  return (
    <TooltipSurface className="max-w-[20rem]">
      <p className="text-code mb-1.5 break-all text-foreground">{entry.url}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="label-mono text-[10px]">Type</dt>
        <dd className="text-code text-right text-foreground">{entry.type}</dd>
        <dt className="label-mono text-[10px]">Start</dt>
        <dd className="text-code text-right text-foreground">{formatDuration(entry.startMs)}</dd>
        <dt className="label-mono text-[10px]">Duration</dt>
        <dd className="text-code text-right text-foreground">{formatDuration(entry.durationMs)}</dd>
        <dt className="label-mono text-[10px]">Transfer</dt>
        <dd className="text-code text-right text-foreground">
          {entry.cached ? "cached" : formatBytes(entry.transferBytes)}
        </dd>
      </dl>
      {entry.blocking ? (
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-critical">
          Render blocking
        </p>
      ) : null}
    </TooltipSurface>
  );
});

/**
 * Classic waterfall: a transparent stacked segment carries each bar to its start
 * time, so recharts' own band layout handles row spacing and the time axis.
 */
export const WaterfallChart = React.memo(function WaterfallChart({
  resources,
  height,
  testId = "waterfall-chart",
  className,
}: WaterfallChartProps) {
  const rows = React.useMemo<WaterfallRow[]>(
    () =>
      [...resources]
        .sort((a, b) => a.startMs - b.startMs)
        .map((entry) => ({
          id: entry.id,
          label: shortName(entry.url),
          offset: entry.startMs,
          // Cached hits finish in well under a millisecond; a 1ms floor keeps the
          // row visible instead of rendering a zero-width bar.
          duration: Math.max(1, entry.durationMs),
          color: toneColor(TYPE_TONE[entry.type]),
          entry,
        })),
    [resources],
  );

  const labels = React.useMemo(() => new Map(rows.map((row) => [row.id, row.label])), [rows]);
  const tickFormatter = React.useCallback((value: string) => labels.get(value) ?? "", [labels]);

  const blocking = rows.filter((row) => row.entry.blocking);
  const span = rows.reduce((max, row) => Math.max(max, row.offset + row.duration), 0);
  const markerColor = toneColor("critical");

  return (
    <ChartFrame
      label={`Network waterfall of ${rows.length} requests over ${formatDuration(span)}, ${blocking.length} render blocking`}
      height={height ?? Math.max(160, rows.length * ROW_H + 32)}
      testId={testId}
      className={className}
    >
      <BarChart data={rows} layout="vertical" margin={MARGIN} barCategoryGap={2}>
        <CartesianGrid {...GRID_TIME} />
        <XAxis type="number" {...AXIS_PROPS} tickFormatter={formatDuration} />
        <YAxis
          type="category"
          // Keyed by id, not label: two requests can share a filename and a
          // duplicated category value would collapse them onto one band.
          dataKey="id"
          tickFormatter={tickFormatter}
          interval={0}
          width={132}
          {...AXIS_PROPS}
        />
        <Tooltip {...TOOLTIP_STYLE} content={<WaterfallTooltip />} />
        <Bar dataKey="offset" stackId="wf" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="duration" stackId="wf" radius={RADIUS} maxBarSize={10} isAnimationActive={false}>
          {rows.map((row) => (
            <Cell key={row.id} fill={row.color} />
          ))}
        </Bar>
        {blocking.map((row) => (
          <ReferenceDot
            key={`block-${row.id}`}
            x={row.offset}
            y={row.id}
            r={2.5}
            fill={markerColor}
            stroke="none"
            ifOverflow="extendDomain"
          />
        ))}
      </BarChart>
    </ChartFrame>
  );
});

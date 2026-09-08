"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardToolbar } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Body height in px. Pass the same value to the chart inside. */
  height?: number;
  children: React.ReactNode;
  testId?: string;
  className?: string;
}

export const CHART_CARD_HEIGHT = 220;

/**
 * Card + mono caption + a fixed-height body box for a chart.
 *
 * The body is a plain sized div rather than a ResponsiveContainer: every chart in
 * this directory brings its own, and nesting two containers breaks the resize
 * observer (the inner one measures a parent that is still 0px).
 */
export const ChartCard = React.memo(function ChartCard({
  title,
  description,
  actions,
  height = CHART_CARD_HEIGHT,
  children,
  testId = "chart-card",
  className,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)} data-testid={testId}>
      <CardHeader className="pb-2">
        <div className="min-w-0">
          <h3 className="label-mono truncate">{title}</h3>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <CardToolbar data-testid={`${testId}-actions`}>{actions}</CardToolbar> : null}
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="w-full" style={{ height }}>
          {children}
        </div>
      </CardContent>
    </Card>
  );
});

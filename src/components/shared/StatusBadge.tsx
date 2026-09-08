"use client";

import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface StatusStyle {
  variant: NonNullable<BadgeProps["variant"]>;
  /** Extra token classes for statuses no Badge variant covers. */
  className?: string;
  label: string;
  dot?: boolean;
}

/**
 * ONE table for every status string in the domain — test results, suite health,
 * finding triage, baseline review and perf ratings all land here, so a status
 * never reads a different colour on a different page.
 */
const STATUS: Record<string, StatusStyle> = {
  /* TestStatus */
  passed: { variant: "success", label: "Passed" },
  failed: { variant: "error", label: "Failed" },
  flaky: { variant: "warning", label: "Flaky" },
  skipped: { variant: "muted", label: "Skipped" },
  running: {
    variant: "outline",
    className: "border-executing/30 bg-executing/15 text-executing",
    label: "Running",
    dot: true,
  },
  pending: { variant: "outline", label: "Pending" },

  /* SuiteStatus */
  passing: { variant: "success", label: "Passing" },
  failing: { variant: "error", label: "Failing" },

  /* FindingStatus */
  new: { variant: "info", label: "New" },
  confirmed: { variant: "warning", label: "Confirmed" },
  fixed: { variant: "success", label: "Fixed" },
  "false-positive": { variant: "muted", label: "False positive" },
  "wont-fix": { variant: "outline", label: "Won't fix" },

  /* VisualBaseline review state */
  approved: { variant: "success", label: "Approved" },
  changed: { variant: "warning", label: "Changed" },

  /* PerfMetric rating */
  good: { variant: "success", label: "Good" },
  "needs-improvement": { variant: "warning", label: "Needs improvement" },
  poor: { variant: "error", label: "Poor" },
};

const UNKNOWN: StatusStyle = { variant: "muted", label: "Unknown" };

export interface StatusBadgeProps {
  status: string;
  size?: "xs" | "sm";
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const style = STATUS[status] ?? { ...UNKNOWN, label: status.replace(/-/g, " ") };
  return (
    <Badge
      variant={style.variant}
      size={size}
      dot={style.dot}
      data-testid={`status-badge-${status}`}
      data-status={status}
      className={cn(style.className, style.dot && "[&>span:first-child]:animate-pulse")}
    >
      {style.label}
    </Badge>
  );
}

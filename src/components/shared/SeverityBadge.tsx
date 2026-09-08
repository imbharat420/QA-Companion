"use client";

import { Badge } from "@/components/ui/Badge";
import type { Severity } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * The `--sev-*` tokens exist for exactly this, so the badge tints from them
 * rather than borrowing the closest generic Badge variant.
 */
const SEVERITY_CLASS: Record<Severity, string> = {
  critical: "border-critical/30 bg-critical/15 text-critical",
  high: "border-high/30 bg-high/15 text-high",
  medium: "border-medium/30 bg-medium/15 text-medium",
  low: "border-low/30 bg-low/15 text-low",
};

export interface SeverityBadgeProps {
  severity: Severity;
  size?: "xs" | "sm";
  showLabel?: boolean;
}

export function SeverityBadge({ severity, size = "sm", showLabel = true }: SeverityBadgeProps) {
  return (
    <Badge
      variant="outline"
      size={size}
      dot={!showLabel}
      data-testid={`severity-badge-${severity}`}
      data-severity={severity}
      className={cn(SEVERITY_CLASS[severity], !showLabel && "w-auto px-1.5")}
    >
      {/* Icon-only variants still have to announce the severity. */}
      <span className={showLabel ? undefined : "sr-only"}>{severity}</span>
    </Badge>
  );
}

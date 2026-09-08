"use client";

import { AlertTriangle, Brain, Check, ListTree, Pause, Square, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AgentStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

interface StatusStyle {
  label: string;
  icon: LucideIcon;
  /** Token classes for the pill itself. */
  pill: string;
  /** Motion that reads as the state, not as decoration. */
  motion?: string;
}

/**
 * One token + one motion per lifecycle state, straight off the `--status-*`
 * tokens. The motion is the signal: a soft breath while the model is thinking,
 * a ring while a browser action is actually in flight, nothing once it stops.
 */
const STYLES: Record<AgentStatus, StatusStyle> = {
  idle: { label: "Idle", icon: Pause, pill: "border-idle/30 bg-idle/12 text-idle" },
  thinking: {
    label: "Thinking",
    icon: Brain,
    pill: "border-thinking/30 bg-thinking/12 text-thinking",
    motion: "animate-pulse",
  },
  planning: {
    label: "Planning",
    icon: ListTree,
    pill: "border-planning/30 bg-planning/12 text-planning",
    motion: "animate-pulse-ring",
  },
  executing: {
    label: "Executing",
    icon: Zap,
    pill: "border-executing/40 bg-executing/12 text-executing ring-2 ring-executing/25",
    motion: "animate-pulse",
  },
  waiting: {
    label: "Waiting",
    icon: AlertTriangle,
    pill: "border-waiting/40 bg-waiting/12 text-waiting",
    motion: "animate-pulse",
  },
  completed: { label: "Completed", icon: Check, pill: "border-success/30 bg-success/12 text-success" },
  error: { label: "Error", icon: AlertTriangle, pill: "border-error/40 bg-error/12 text-error" },
  stopped: { label: "Stopped", icon: Square, pill: "border-border bg-muted text-muted-foreground" },
};

export interface AgentStatusPillProps {
  status: AgentStatus;
  /** Overrides the state's own word — e.g. the current step's label. */
  label?: string;
  /** Rendered as a count badge in the `waiting` state. */
  pendingApprovals?: number;
}

export function AgentStatusPill({ status, label, pendingApprovals = 0 }: AgentStatusPillProps) {
  const style = STYLES[status];
  const Icon = style.icon;
  const text = label ?? style.label;
  const showCount = status === "waiting" && pendingApprovals > 0;

  return (
    <span
      data-testid="agent-status-pill"
      data-state={status}
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2",
        "font-mono text-[10px] font-semibold uppercase tracking-[0.04em]",
        style.pill,
      )}
    >
      <Icon className={cn("size-3 shrink-0", style.motion)} aria-hidden />
      <span className="max-w-40 truncate normal-case tracking-normal">{text}</span>
      {showCount ? (
        <span
          data-testid="agent-status-pill-approvals"
          className="grid h-4 min-w-4 place-items-center rounded-full bg-waiting px-1 text-[10px] font-bold tabular-nums text-background"
        >
          {pendingApprovals}
          <span className="sr-only"> approvals waiting</span>
        </span>
      ) : null}
    </span>
  );
}

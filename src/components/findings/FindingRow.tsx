"use client";

import { memo } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import Link from "next/link";
import { PanelRightOpen } from "lucide-react";
import { Badge, Button, Checkbox, Progress } from "@/components/ui";
import { SeverityBadge, StatusBadge } from "@/components/shared";
import { routes } from "@/config/nav";
import { cn, formatRelative, truncateMiddle } from "@/lib/utils";
import type { Finding, Severity } from "@/lib/api/types";

export interface FindingRowProps {
  finding: Finding;
  /** The row the `?finding=` param currently points at. */
  active: boolean;
  selected: boolean;
  onOpen: (id: string) => void;
  onOpenCockpit: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

/** The stripe is the first thing a triager reads, so it carries the severity token. */
const STRIPE: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};

const CONFIDENCE_TONE = (value: number) =>
  value >= 90 ? "success" : value >= 70 ? "primary" : "warning";

/** Nested links and controls must not also open the row behind them. */
const stop = (event: MouseEvent) => event.stopPropagation();

function FindingRowImpl({
  finding,
  active,
  selected,
  onOpen,
  onOpenCockpit,
  onToggleSelect,
}: FindingRowProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Space belongs to the checkbox and Enter to a nested link when focus is on
    // one of them — only the row itself opens the detail.
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpen(finding.id);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      aria-label={`${finding.severity} finding ${finding.id}: ${finding.title}`}
      onClick={() => onOpen(finding.id)}
      onKeyDown={onKeyDown}
      data-testid={`findings-row-${finding.id}`}
      data-finding-id={finding.id}
      data-severity={finding.severity}
      className={cn(
        "relative flex cursor-pointer items-start gap-3 border-b border-border/40 py-2.5 pl-4 pr-2.5",
        "transition-colors duration-150 ease-out",
        active ? "bg-primary/10" : "hover:bg-muted/60",
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", STRIPE[finding.severity])} />

      <span className="pt-1" onClick={stop}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(finding.id)}
          aria-label={`Select ${finding.id}`}
          data-testid={`findings-row-select-${finding.id}`}
        />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {/* Line 1 — identity */}
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={routes.findings({ severity: finding.severity })}
            onClick={stop}
            aria-label={`Filter by ${finding.severity} severity`}
            data-testid={`findings-row-severity-${finding.id}`}
            className="shrink-0 rounded-full"
          >
            <SeverityBadge severity={finding.severity} size="xs" />
          </Link>
          <span className="text-code shrink-0 text-primary">{finding.id}</span>
          <span
            className={cn(
              "min-w-0 truncate text-[13px]",
              finding.status === "fixed" || finding.status === "false-positive"
                ? "text-muted-foreground line-through"
                : "text-foreground",
            )}
            title={finding.title}
          >
            {finding.title}
          </span>
        </div>

        {/* Line 2 — where it lives */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={routes.findings({ category: finding.category })}
            onClick={stop}
            aria-label={`Filter by ${finding.category}`}
            data-testid={`findings-row-category-${finding.id}`}
            className="shrink-0 rounded-full"
          >
            <Badge variant="outline" size="xs">
              {finding.category}
            </Badge>
          </Link>

          <span className="text-code truncate text-subtle-foreground" title={finding.url}>
            {truncateMiddle(finding.url, 34)}
          </span>

          {finding.runId ? (
            <Link
              href={routes.run(finding.runId)}
              onClick={stop}
              data-testid={`findings-row-run-${finding.id}`}
              className="text-code shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              run {finding.runId}
            </Link>
          ) : null}

          {finding.caseId ? (
            <Link
              href={routes.cases({ caseId: finding.caseId })}
              onClick={stop}
              data-testid={`findings-row-tests-${finding.id}`}
              className="text-code shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              {finding.relatedTests} tests
            </Link>
          ) : (
            <span className="text-code shrink-0 text-muted-foreground">
              {finding.relatedTests} tests
            </span>
          )}
        </div>
      </div>

      {/* Right rail — triage signal */}
      <div className="flex shrink-0 items-center gap-2.5 pt-0.5">
        <span
          className="hidden w-24 items-center gap-1.5 md:flex"
          title={`Agent confidence ${finding.confidence}%`}
        >
          <Progress
            value={finding.confidence}
            tone={CONFIDENCE_TONE(finding.confidence)}
            aria-label={`Agent confidence ${finding.confidence} percent`}
            data-testid={`findings-row-confidence-${finding.id}`}
          />
          <span className="font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
            {finding.confidence}%
          </span>
        </span>

        <Link
          href={routes.findings({ status: finding.status })}
          onClick={stop}
          aria-label={`Filter by ${finding.status}`}
          data-testid={`findings-row-status-${finding.id}`}
          className="shrink-0 rounded-full"
        >
          <StatusBadge status={finding.status} size="xs" />
        </Link>

        <span className="hidden w-20 shrink-0 text-right font-mono text-[10px] text-subtle-foreground lg:block">
          {finding.detectedAt ? formatRelative(finding.detectedAt) : "—"}
        </span>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(event) => {
            event.stopPropagation();
            onOpenCockpit(finding.id);
          }}
          aria-label={`Open cockpit for ${finding.id}`}
          data-testid={`findings-row-cockpit-${finding.id}`}
        >
          <PanelRightOpen className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export const FindingRow = memo(FindingRowImpl);

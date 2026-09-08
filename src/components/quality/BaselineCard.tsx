"use client";

import { memo } from "react";
import Link from "next/link";
import { Bug, Check, Minus, Move, Paintbrush, Play, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { ImageDiffSlider, StatusBadge } from "@/components/shared";
import { routes } from "@/config/nav";
import { cn, formatCompact, formatPercent, truncateMiddle } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui";
import type { VisualBaseline } from "@/lib/api/types";

export interface ChangeKindMeta {
  label: string;
  /** The response the kind calls for — a shift and a repaint are different bugs. */
  hint: string;
  icon: LucideIcon;
  variant: NonNullable<BadgeProps["variant"]>;
  /** Rule across the card top. */
  bar: string;
  /** Dashed for a displacement, solid for a repaint — legible without colour. */
  badgeClass?: string;
}

/**
 * `moved` is deliberately not styled like `changed`. A repaint means someone
 * restyled an element; a move means the layout shifted and everything below it
 * is now in the wrong place — a re-baseline hides that instead of fixing it.
 */
export const CHANGE_KIND_META: Record<VisualBaseline["changeKind"], ChangeKindMeta> = {
  none: { label: "No change", hint: "Pixel-identical to the baseline", icon: Check, variant: "muted", bar: "bg-border" },
  moved: {
    label: "Moved",
    hint: "Layout shift — content displaced, not restyled",
    icon: Move,
    variant: "info",
    bar: "bg-low",
    badgeClass: "border-dashed",
  },
  changed: {
    label: "Changed",
    hint: "Repaint in place — same box, new pixels",
    icon: Paintbrush,
    variant: "warning",
    bar: "bg-waiting",
  },
  added: { label: "Added", hint: "New content appeared", icon: Plus, variant: "success", bar: "bg-success" },
  removed: { label: "Removed", hint: "Content disappeared", icon: Minus, variant: "error", bar: "bg-error" },
};

export const CHANGE_KINDS = Object.keys(CHANGE_KIND_META) as VisualBaseline["changeKind"][];

export const viewportLabel = (viewport: VisualBaseline["viewport"]) =>
  `${viewport.label} ${viewport.width}×${viewport.height}`;

export interface BaselineCardProps {
  baseline: VisualBaseline;
  selected?: boolean;
  /** Reviewer chose to keep the existing baseline; nothing was written. */
  rejected?: boolean;
  approving?: boolean;
  onOpen: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="label-mono block text-[9px]">{label}</span>
      <span className="block truncate font-mono text-[11px] tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function BaselineCardImpl({
  baseline,
  selected = false,
  rejected = false,
  approving = false,
  onOpen,
  onApprove,
  onReject,
}: BaselineCardProps) {
  const kind = CHANGE_KIND_META[baseline.changeKind];
  const KindIcon = kind.icon;
  const viewport = viewportLabel(baseline.viewport);
  const settled = baseline.status === "approved" || rejected;
  const overThreshold = baseline.diffPercent > baseline.threshold;

  return (
    <article
      data-testid={`visual-card-${baseline.id}`}
      data-change-kind={baseline.changeKind}
      data-status={baseline.status}
      data-selected={selected || undefined}
      className={cn(
        "surface-card relative flex flex-col overflow-hidden",
        selected && "border-primary",
        rejected && "opacity-70",
      )}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", kind.bar)} />

      <button
        type="button"
        onClick={() => onOpen(baseline.id)}
        data-testid={`visual-card-${baseline.id}-open`}
        className="flex flex-col gap-2 rounded-t-[var(--radius-lg)] p-3 pt-3.5 text-left"
      >
        <ImageDiffSlider
          mode="diff"
          baselineSrc={baseline.baselineSrc}
          actualSrc={baseline.actualSrc}
          diffSrc={baseline.diffSrc}
          alt={`${baseline.name} at ${viewport}`}
        />
        <h3 className="truncate font-display text-[13px] font-semibold leading-tight">
          {baseline.name}
        </h3>
        <p className="text-code truncate text-muted-foreground" title={baseline.target}>
          {truncateMiddle(baseline.target, 42)}
        </p>
      </button>

      <div className="flex flex-wrap items-center gap-1.5 px-3">
        <Badge variant="outline" size="xs" data-testid={`visual-card-${baseline.id}-viewport`}>
          {viewport}
        </Badge>
        <Badge
          variant={kind.variant}
          size="xs"
          title={kind.hint}
          className={kind.badgeClass}
          data-testid={`visual-card-${baseline.id}-change-kind`}
        >
          <KindIcon className="size-2.5" aria-hidden />
          {kind.label}
        </Badge>
        <StatusBadge status={baseline.status} size="xs" />
      </div>

      <p className="px-3 pt-1.5 text-[11px] leading-snug text-muted-foreground">{kind.hint}</p>

      <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/50 px-3 py-2.5">
        <Metric
          /* diffPercent is already 0–100; formatPercent expects a ratio. */
          label={overThreshold ? "Diff · over" : "Diff"}
          value={formatPercent(baseline.diffPercent / 100)}
        />
        <Metric label="Pixels" value={formatCompact(baseline.pixelsChanged)} />
        <Metric label="Branch" value={baseline.branch} />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 px-3 py-2 text-[11px]">
        {baseline.runId ? (
          <Link
            href={routes.run(baseline.runId)}
            data-testid={`visual-card-${baseline.id}-run`}
            className="inline-flex items-center gap-1 font-mono text-muted-foreground transition-colors hover:text-foreground"
          >
            <Play className="size-3" aria-hidden />
            {baseline.runId}
          </Link>
        ) : null}
        {baseline.status === "changed" ? (
          <Link
            href={routes.findings({ category: "visual" })}
            data-testid={`visual-card-${baseline.id}-findings`}
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Bug className="size-3" aria-hidden />
            Visual findings
          </Link>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border/50 px-3 py-2.5">
        <Button
          variant="primary"
          onClick={() => onApprove(baseline.id)}
          loading={approving}
          disabled={settled}
          data-testid={`visual-card-${baseline.id}-approve`}
        >
          <Check className="size-3.5" aria-hidden />
          Approve
        </Button>
        <Button
          variant="outline"
          onClick={() => onReject(baseline.id)}
          disabled={settled}
          data-testid={`visual-card-${baseline.id}-reject`}
        >
          <X className="size-3.5" aria-hidden />
          Reject
        </Button>
        {rejected ? (
          <span className="label-mono ml-auto text-[9px] text-subtle-foreground">Kept baseline</span>
        ) : null}
      </div>
    </article>
  );
}

export const BaselineCard = memo(BaselineCardImpl);

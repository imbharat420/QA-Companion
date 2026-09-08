"use client";

import { memo } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "@/components/charts";
import { cn } from "@/lib/utils";
import { toneTextClass } from "./ToneDot";

export type StatTone = "primary" | "accent" | "success" | "warning" | "error" | "neutral";

export interface StatTileProps {
  label: string;
  value: string | number;
  /** Signed change; sign drives the arrow and the colour, not `tone`. */
  delta?: number;
  deltaLabel?: string;
  tone?: StatTone;
  icon?: LucideIcon;
  /** Pass a stable array — this component is memoized. */
  sparkline?: number[];
  hint?: string;
  href?: string;
  onClick?: () => void;
  testId: string;
}

const SHELL = cn(
  "surface-card group relative flex flex-col gap-2.5 p-3.5 text-left",
  "transition-[border-color,box-shadow,transform] duration-150 ease-out",
);

const INTERACTIVE = cn(
  "cursor-pointer hover:-translate-y-0.5 hover:border-border hover:shadow-lg",
  "motion-reduce:hover:translate-y-0",
);

function StatTileImpl({
  label,
  value,
  delta,
  deltaLabel,
  tone = "primary",
  icon: Icon,
  sparkline,
  hint,
  href,
  onClick,
  testId,
}: StatTileProps) {
  const deltaTone = delta === undefined || delta === 0 ? "neutral" : delta > 0 ? "success" : "error";
  const DeltaIcon = delta === undefined || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="label-mono truncate">{label}</span>
        {Icon ? (
          <span
            aria-hidden
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)]",
              "border border-current/25 bg-current/12",
              toneTextClass(tone),
            )}
          >
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-3">
        <span className="font-display text-2xl font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </span>
        {sparkline?.length ? (
          <span aria-hidden className="shrink-0 pb-0.5">
            <Sparkline data={sparkline} tone={tone} width={72} height={26} showArea />
          </span>
        ) : null}
      </div>

      {delta === undefined && !deltaLabel ? null : (
        <div className="flex items-center gap-1.5 text-[11px] leading-none">
          {delta === undefined ? null : (
            <span
              data-testid={`${testId}-delta`}
              className={cn("inline-flex items-center gap-0.5 font-mono font-semibold tabular-nums", toneTextClass(deltaTone))}
            >
              <DeltaIcon className="size-3" aria-hidden />
              {delta > 0 ? "+" : ""}
              {delta}
            </span>
          )}
          {deltaLabel ? <span className="truncate text-muted-foreground">{deltaLabel}</span> : null}
        </div>
      )}

      {hint ? (
        <p className="text-[10px] leading-snug text-subtle-foreground">{hint}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} data-testid={testId} className={cn(SHELL, INTERACTIVE)}>
        {body}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} data-testid={testId} className={cn(SHELL, INTERACTIVE)}>
        {body}
      </button>
    );
  }

  return (
    <div data-testid={testId} className={SHELL}>
      {body}
    </div>
  );
}

export const StatTile = memo(StatTileImpl);

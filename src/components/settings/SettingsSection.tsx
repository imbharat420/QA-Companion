"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * The one row shape every settings tab uses, so six unrelated tabs read as one
 * page: a label + helper column on the left, the control on the right, rows
 * divided inside a single card.
 */

export interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Header-right slot — section-level actions live here, not per row. */
  actions?: ReactNode;
  children: ReactNode;
  testId: string;
}

export function SettingsSection({
  title,
  description,
  icon: Icon,
  actions,
  children,
  testId,
}: SettingsSectionProps) {
  return (
    <Card data-testid={testId} className="flex flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-3.5 pt-4">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <span
              aria-hidden
              className="mt-px grid size-7 shrink-0 place-items-center rounded-[var(--radius-md)] border border-primary/25 bg-primary/12 text-primary"
            >
              <Icon className="size-3.5" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold leading-tight">{title}</h2>
            {description ? (
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      <div className="flex flex-col border-t border-border/60 [&>*+*]:border-t [&>*+*]:border-border/60">
        {children}
      </div>
    </Card>
  );
}

export interface SettingsFieldProps {
  label: string;
  /** The helper line under the label. Takes nodes so it can carry a cross-link. */
  help?: ReactNode;
  /** Wire to the control's id so clicking the label focuses it. */
  htmlFor?: string;
  /** Control stacks under the label instead of sitting in the right column. */
  stacked?: boolean;
  children: ReactNode;
}

export function SettingsField({ label, help, htmlFor, stacked = false, children }: SettingsFieldProps) {
  return (
    <div
      className={cn(
        "grid gap-2 px-4 py-3.5",
        !stacked && "sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)] sm:items-center sm:gap-4",
      )}
    >
      <div className="min-w-0">
        <Label htmlFor={htmlFor} className="text-xs">
          {label}
        </Label>
        {help ? (
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{help}</p>
        ) : null}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-2",
          !stacked && "sm:justify-end",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export interface NumberFieldProps {
  value: number;
  onCommit: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Unit shown after the input — ms, pages, steps. */
  suffix?: string;
  id?: string;
  testId: string;
  className?: string;
}

/**
 * A number input that commits on blur/Enter rather than per keystroke: some of
 * these fields bump `apiRevision`, and a keystroke-level write would clear the
 * query cache on every digit typed.
 */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix,
  id,
  testId,
  className,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(() => String(value));

  // Re-sync when the store changes underneath us (a reset, or another tab).
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        data-testid={testId}
        className={cn("w-28 text-code tabular-nums", className)}
      />
      {suffix ? (
        <span className="shrink-0 text-[11px] text-muted-foreground">{suffix}</span>
      ) : null}
    </div>
  );
}

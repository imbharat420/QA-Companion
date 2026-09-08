"use client";

import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  testId?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  testId = "empty-state",
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-full border border-border bg-elevated text-muted-foreground"
      >
        <Icon className="size-5" />
      </span>
      <div className="max-w-sm">
        <p className="font-display text-sm font-semibold">{title}</p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

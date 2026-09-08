"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  breadcrumbs?: Breadcrumb[];
  /** Secondary line under the title — counts, timestamps, filter summaries. */
  meta?: ReactNode;
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  breadcrumbs,
  meta,
}: PageHeaderProps) {
  return (
    <header data-testid="page-header" className="flex flex-col gap-3 pb-4">
      {breadcrumbs?.length ? (
        <nav aria-label="Breadcrumb" data-testid="page-header-breadcrumbs">
          <ol className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            {breadcrumbs.map((crumb, i) => (
              <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="size-3 text-subtle-foreground" aria-hidden /> : null}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="rounded px-0.5 transition-colors hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-foreground">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span
              aria-hidden
              className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] border border-primary/25 bg-primary/12 text-primary"
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold leading-tight">{title}</h1>
            {description ? (
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div data-testid="page-header-actions" className="flex shrink-0 items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {meta ? (
        <div
          data-testid="page-header-meta"
          className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground"
        >
          {meta}
        </div>
      ) : null}
    </header>
  );
}

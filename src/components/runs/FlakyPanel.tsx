"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Waves } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardToolbar, Progress } from "@/components/ui";
import {
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  type Column,
} from "@/components/shared";
import { useCases } from "@/lib/queries";
import { cn, formatPercent, formatRelative } from "@/lib/utils";
import { routes } from "@/config/nav";
import type { FlakyTest } from "@/lib/api/types";

export interface FlakyPanelProps {
  flaky: FlakyTest[];
  isPending?: boolean;
  error?: unknown;
  onRetry?: () => void;
  testId?: string;
}

/**
 * FLAKE ANALYSIS.
 *
 * `FlakyTest` carries a single rate, not a history, so the rate renders as a bar
 * scaled to the worst offender in the set rather than a fabricated sparkline —
 * a relative bar is the honest reading of one number per row.
 */
export function FlakyPanel({
  flaky,
  isPending = false,
  error,
  onRetry,
  testId = "runs-flaky-panel",
}: FlakyPanelProps) {
  // The FlakyTest ids are TestCase ids by construction, but only link the rows
  // the live data source actually holds a case for.
  const casesQuery = useCases();
  const caseIds = useMemo(
    () => new Set((casesQuery.data?.items ?? []).map((testCase) => testCase.id)),
    [casesQuery.data],
  );

  const worst = useMemo(
    () => flaky.reduce((max, test) => Math.max(max, test.flakeRate), 0) || 1,
    [flaky],
  );

  const runsAffected = useMemo(
    () => flaky.reduce((sum, test) => sum + test.runsAffected, 0),
    [flaky],
  );

  const columns = useMemo<Column<FlakyTest>[]>(
    () => [
      {
        id: "title",
        header: "Test",
        width: "minmax(0,2.2fr)",
        sortValue: (row) => row.title,
        cell: (row) => (
          <div className="min-w-0">
            {caseIds.has(row.id) ? (
              <Link
                href={routes.cases({ caseId: row.id })}
                data-testid={`flaky-case-link-${row.id}`}
                className="block truncate text-xs font-medium text-foreground hover:text-primary"
              >
                {row.title}
              </Link>
            ) : (
              <span className="block truncate text-xs font-medium text-foreground">{row.title}</span>
            )}
            <span className="text-code block truncate text-subtle-foreground">{row.id}</span>
          </div>
        ),
      },
      {
        id: "file",
        header: "File",
        width: "150px",
        sortValue: (row) => row.file,
        cell: (row) => <span className="text-code truncate">{row.file}</span>,
      },
      {
        id: "flakeRate",
        header: "Flake rate",
        width: "140px",
        sortValue: (row) => row.flakeRate,
        cell: (row) => (
          <div className="w-full min-w-0">
            <span className="font-mono text-[11px] font-semibold tabular-nums text-waiting">
              {formatPercent(row.flakeRate, 0)}
            </span>
            <Progress
              value={row.flakeRate * 100}
              max={worst * 100}
              tone="warning"
              aria-label={`Flake rate ${formatPercent(row.flakeRate, 0)}`}
              className="mt-1"
            />
          </div>
        ),
      },
      {
        id: "runsAffected",
        header: "Runs",
        width: "90px",
        align: "right",
        sortValue: (row) => row.runsAffected,
        cell: (row) => (
          <span className="font-mono text-[11px] tabular-nums text-foreground">
            {row.runsAffected}
          </span>
        ),
      },
      {
        id: "lastFailure",
        header: "Last failure",
        width: "130px",
        sortValue: (row) => row.lastFailure,
        cell: (row) => (
          <span className="truncate text-[11px] text-muted-foreground">
            {formatRelative(row.lastFailure)}
          </span>
        ),
      },
      {
        id: "suspectedCause",
        header: "Suspected cause",
        width: "minmax(0,2.4fr)",
        cell: (row) => (
          <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {row.suspectedCause}
          </span>
        ),
      },
    ],
    [caseIds, worst],
  );

  return (
    <Card data-testid={testId} className="cv-auto">
      <CardHeader>
        <div className="min-w-0">
          <h2 className="label-mono flex items-center gap-2">
            <Waves className="size-3.5 text-waiting" aria-hidden />
            Flaky tests
          </h2>
          <CardDescription>
            Tests that changed verdict without a code change — ranked by flake rate.
          </CardDescription>
        </div>
        <CardToolbar>
          <Badge variant="warning" size="xs" data-testid={`${testId}-count`}>
            {flaky.length} tests
          </Badge>
          <Badge variant="muted" size="xs">
            {runsAffected} runs affected
          </Badge>
          <Button variant="ghost" size="xs" asChild data-testid={`${testId}-open-cases`}>
            <Link href={routes.cases()}>All cases</Link>
          </Button>
        </CardToolbar>
      </CardHeader>

      <CardContent className={cn(isPending && "pt-0")}>
        {isPending ? (
          <LoadingState rows={6} variant="table" />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} testId={`${testId}-error`} />
        ) : (
          <DataTable
            rows={flaky}
            columns={columns}
            rowKey={(row) => row.id}
            rowHeight={64}
            testId={`${testId}-table`}
            empty={
              <EmptyState
                icon={Waves}
                title="No flaky tests detected"
                description="Every test in this window returned the same verdict on every attempt."
                action={
                  <Button variant="outline" size="sm" asChild data-testid={`${testId}-empty-cases`}>
                    <Link href={routes.cases()}>Browse test cases</Link>
                  </Button>
                }
                testId={`${testId}-empty`}
              />
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

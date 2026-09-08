"use client";

import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock,
  GitCommitHorizontal,
  PlayCircle,
  Plus,
  Timer,
  TrendingUp,
  Waves,
} from "lucide-react";
import { Badge, Button, Card, CardContent, Skeleton } from "@/components/ui";
import { ChartCard, CHART_CARD_HEIGHT } from "@/components/charts";
import {
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  StatGrid,
  StatTile,
  StatusBadge,
  type Column,
  type FilterDef,
} from "@/components/shared";
import { FlakyPanel, RunDetail } from "@/components/runs";
import {
  qk,
  useDashboardSummary,
  useFlakyTests,
  usePrefetchOnHover,
  useRun,
  useRunTrend,
  useRuns,
  useStartRun,
  useSuites,
} from "@/lib/queries";
import { cn, formatDuration, formatRelative } from "@/lib/utils";
import { filterValue, useFiltersStore, useRunsFilters } from "@/store";
import { routes } from "@/config/nav";
import type { RunsFilters } from "@/store";
import type { TestRun, TestStatus } from "@/lib/api/types";

/* Recharts is ~90kB — the KPI strip and the run table must paint without it. */
const AreaTrendChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.AreaTrendChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);
const BarSeriesChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.BarSeriesChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

/** The `TestRun.status` values a run history can actually hold. */
const RUN_STATUSES: TestStatus[] = ["passed", "failed", "flaky", "running"];
const TRIGGERS: NonNullable<TestRun["trigger"]>[] = ["manual", "ci", "schedule", "agent"];

const TREND_SERIES = [
  { key: "pass", label: "Pass %", tone: "green" as const },
  { key: "fail", label: "Fail %", tone: "red" as const },
];
const OUTCOME_SERIES = [
  { key: "passed", label: "Passed", tone: "green" as const },
  { key: "failed", label: "Failed", tone: "red" as const },
  { key: "flaky", label: "Flaky", tone: "amber" as const },
  { key: "skipped", label: "Skipped", tone: "neutral" as const },
];
const PERCENT_DOMAIN: [number, number] = [0, 100];
const formatPercentTick = (value: number) => `${value}%`;

const isRunStatus = (value: string): value is TestStatus =>
  (RUN_STATUSES as string[]).includes(value);

/** "main · 91ac2f" -> "main"; the mock branch filter accepts either form. */
const branchName = (branch: string) => branch.split(" · ")[0];

const testTotal = (run: TestRun) => run.passed + run.failed + run.flaky + run.skipped;

/* ==========================================================================
   COUNT PILL — the coloured Results cell.
   ======================================================================== */

function CountPill({
  value,
  tone,
  label,
  href,
  testId,
}: {
  value: number;
  tone: string;
  label: string;
  href?: string;
  testId: string;
}) {
  const body = (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden className={cn("size-1.5 rounded-full", tone)} />
      {value}
    </>
  );
  const shell = cn(
    "inline-flex items-center gap-1 rounded-full border border-border/60 bg-elevated px-1.5",
    "font-mono text-[10px] tabular-nums",
    value === 0 && "opacity-45",
  );

  if (href && value > 0) {
    return (
      <Link
        href={href}
        onClick={(event) => event.stopPropagation()}
        data-testid={testId}
        className={cn(shell, "hover:border-error/50 hover:text-error")}
      >
        {body}
      </Link>
    );
  }
  return (
    <span data-testid={testId} className={shell}>
      {body}
    </span>
  );
}

/* ==========================================================================
   PAGE
   ======================================================================== */

function RunsView() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useRunsFilters();
  const setFilter = useFiltersStore((s) => s.setFilter);
  const prefetch = usePrefetchOnHover();
  const startRun = useStartRun();

  const [sortBy, setSortBy] = useState("run");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirmOpen, setConfirmOpen] = useState(false);

  /* --- URL is the source of truth for every filter ----------------------- */

  const runId = params.get("run");
  const rawStatus = params.get("status") ?? "all";
  const status: RunsFilters["status"] = isRunStatus(rawStatus) ? rawStatus : "all";
  const branch = params.get("branch") ?? "all";
  const trigger = params.get("trigger") ?? "all";
  const suite = params.get("suite") ?? "all";
  const search = params.get("search") ?? "";

  // The store already has a `runs` bag; mirror the linkable filters into it so
  // anything else reading the bag agrees with the URL.
  useEffect(() => {
    if (filters.status !== status) setFilter("runs", "status", status);
    if (filters.branch !== branch) setFilter("runs", "branch", branch);
    if (filters.search !== search) setFilter("runs", "search", search);
  }, [branch, filters.branch, filters.search, filters.status, search, setFilter, status]);

  /**
   * `routes.runs()` models only `status` and `suite`; `branch`, `trigger` and
   * `search` are this page's own params, so they are layered onto the builder's
   * path instead of a hand-written href.
   */
  const listHref = useCallback(
    (patch: Record<string, string> = {}) => {
      const query = new URLSearchParams(params.toString());
      query.delete("run");
      query.delete("tab");
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === "all") query.delete(key);
        else query.set(key, value);
      }
      const serialized = query.toString();
      return serialized ? `${routes.runs()}?${serialized}` : routes.runs();
    },
    [params],
  );

  const hasActiveFilters =
    status !== "all" || branch !== "all" || trigger !== "all" || suite !== "all" || search !== "";

  /* --- data -------------------------------------------------------------- */

  const deferredSearch = useDeferredValue(search);
  const runsQuery = useRuns({
    status: filterValue(status),
    branch: filterValue(branch),
    suiteId: filterValue(suite),
    search: deferredSearch.trim() || undefined,
  });
  /** Unfiltered, so the Branch and Trigger option lists never collapse. */
  const allRunsQuery = useRuns();
  const trendQuery = useRunTrend();
  const flakyQuery = useFlakyTests();
  const summaryQuery = useDashboardSummary();
  const suitesQuery = useSuites();
  const runQuery = useRun(runId ?? "");

  const allRuns = allRunsQuery.data?.items ?? [];
  const trend = trendQuery.data ?? [];
  const flaky = flakyQuery.data ?? [];
  const summary = summaryQuery.data;

  // `RunFilter` has no trigger, so that one filter is applied here.
  const runs = useMemo(() => {
    const items = runsQuery.data?.items ?? [];
    return trigger === "all" ? items : items.filter((run) => run.trigger === trigger);
  }, [runsQuery.data, trigger]);

  /** Oldest -> newest: a per-run bar chart has to read left to right. */
  const chronological = useMemo(() => allRuns.slice().reverse(), [allRuns]);

  /* --- sparkline series (stable arrays — StatTile is memoized) ------------ */

  const passSeries = useMemo(() => trend.map((point) => point.pass), [trend]);
  const totalSeries = useMemo(() => chronological.map(testTotal), [chronological]);
  const durationSeries = useMemo(
    () => chronological.map((run) => run.durationMs ?? 0).filter((ms) => ms > 0),
    [chronological],
  );
  const flakySeries = useMemo(() => chronological.map((run) => run.flaky), [chronological]);

  const passDelta =
    trend.length >= 2 ? trend[trend.length - 1].pass - trend[trend.length - 2].pass : undefined;

  const lastUpdated = useMemo(() => {
    const newest = allRuns.reduce<string | undefined>(
      (max, run) => (run.startedAt && (!max || run.startedAt > max) ? run.startedAt : max),
      undefined,
    );
    return newest ? formatRelative(newest) : undefined;
  }, [allRuns]);

  /* --- filter writes ----------------------------------------------------- */

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      // replace, not push: a filter change must not fill the back stack.
      router.replace(listHref({ [id]: value }));
    },
    [listHref, router],
  );

  const onSearchChange = useCallback(
    (value: string) => router.replace(listHref({ search: value })),
    [listHref, router],
  );

  const clearFilters = useCallback(() => router.replace(routes.runs()), [router]);

  const onSortChange = useCallback(
    (id: string) => {
      if (id === sortBy) {
        setSortDir(sortDir === "asc" ? "desc" : "asc");
        return;
      }
      setSortBy(id);
      setSortDir("desc");
    },
    [sortBy, sortDir],
  );

  const openRun = useCallback((run: TestRun) => router.push(routes.run(run.id)), [router]);

  const warmRun = useCallback(
    (id: string) => prefetch(qk.runs.detail(id), (source) => source.getRun(id)),
    [prefetch],
  );

  const newRun = useCallback(() => {
    startRun.mutate(
      { suiteId: suite === "all" ? undefined : suite },
      { onSuccess: (created) => router.push(routes.run(created.id)) },
    );
  }, [router, startRun, suite]);

  /* --- filter definitions ------------------------------------------------ */

  const filterDefs = useMemo<FilterDef[]>(() => {
    const branches = [...new Set(allRuns.map((run) => branchName(run.branch)))].sort();
    const suites = suitesQuery.data?.items ?? [];

    return [
      {
        id: "status",
        label: "Status",
        value: status,
        options: [
          { value: "all", label: "All statuses", count: allRuns.length },
          ...RUN_STATUSES.map((value) => ({
            value,
            label: value[0].toUpperCase() + value.slice(1),
            count: allRuns.filter((run) => run.status === value).length,
          })),
        ],
      },
      {
        id: "branch",
        label: "Branch",
        value: branch,
        options: [
          { value: "all", label: "All branches" },
          ...branches.map((value) => ({
            value,
            label: value,
            count: allRuns.filter((run) => branchName(run.branch) === value).length,
          })),
        ],
      },
      {
        id: "trigger",
        label: "Trigger",
        value: trigger,
        options: [
          { value: "all", label: "All triggers" },
          ...TRIGGERS.map((value) => ({
            value,
            label: value === "ci" ? "CI" : value[0].toUpperCase() + value.slice(1),
            count: allRuns.filter((run) => run.trigger === value).length,
          })),
        ],
      },
      {
        id: "suite",
        label: "Suite",
        value: suite,
        options: [
          { value: "all", label: "All suites" },
          ...suites.map((entry) => ({
            value: entry.id,
            label: entry.name,
            count: entry.cases,
          })),
        ],
      },
    ];
  }, [allRuns, branch, status, suite, suitesQuery.data, trigger]);

  /* --- table columns ----------------------------------------------------- */

  const columns = useMemo<Column<TestRun>[]>(
    () => [
      {
        id: "run",
        header: "Run",
        width: "minmax(180px,1.1fr)",
        sortValue: (row) => row.startedAt ?? row.id,
        cell: (row) => (
          <div className="min-w-0" onMouseEnter={() => warmRun(row.id)}>
            <div className="flex items-center gap-1.5">
              <Link
                href={routes.run(row.id)}
                onClick={(event) => event.stopPropagation()}
                data-testid={`runs-link-${row.id}`}
                className="font-mono text-xs font-semibold text-primary hover:underline"
              >
                {row.id}
              </Link>
              <StatusBadge status={row.status ?? "pending"} size="xs" />
            </div>
            <span className="text-code block truncate text-subtle-foreground">
              {row.duration}
              {row.trigger ? ` · ${row.trigger}` : ""}
            </span>
          </div>
        ),
      },
      {
        id: "commit",
        header: "Commit",
        width: "minmax(0,2fr)",
        sortValue: (row) => row.commitMessage ?? row.name,
        cell: (row) => (
          <div className="min-w-0">
            <Link
              href={routes.run(row.id)}
              onClick={(event) => event.stopPropagation()}
              data-testid={`runs-commit-${row.id}`}
              className="block truncate text-xs font-medium text-foreground hover:text-primary"
            >
              {row.commitMessage ?? row.name}
            </Link>
            <span className="block truncate text-[11px] text-muted-foreground">
              {row.author ?? "unknown"} ·{" "}
              {row.startedAt ? formatRelative(row.startedAt) : row.when}
            </span>
          </div>
        ),
      },
      {
        id: "branch",
        header: "Branch",
        width: "150px",
        sortValue: (row) => row.branch,
        cell: (row) => <span className="text-code truncate">{row.branch}</span>,
      },
      {
        id: "results",
        header: "Results",
        width: "230px",
        sortValue: (row) => row.failed,
        cell: (row) => (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <CountPill
                value={row.passed}
                tone="bg-success"
                label="Passed"
                testId={`runs-passed-${row.id}`}
              />
              <CountPill
                value={row.failed}
                tone="bg-error"
                label="Failed"
                href={routes.findings({ runId: row.id })}
                testId={`runs-failed-${row.id}`}
              />
              <CountPill
                value={row.flaky}
                tone="bg-waiting"
                label="Flaky"
                testId={`runs-flaky-${row.id}`}
              />
              <CountPill
                value={row.skipped}
                tone="bg-idle"
                label="Skipped"
                testId={`runs-skipped-${row.id}`}
              />
            </div>
            <span className="text-code block text-subtle-foreground">
              Total: {testTotal(row)}
            </span>
          </div>
        ),
      },
      {
        id: "cause",
        header: "Cause",
        width: "minmax(0,1.4fr)",
        cell: (row) =>
          row.groups.length === 0 ? (
            <span className="text-subtle-foreground" aria-label="No root cause grouping">
              —
            </span>
          ) : (
            <Link
              href={routes.findings({ runId: row.id })}
              onClick={(event) => event.stopPropagation()}
              data-testid={`runs-cause-${row.id}`}
              className="flex min-w-0 items-center gap-1.5 hover:text-primary"
            >
              <span className="truncate text-[11px] text-foreground">{row.groups[0].title}</span>
              <Badge variant="error" size="xs">
                {row.groups[0].count}
              </Badge>
              {row.groups.length > 1 ? (
                <Badge variant="muted" size="xs">
                  +{row.groups.length - 1}
                </Badge>
              ) : null}
            </Link>
          ),
      },
    ],
    [warmRun],
  );

  /* --- detail mode -------------------------------------------------------- */

  const header = (
    <PageHeader
      title="Test Runs"
      description="Run history, pass-rate trend, per-spec breakdown and flake analysis."
      icon={PlayCircle}
      breadcrumbs={
        runId
          ? [
              { label: "Test Runs", href: listHref() },
              { label: runId },
            ]
          : undefined
      }
      actions={
        runId ? undefined : (
          <>
            <Button variant="outline" size="sm" asChild data-testid="runs-open-suites">
              <Link href={routes.suites()}>Test suites</Link>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              loading={startRun.isPending}
              data-testid="runs-new-run"
            >
              <Plus className="size-3.5" aria-hidden />
              New run
            </Button>
          </>
        )
      }
      meta={
        runId ? undefined : (
          <>
            <span data-testid="runs-total">{runsQuery.data?.total ?? 0} total</span>
            <span>{summary?.runningRuns ?? 0} running</span>
            {lastUpdated ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3" aria-hidden />
                Last updated {lastUpdated}
              </span>
            ) : null}
          </>
        )
      }
    />
  );

  if (runId) {
    return (
      <div className="flex flex-col gap-4 p-6" data-testid="runs-page">
        {header}

        {runQuery.isPending ? (
          <LoadingState rows={6} variant="panel" />
        ) : runQuery.isError ? (
          <Card>
            <CardContent className="pt-4">
              <ErrorState
                error={runQuery.error}
                onRetry={() => void runQuery.refetch()}
                testId="runs-detail-error"
              />
            </CardContent>
          </Card>
        ) : runQuery.data ? (
          <RunDetail run={runQuery.data} backHref={listHref()} />
        ) : (
          <Card>
            <CardContent className="pt-4">
              <EmptyState
                icon={GitCommitHorizontal}
                title="Run not found in this data source"
                description={`No run with the id ${runId} exists in the source that is currently selected.`}
                action={
                  <Button variant="outline" size="sm" asChild data-testid="runs-detail-back">
                    <Link href={listHref()}>← All runs</Link>
                  </Button>
                }
                testId="runs-detail-missing"
              />
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  /* --- list mode ---------------------------------------------------------- */

  const tableEmpty = hasActiveFilters ? (
    <EmptyState
      icon={PlayCircle}
      title="No runs match these filters"
      description={search ? `Nothing matched “${search}”.` : "Widen the status, branch or trigger."}
      action={
        <Button variant="outline" size="sm" onClick={clearFilters} data-testid="runs-empty-clear">
          Clear filters
        </Button>
      }
      testId="runs-table-empty-filtered"
    />
  ) : (
    <EmptyState
      icon={PlayCircle}
      title="No runs yet"
      description="Nothing has executed against this project. Kick off the full suite and the history starts here."
      action={
        <Button
          variant="primary"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          data-testid="runs-empty-start"
        >
          <PlayCircle className="size-3.5" aria-hidden />
          Run all suites
        </Button>
      }
      testId="runs-table-empty"
    />
  );

  return (
    <div className="flex flex-col gap-4 p-6" data-testid="runs-page">
      {header}

      {/* KPI STRIP */}
      <StatGrid columns={4}>
        <StatTile
          label="Pass rate"
          value={`${summary?.passRate ?? 0}%`}
          delta={passDelta}
          deltaLabel="vs previous run"
          tone="primary"
          icon={TrendingUp}
          sparkline={passSeries}
          testId="runs-stat-pass-rate"
        />
        <StatTile
          label="Total tests"
          value={summary?.totalTests ?? 0}
          tone="accent"
          icon={PlayCircle}
          sparkline={totalSeries}
          hint="Cases in the catalog"
          href={routes.cases()}
          testId="runs-stat-total-tests"
        />
        <StatTile
          label="Avg duration"
          value={formatDuration(summary?.avgDurationMs ?? 0)}
          tone="neutral"
          icon={Timer}
          sparkline={durationSeries}
          hint="Mean case wall-clock"
          testId="runs-stat-avg-duration"
        />
        <StatTile
          label="Flaky tests"
          value={flaky.length}
          tone="warning"
          icon={Waves}
          sparkline={flakySeries}
          hint="Verdict changed without a code change"
          href={routes.cases()}
          testId="runs-stat-flaky"
        />
      </StatGrid>

      {/* CHARTS */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Pass / fail trend"
          description="Share of tests by verdict, per run"
          testId="runs-trend-card"
        >
          {trendQuery.isPending ? (
            <Skeleton className="size-full rounded-[var(--radius-md)]" />
          ) : trendQuery.isError ? (
            <ErrorState
              error={trendQuery.error}
              onRetry={() => void trendQuery.refetch()}
              testId="runs-trend-error"
            />
          ) : (
            <AreaTrendChart
              data={trend}
              xKey="run"
              series={TREND_SERIES}
              stacked
              showLegend
              yDomain={PERCENT_DOMAIN}
              formatY={formatPercentTick}
              height={CHART_CARD_HEIGHT}
              testId="runs-trend-chart"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Outcomes per run"
          description="Passed, failed, flaky and skipped counts"
          testId="runs-outcome-card"
        >
          {allRunsQuery.isPending ? (
            <Skeleton className="size-full rounded-[var(--radius-md)]" />
          ) : (
            <BarSeriesChart
              data={chronological}
              xKey="id"
              series={OUTCOME_SERIES}
              stacked
              showLegend
              height={CHART_CARD_HEIGHT}
              testId="runs-outcome-chart"
            />
          )}
        </ChartCard>
      </div>

      {/* FILTERS */}
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search commits or run number"
        filters={filterDefs}
        onFilterChange={onFilterChange}
        right={
          hasActiveFilters ? (
            <Button variant="ghost" size="xs" onClick={clearFilters} data-testid="runs-clear-filters">
              Clear filters
            </Button>
          ) : null
        }
        testId="runs-filter-bar"
      />

      {/* TABLE */}
      <section aria-label="Run history" className="flex flex-col gap-3">
        {runsQuery.isPending ? (
          <LoadingState rows={5} variant="table" />
        ) : runsQuery.isError ? (
          <Card>
            <CardContent className="pt-4">
              <ErrorState
                error={runsQuery.error}
                onRetry={() => void runsQuery.refetch()}
                testId="runs-list-error"
              />
            </CardContent>
          </Card>
        ) : (
          <DataTable
            rows={runs}
            columns={columns}
            rowKey={(row) => row.id}
            onRowClick={openRun}
            rowHeight={58}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={onSortChange}
            empty={tableEmpty}
            testId="runs-table"
          />
        )}
      </section>

      {/* FLAKE ANALYSIS */}
      <FlakyPanel
        flaky={flaky}
        isPending={flakyQuery.isPending}
        error={flakyQuery.error}
        onRetry={() => void flakyQuery.refetch()}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Start a new run?"
        description={
          suite === "all"
            ? "Queues every suite in the active project against the current branch."
            : "Queues the selected suite against the current branch."
        }
        confirmLabel="Start run"
        onConfirm={newRun}
        testId="runs-new-run-confirm"
      />
    </div>
  );
}

/**
 * `useSearchParams` suspends during the static-export prerender, so the whole
 * reading half of the route lives under a boundary.
 */
export default function RunsPage() {
  return (
    <Suspense fallback={<LoadingState rows={8} variant="panel" />}>
      <RunsView />
    </Suspense>
  );
}

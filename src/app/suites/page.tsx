"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  FileCode2,
  ListChecks,
  MoreHorizontal,
  Percent,
  Play,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SuiteTree } from "@/components/testing";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Progress,
  Skeleton,
} from "@/components/ui";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  StatGrid,
  StatTile,
  StatusBadge,
} from "@/components/shared";
import { ChartCard, CHART_CARD_HEIGHT } from "@/components/charts";
import { routes } from "@/config/nav";
import { useProject, useStartRun, useSuites } from "@/lib/queries";
import { useActiveProjectId } from "@/store";
import { formatPercent, truncateMiddle } from "@/lib/utils";
import type { Column } from "@/components/shared";
import type { DonutSlice, SeriesSpec } from "@/components/charts";
import type { Suite, SuiteStatus } from "@/lib/api/types";

/** recharts is the heaviest import on this route — keep it off first paint. */
const BarSeriesChart = dynamic(
  () => import("@/components/charts/BarSeriesChart").then((m) => m.BarSeriesChart),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);
const DonutChart = dynamic(
  () => import("@/components/charts/DonutChart").then((m) => m.DonutChart),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "passing", label: "Passing" },
  { value: "failing", label: "Failing" },
  { value: "flaky", label: "Flaky" },
];

const PASS_RATE_SERIES: SeriesSpec[] = [{ key: "passRate", label: "Pass rate", tone: "primary" }];

const STATUS_TONE: Record<SuiteStatus, "success" | "error" | "warning"> = {
  passing: "success",
  failing: "error",
  flaky: "warning",
};

const isSuiteStatus = (value: string): value is SuiteStatus =>
  value === "passing" || value === "failing" || value === "flaky";

const formatY = (value: number) => `${Math.round(value)}%`;

/** Pass rate is stored 0–100 on a Suite; the bar and the numeral share one tone. */
function PassRateCell({ suite }: { suite: Suite }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-foreground">
        {formatPercent(suite.passRate / 100, 0)}
      </span>
      <Progress
        value={suite.passRate}
        tone={STATUS_TONE[suite.status]}
        className="min-w-10"
        aria-label={`${suite.name} pass rate`}
      />
    </div>
  );
}

function SuitesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const activeProjectId = useActiveProjectId();

  const projectId = params.get("project") ?? activeProjectId ?? "";
  const selectedSuiteId = params.get("suite") ?? "";
  const status = params.get("status") ?? "all";
  const tag = params.get("tag") ?? "all";
  const search = params.get("q") ?? "";

  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // The tree must show every suite even while the table is filtered, so the one
  // query is scoped by project only and the status/tag/search cuts happen here.
  const suitesQuery = useSuites(useMemo(() => ({ projectId: projectId || undefined }), [projectId]));
  const project = useProject(projectId);
  const startRun = useStartRun();

  const suites = suitesQuery.data?.items ?? [];

  const writeParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${routes.suites()}?${qs}` : routes.suites());
    },
    [params, router],
  );

  const onFilterChange = useCallback(
    (id: string, value: string) => writeParams({ [id]: value }),
    [writeParams],
  );

  const onSearchChange = useCallback((value: string) => writeParams({ q: value }), [writeParams]);

  const onSelectSuite = useCallback(
    (suiteId: string) => writeParams({ suite: suiteId === selectedSuiteId ? undefined : suiteId }),
    [selectedSuiteId, writeParams],
  );

  const clearFilters = useCallback(
    () => writeParams({ status: undefined, tag: undefined, q: undefined, suite: undefined }),
    [writeParams],
  );

  const onSortChange = useCallback((id: string) => {
    setSortBy((current) => {
      if (current === id) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return current;
      }
      setSortDir("asc");
      return id;
    });
  }, []);

  const runSuite = useCallback(
    async (suite: Suite) => {
      try {
        const run = await startRun.mutateAsync({ suiteId: suite.id, projectId: projectId || undefined });
        toast.success(`Run ${run.id} started`, { description: suite.name });
        router.push(routes.run(run.id));
      } catch (error) {
        toast.error("Could not start the run", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [projectId, router, startRun],
  );

  const runAll = useCallback(async () => {
    try {
      const run = await startRun.mutateAsync({ projectId: projectId || undefined });
      toast.success(`Run ${run.id} started`, { description: `${suites.length} suites queued` });
      router.push(routes.run(run.id));
    } catch (error) {
      toast.error("Could not start the run", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }, [projectId, router, startRun, suites.length]);

  const sync = useCallback(() => {
    void suitesQuery.refetch();
    toast.message("Re-reading the spec catalog…");
  }, [suitesQuery]);

  /* --- derived --------------------------------------------------------- */

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const suite of suites) {
      for (const entry of suite.tags ?? []) counts.set(entry, (counts.get(entry) ?? 0) + 1);
    }
    return [
      { value: "all", label: "All tags" },
      ...[...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, label: value, count })),
    ];
  }, [suites]);

  const statusCounts = useMemo(() => {
    const counts: Record<SuiteStatus, number> = { passing: 0, failing: 0, flaky: 0 };
    for (const suite of suites) counts[suite.status] += 1;
    return counts;
  }, [suites]);

  const totals = useMemo(() => {
    const cases = suites.reduce((sum, suite) => sum + suite.cases, 0);
    // Weight by case count: a 5-case suite at 100% must not outvote a 12-case
    // suite at 58% the way a plain mean of `passRate` would.
    const weighted = suites.reduce((sum, suite) => sum + (suite.passRate / 100) * suite.cases, 0);
    return { cases, passRate: cases === 0 ? 0 : weighted / cases };
  }, [suites]);

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return suites.filter((suite) => {
      if (selectedSuiteId && suite.id !== selectedSuiteId) return false;
      if (status !== "all" && suite.status !== status) return false;
      if (tag !== "all" && !(suite.tags ?? []).includes(tag)) return false;
      if (!needle) return true;
      return (
        suite.name.toLowerCase().includes(needle) || suite.file.toLowerCase().includes(needle)
      );
    });
  }, [search, selectedSuiteId, status, suites, tag]);

  const passRateData = useMemo(
    () => suites.map((suite) => ({ name: suite.name, passRate: suite.passRate })),
    [suites],
  );

  const statusSlices = useMemo<DonutSlice[]>(
    () =>
      (
        [
          { key: "passing", name: "Passing", tone: "success" },
          { key: "failing", name: "Failing", tone: "error" },
          { key: "flaky", name: "Flaky", tone: "warning" },
        ] as const
      )
        .map((entry) => ({
          name: entry.name,
          value: statusCounts[entry.key],
          tone: entry.tone,
        }))
        .filter((slice) => slice.value > 0),
    [statusCounts],
  );

  const columns = useMemo<Column<Suite>[]>(
    () => [
      {
        id: "name",
        header: "Suite",
        width: "minmax(160px,1.5fr)",
        sortValue: (row) => row.name,
        cell: (row) => (
          <Link
            href={routes.cases({ suiteId: row.id })}
            onClick={(event) => event.stopPropagation()}
            className="truncate font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
            data-testid={`suites-row-${row.id}-name`}
          >
            {row.name}
          </Link>
        ),
      },
      {
        id: "file",
        header: "File",
        width: "minmax(120px,1.1fr)",
        sortValue: (row) => row.file,
        cell: (row) => (
          <span className="text-code truncate text-muted-foreground" title={row.file}>
            {truncateMiddle(row.file, 28)}
          </span>
        ),
      },
      {
        id: "cases",
        header: "Cases",
        width: "80px",
        align: "right",
        sortValue: (row) => row.cases,
        cell: (row) => (
          <Link
            href={routes.cases({ suiteId: row.id })}
            onClick={(event) => event.stopPropagation()}
            className="font-mono text-xs tabular-nums text-foreground underline-offset-2 hover:text-primary hover:underline"
            data-testid={`suites-row-${row.id}-cases`}
          >
            {row.cases}
          </Link>
        ),
      },
      {
        id: "passRate",
        header: "Pass rate",
        width: "minmax(110px,1fr)",
        sortValue: (row) => row.passRate,
        cell: (row) => <PassRateCell suite={row} />,
      },
      {
        id: "lastRun",
        header: "Last run",
        width: "110px",
        sortValue: (row) => row.lastRun,
        cell: (row) => (
          <Link
            href={routes.runs({ suiteId: row.id })}
            onClick={(event) => event.stopPropagation()}
            className="truncate text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            data-testid={`suites-row-${row.id}-lastrun`}
          >
            {row.lastRun}
          </Link>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "96px",
        sortValue: (row) => row.status,
        cell: (row) => (
          <Link
            href={routes.runs({ suiteId: row.id })}
            onClick={(event) => event.stopPropagation()}
            data-testid={`suites-row-${row.id}-status`}
          >
            <StatusBadge status={row.status} size="xs" />
          </Link>
        ),
      },
      {
        id: "tags",
        header: "Tags",
        width: "minmax(120px,1.2fr)",
        cell: (row) => (
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {(row.tags ?? []).slice(0, 3).map((entry) => (
              <Link
                key={entry}
                href={routes.cases({ tag: entry })}
                onClick={(event) => event.stopPropagation()}
                data-testid={`suites-row-${row.id}-tag-${entry}`}
              >
                <Badge variant="muted" size="xs" className="hover:text-foreground">
                  {entry}
                </Badge>
              </Link>
            ))}
            {(row.tags?.length ?? 0) > 3 ? (
              <span className="font-mono text-[10px] text-subtle-foreground">
                +{(row.tags?.length ?? 0) - 3}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        width: "44px",
        align: "center",
        cell: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${row.name}`}
                onClick={(event) => event.stopPropagation()}
                data-testid={`suites-row-${row.id}-menu`}
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{row.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => void runSuite(row)}
                data-testid={`suites-row-${row.id}-run`}
              >
                <Play className="size-3.5" aria-hidden />
                Run suite
              </DropdownMenuItem>
              <DropdownMenuItem asChild data-testid={`suites-row-${row.id}-view-cases`}>
                <Link href={routes.cases({ suiteId: row.id })}>
                  <FileCode2 className="size-3.5" aria-hidden />
                  View cases
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild data-testid={`suites-row-${row.id}-workbench`}>
                <Link href={routes.workbench()}>
                  <Bot className="size-3.5" aria-hidden />
                  Open in workbench
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild data-testid={`suites-row-${row.id}-runs`}>
                <Link href={routes.runs({ suiteId: row.id })}>
                  <Play className="size-3.5" aria-hidden />
                  Run history
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [runSuite],
  );

  const onRowClick = useCallback(
    (row: Suite) => router.push(routes.cases({ suiteId: row.id })),
    [router],
  );

  const filtered = status !== "all" || tag !== "all" || search.trim() !== "" || Boolean(selectedSuiteId);
  const selectedSuite = suites.find((suite) => suite.id === selectedSuiteId);

  /* --- render ---------------------------------------------------------- */

  const table = suitesQuery.isPending ? (
    <LoadingState rows={6} variant="table" />
  ) : suitesQuery.isError ? (
    <ErrorState
      error={suitesQuery.error}
      onRetry={() => void suitesQuery.refetch()}
      testId="suites-error"
    />
  ) : (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      onRowClick={onRowClick}
      selectedKey={selectedSuiteId || undefined}
      sortBy={sortBy}
      sortDir={sortDir}
      onSortChange={onSortChange}
      testId="suites-table"
      virtualize={rows.length > 100}
      empty={
        filtered ? (
          <EmptyState
            icon={ListChecks}
            title={search.trim() ? `No suites match "${search.trim()}"` : "No suites match these filters"}
            description="Widen the status, tag or suite selection to see the rest of the catalog."
            action={
              <Button variant="outline" onClick={clearFilters} data-testid="suites-clear-filters">
                Clear filters
              </Button>
            }
            testId="suites-empty-filtered"
          />
        ) : (
          <EmptyState
            icon={ListChecks}
            title="No suites in this project"
            description="Point the agent at a flow and it will write the first spec for you."
            action={
              <Button variant="primary" asChild data-testid="suites-empty-generate">
                <Link href={routes.workbench()}>
                  <Sparkles className="size-3.5" aria-hidden />
                  Generate spec
                </Link>
              </Button>
            }
            testId="suites-empty"
          />
        )
      }
    />
  );

  return (
    <div className="grid min-h-0 grid-cols-1 gap-4 p-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside
        aria-label="Suite tree"
        data-testid="suites-tree-panel"
        className="surface-card flex max-h-[70vh] min-w-0 flex-col gap-2 overflow-y-auto p-2 lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)]"
      >
        <div className="flex items-center justify-between gap-2 px-1.5 pt-1">
          <span className="label-mono">Catalog</span>
          {selectedSuiteId ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => writeParams({ suite: undefined })}
              data-testid="suites-tree-clear"
            >
              Show all
            </Button>
          ) : null}
        </div>
        <SuiteTree
          suites={suites}
          projectName={project.data?.name ?? "All projects"}
          projectHref={projectId ? routes.project(projectId) : routes.projects()}
          selectedSuiteId={selectedSuiteId || undefined}
          onSelectSuite={onSelectSuite}
          loading={suitesQuery.isPending}
          stale={suitesQuery.isError}
        />
      </aside>

      <section className="flex min-w-0 flex-col gap-4">
        <PageHeader
          title="Test Suites"
          description="Suite tree and spec catalog for the active project."
          icon={ListChecks}
          breadcrumbs={[
            { label: project.data?.name ?? "Projects", href: routes.projects() },
            { label: "Test Suites" },
          ]}
          meta={
            <>
              <span data-testid="suites-count">
                <span className="font-mono tabular-nums text-foreground">{suites.length}</span>{" "}
                suites
              </span>
              <span>
                <span className="font-mono tabular-nums text-foreground">{totals.cases}</span> cases
              </span>
              <Link href={routes.runs()} className="hover:text-foreground">
                Run history
              </Link>
              {selectedSuite ? (
                <span className="text-primary" data-testid="suites-selected-label">
                  Filtered to {selectedSuite.name}
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <Button
                variant="primary"
                onClick={() => void runAll()}
                loading={startRun.isPending}
                data-testid="suites-run-all"
              >
                <Play className="size-3.5" aria-hidden />
                Run all
              </Button>
              <Button variant="outline" asChild data-testid="suites-generate-spec">
                <Link href={routes.workbench()}>
                  <Sparkles className="size-3.5" aria-hidden />
                  Generate spec
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={sync}
                aria-label="Sync spec catalog"
                data-testid="suites-sync"
              >
                <RefreshCw
                  className={suitesQuery.isFetching ? "size-3.5 animate-spin" : "size-3.5"}
                  aria-hidden
                />
              </Button>
            </>
          }
        />

        <StatGrid columns={5}>
          <StatTile
            label="Suites"
            value={suites.length}
            icon={ListChecks}
            tone="primary"
            hint="Spec files in this project"
            testId="suites-stat-total"
          />
          <StatTile
            label="Cases"
            value={totals.cases}
            icon={FileCode2}
            tone="accent"
            href={routes.cases()}
            hint="Sum of suite case counts"
            testId="suites-stat-cases"
          />
          <StatTile
            label="Pass rate"
            value={formatPercent(totals.passRate, 1)}
            icon={Percent}
            tone={totals.passRate >= 0.9 ? "success" : totals.passRate >= 0.7 ? "warning" : "error"}
            hint="Case-weighted across all suites"
            testId="suites-stat-pass-rate"
          />
          <StatTile
            label="Passing"
            value={statusCounts.passing}
            icon={CheckCircle2}
            tone="success"
            onClick={() => onFilterChange("status", "passing")}
            testId="suites-stat-passing"
          />
          <StatTile
            label="Failing"
            value={statusCounts.failing + statusCounts.flaky}
            icon={XCircle}
            tone="error"
            hint={`${statusCounts.failing} failing · ${statusCounts.flaky} flaky`}
            onClick={() => onFilterChange("status", "failing")}
            testId="suites-stat-failing"
          />
        </StatGrid>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <ChartCard
            title="Pass rate by suite"
            description="Percentage of cases green on the last run"
            testId="suites-chart-pass-rate"
          >
            {passRateData.length ? (
              <BarSeriesChart
                data={passRateData}
                xKey="name"
                series={PASS_RATE_SERIES}
                height={CHART_CARD_HEIGHT}
                formatY={formatY}
                testId="suites-pass-rate-chart"
              />
            ) : (
              <EmptyState title="No pass-rate data" testId="suites-chart-pass-rate-empty" />
            )}
          </ChartCard>

          <ChartCard
            title="Suites by status"
            description="Where the catalog stands right now"
            testId="suites-chart-status"
          >
            {statusSlices.length ? (
              <DonutChart
                data={statusSlices}
                centerLabel="Suites"
                centerValue={String(suites.length)}
                height={CHART_CARD_HEIGHT}
                testId="suites-status-chart"
              />
            ) : (
              <EmptyState title="No suites to chart" testId="suites-chart-status-empty" />
            )}
          </ChartCard>
        </div>

        <FilterBar
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search suites and spec files"
          filters={[
            {
              id: "status",
              label: "Status",
              value: isSuiteStatus(status) ? status : "all",
              options: STATUS_OPTIONS.map((option) =>
                option.value === "all"
                  ? { ...option, count: suites.length }
                  : { ...option, count: statusCounts[option.value as SuiteStatus] },
              ),
            },
            { id: "tag", label: "Tag", value: tag, options: tagOptions },
          ]}
          onFilterChange={onFilterChange}
          right={
            filtered ? (
              <Button variant="ghost" size="xs" onClick={clearFilters} data-testid="suites-reset">
                Clear filters
              </Button>
            ) : null
          }
          testId="suites-filters"
        />

        {table}
      </section>
    </div>
  );
}

export default function SuitesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState rows={6} />
        </div>
      }
    >
      <SuitesScreen />
    </Suspense>
  );
}

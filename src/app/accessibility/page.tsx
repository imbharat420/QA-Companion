"use client";

import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Accessibility, CheckCircle2, Download, HelpCircle, RotateCw, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, CardContent, Label, Skeleton, Switch } from "@/components/ui";
import { ChartCard } from "@/components/charts";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  ScoreRing,
  SeverityBadge,
  StatGrid,
  StatTile,
  StatusBadge,
  type Column,
  type FilterDef,
} from "@/components/shared";
import { A11yIssueDetail } from "@/components/quality/A11yIssueDetail";
import { useA11yIssues, useA11ySummary, useFindings } from "@/lib/queries";
import { cn, formatCompact, truncateMiddle } from "@/lib/utils";
import {
  filterValue,
  useA11yFilters,
  useAgentStore,
  useFiltersStore,
  useHasActiveFilters,
} from "@/store";
import { routes } from "@/config/nav";
import type { A11yFilters } from "@/store";
import type { A11yIssue, FindingStatus, Severity, WcagLevel } from "@/lib/api/types";

/* Recharts is ~90kB — the score hero and the table must paint without it. */
const TrendLineChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.TrendLineChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);
const DonutChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.DonutChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);
const BarSeriesChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.BarSeriesChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

const LEVELS: WcagLevel[] = ["A", "AA", "AAA"];
const IMPACTS: Severity[] = ["critical", "high", "medium", "low"];
/** The distinct `A11yIssue.category` values — the union documented in types.ts. */
const CATEGORIES = ["contrast", "aria", "keyboard", "structure", "forms", "media"];

const IMPACT_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const LEVEL_RANK: Record<WcagLevel, number> = { A: 1, AA: 2, AAA: 3 };
const IMPACT_DOT: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};

const TREND_SERIES = [{ key: "score", label: "Score", tone: "primary" as const }];
const LEVEL_SERIES = [{ key: "count", label: "Violations", tone: "accent" as const }];
const SCORE_DOMAIN: [number, number] = [0, 100];

const AUDIT_PROMPT =
  "Audit every page against WCAG 2.2 AA and group the violations by rule.";

const isLevel = (value: string | null): value is WcagLevel =>
  value !== null && (LEVELS as string[]).includes(value);

/* ==========================================================================
   FILTER CHIP — the discoverable half of "clicking a bar filters the table".
   ======================================================================== */

function FilterChip({
  label,
  count,
  active,
  dotClass,
  onClick,
  testId,
}: {
  label: string;
  count: number;
  active: boolean;
  dotClass?: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "font-mono text-[10px] uppercase tracking-[0.04em] transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-foreground"
          : "border-border bg-elevated text-muted-foreground hover:border-border hover:text-foreground",
      )}
    >
      {dotClass ? <span aria-hidden className={cn("size-1.5 rounded-full", dotClass)} /> : null}
      {label}
      <span className="tabular-nums text-subtle-foreground">{count}</span>
    </button>
  );
}

/* ==========================================================================
   PAGE
   ======================================================================== */

function AccessibilityView() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useA11yFilters();
  const setFilter = useFiltersStore((s) => s.setFilter);
  const resetFilters = useFiltersStore((s) => s.resetFilters);
  const hasActiveFilters = useHasActiveFilters("a11y");
  const startTask = useAgentStore((s) => s.startTask);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(true);
  const [sortBy, setSortBy] = useState("impact");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  /** Optimistic triage: a11y issues have no status mutation on the DataSource. */
  const [overrides, setOverrides] = useState<Record<string, FindingStatus>>({});

  // `level` is the one linkable filter (routes.accessibility({ level })), so the
  // URL is its source of truth and the store mirrors it.
  const urlLevel = params.get("level");
  const level: A11yFilters["level"] = isLevel(urlLevel) ? urlLevel : "all";

  useEffect(() => {
    if (filters.level !== level) setFilter("a11y", "level", level);
  }, [filters.level, level, setFilter]);

  const search = useDeferredValue(filters.search);
  const issuesQuery = useA11yIssues({
    level: filterValue(level),
    impact: filterValue(filters.impact),
    category: filterValue(filters.category),
    search: search.trim() || undefined,
  });
  const summaryQuery = useA11ySummary();
  const findingsQuery = useFindings({ category: "accessibility" });

  const issues = issuesQuery.data?.items ?? [];
  const summary = summaryQuery.data;

  const findingIds = useMemo(
    () => new Set((findingsQuery.data?.items ?? []).map((finding) => finding.id)),
    [findingsQuery.data],
  );

  const statusOf = useCallback(
    (issue: A11yIssue): FindingStatus => overrides[issue.id] ?? issue.status,
    [overrides],
  );

  /* --- filter writes ----------------------------------------------------- */

  const setLevel = useCallback(
    (next: string) => {
      setFilter("a11y", "level", next as A11yFilters["level"]);
      // replace, not push: a filter change must not fill the back stack.
      router.replace(next === "all" ? routes.accessibility() : routes.accessibility({ level: next }));
    },
    [router, setFilter],
  );

  const setImpact = useCallback(
    (next: string) => setFilter("a11y", "impact", next as A11yFilters["impact"]),
    [setFilter],
  );

  const setCategory = useCallback(
    (next: string) => setFilter("a11y", "category", next),
    [setFilter],
  );

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === "level") setLevel(value);
      else if (id === "impact") setImpact(value);
      else if (id === "category") setCategory(value);
    },
    [setCategory, setImpact, setLevel],
  );

  const onSearchChange = useCallback(
    (value: string) => setFilter("a11y", "search", value),
    [setFilter],
  );

  const clearFilters = useCallback(() => {
    resetFilters("a11y");
    router.replace(routes.accessibility());
  }, [resetFilters, router]);

  /** A chip toggles its own value off, which is what a filter legend should do. */
  const toggleImpact = useCallback(
    (value: Severity) => setImpact(filters.impact === value ? "all" : value),
    [filters.impact, setImpact],
  );
  const toggleLevel = useCallback(
    (value: WcagLevel) => setLevel(level === value ? "all" : value),
    [level, setLevel],
  );

  /* --- actions ----------------------------------------------------------- */

  const runAudit = useCallback(() => {
    void startTask({ prompt: AUDIT_PROMPT, mode: "accessibility-audit" });
    router.push(routes.workbench());
  }, [router, startTask]);

  const exportReport = useCallback(() => {
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = issues.map((issue) =>
      [
        issue.id,
        issue.ruleId,
        issue.impact,
        issue.wcagLevel,
        issue.criteria.join(" "),
        String(issue.nodeCount),
        statusOf(issue),
        issue.category,
        issue.url,
        issue.selector,
        issue.title,
      ]
        .map(cell)
        .join(","),
    );
    const csv = [
      "id,rule,impact,wcagLevel,criteria,nodes,status,category,url,selector,title",
      ...rows,
    ].join("\n");

    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `a11y-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  }, [issues, statusOf]);

  const markFalsePositive = useCallback((id: string) => {
    setOverrides((previous) => ({ ...previous, [id]: "false-positive" }));
  }, []);

  const openIssue = useCallback((issue: A11yIssue) => setSelectedId(issue.id), []);
  const closeIssue = useCallback(() => setSelectedId(null), []);

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

  /* --- derived view data ------------------------------------------------- */

  const filterDefs = useMemo<FilterDef[]>(
    () => [
      {
        id: "level",
        label: "Level",
        value: level,
        options: [
          { value: "all", label: "All levels", count: summary?.violations },
          ...LEVELS.map((value) => ({
            value,
            label: `WCAG ${value}`,
            count: summary?.byLevel[value],
          })),
        ],
      },
      {
        id: "impact",
        label: "Impact",
        value: filters.impact,
        options: [
          { value: "all", label: "All impact" },
          ...IMPACTS.map((value) => ({
            value,
            label: value[0].toUpperCase() + value.slice(1),
            count: summary?.byImpact[value],
          })),
        ],
      },
      {
        id: "category",
        label: "Category",
        value: filters.category,
        options: [
          { value: "all", label: "All categories" },
          ...CATEGORIES.map((value) => ({ value, label: value })),
        ],
      },
    ],
    [filters.category, filters.impact, level, summary],
  );

  const impactSlices = useMemo(
    () =>
      IMPACTS.map((impact) => ({
        name: impact,
        value: summary?.byImpact[impact] ?? 0,
        tone: impact,
      })),
    [summary],
  );

  const levelData = useMemo(
    () => LEVELS.map((value) => ({ level: `WCAG ${value}`, count: summary?.byLevel[value] ?? 0 })),
    [summary],
  );

  const trendData = useMemo(() => summary?.trend ?? [], [summary]);

  const columns = useMemo<Column<A11yIssue>[]>(
    () => [
      {
        id: "rule",
        header: "Rule",
        width: "190px",
        sortValue: (row) => row.ruleId,
        cell: (row) => (
          <span className="text-code truncate text-primary" title={row.ruleId}>
            {row.ruleId}
          </span>
        ),
      },
      {
        id: "issue",
        header: "Issue",
        width: "minmax(220px,2fr)",
        sortValue: (row) => row.title,
        cell: (row) => (
          <span className="truncate text-foreground" title={row.title}>
            {row.title}
          </span>
        ),
      },
      {
        id: "impact",
        header: "Impact",
        width: "108px",
        sortValue: (row) => IMPACT_RANK[row.impact],
        cell: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleImpact(row.impact);
            }}
            aria-label={`Filter by ${row.impact} impact`}
            data-testid={`a11y-row-impact-${row.id}`}
            className="rounded-full"
          >
            <SeverityBadge severity={row.impact} size="xs" />
          </button>
        ),
      },
      {
        id: "level",
        header: "Level",
        width: "84px",
        sortValue: (row) => LEVEL_RANK[row.wcagLevel],
        cell: (row) => (
          <Link
            href={routes.accessibility({ level: row.wcagLevel })}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Show only WCAG ${row.wcagLevel} violations`}
            data-testid={`a11y-row-level-${row.id}`}
          >
            <Badge variant="outline" size="xs">
              {row.wcagLevel}
            </Badge>
          </Link>
        ),
      },
      {
        id: "criteria",
        header: "Criteria",
        width: "130px",
        cell: (row) => (
          <span className="flex min-w-0 flex-wrap gap-1">
            {row.criteria.map((criterion) => (
              <Badge key={criterion} variant="muted" size="xs">
                {criterion}
              </Badge>
            ))}
          </span>
        ),
      },
      {
        id: "nodes",
        header: "Nodes",
        width: "78px",
        align: "right",
        sortValue: (row) => row.nodeCount,
        cell: (row) => (
          <span className="font-mono tabular-nums text-muted-foreground">{row.nodeCount}</span>
        ),
      },
      {
        id: "category",
        header: "Category",
        width: "112px",
        sortValue: (row) => row.category,
        cell: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCategory(filters.category === row.category ? "all" : row.category);
            }}
            aria-label={`Filter by ${row.category}`}
            data-testid={`a11y-row-category-${row.id}`}
            className="label-mono truncate transition-colors hover:text-foreground"
          >
            {row.category}
          </button>
        ),
      },
      {
        id: "page",
        header: "Page",
        width: "190px",
        cell: (row) => (
          <span className="text-code truncate text-muted-foreground" title={row.url}>
            {truncateMiddle(row.url, 30)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "120px",
        sortValue: (row) => statusOf(row),
        cell: (row) => <StatusBadge status={statusOf(row)} size="xs" />,
      },
    ],
    [filters.category, setCategory, statusOf, toggleImpact],
  );

  const groups = useMemo(() => {
    if (!grouped) return null;
    const map = new Map<string, A11yIssue[]>();
    for (const issue of issues) {
      const bucket = map.get(issue.category);
      if (bucket) bucket.push(issue);
      else map.set(issue.category, [issue]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [grouped, issues]);

  const selected = useMemo(
    () => issues.find((issue) => issue.id === selectedId) ?? null,
    [issues, selectedId],
  );

  /* --- render ------------------------------------------------------------ */

  const tableEmpty = hasActiveFilters ? (
    <EmptyState
      icon={Accessibility}
      title="No violations at this level"
      description="Nothing matches the current level, impact, category and search combination."
      action={
        <Button variant="outline" onClick={clearFilters} data-testid="a11y-empty-clear-filters">
          Clear filters
        </Button>
      }
      testId="a11y-empty-filtered"
    />
  ) : (
    <EmptyState
      icon={Accessibility}
      title="No accessibility audit has run yet"
      description="Run an axe-core sweep to populate WCAG violations, impact and the score trend."
      action={
        <Button variant="primary" onClick={runAudit} data-testid="a11y-empty-run-audit">
          <RotateCw className="size-3.5" aria-hidden />
          Re-run audit
        </Button>
      }
      testId="a11y-empty"
    />
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Accessibility"
        description="WCAG violations, keyboard traversal and contrast audit"
        icon={Accessibility}
        meta={
          <>
            <span data-testid="a11y-violation-count">
              <strong className="font-mono text-foreground">
                {formatCompact(summary?.violations ?? issues.length)}
              </strong>{" "}
              violations
            </span>
            <span>{issues.length} shown</span>
            <Link href={routes.runs()} className="transition-colors hover:text-foreground">
              axe-core 4.10 sweep
            </Link>
          </>
        }
        actions={
          <>
            <Button variant="primary" onClick={runAudit} data-testid="a11y-run-audit-btn">
              <RotateCw className="size-3.5" aria-hidden />
              Re-run audit
            </Button>
            <Button variant="outline" onClick={exportReport} data-testid="a11y-export-btn">
              <Download className="size-3.5" aria-hidden />
              Export
            </Button>
          </>
        }
      />

      {/* HERO — score beside the three axe counters. */}
      <section aria-label="Accessibility score" className="flex flex-col gap-3 lg:flex-row">
        <Card className="lg:w-[280px] lg:shrink-0" data-testid="a11y-score-card">
          <CardContent className="flex items-center gap-4 py-4">
            {summaryQuery.isPending ? (
              <Skeleton className="size-[104px] rounded-full" />
            ) : (
              <ScoreRing score={summary?.score ?? 0} size={104} label="axe score" />
            )}
            <dl className="flex min-w-0 flex-col gap-1.5 text-[11px]">
              <div className="flex items-baseline gap-1.5">
                <dt className="label-mono">Violations</dt>
                <dd className="font-mono font-semibold tabular-nums text-critical">
                  {summary?.violations ?? "—"}
                </dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="label-mono">Passes</dt>
                <dd className="font-mono font-semibold tabular-nums text-success">
                  {summary?.passes ?? "—"}
                </dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="label-mono">Incomplete</dt>
                <dd className="font-mono font-semibold tabular-nums text-waiting">
                  {summary?.incomplete ?? "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="min-w-0 flex-1">
          {summaryQuery.isError ? (
            <Card>
              <CardContent>
                <ErrorState
                  error={summaryQuery.error}
                  onRetry={() => void summaryQuery.refetch()}
                  testId="a11y-summary-error"
                />
              </CardContent>
            </Card>
          ) : (
            <StatGrid columns={3}>
              <StatTile
                label="Violations"
                value={summary?.violations ?? 0}
                tone="error"
                icon={ShieldAlert}
                hint="Failing axe rules in this sweep"
                testId="a11y-stat-violations"
              />
              <StatTile
                label="Passes"
                value={summary?.passes ?? 0}
                tone="success"
                icon={CheckCircle2}
                hint="Checks that returned clean"
                testId="a11y-stat-passes"
              />
              <StatTile
                label="Incomplete"
                value={summary?.incomplete ?? 0}
                tone="warning"
                icon={HelpCircle}
                hint="Needs a human decision"
                testId="a11y-stat-incomplete"
              />
            </StatGrid>
          )}
        </div>
      </section>

      {/* TREND + IMPACT BREAKDOWN */}
      <section aria-label="Score trend and impact breakdown" className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Score per run"
          description="Dips at #555 and #558 — click a run to open it"
          testId="a11y-trend-card"
        >
          <div className="flex h-full flex-col gap-1.5">
            <div className="min-h-0 flex-1">
              <TrendLineChart
                data={trendData}
                xKey="run"
                series={TREND_SERIES}
                yDomain={SCORE_DOMAIN}
                height={168}
                testId="a11y-trend-chart"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {trendData.map((point) => (
                <Link
                  key={point.run}
                  href={routes.run(point.run)}
                  data-testid={`a11y-trend-run-${point.run.replace("#", "")}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2 py-0.5",
                    "font-mono text-[10px] tabular-nums text-muted-foreground",
                    "transition-colors hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  {point.run}
                  <span className="text-subtle-foreground">{point.score}</span>
                </Link>
              ))}
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Violations by impact"
          description="Click an impact to filter the table"
          testId="a11y-impact-card"
        >
          <div className="flex h-full flex-col gap-1.5">
            <div className="min-h-0 flex-1">
              <DonutChart
                data={impactSlices}
                centerValue={String(summary?.violations ?? 0)}
                centerLabel="violations"
                height={168}
                testId="a11y-impact-chart"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {IMPACTS.map((impact) => (
                <FilterChip
                  key={impact}
                  label={impact}
                  count={summary?.byImpact[impact] ?? 0}
                  active={filters.impact === impact}
                  dotClass={IMPACT_DOT[impact]}
                  onClick={() => toggleImpact(impact)}
                  testId={`a11y-impact-chip-${impact}`}
                />
              ))}
            </div>
          </div>
        </ChartCard>
      </section>

      {/* WCAG LEVEL BREAKDOWN */}
      <ChartCard
        title="Violations by WCAG level"
        description="Click a level to filter the table — the level also lives in the URL"
        height={150}
        testId="a11y-level-card"
      >
        <div className="flex h-full flex-col gap-1.5">
          <div className="min-h-0 flex-1">
            <BarSeriesChart
              data={levelData}
              xKey="level"
              series={LEVEL_SERIES}
              height={112}
              testId="a11y-level-chart"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {LEVELS.map((value) => (
              <FilterChip
                key={value}
                label={`WCAG ${value}`}
                count={summary?.byLevel[value] ?? 0}
                active={level === value}
                onClick={() => toggleLevel(value)}
                testId={`a11y-level-chip-${value}`}
              />
            ))}
          </div>
        </div>
      </ChartCard>

      {/* FILTERS + TABLE */}
      <FilterBar
        search={filters.search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search rules, selectors and pages"
        filters={filterDefs}
        onFilterChange={onFilterChange}
        right={
          <div className="flex items-center gap-2">
            {hasActiveFilters ? (
              <Button variant="ghost" size="xs" onClick={clearFilters} data-testid="a11y-clear-filters">
                Clear filters
              </Button>
            ) : null}
            <Label htmlFor="a11y-group-toggle" className="label-mono cursor-pointer">
              Group by category
            </Label>
            <Switch
              id="a11y-group-toggle"
              checked={grouped}
              onCheckedChange={setGrouped}
              data-testid="a11y-group-toggle"
            />
          </div>
        }
        testId="a11y-filter-bar"
      />

      <section aria-label="Accessibility violations" className="cv-auto flex flex-col gap-3">
        {issuesQuery.isPending ? (
          <LoadingState rows={10} variant="table" />
        ) : issuesQuery.isError ? (
          <Card>
            <CardContent>
              <ErrorState
                error={issuesQuery.error}
                onRetry={() => void issuesQuery.refetch()}
                testId="a11y-list-error"
              />
            </CardContent>
          </Card>
        ) : groups && issues.length > 0 ? (
          groups.map(([category, rows]) => (
            <div key={category} className="flex flex-col gap-1.5">
              <h2 className="label-mono flex items-center gap-2">
                {category}
                <Badge variant="muted" size="xs">
                  {rows.length}
                </Badge>
              </h2>
              <DataTable
                rows={rows}
                columns={columns}
                rowKey={(row) => row.id}
                onRowClick={openIssue}
                selectedKey={selectedId ?? undefined}
                sortBy={sortBy}
                sortDir={sortDir}
                onSortChange={onSortChange}
                testId={`a11y-table-${category}`}
              />
            </div>
          ))
        ) : (
          <DataTable
            rows={issues}
            columns={columns}
            rowKey={(row) => row.id}
            onRowClick={openIssue}
            selectedKey={selectedId ?? undefined}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={onSortChange}
            empty={tableEmpty}
            testId="a11y-table"
          />
        )}
      </section>

      {selected ? (
        <A11yIssueDetail
          issue={selected}
          status={statusOf(selected)}
          hasFinding={findingIds.has(selected.id)}
          onMarkFalsePositive={markFalsePositive}
          onClose={closeIssue}
        />
      ) : null}
    </div>
  );
}

/**
 * `useSearchParams` suspends during the static export prerender, so the reading
 * half of the page lives under a boundary.
 */
export default function AccessibilityPage() {
  return (
    <Suspense fallback={<LoadingState rows={10} variant="panel" />}>
      <AccessibilityView />
    </Suspense>
  );
}

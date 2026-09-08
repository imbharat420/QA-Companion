"use client";

import { memo, Suspense, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Gauge, Wand2 } from "lucide-react";
// Deep imports rather than the "@/components/charts" barrel: ChartCard and
// GaugeChart carry no chart library, and the two recharts-backed charts below
// load through next/dynamic so recharts never blocks this page's first paint.
import { ChartCard } from "@/components/charts/ChartCard";
import { GaugeChart } from "@/components/charts/GaugeChart";
import {
  Badge,
  Button,
  Card,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui";
import {
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  ToneDot,
  type Column,
  type FilterDef,
} from "@/components/shared";
import { MetricCard, RATING_TONE, formatMetricValue } from "@/components/quality/MetricCard";
import { usePerfSummary } from "@/lib/queries";
import { useAgentStore } from "@/store/agentStore";
import { routes } from "@/config/nav";
import { cn, formatBytes, formatDuration, formatRelative, truncateMiddle } from "@/lib/utils";
import type { PerfMetricId, PerfSummary, ResourceEntry } from "@/lib/api/types";

const TrendLineChart = dynamic(
  () => import("@/components/charts/TrendLineChart").then((m) => ({ default: m.TrendLineChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

const WaterfallChart = dynamic(
  () => import("@/components/charts/WaterfallChart").then((m) => ({ default: m.WaterfallChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

type Device = PerfSummary["device"];
type ResourceType = ResourceEntry["type"];

/** The four vitals lead; the lab diagnostics sit in the secondary row. */
const CWV_IDS: readonly PerfMetricId[] = ["lcp", "cls", "inp", "fcp"];
const LAB_IDS: readonly PerfMetricId[] = ["ttfb", "tbt", "si", "tti"];

/** Metrics whose regression is already filed as a finding. */
const METRIC_FINDING: Partial<Record<PerfMetricId, string>> = { lcp: "PERF-33", cls: "VIS-77" };

/** Opportunities carry no id, so the two that have a filed finding match by title. */
const OPPORTUNITY_FINDING: Record<string, string> = {
  "Serve the hero image as AVIF with a responsive srcset": "PERF-33",
  "Reserve dimensions for the hero and card media": "VIS-77",
};

/**
 * Mirror of WaterfallChart's own type ramp — it keeps that map private, and the
 * legend has to read the same colours as the bars.
 */
const TYPE_TONE: Record<ResourceType, string> = {
  document: "chart-1",
  script: "chart-2",
  stylesheet: "chart-3",
  image: "chart-4",
  xhr: "chart-5",
  font: "chart-6",
  media: "medium",
  other: "neutral",
};

const RESOURCE_TYPES = Object.keys(TYPE_TONE) as ResourceType[];

const SORT_OPTIONS = [
  { value: "duration", label: "Duration" },
  { value: "size", label: "Size" },
  { value: "start", label: "Start" },
];

/** Stable empty tail so `?? []` never hands a fresh array to a memo boundary. */
const NO_RESOURCES: ResourceEntry[] = [];

const Flag = ({ on, label }: { on: boolean; label: string }) =>
  on ? (
    <Badge variant={label === "Blocking" ? "error" : "success"} size="xs">
      {label}
    </Badge>
  ) : (
    <span aria-label={`Not ${label.toLowerCase()}`} className="text-subtle-foreground">
      —
    </span>
  );

const RESOURCE_COLUMNS: Column<ResourceEntry>[] = [
  {
    id: "url",
    header: "Resource",
    width: "minmax(220px,2.4fr)",
    cell: (row) => (
      <span className="text-code truncate text-foreground" title={row.url}>
        {truncateMiddle(row.url, 52)}
      </span>
    ),
    sortValue: (row) => row.url,
  },
  {
    id: "type",
    header: "Type",
    width: "104px",
    cell: (row) => (
      <Badge variant="outline" size="xs" className="gap-1.5">
        <ToneDot tone={TYPE_TONE[row.type]} size={6} />
        {row.type}
      </Badge>
    ),
    sortValue: (row) => row.type,
  },
  {
    id: "size",
    header: "Size",
    width: "96px",
    align: "right",
    cell: (row) => <span className="text-code tabular-nums">{formatBytes(row.sizeBytes)}</span>,
    sortValue: (row) => row.sizeBytes,
  },
  {
    id: "transfer",
    header: "Transfer",
    width: "104px",
    align: "right",
    cell: (row) => (
      <span className={cn("text-code tabular-nums", row.transferBytes === 0 && "text-subtle-foreground")}>
        {formatBytes(row.transferBytes)}
      </span>
    ),
    sortValue: (row) => row.transferBytes,
  },
  {
    id: "duration",
    header: "Duration",
    width: "104px",
    align: "right",
    cell: (row) => (
      <span className={cn("text-code tabular-nums", row.durationMs >= 1000 && "font-semibold text-error")}>
        {formatDuration(row.durationMs)}
      </span>
    ),
    sortValue: (row) => row.durationMs,
  },
  {
    id: "start",
    header: "Start",
    width: "88px",
    align: "right",
    cell: (row) => (
      <span className="text-code tabular-nums text-muted-foreground">{formatDuration(row.startMs)}</span>
    ),
    sortValue: (row) => row.startMs,
  },
  {
    id: "blocking",
    header: "Blocking",
    width: "96px",
    align: "center",
    cell: (row) => <Flag on={row.blocking} label="Blocking" />,
    sortValue: (row) => (row.blocking ? 0 : 1),
  },
  {
    id: "cached",
    header: "Cached",
    width: "92px",
    align: "center",
    cell: (row) => <Flag on={row.cached} label="Cached" />,
    sortValue: (row) => (row.cached ? 0 : 1),
  },
];

/* ==========================================================================
   OPPORTUNITY ROW
   ======================================================================== */

interface OpportunityRowProps {
  title: string;
  savingsMs: number;
  detail: string;
  findingId?: string;
  onFix: (title: string) => void;
}

const OpportunityRow = memo(function OpportunityRow({
  title,
  savingsMs,
  detail,
  findingId,
  onFix,
}: OpportunityRowProps) {
  const fix = useCallback(() => onFix(title), [onFix, title]);

  return (
    <li
      data-testid={`performance-opportunity-${savingsMs}`}
      className="flex flex-col gap-2 border-b border-border/40 px-4 py-3 last:border-0"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-[13px] font-semibold leading-snug text-foreground">{title}</h3>
        <span
          data-testid={`performance-opportunity-${savingsMs}-savings`}
          className="shrink-0 font-display text-base font-semibold tabular-nums text-primary"
        >
          −{formatDuration(savingsMs)}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{detail}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={fix}
          data-testid={`performance-opportunity-${savingsMs}-fix`}
        >
          <Wand2 className="size-3" aria-hidden />
          Fix with agent
        </Button>
        {findingId ? (
          <Link
            href={routes.finding(findingId)}
            data-testid={`performance-opportunity-${savingsMs}-finding`}
            className="text-code text-muted-foreground hover:text-foreground hover:underline"
          >
            {findingId}
          </Link>
        ) : null}
      </div>
    </li>
  );
});

/* ==========================================================================
   PAGE
   ======================================================================== */

function PerformanceView() {
  const router = useRouter();
  const params = useSearchParams();
  const startTask = useAgentStore((s) => s.startTask);

  const device: Device = params.get("device") === "mobile" ? "mobile" : "desktop";
  const metricParam = params.get("metric") as PerfMetricId | null;
  const typeFilter = (params.get("type") ?? "all") as ResourceType | "all";
  const onlyBlocking = params.get("blocking") === "1";
  const onlyUncached = params.get("uncached") === "1";
  const sortBy = params.get("sort") ?? "start";
  const sortDir = params.get("dir") === "asc" ? "asc" : "desc";

  const query = useMemo(() => ({ device }), [device]);
  const { data: summary, isPending, isError, error, refetch } = usePerfSummary(query);

  /** Filters use replace so a device flip or a switch doesn't stack history. */
  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      const search = next.toString();
      router.replace(search ? `${routes.performance()}?${search}` : routes.performance(), {
        scroll: false,
      });
    },
    [params, router],
  );

  const onDevice = useCallback(
    (value: string) => {
      if (value === "desktop" || value === "mobile") setParams({ device: value });
    },
    [setParams],
  );

  const onSelectMetric = useCallback((id: PerfMetricId) => setParams({ metric: id }), [setParams]);
  const onMetricSelect = useCallback((value: string) => setParams({ metric: value }), [setParams]);

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === "type") setParams({ type: value === "all" ? null : value });
      if (id === "sort") setParams({ sort: value });
    },
    [setParams],
  );

  const onSortChange = useCallback(
    (id: string) => setParams({ sort: id, dir: id === sortBy && sortDir === "desc" ? "asc" : "desc" }),
    [setParams, sortBy, sortDir],
  );

  const onBlocking = useCallback(
    (on: boolean) => setParams({ blocking: on ? "1" : null }),
    [setParams],
  );
  const onUncached = useCallback(
    (on: boolean) => setParams({ uncached: on ? "1" : null }),
    [setParams],
  );
  const clearFilters = useCallback(
    () => setParams({ type: null, blocking: null, uncached: null }),
    [setParams],
  );

  const auditedUrl = summary?.url ?? "";

  const runAudit = useCallback(() => {
    void startTask({
      prompt: auditedUrl
        ? `Re-measure Core Web Vitals for ${auditedUrl} on ${device} and report every budget failure.`
        : `Run a performance audit on ${device}.`,
      mode: "performance",
    });
    router.push(routes.workbench());
  }, [auditedUrl, device, router, startTask]);

  const fixOpportunity = useCallback(
    (title: string) => {
      void startTask({
        prompt: `Fix the performance opportunity "${title}" on ${auditedUrl || "the audited page"} (${device} trace) and re-measure.`,
        mode: "performance-fix",
      });
      router.push(routes.workbench());
    },
    [auditedUrl, device, router, startTask],
  );

  const metrics = summary?.metrics ?? [];
  const selectedMetric =
    metrics.find((m) => m.id === metricParam) ?? metrics.find((m) => m.id === "lcp") ?? metrics[0];
  const baselineRun = selectedMetric?.history.at(-2)?.run;
  const failingBudgets = metrics.filter((m) => m.value > m.budget).length;

  const resources = summary?.resources ?? NO_RESOURCES;
  const filteredResources = useMemo(
    () =>
      resources.filter(
        (r) =>
          (typeFilter === "all" || r.type === typeFilter) &&
          (!onlyBlocking || r.blocking) &&
          (!onlyUncached || !r.cached),
      ),
    [resources, typeFilter, onlyBlocking, onlyUncached],
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<ResourceType, number>();
    for (const r of resources) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
    return counts;
  }, [resources]);

  const filters = useMemo<FilterDef[]>(
    () => [
      {
        id: "type",
        label: "Type",
        value: typeFilter,
        options: [
          { value: "all", label: "All types", count: resources.length },
          ...RESOURCE_TYPES.filter((t) => typeCounts.has(t)).map((t) => ({
            value: t,
            label: t,
            count: typeCounts.get(t),
          })),
        ],
      },
      { id: "sort", label: "Sort", value: sortBy, options: SORT_OPTIONS },
    ],
    [resources.length, sortBy, typeCounts, typeFilter],
  );

  const trendSeries = useMemo(
    () =>
      selectedMetric
        ? [
            {
              key: "value",
              label: selectedMetric.label,
              tone: RATING_TONE[selectedMetric.rating],
            },
          ]
        : [],
    [selectedMetric],
  );

  const trendUnit = selectedMetric?.unit ?? "ms";
  const formatTrendY = useCallback(
    (value: number) => formatMetricValue(value, trendUnit),
    [trendUnit],
  );

  const opportunities = useMemo(
    () => [...(summary?.opportunities ?? [])].sort((a, b) => b.savingsMs - a.savingsMs),
    [summary?.opportunities],
  );

  const waterfallHeight = Math.min(430, Math.max(180, filteredResources.length * 17 + 44));

  const deviceToggle = (
    <ToggleGroup
      type="single"
      value={device}
      onValueChange={onDevice}
      aria-label="Audit device"
      data-testid="performance-device-toggle"
    >
      <ToggleGroupItem value="desktop" data-testid="performance-device-toggle-desktop">
        Desktop
      </ToggleGroupItem>
      <ToggleGroupItem value="mobile" data-testid="performance-device-toggle-mobile">
        Mobile
      </ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <PageHeader
        title="Performance"
        icon={Gauge}
        description="Core Web Vitals against their budgets, the requests behind them, and the ranked fixes."
        actions={
          <>
            <Button variant="primary" onClick={runAudit} data-testid="performance-run-audit">
              <Gauge className="size-3.5" aria-hidden />
              Run audit
            </Button>
            {deviceToggle}
          </>
        }
        meta={
          <>
            <Link
              href={routes.workbench()}
              data-testid="performance-url-link"
              className="text-code inline-flex items-center gap-1 text-foreground hover:underline"
            >
              {auditedUrl || "No URL traced"}
              <ExternalLink className="size-3" aria-hidden />
            </Link>
            {summary ? <span>Measured {formatRelative(summary.lastRun)}</span> : null}
            <Link
              href={routes.settings({ tab: "browser" })}
              data-testid="performance-throttle-hint"
              className="hover:text-foreground hover:underline"
            >
              {device === "mobile" ? "Moto G Power · 4G · 4× CPU throttle" : "Desktop · no throttling"}
            </Link>
            {summary ? (
              <Link
                href={routes.findings({ category: "performance" })}
                data-testid="performance-failing-budgets"
                className={cn(
                  "font-mono tabular-nums hover:underline",
                  failingBudgets > 0 ? "text-error" : "text-success",
                )}
              >
                {failingBudgets} of {metrics.length} budgets over
              </Link>
            ) : null}
          </>
        }
      />

      {isError ? (
        <Card>
          <ErrorState error={error} onRetry={() => void refetch()} testId="performance-error" />
        </Card>
      ) : isPending ? (
        <div className="flex flex-col gap-4">
          <LoadingState variant="panel" rows={4} />
          <LoadingState rows={8} />
        </div>
      ) : !summary || metrics.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gauge}
            title="No performance trace for this device"
            description={`Nothing has been measured for ${device} yet. Run an audit — the other device tab stays available.`}
            action={
              <Button variant="primary" onClick={runAudit} data-testid="performance-empty-run-audit">
                Run audit
              </Button>
            }
            testId="performance-empty"
          />
        </Card>
      ) : (
        <>
          {/* --- hero: score + Core Web Vitals ------------------------------ */}
          <section aria-labelledby="performance-vitals-heading" className="flex flex-col gap-3">
            <h2 id="performance-vitals-heading" className="label-mono">
              Core Web Vitals · {device}
            </h2>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
              <Card
                data-testid="performance-score-card"
                className="flex flex-col items-center justify-center gap-3 p-5"
              >
                <GaugeChart
                  value={summary.score}
                  label="Perf score"
                  size={180}
                  testId="performance-score-gauge"
                />
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  {failingBudgets === 0
                    ? "Every budget is holding on this device."
                    : `${failingBudgets} of ${metrics.length} metrics are over budget on ${device}.`}
                </p>
                <Link
                  href={routes.findings({ category: "performance" })}
                  data-testid="performance-score-findings-link"
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  Open performance findings
                </Link>
              </Card>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                {CWV_IDS.map((id) => {
                  const metric = metrics.find((m) => m.id === id);
                  return metric ? (
                    <MetricCard
                      key={id}
                      metric={metric}
                      selected={selectedMetric?.id === id}
                      onSelect={onSelectMetric}
                      baselineRun={metric.history.at(-2)?.run}
                      findingId={METRIC_FINDING[id]}
                    />
                  ) : null;
                })}
              </div>
            </div>
          </section>

          {/* --- lab metrics ----------------------------------------------- */}
          <section aria-labelledby="performance-lab-heading" className="flex flex-col gap-3">
            <h2 id="performance-lab-heading" className="label-mono">
              Lab metrics
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {LAB_IDS.map((id) => {
                const metric = metrics.find((m) => m.id === id);
                return metric ? (
                  <MetricCard
                    key={id}
                    metric={metric}
                    selected={selectedMetric?.id === id}
                    onSelect={onSelectMetric}
                    baselineRun={metric.history.at(-2)?.run}
                    findingId={METRIC_FINDING[id]}
                  />
                ) : null;
              })}
            </div>
          </section>

          {/* --- metric trend ---------------------------------------------- */}
          {selectedMetric ? (
            <section aria-labelledby="performance-trend-heading" className="flex flex-col gap-2">
              <h2 id="performance-trend-heading" className="sr-only">
                Metric history
              </h2>
              <ChartCard
                title={`${selectedMetric.label} · last ${selectedMetric.history.length} runs`}
                description={`Budget ${formatMetricValue(selectedMetric.budget, selectedMetric.unit)} · ${
                  baselineRun ? `delta measured against ${baselineRun}` : "no baseline run"
                }`}
                height={240}
                testId="performance-trend-card"
                actions={
                  <Select value={selectedMetric.id} onValueChange={onMetricSelect}>
                    <SelectTrigger
                      className="h-8 w-auto min-w-40 gap-1.5"
                      aria-label="Metric to trend"
                      data-testid="performance-trend-metric"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {metrics.map((metric) => (
                        <SelectItem
                          key={metric.id}
                          value={metric.id}
                          data-testid={`performance-trend-metric-${metric.id}`}
                        >
                          {metric.id.toUpperCase()} · {metric.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              >
                <TrendLineChart
                  data={selectedMetric.history}
                  xKey="run"
                  series={trendSeries}
                  height={240}
                  formatY={formatTrendY}
                  testId="performance-trend-chart"
                />
              </ChartCard>
              <nav
                aria-label="Runs in this trend"
                data-testid="performance-trend-runs"
                className="flex flex-wrap items-center gap-1.5 px-1"
              >
                <span className="label-mono text-[10px]">Runs</span>
                {selectedMetric.history.map((point) => (
                  <Link
                    key={point.run}
                    href={routes.run(point.run)}
                    aria-label={`Open run ${point.run}`}
                    data-testid={`performance-trend-run-${point.run.replace("#", "")}`}
                    className="text-code rounded-full border border-border/70 px-2 py-0.5 text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                  >
                    {point.run}
                  </Link>
                ))}
              </nav>
            </section>
          ) : null}

          {/* --- waterfall + resource table -------------------------------- */}
          <section aria-labelledby="performance-resources-heading" className="flex flex-col gap-3">
            <h2 id="performance-resources-heading" className="label-mono">
              Resources · {filteredResources.length} of {resources.length}
            </h2>

            <ChartCard
              title="Request waterfall"
              description="Bars are placed by start time; render-blocking requests carry a marker."
              height={waterfallHeight}
              testId="performance-waterfall-card"
              actions={
                <div
                  className="flex flex-wrap items-center justify-end gap-1"
                  data-testid="performance-waterfall-legend"
                >
                  {RESOURCE_TYPES.filter((type) => typeCounts.has(type)).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onFilterChange("type", typeFilter === type ? "all" : type)}
                      aria-pressed={typeFilter === type}
                      data-testid={`performance-waterfall-legend-${type}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.04em] transition-colors",
                        typeFilter === type
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border/70 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <ToneDot tone={TYPE_TONE[type]} size={6} />
                      {type}
                      <span className="tabular-nums text-subtle-foreground">{typeCounts.get(type)}</span>
                    </button>
                  ))}
                </div>
              }
            >
              {filteredResources.length > 0 ? (
                <WaterfallChart
                  resources={filteredResources}
                  height={waterfallHeight}
                  testId="performance-waterfall-chart"
                />
              ) : (
                <EmptyState
                  title="No requests match these filters"
                  description="Widen the type filter to see the waterfall."
                  testId="performance-waterfall-empty"
                />
              )}
            </ChartCard>

            <FilterBar
              filters={filters}
              onFilterChange={onFilterChange}
              testId="performance-filters"
              right={
                <>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="performance-only-blocking"
                      checked={onlyBlocking}
                      onCheckedChange={onBlocking}
                      data-testid="performance-filter-blocking"
                    />
                    <Label htmlFor="performance-only-blocking" className="text-[11px]">
                      Only blocking
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="performance-only-uncached"
                      checked={onlyUncached}
                      onCheckedChange={onUncached}
                      data-testid="performance-filter-uncached"
                    />
                    <Label htmlFor="performance-only-uncached" className="text-[11px]">
                      Only uncached
                    </Label>
                  </div>
                </>
              }
            />

            <DataTable
              rows={filteredResources}
              columns={RESOURCE_COLUMNS}
              rowKey={(row) => row.id}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={onSortChange}
              testId="performance-resources-table"
              empty={
                <EmptyState
                  title="No requests match these filters"
                  description="The trace holds 22 requests — clear the filters to see them all."
                  action={
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      data-testid="performance-resources-clear"
                    >
                      Clear filters
                    </Button>
                  }
                  testId="performance-resources-empty"
                />
              }
            />
          </section>

          {/* --- opportunities --------------------------------------------- */}
          <section aria-labelledby="performance-opportunities-heading" className="flex flex-col gap-3">
            <h2 id="performance-opportunities-heading" className="label-mono">
              Opportunities · {formatDuration(opportunities.reduce((sum, o) => sum + o.savingsMs, 0))}{" "}
              recoverable
            </h2>
            <Card data-testid="performance-opportunities">
              {opportunities.length > 0 ? (
                <ul className="flex flex-col">
                  {opportunities.map((opportunity) => (
                    <OpportunityRow
                      key={opportunity.title}
                      title={opportunity.title}
                      savingsMs={opportunity.savingsMs}
                      detail={opportunity.detail}
                      findingId={OPPORTUNITY_FINDING[opportunity.title]}
                      onFix={fixOpportunity}
                    />
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No opportunities left"
                  description="Nothing on this page is worth more than a millisecond right now."
                  testId="performance-opportunities-empty"
                />
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

/**
 * `useSearchParams` suspends during the static-export prerender, so the reading
 * component has to sit under a boundary — same wrapper the other twelve pages use.
 */
export default function PerformancePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState rows={8} />
        </div>
      }
    >
      <PerformanceView />
    </Suspense>
  );
}

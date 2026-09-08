"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Database, FileJson, GitCompare, Lock, Radar, Webhook } from "lucide-react";

import { ChartCard, CHART_CARD_HEIGHT } from "@/components/charts/ChartCard";
import type { DonutSlice, SeriesSpec } from "@/components/charts";
import {
  EndpointDetail,
  MethodBadge,
  StatusChip,
  errorRateClass,
  hasSchemaDrift,
  worstSeverity,
} from "@/components/quality/EndpointDetail";
import {
  CopyButton,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  SeverityBadge,
  StatGrid,
  StatTile,
  type Column,
  type FilterDef,
} from "@/components/shared";
import { Button } from "@/components/ui/Button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/Drawer";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { routes } from "@/config/nav";
import { useApiEndpoints, useApiSummary } from "@/lib/queries";
import {
  cn,
  formatCompact,
  formatDuration,
  formatPercent,
  formatRelative,
  truncateMiddle,
} from "@/lib/utils";
import { useAgentStore } from "@/store/agentStore";
import { useFiltersStore } from "@/store/filtersStore";
import type { ApiEndpoint, ApiIssue, HttpMethod, Severity } from "@/lib/api/types";

/* ==========================================================================
   CHARTS — dynamic so recharts never lands on the first-paint path.
   ======================================================================== */

const ChartFallback = () => <Skeleton className="size-full rounded-[var(--radius-md)]" />;

const DonutChart = dynamic(
  () => import("@/components/charts/DonutChart").then((m) => ({ default: m.DonutChart })),
  { ssr: false, loading: ChartFallback },
);

const BarSeriesChart = dynamic(
  () => import("@/components/charts/BarSeriesChart").then((m) => ({ default: m.BarSeriesChart })),
  { ssr: false, loading: ChartFallback },
);

/** Ten horizontal categories need more room than the shared card body. */
const LATENCY_CHART_HEIGHT = 280;

/** Stable module-level props — both charts are memoized. */
const LATENCY_SERIES: SeriesSpec[] = [
  { key: "p95", label: "p95", tone: "accent" },
  { key: "p50", label: "p50", tone: "primary" },
];

const SEVERITY_TONE: Record<Severity, DonutSlice["tone"]> = {
  critical: "error",
  high: "accent",
  medium: "warning",
  low: "info",
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

/* ==========================================================================
   URL STATE
   ======================================================================== */

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
const SOURCES: ApiEndpoint["discoveredVia"][] = ["traffic", "openapi", "manual"];
const SORT_COLUMNS = ["path", "calls", "p95", "errors", "issues"] as const;

type SortColumn = (typeof SORT_COLUMNS)[number];

const METHOD_OPTIONS: FilterDef["options"] = [
  { value: "all", label: "All methods" },
  ...METHODS.map((method) => ({ value: method, label: method })),
];

const SOURCE_LABELS: Record<ApiEndpoint["discoveredVia"], string> = {
  traffic: "Traffic",
  openapi: "OpenAPI",
  manual: "Manual",
};

const readMethod = (value: string | null): HttpMethod | "all" =>
  METHODS.find((method) => method === value) ?? "all";

const readSource = (value: string | null): ApiEndpoint["discoveredVia"] | "all" =>
  SOURCES.find((source) => source === value) ?? "all";

const readSort = (value: string | null): SortColumn =>
  SORT_COLUMNS.find((column) => column === value) ?? "calls";

/* ==========================================================================
   HELPERS
   ======================================================================== */

/** An OpenAPI stub of what the proxy actually saw — the Export action's payload. */
function openApiStub(endpoints: ApiEndpoint[], specSource?: string): string {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const endpoint of endpoints) {
    const operations = paths[endpoint.path] ?? {};
    operations[endpoint.method.toLowerCase()] = {
      operationId: endpoint.id,
      tags: endpoint.tags,
      security: endpoint.authRequired ? [{ session: [] }] : [],
      "x-discovered-via": endpoint.discoveredVia,
      "x-observed": {
        calls: endpoint.callCount,
        p50Ms: endpoint.p50Ms,
        p95Ms: endpoint.p95Ms,
        errorRate: endpoint.errorRate,
        lastSeen: endpoint.lastSeen,
      },
      parameters: endpoint.requestSchema.map((field) => ({
        name: field.name,
        required: field.required,
        schema: { type: field.type },
        ...(field.drift ? { "x-drift": field.drift, "x-documented-type": field.documentedType } : {}),
      })),
      responses: Object.fromEntries(
        endpoint.observedStatuses.map((status) => [
          String(status),
          {
            description: "observed",
            ...(status < 300 && endpoint.responseSchema.length > 0
              ? {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        required: endpoint.responseSchema
                          .filter((field) => field.required)
                          .map((field) => field.name),
                        properties: Object.fromEntries(
                          endpoint.responseSchema.map((field) => [
                            field.name,
                            {
                              type: field.type,
                              ...(field.drift
                                ? { "x-drift": field.drift, "x-documented-type": field.documentedType }
                                : {}),
                            },
                          ]),
                        ),
                      },
                    },
                  },
                }
              : {}),
          },
        ]),
      ),
    };
    paths[endpoint.path] = operations;
  }

  return JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "Observed API surface",
        version: "0.0.0-observed",
        description: specSource
          ? `Generated by Aether from observed traffic. Diffed against ${specSource}.`
          : "Generated by Aether from observed traffic.",
      },
      components: {
        securitySchemes: { session: { type: "apiKey", in: "cookie", name: "session" } },
      },
      paths,
    },
    null,
    2,
  );
}

function matchesSearch(endpoint: ApiEndpoint, needle: string): boolean {
  if (!needle) return true;
  return (
    endpoint.path.toLowerCase().includes(needle) ||
    endpoint.method.toLowerCase().includes(needle) ||
    endpoint.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
    endpoint.issues.some(
      (issue) =>
        issue.summary.toLowerCase().includes(needle) ||
        issue.detector.toLowerCase().includes(needle) ||
        issue.id.toLowerCase().includes(needle),
    )
  );
}

/* ==========================================================================
   PAGE
   ======================================================================== */

function ApiIntelView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const search = searchParams.get("q") ?? "";
  const method = readMethod(searchParams.get("method"));
  const source = readSource(searchParams.get("source"));
  const hasIssues = searchParams.get("issues") === "1";
  const driftOnly = searchParams.get("drift") === "1";
  const sortBy = readSort(searchParams.get("sort"));
  const sortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const selectedId = searchParams.get("endpoint");

  /**
   * The URL is the source of truth; `filtersStore.api` is the persisted mirror
   * so the page reopens the way the user left it.
   */
  const setFilter = useFiltersStore((s) => s.setFilter);
  useEffect(() => {
    setFilter("api", "method", method);
    setFilter("api", "hasIssues", hasIssues);
    setFilter("api", "search", search);
  }, [method, hasIssues, search, setFilter]);

  const buildHref = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "" || value === "all") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      return query ? `/api-intel?${query}` : "/api-intel";
    },
    [searchParams],
  );

  // replace() for filters so a session of tweaking doesn't fill the history.
  const patchFilters = useCallback(
    (patch: Record<string, string | null>) => {
      router.replace(buildHref(patch), { scroll: false });
    },
    [buildHref, router],
  );

  const onFilterChange = useCallback(
    (id: string, value: string) => patchFilters({ [id]: value }),
    [patchFilters],
  );

  const onSearchChange = useCallback((value: string) => patchFilters({ q: value }), [patchFilters]);

  const onSortChange = useCallback(
    (id: string) => {
      const column = readSort(id);
      const flip = column === sortBy && sortDir === "desc" ? "asc" : "desc";
      patchFilters({ sort: column, dir: flip });
    },
    [patchFilters, sortBy, sortDir],
  );

  const onPickMethod = useCallback(
    (picked: HttpMethod) => patchFilters({ method: picked === method ? "all" : picked }),
    [method, patchFilters],
  );

  const clearFilters = useCallback(
    () => patchFilters({ q: null, method: null, source: null, issues: null, drift: null }),
    [patchFilters],
  );

  // push() for the detail so Back closes the drawer; the filters ride along.
  const openEndpoint = useCallback(
    (endpoint: ApiEndpoint) => router.push(buildHref({ endpoint: endpoint.id })),
    [buildHref, router],
  );

  const closeEndpoint = useCallback(
    () => router.replace(buildHref({ endpoint: null }), { scroll: false }),
    [buildHref, router],
  );

  /* --- data ---------------------------------------------------------- */

  const summaryQuery = useApiSummary();
  const endpointsQuery = useApiEndpoints({
    method: method === "all" ? undefined : method,
    hasIssues: hasIssues ? true : undefined,
  });

  const summary = summaryQuery.data;
  const endpoints = endpointsQuery.data?.items ?? [];

  /**
   * Search stays local: the contract matches paths, tags AND issue summaries,
   * which is wider than the adapter's own search fields.
   */
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return endpoints.filter(
      (endpoint) =>
        (source === "all" || endpoint.discoveredVia === source) &&
        (!driftOnly || hasSchemaDrift(endpoint)) &&
        matchesSearch(endpoint, needle),
    );
  }, [endpoints, source, driftOnly, search]);

  const sourceOptions = useMemo<FilterDef["options"]>(
    () => [
      { value: "all", label: "All sources", count: endpoints.length },
      ...SOURCES.map((value) => ({
        value,
        label: SOURCE_LABELS[value],
        count: endpoints.filter((endpoint) => endpoint.discoveredVia === value).length,
      })),
    ],
    [endpoints],
  );

  const filters = useMemo<FilterDef[]>(
    () => [
      { id: "method", label: "Method", value: method, options: METHOD_OPTIONS },
      { id: "source", label: "Source", value: source, options: sourceOptions },
    ],
    [method, source, sourceOptions],
  );

  const severitySlices = useMemo<DonutSlice[]>(() => {
    const bySeverity = summary?.bySeverity;
    if (!bySeverity) return [];
    return SEVERITY_ORDER.filter((severity) => bySeverity[severity] > 0).map((severity) => ({
      name: severity,
      value: bySeverity[severity],
      tone: SEVERITY_TONE[severity],
    }));
  }, [summary]);

  const issueTotal = severitySlices.reduce((sum, slice) => sum + slice.value, 0);

  const latencyData = useMemo(
    () =>
      endpoints
        .slice()
        .sort((a, b) => b.callCount - a.callCount)
        .slice(0, 10)
        .map((endpoint) => ({
          endpoint: truncateMiddle(endpoint.path, 22),
          p95: endpoint.p95Ms,
          p50: endpoint.p50Ms,
        })),
    [endpoints],
  );

  // Serialising 20 endpoints on every render is pure waste; the payload only
  // changes when the endpoint set does.
  const exportStub = useMemo(
    () => openApiStub(endpoints, summary?.specSource),
    [endpoints, summary],
  );

  const filterDocumented = useCallback(
    () => patchFilters({ source: source === "openapi" ? null : "openapi" }),
    [patchFilters, source],
  );

  const toggleDriftOnly = useCallback(
    () => patchFilters({ drift: driftOnly ? null : "1" }),
    [driftOnly, patchFilters],
  );

  /* --- agent actions -------------------------------------------------- */

  const startTask = useAgentStore((s) => s.startTask);

  const selected = useMemo(
    () => (selectedId ? endpoints.find((endpoint) => endpoint.id === selectedId) : undefined),
    [endpoints, selectedId],
  );

  const rediscover = useCallback(() => {
    void startTask({
      prompt:
        "Attach the proxy, walk the booking flow end to end and re-discover every API endpoint it calls. Diff what you see against the committed OpenAPI spec and report the drift.",
      mode: "explore-website",
    });
    router.push(routes.workbench());
  }, [router, startTask]);

  const generateTest = useCallback(
    (issue?: ApiIssue) => {
      if (!selected) return;
      const target = `${selected.method} ${selected.path}`;
      void startTask({
        prompt: issue
          ? `Write a contract test for ${target} that reproduces ${issue.id} (${issue.detector}): ${issue.summary}. Assert the documented behaviour so the test fails until the endpoint is fixed.`
          : `Write a contract test for ${target} covering its request schema, response schema and the observed status codes ${selected.observedStatuses.join(", ")}.`,
        mode: "generate-playwright-spec",
      });
      router.push(routes.workbench());
    },
    [router, selected, startTask],
  );

  /* --- columns -------------------------------------------------------- */

  const columns = useMemo<Column<ApiEndpoint>[]>(
    () => [
      {
        id: "method",
        header: "Method",
        width: "84px",
        cell: (endpoint) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPickMethod(endpoint.method);
            }}
            aria-label={`Filter by ${endpoint.method}`}
            data-testid={`api-intel-method-${endpoint.id}`}
            className="rounded-full"
          >
            <MethodBadge method={endpoint.method} />
          </button>
        ),
      },
      {
        id: "path",
        header: "Path",
        width: "minmax(200px,2fr)",
        cell: (endpoint) => (
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="text-code truncate text-foreground" title={endpoint.path}>
              {endpoint.path}
            </span>
            {hasSchemaDrift(endpoint) ? (
              <span className="shrink-0 text-accent" title="Schema drift">
                <GitCompare className="size-3" aria-hidden />
                <span className="sr-only">Schema drift</span>
              </span>
            ) : null}
          </span>
        ),
        sortValue: (endpoint) => endpoint.path,
      },
      {
        id: "source",
        header: "Source",
        width: "84px",
        cell: (endpoint) => (
          <span
            className={cn(
              "label-mono truncate text-[10px]",
              endpoint.discoveredVia === "openapi" ? undefined : "text-accent",
            )}
          >
            {endpoint.discoveredVia}
          </span>
        ),
      },
      {
        id: "auth",
        header: "Auth",
        width: "56px",
        align: "center",
        cell: (endpoint) =>
          endpoint.authRequired ? (
            <span className="text-medium" title="Auth required">
              <Lock className="size-3.5" aria-hidden />
              <span className="sr-only">Auth required</span>
            </span>
          ) : (
            <span className="text-subtle-foreground" title="Public">
              —<span className="sr-only">Public</span>
            </span>
          ),
      },
      {
        id: "statuses",
        header: "Statuses",
        width: "132px",
        cell: (endpoint) => (
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            {endpoint.observedStatuses.slice(0, 4).map((status) => (
              <StatusChip key={status} status={status} />
            ))}
          </span>
        ),
      },
      {
        id: "calls",
        header: "Calls",
        width: "70px",
        align: "right",
        cell: (endpoint) => (
          <span className="font-mono text-[11px] tabular-nums">
            {formatCompact(endpoint.callCount)}
          </span>
        ),
        sortValue: (endpoint) => endpoint.callCount,
      },
      {
        id: "p50",
        header: "p50",
        width: "64px",
        align: "right",
        cell: (endpoint) => (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(endpoint.p50Ms)}
          </span>
        ),
      },
      {
        id: "p95",
        header: "p95",
        width: "68px",
        align: "right",
        cell: (endpoint) => (
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              endpoint.p95Ms >= 500 ? "text-medium" : "text-foreground",
            )}
          >
            {formatDuration(endpoint.p95Ms)}
          </span>
        ),
        sortValue: (endpoint) => endpoint.p95Ms,
      },
      {
        id: "errors",
        header: "Error rate",
        width: "78px",
        align: "right",
        cell: (endpoint) => (
          <span
            className={cn("font-mono text-[11px] tabular-nums", errorRateClass(endpoint.errorRate))}
          >
            {formatPercent(endpoint.errorRate)}
          </span>
        ),
        sortValue: (endpoint) => endpoint.errorRate,
      },
      {
        id: "issues",
        header: "Issues",
        width: "66px",
        align: "center",
        cell: (endpoint) => {
          const worst = worstSeverity(endpoint.issues);
          if (!worst) return <span className="text-subtle-foreground">—</span>;
          return (
            <span className="flex items-center gap-1">
              <SeverityBadge severity={worst} size="xs" showLabel={false} />
              <span className="font-mono text-[11px] tabular-nums">{endpoint.issues.length}</span>
            </span>
          );
        },
        sortValue: (endpoint) => endpoint.issues.length,
      },
      {
        id: "lastSeen",
        header: "Last seen",
        width: "92px",
        align: "right",
        cell: (endpoint) => (
          <span className="truncate text-[11px] text-muted-foreground">
            {formatRelative(endpoint.lastSeen)}
          </span>
        ),
      },
    ],
    [onPickMethod],
  );

  /* --- header --------------------------------------------------------- */

  const filtersActive =
    search !== "" || method !== "all" || source !== "all" || hasIssues || driftOnly;

  const header = (
    <PageHeader
      title="API"
      description="Discovered endpoints, schema drift and contract tests"
      icon={Webhook}
      meta={
        <>
          <span data-testid="api-intel-endpoint-count">
            {summary ? formatCompact(summary.endpoints) : endpoints.length} endpoints
          </span>
          {summary?.specSource ? (
            <span className="flex items-center gap-1">
              <FileJson className="size-3" aria-hidden />
              <code className="text-code rounded-[var(--radius-sm)] bg-elevated px-1.5 py-0.5 text-muted-foreground">
                {summary.specSource}
              </code>
              <CopyButton value={summary.specSource} testId="api-intel-copy-spec-source" />
            </span>
          ) : (
            <span>No OpenAPI spec attached</span>
          )}
          {rows.length !== endpoints.length ? (
            <span data-testid="api-intel-filtered-count">
              {rows.length} shown after filters
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={rediscover}
            data-testid="api-intel-rediscover-btn"
          >
            <Radar className="size-3.5" aria-hidden />
            Re-discover
          </Button>
          <CopyButton
            value={exportStub}
            label="Export OpenAPI stub"
            testId="api-intel-export-btn"
          />
        </>
      }
    />
  );

  const tiles = (
    <StatGrid columns={4}>
      <StatTile
        label="Endpoints"
        value={summary ? formatCompact(summary.endpoints) : "—"}
        tone="primary"
        icon={Webhook}
        hint="Observed by the proxy across runs #552–#558"
        testId="api-intel-stat-endpoints"
      />
      <StatTile
        label="Documented"
        value={summary ? formatCompact(summary.documented) : "—"}
        tone="success"
        icon={FileJson}
        hint="Present in the committed OpenAPI spec"
        onClick={filterDocumented}
        testId="api-intel-stat-documented"
      />
      <StatTile
        label="Undocumented"
        value={summary ? formatCompact(summary.undocumented) : "—"}
        tone="accent"
        icon={Radar}
        hint="Traffic or manual only — nothing in the spec"
        testId="api-intel-stat-undocumented"
      />
      <StatTile
        label="Contract drift"
        value={summary ? formatCompact(summary.driftCount) : "—"}
        tone="error"
        icon={GitCompare}
        hint="Fields whose traffic contradicts the spec"
        onClick={toggleDriftOnly}
        testId="api-intel-stat-drift"
      />
    </StatGrid>
  );

  /* --- states --------------------------------------------------------- */

  if (endpointsQuery.isError) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {header}
        <ErrorState
          error={endpointsQuery.error}
          onRetry={() => void endpointsQuery.refetch()}
          testId="api-intel-error"
        />
        <div className="flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href={routes.settings({ tab: "data" })} data-testid="api-intel-error-data-source">
              <Database className="size-3.5" aria-hidden />
              Check data source
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (endpointsQuery.isPending) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {header}
        {tiles}
        <LoadingState rows={12} variant="table" />
      </div>
    );
  }

  if (endpoints.length === 0 && !filtersActive) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {header}
        {tiles}
        <div className="surface-card">
          <EmptyState
            icon={Radar}
            title="No endpoints discovered yet"
            description="Run a session with the proxy attached, or point at an OpenAPI file."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={rediscover}
                  data-testid="api-intel-empty-rediscover"
                >
                  <Radar className="size-3.5" aria-hidden />
                  Re-discover
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={routes.settings({ tab: "data" })}
                    data-testid="api-intel-empty-data-source"
                  >
                    <Database className="size-3.5" aria-hidden />
                    Data source
                  </Link>
                </Button>
              </div>
            }
            testId="api-intel-empty"
          />
        </div>
      </div>
    );
  }

  /* --- the page ------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-4 p-6">
      {header}
      {tiles}

      <section aria-label="API traffic charts" className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Issues by severity"
          description={`${issueTotal} contract issues across ${endpoints.length} endpoints`}
          height={CHART_CARD_HEIGHT}
          testId="api-intel-severity-chart"
          actions={
            <Link
              href={routes.findings({ category: "api-contract" })}
              className="label-mono rounded transition-colors hover:text-foreground"
              data-testid="api-intel-severity-chart-findings"
            >
              Findings
            </Link>
          }
        >
          {severitySlices.length > 0 ? (
            <DonutChart
              data={severitySlices}
              centerValue={String(issueTotal)}
              centerLabel="issues"
              height={CHART_CARD_HEIGHT}
            />
          ) : (
            <EmptyState
              title="No contract issues"
              description="No detector has fired on this surface."
              testId="api-intel-severity-chart-empty"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Latency — ten busiest endpoints"
          description="p95 against p50"
          height={LATENCY_CHART_HEIGHT}
          testId="api-intel-latency-chart"
        >
          <BarSeriesChart
            data={latencyData}
            xKey="endpoint"
            series={LATENCY_SERIES}
            horizontal
            showLegend
            height={LATENCY_CHART_HEIGHT}
            formatY={formatDuration}
            testId="api-intel-latency-bars"
          />
        </ChartCard>
      </section>

      <FilterBar
        testId="api-intel-filters"
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search paths, tags and detectors"
        filters={filters}
        onFilterChange={onFilterChange}
        right={
          <>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Switch
                checked={hasIssues}
                onCheckedChange={(on) => patchFilters({ issues: on ? "1" : null })}
                aria-label="Has issues only"
                data-testid="api-intel-filter-has-issues"
              />
              Has issues
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Switch
                checked={driftOnly}
                onCheckedChange={(on) => patchFilters({ drift: on ? "1" : null })}
                aria-label="Only schema drift"
                data-testid="api-intel-filter-drift-only"
              />
              Only drift
            </span>
            {filtersActive ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={clearFilters}
                data-testid="api-intel-clear-filters"
              >
                Clear filters
              </Button>
            ) : null}
          </>
        }
      />

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(endpoint) => endpoint.id}
        onRowClick={openEndpoint}
        selectedKey={selectedId ?? undefined}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
        stickyHeader
        testId="api-intel-table"
        empty={
          <EmptyState
            title="No endpoints match these filters"
            description="Widen the method, source or search to see the rest of the surface."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                data-testid="api-intel-filtered-empty-clear"
              >
                Clear filters
              </Button>
            }
            testId="api-intel-filtered-empty"
          />
        }
      />

      <Drawer
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) closeEndpoint();
        }}
      >
        <DrawerContent
          side="right"
          size="lg"
          data-testid="api-intel-drawer"
        >
          <DrawerHeader>
            <DrawerTitle>{selected ? selected.path : "Endpoint"}</DrawerTitle>
            {selected ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {selected.id} · {selected.method}
                </span>
                <CopyButton
                  value={routes.apiIntel({ endpointId: selected.id })}
                  label="Copy link"
                  testId="api-intel-drawer-copy-link"
                />
              </div>
            ) : null}
          </DrawerHeader>

          {selected ? (
            <EndpointDetail
              key={selected.id}
              endpoint={selected}
              onGenerateTest={generateTest}
            />
          ) : (
            <EmptyState
              icon={Radar}
              title="Endpoint not found in this data source"
              description={`No endpoint with id "${selectedId}" was discovered here. It may belong to another project or adapter.`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeEndpoint}
                  data-testid="api-intel-drawer-back"
                >
                  Back to the list
                </Button>
              }
              testId="api-intel-drawer-empty"
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/**
 * `useSearchParams()` needs a Suspense boundary in a statically exported route,
 * so the filter-aware view sits one level down.
 */
export default function ApiIntelPage() {
  return (
    <Suspense fallback={<LoadingState rows={12} variant="table" />}>
      <ApiIntelView />
    </Suspense>
  );
}

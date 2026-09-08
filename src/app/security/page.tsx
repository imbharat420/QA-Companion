"use client";

import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Clock,
  Download,
  ExternalLink,
  Globe,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { Button, Card, CardContent, Skeleton, ToggleGroup, ToggleGroupItem } from "@/components/ui";
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
import { HeaderChecklist } from "@/components/quality/HeaderChecklist";
import { SecurityIssueDetail, cvssBand, cweHref } from "@/components/quality/SecurityIssueDetail";
import { useApiEndpoints, useFindings, useSecurityIssues, useSecuritySummary } from "@/lib/queries";
import { cn, formatRelative, truncateMiddle } from "@/lib/utils";
import {
  filterValue,
  useAgentStore,
  useFiltersStore,
  useHasActiveFilters,
  useSecurityFilters,
} from "@/store";
import { routes } from "@/config/nav";
import type { ApiEndpoint, FindingStatus, SecurityIssue, Severity } from "@/lib/api/types";

/* Recharts is ~90kB — the score, the header checklist and the table must paint
   without waiting for it. */
const BarSeriesChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.BarSeriesChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);
const DonutChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.DonutChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
/** The `SecurityIssue.category` union documented in types.ts. */
const CATEGORIES = ["headers", "secrets", "auth", "authz", "injection", "transport", "deps"];

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEVERITY_DOT: Record<Severity, string> = {
  critical: "bg-critical",
  high: "bg-high",
  medium: "bg-medium",
  low: "bg-low",
};
const SEVERITY_TEXT: Record<Severity, string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
};

const CATEGORY_SERIES = [{ key: "count", label: "Issues", tone: "accent" as const }];

/** Read-only posture check — the agent never goes further than observing. */
const SCAN_PROMPT =
  "Run a passive security scan of the staging environment: collect response headers on every " +
  "document route, grep the client bundles for credential-shaped strings, and check the session " +
  "cookie flags and TLS posture. Read-only requests only — report findings with CWE ids, CVSS " +
  "3.1 base scores and remediation, and change nothing.";

const isSeverity = (value: string | null): value is Severity =>
  value !== null && (SEVERITIES as string[]).includes(value);

const isCategory = (value: string | null): value is string =>
  value !== null && CATEGORIES.includes(value);

const titleCase = (value: string) => value[0].toUpperCase() + value.slice(1);

/**
 * Issue URLs are absolute and concrete; discovered endpoints are templated
 * paths (`/api/orders/:id`). Match segment-wise so `/api/orders/8841` finds its
 * endpoint and `/checkout` never matches `/api/checkout`.
 */
function matchEndpoint(url: string, endpoints: ApiEndpoint[]): string | undefined {
  let path: string;
  try {
    path = new URL(url, "https://placeholder.invalid").pathname;
  } catch {
    return undefined;
  }
  const parts = path.split("/").filter(Boolean);

  return endpoints.find((endpoint) => {
    const template = endpoint.path.split("/").filter(Boolean);
    if (template.length !== parts.length) return false;
    return template.every((segment, i) => segment.startsWith(":") || segment === parts[i]);
  })?.id;
}

/** SARIF 2.1.0 `level`, which has no "critical". */
const sarifLevel = (severity: Severity) =>
  severity === "critical" || severity === "high" ? "error" : severity === "medium" ? "warning" : "note";

/**
 * A real SARIF 2.1.0 log, so the scan can be uploaded to a code-scanning
 * dashboard instead of screenshotted.
 */
function toSarif(issues: SecurityIssue[], scannedUrls: number, lastScan: string): string {
  const rules = [...new Map(issues.map((issue) => [issue.cwe ?? issue.id, issue])).values()].map(
    (issue) => ({
      id: issue.cwe ?? issue.id,
      name: issue.category,
      shortDescription: { text: issue.cwe ? `${issue.cwe} — ${issue.category}` : issue.category },
      helpUri: issue.cwe ? cweHref(issue.cwe) : undefined,
      properties: { "security-severity": issue.cvss?.toFixed(1) ?? "0.0", tags: [issue.category] },
    }),
  );

  return JSON.stringify(
    {
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      version: "2.1.0",
      runs: [
        {
          tool: {
            driver: {
              name: "Aether QA Companion",
              informationUri: "https://aether.qa/security",
              rules,
            },
          },
          invocations: [{ endTimeUtc: lastScan, executionSuccessful: true }],
          properties: { scannedUrls },
          results: issues.map((issue) => ({
            ruleId: issue.cwe ?? issue.id,
            level: sarifLevel(issue.severity),
            message: { text: `${issue.id}: ${issue.title}` },
            locations: [{ physicalLocation: { artifactLocation: { uri: issue.url } } }],
            partialFingerprints: { issueId: issue.id },
            properties: {
              cvss: issue.cvss,
              cwe: issue.cwe,
              category: issue.category,
              status: issue.status,
              detectedAt: issue.detectedAt,
              remediation: issue.remediation,
            },
          })),
        },
      ],
    },
    null,
    2,
  );
}

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

function SecurityView() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useSecurityFilters();
  const setFilter = useFiltersStore((s) => s.setFilter);
  const resetFilters = useFiltersStore((s) => s.resetFilters);
  const hasActiveFilters = useHasActiveFilters("security");
  const startTask = useAgentStore((s) => s.startTask);

  const [breakdown, setBreakdown] = useState<"category" | "severity">("category");
  const [sortBy, setSortBy] = useState("severity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  /** Optimistic triage: the DataSource has no security-status mutation. */
  const [overrides, setOverrides] = useState<Record<string, FindingStatus>>({});

  /**
   * The URL owns `category`, `severity` and the open `issue` (the three params
   * `routes.security()` builds); `filtersStore.security` is the persisted
   * mirror, so the page reopens the way it was left. Search lives in the store
   * alone — the route builder has no param for it.
   */
  const urlCategory = params.get("category");
  const urlSeverity = params.get("severity");
  const category = isCategory(urlCategory) ? urlCategory : "all";
  const severity: Severity | "all" = isSeverity(urlSeverity) ? urlSeverity : "all";
  const selectedId = params.get("issue");

  useEffect(() => {
    setFilter("security", "category", category);
    setFilter("security", "severity", severity);
  }, [category, setFilter, severity]);

  const search = useDeferredValue(filters.search);

  const issuesQuery = useSecurityIssues({
    category: filterValue(category),
    severity: filterValue(severity),
    search: search.trim() || undefined,
  });
  /** Unfiltered, so a `?issue=` link and the header→issue map survive any filter. */
  const catalogQuery = useSecurityIssues();
  const summaryQuery = useSecuritySummary();
  const findingsQuery = useFindings({ category: "security" });
  const endpointsQuery = useApiEndpoints();

  const issues = issuesQuery.data?.items ?? [];
  const catalog = useMemo(() => catalogQuery.data?.items ?? [], [catalogQuery.data]);
  const summary = summaryQuery.data;
  const checks = useMemo(() => summary?.headers ?? [], [summary]);

  const findingIds = useMemo(
    () => new Set((findingsQuery.data?.items ?? []).map((finding) => finding.id)),
    [findingsQuery.data],
  );

  const endpointByIssue = useMemo(() => {
    const endpoints = endpointsQuery.data?.items ?? [];
    if (endpoints.length === 0) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const issue of catalog) {
      const id = matchEndpoint(issue.url, endpoints);
      if (id) map[issue.id] = id;
    }
    return map;
  }, [catalog, endpointsQuery.data]);

  /** Header name → the issue tracking it, so a failing check opens its drawer. */
  const issueByHeader = useMemo(() => {
    const map: Record<string, string> = {};
    for (const check of checks) {
      const needle = check.header.toLowerCase();
      const match = catalog.find(
        (issue) =>
          issue.title.toLowerCase().includes(needle) ||
          issue.evidence.toLowerCase().includes(needle),
      );
      if (match) map[check.header] = match.id;
    }
    return map;
  }, [catalog, checks]);

  const statusOf = useCallback(
    (issue: SecurityIssue): FindingStatus => overrides[issue.id] ?? issue.status,
    [overrides],
  );

  /* --- URL writes -------------------------------------------------------- */

  const buildHref = useCallback(
    (patch: { category?: string; severity?: string; issue?: string | null }) => {
      const nextCategory = patch.category ?? category;
      const nextSeverity = patch.severity ?? severity;
      const nextIssue = patch.issue === undefined ? selectedId : patch.issue;
      return routes.security({
        category: nextCategory === "all" ? undefined : nextCategory,
        severity: nextSeverity === "all" ? undefined : nextSeverity,
        issueId: nextIssue ?? undefined,
      });
    },
    [category, selectedId, severity],
  );

  // replace() for filters, so a session of tweaking does not fill the history.
  const setCategory = useCallback(
    (next: string) => router.replace(buildHref({ category: next }), { scroll: false }),
    [buildHref, router],
  );

  const setSeverity = useCallback(
    (next: string) => router.replace(buildHref({ severity: next }), { scroll: false }),
    [buildHref, router],
  );

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === "category") setCategory(value);
      else if (id === "severity") setSeverity(value);
    },
    [setCategory, setSeverity],
  );

  const onSearchChange = useCallback(
    (value: string) => setFilter("security", "search", value),
    [setFilter],
  );

  const clearFilters = useCallback(() => {
    resetFilters("security");
    router.replace(buildHref({ category: "all", severity: "all" }), { scroll: false });
  }, [buildHref, resetFilters, router]);

  /** A chip or badge toggles its own value off — what a filter legend should do. */
  const toggleSeverity = useCallback(
    (value: Severity) => setSeverity(severity === value ? "all" : value),
    [setSeverity, severity],
  );
  const toggleCategory = useCallback(
    (value: string) => setCategory(category === value ? "all" : value),
    [category, setCategory],
  );
  const filterCritical = useCallback(() => toggleSeverity("critical"), [toggleSeverity]);

  // push() for the detail, so Back closes the drawer; the filters ride along.
  const openIssue = useCallback(
    (issue: SecurityIssue) => router.push(buildHref({ issue: issue.id })),
    [buildHref, router],
  );
  const openIssueById = useCallback(
    (id: string) => router.push(buildHref({ issue: id })),
    [buildHref, router],
  );
  const closeIssue = useCallback(
    () => router.replace(buildHref({ issue: null }), { scroll: false }),
    [buildHref, router],
  );

  /* --- actions ----------------------------------------------------------- */

  const runScan = useCallback(() => {
    void startTask({ prompt: SCAN_PROMPT, mode: "security-scan" });
    router.push(routes.workbench());
  }, [router, startTask]);

  const exportSarif = useCallback(() => {
    const sarif = toSarif(
      catalog.length > 0 ? catalog : issues,
      summary?.scannedUrls ?? 0,
      summary?.lastScan ?? new Date().toISOString(),
    );
    const href = URL.createObjectURL(new Blob([sarif], { type: "application/sarif+json" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `security-scan-${new Date().toISOString().slice(0, 10)}.sarif`;
    link.click();
    URL.revokeObjectURL(href);
  }, [catalog, issues, summary]);

  const changeStatus = useCallback((id: string, next: FindingStatus) => {
    setOverrides((previous) => ({ ...previous, [id]: next }));
  }, []);

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
        id: "category",
        label: "Category",
        value: category,
        options: [
          { value: "all", label: "All categories" },
          ...CATEGORIES.map((value) => ({
            value,
            label: value,
            count: summary?.byCategory.find((entry) => entry.category === value)?.count,
          })),
        ],
      },
      {
        id: "severity",
        label: "Severity",
        value: severity,
        options: [
          { value: "all", label: "All severities" },
          ...SEVERITIES.map((value) => ({
            value,
            label: titleCase(value),
            count: summary?.bySeverity[value],
          })),
        ],
      },
    ],
    [category, severity, summary],
  );

  const categoryData = useMemo(
    () =>
      CATEGORIES.map((value) => ({
        category: value,
        count: summary?.byCategory.find((entry) => entry.category === value)?.count ?? 0,
      })).sort((a, b) => b.count - a.count),
    [summary],
  );

  const severitySlices = useMemo(
    () =>
      SEVERITIES.map((value) => ({
        name: value,
        value: summary?.bySeverity[value] ?? 0,
        tone: value,
      })),
    [summary],
  );

  const totalIssues = useMemo(
    () => SEVERITIES.reduce((sum, value) => sum + (summary?.bySeverity[value] ?? 0), 0),
    [summary],
  );

  const columns = useMemo<Column<SecurityIssue>[]>(
    () => [
      {
        id: "id",
        header: "ID",
        width: "84px",
        sortValue: (row) => row.id,
        cell: (row) => <span className="text-code truncate text-primary">{row.id}</span>,
      },
      {
        id: "severity",
        header: "Severity",
        width: "96px",
        sortValue: (row) => SEVERITY_RANK[row.severity],
        cell: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleSeverity(row.severity);
            }}
            aria-label={`Filter by ${row.severity} severity`}
            data-testid={`security-row-severity-${row.id}`}
            className="rounded-full"
          >
            <SeverityBadge severity={row.severity} size="xs" />
          </button>
        ),
      },
      {
        id: "title",
        header: "Title",
        width: "minmax(200px,2fr)",
        sortValue: (row) => row.title,
        cell: (row) => (
          <span className="truncate text-foreground" title={row.title}>
            {row.title}
          </span>
        ),
      },
      {
        id: "category",
        header: "Category",
        width: "104px",
        sortValue: (row) => row.category,
        cell: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleCategory(row.category);
            }}
            aria-label={`Filter by ${row.category}`}
            data-testid={`security-row-category-${row.id}`}
            className="label-mono truncate transition-colors hover:text-foreground"
          >
            {row.category}
          </button>
        ),
      },
      {
        id: "cvss",
        header: "CVSS",
        width: "72px",
        align: "right",
        sortValue: (row) => row.cvss ?? 0,
        cell: (row) =>
          row.cvss === undefined ? (
            <span className="font-mono text-subtle-foreground">—</span>
          ) : (
            <span
              className={cn("font-mono font-semibold tabular-nums", cvssBand(row.cvss).className)}
              title={`CVSS 3.1 base score — ${cvssBand(row.cvss).label}`}
            >
              {row.cvss.toFixed(1)}
            </span>
          ),
      },
      {
        id: "cwe",
        header: "CWE",
        width: "100px",
        sortValue: (row) => row.cwe ?? "",
        cell: (row) =>
          row.cwe ? (
            <a
              href={cweHref(row.cwe)}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              aria-label={`${row.cwe} on cwe.mitre.org`}
              data-testid={`security-row-cwe-${row.id}`}
              className="text-code inline-flex items-center gap-1 truncate text-muted-foreground transition-colors hover:text-foreground"
            >
              {row.cwe}
              <ExternalLink className="size-2.5 shrink-0" aria-hidden />
            </a>
          ) : (
            <span className="font-mono text-subtle-foreground">—</span>
          ),
      },
      {
        id: "endpoint",
        header: "Endpoint",
        width: "minmax(150px,1fr)",
        sortValue: (row) => row.url,
        cell: (row) => {
          const endpointId = endpointByIssue[row.id];
          const label = truncateMiddle(row.url.replace(/^https?:\/\//, ""), 30);
          return endpointId ? (
            <Link
              href={routes.apiIntel({ endpointId })}
              onClick={(event) => event.stopPropagation()}
              title={`${row.url} — open ${endpointId}`}
              data-testid={`security-row-endpoint-${row.id}`}
              className="text-code truncate text-primary transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ) : (
            <span className="text-code truncate text-muted-foreground" title={row.url}>
              {label}
            </span>
          );
        },
      },
      {
        id: "detected",
        header: "Detected",
        width: "96px",
        sortValue: (row) => row.detectedAt,
        cell: (row) => (
          <span className="truncate text-muted-foreground" title={row.detectedAt}>
            {formatRelative(row.detectedAt)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "104px",
        sortValue: (row) => statusOf(row),
        cell: (row) => <StatusBadge status={statusOf(row)} size="xs" />,
      },
    ],
    [endpointByIssue, statusOf, toggleCategory, toggleSeverity],
  );

  const selected = useMemo(
    () => catalog.find((issue) => issue.id === selectedId) ?? null,
    [catalog, selectedId],
  );

  /* --- render ------------------------------------------------------------ */

  const tableEmpty = hasActiveFilters ? (
    <EmptyState
      icon={ShieldCheck}
      title="No issues in this category"
      description="Nothing matches the current category, severity and search combination."
      action={
        <Button variant="outline" onClick={clearFilters} data-testid="security-empty-clear-filters">
          Clear filters
        </Button>
      }
      testId="security-empty-filtered"
    />
  ) : (
    <EmptyState
      icon={ShieldCheck}
      title="No security scan has run yet"
      description="Run a passive scan to collect response headers, credential leaks, auth posture and injection surface."
      action={
        <Button variant="primary" onClick={runScan} data-testid="security-empty-run-scan">
          <RotateCw className="size-3.5" aria-hidden />
          Re-scan
        </Button>
      }
      testId="security-empty"
    />
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      <PageHeader
        title="Security"
        description="Headers, secrets, auth and injection surface scan"
        icon={ShieldCheck}
        meta={
          <>
            <span data-testid="security-last-scan">
              Last scan{" "}
              <strong className="font-mono text-foreground">
                {summary ? formatRelative(summary.lastScan) : "—"}
              </strong>
            </span>
            <span data-testid="security-issue-count">
              <strong className="font-mono text-foreground">{totalIssues || issues.length}</strong>{" "}
              issues · {issues.length} shown
            </span>
            <Link href={routes.run("#554")} className="transition-colors hover:text-foreground">
              passive scan · run #554
            </Link>
          </>
        }
        actions={
          <>
            <Button variant="primary" onClick={runScan} data-testid="security-rescan-btn">
              <RotateCw className="size-3.5" aria-hidden />
              Re-scan
            </Button>
            <Button variant="outline" onClick={exportSarif} data-testid="security-export-btn">
              <Download className="size-3.5" aria-hidden />
              Export SARIF
            </Button>
          </>
        }
      />

      {/* HERO — the score and its severity split, beside the three scan counters. */}
      <section aria-label="Security score" className="flex flex-col gap-3 lg:flex-row">
        <Card className="lg:w-[280px] lg:shrink-0" data-testid="security-score-card">
          <CardContent className="flex items-center gap-4 py-4">
            {summaryQuery.isPending ? (
              <Skeleton className="size-[104px] rounded-full" />
            ) : (
              <ScoreRing score={summary?.score ?? 0} size={104} label="security score" />
            )}
            <ul role="list" className="flex min-w-0 flex-col gap-1">
              {SEVERITIES.map((value) => (
                <li key={value}>
                  <button
                    type="button"
                    onClick={() => toggleSeverity(value)}
                    aria-pressed={severity === value}
                    data-testid={`security-severity-tile-${value}`}
                    className={cn(
                      "flex w-full items-baseline gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-left",
                      "transition-colors hover:bg-muted/50",
                      severity === value && "bg-primary/15",
                    )}
                  >
                    <span aria-hidden className={cn("size-1.5 rounded-full", SEVERITY_DOT[value])} />
                    <span className="label-mono">{value}</span>
                    <span
                      className={cn(
                        "ml-auto font-mono text-xs font-semibold tabular-nums",
                        SEVERITY_TEXT[value],
                      )}
                    >
                      {summary?.bySeverity[value] ?? "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="min-w-0 flex-1">
          {summaryQuery.isError ? (
            <Card>
              <CardContent>
                <ErrorState
                  error={summaryQuery.error}
                  onRetry={() => void summaryQuery.refetch()}
                  testId="security-summary-error"
                />
              </CardContent>
            </Card>
          ) : (
            <StatGrid columns={3}>
              <StatTile
                label="Critical"
                value={summary?.bySeverity.critical ?? 0}
                tone="error"
                icon={ShieldAlert}
                hint="Click to filter the table to critical issues"
                onClick={filterCritical}
                testId="security-stat-critical"
              />
              <StatTile
                label="Scanned URLs"
                value={summary?.scannedUrls ?? 0}
                tone="primary"
                icon={Globe}
                hint="Documents and endpoints touched by the passive scan"
                testId="security-stat-scanned"
              />
              <StatTile
                label="Last scan"
                value={summary ? formatRelative(summary.lastScan) : "—"}
                tone="neutral"
                icon={Clock}
                hint={summary?.lastScan ?? "No scan recorded"}
                testId="security-stat-last-scan"
              />
            </StatGrid>
          )}
        </div>
      </section>

      {/* BREAKDOWN — category by default, severity on the toggle. */}
      <ChartCard
        title={breakdown === "category" ? "Issues by category" : "Issues by severity"}
        description="Click a bar's chip to filter the table"
        height={170}
        testId="security-breakdown-card"
        actions={
          <ToggleGroup
            type="single"
            value={breakdown}
            onValueChange={(next) => {
              if (next === "category" || next === "severity") setBreakdown(next);
            }}
            aria-label="Breakdown dimension"
          >
            <ToggleGroupItem value="category" data-testid="security-breakdown-category">
              Category
            </ToggleGroupItem>
            <ToggleGroupItem value="severity" data-testid="security-breakdown-severity">
              Severity
            </ToggleGroupItem>
          </ToggleGroup>
        }
      >
        <div className="flex h-full flex-col gap-1.5">
          <div className="min-h-0 flex-1">
            {breakdown === "category" ? (
              <BarSeriesChart
                data={categoryData}
                xKey="category"
                series={CATEGORY_SERIES}
                height={124}
                testId="security-category-chart"
              />
            ) : (
              <DonutChart
                data={severitySlices}
                centerValue={String(totalIssues)}
                centerLabel="issues"
                height={124}
                testId="security-severity-chart"
              />
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {breakdown === "category"
              ? categoryData.map((entry) => (
                  <FilterChip
                    key={entry.category}
                    label={entry.category}
                    count={entry.count}
                    active={category === entry.category}
                    onClick={() => toggleCategory(entry.category)}
                    testId={`security-category-chip-${entry.category}`}
                  />
                ))
              : SEVERITIES.map((value) => (
                  <FilterChip
                    key={value}
                    label={value}
                    count={summary?.bySeverity[value] ?? 0}
                    active={severity === value}
                    dotClass={SEVERITY_DOT[value]}
                    onClick={() => toggleSeverity(value)}
                    testId={`security-severity-chip-${value}`}
                  />
                ))}
          </div>
        </div>
      </ChartCard>

      {/* HEADER CHECKLIST — the most actionable block on the page. The hero
          already carries the summary's ErrorState, so a failed summary drops
          this panel rather than repeating the same retry twice. */}
      {summaryQuery.isError ? null : (
        <section aria-label="Security header checklist">
          <HeaderChecklist
            checks={checks}
            loading={summaryQuery.isPending}
            issueByHeader={issueByHeader}
            onOpenIssue={openIssueById}
          />
        </section>
      )}

      {/* FILTERS + ISSUES */}
      <FilterBar
        search={filters.search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search issues, endpoints and CWE ids"
        filters={filterDefs}
        onFilterChange={onFilterChange}
        right={
          hasActiveFilters ? (
            <Button variant="ghost" size="xs" onClick={clearFilters} data-testid="security-clear-filters">
              Clear filters
            </Button>
          ) : null
        }
        testId="security-filter-bar"
      />

      <section aria-label="Security issues" className="cv-auto flex flex-col gap-3">
        {issuesQuery.isPending ? (
          <LoadingState rows={10} variant="table" />
        ) : issuesQuery.isError ? (
          <Card>
            <CardContent>
              <ErrorState
                error={issuesQuery.error}
                onRetry={() => void issuesQuery.refetch()}
                testId="security-list-error"
              />
            </CardContent>
          </Card>
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
            testId="security-table"
          />
        )}
      </section>

      {selected ? (
        <SecurityIssueDetail
          issue={selected}
          status={statusOf(selected)}
          hasFinding={findingIds.has(selected.id)}
          endpointId={endpointByIssue[selected.id]}
          onStatusChange={changeStatus}
          onClose={closeIssue}
        />
      ) : null}
    </div>
  );
}

/**
 * `useSearchParams` suspends during the static-export prerender, so the reading
 * half of the page lives under a boundary.
 */
export default function SecurityPage() {
  return (
    <Suspense fallback={<LoadingState rows={10} variant="panel" />}>
      <SecurityView />
    </Suspense>
  );
}

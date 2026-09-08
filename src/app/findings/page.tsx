"use client";

import {
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Bug,
  CheckCircle2,
  Download,
  Gauge,
  ShieldAlert,
  SortAsc,
  SortDesc,
  ThumbsDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Checkbox,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Skeleton,
} from "@/components/ui";
import { ChartCard } from "@/components/charts";
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FilterBar,
  LoadingState,
  PageHeader,
  ResizableSplit,
  StatGrid,
  StatTile,
  type FilterDef,
} from "@/components/shared";
import { FindingDetail, FindingRow } from "@/components/findings";
import { useDashboardSummary, useFindings, useUpdateFindingStatus } from "@/lib/queries";
import { routes } from "@/config/nav";
import {
  filterValue,
  useAgentStore,
  useFindingsFilters,
  useFiltersStore,
  useUiStore,
} from "@/store";
import { cn } from "@/lib/utils";
import type { FindingsFilters } from "@/store";
import type { Finding, FindingStatus, Severity } from "@/lib/api/types";

/* Recharts is ~90kB — the inbox has to paint before it arrives. */
const DonutChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.DonutChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);
const BarSeriesChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.BarSeriesChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
const STATUSES: FindingStatus[] = ["new", "confirmed", "fixed", "false-positive", "wont-fix"];
/** The nine distinct `Finding.category` values in the fixture set. */
const CATEGORIES = [
  "functional",
  "security",
  "accessibility",
  "api-contract",
  "visual",
  "console-error",
  "performance",
  "broken-link",
  "form-validation",
];

const SORTS: { value: FindingsFilters["sortBy"]; label: string }[] = [
  { value: "severity", label: "Severity" },
  { value: "confidence", label: "Confidence" },
  { value: "detected", label: "Detected" },
  { value: "title", label: "Title" },
];

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const SEVERITY_TONE: Record<Severity, "error" | "warning" | "accent" | "primary"> = {
  critical: "error",
  high: "warning",
  medium: "accent",
  low: "primary",
};

const CATEGORY_SERIES = [{ key: "count", label: "Findings", tone: "accent" as const }];
const ROW_HEIGHT = 66;
const SPLIT_SIZES = [58, 42];
const SPLIT_MIN = [34, 26];
const RESCAN_PROMPT =
  "Re-scan the application for functional, accessibility, security and visual defects.";

const isSeverity = (value: string | null): value is Severity =>
  value !== null && (SEVERITIES as string[]).includes(value);
const isStatus = (value: string | null): value is FindingStatus =>
  value !== null && (STATUSES as string[]).includes(value);

function compare(a: Finding, b: Finding, sortBy: FindingsFilters["sortBy"]): number {
  if (sortBy === "confidence") return a.confidence - b.confidence;
  if (sortBy === "title") return a.title.localeCompare(b.title);
  if (sortBy === "detected") {
    return (Date.parse(a.detectedAt ?? "") || 0) - (Date.parse(b.detectedAt ?? "") || 0);
  }
  // Severity ties resolve on confidence, so the tile order is stable and useful.
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.confidence - b.confidence;
}

/** The detail is an inline pane on a desktop window and a drawer once it would crush the list. */
function useWideLayout() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return wide;
}

/* ==========================================================================
   PAGE
   ======================================================================== */

function FindingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const filters = useFindingsFilters();
  const setFilter = useFiltersStore((s) => s.setFilter);
  const resetFilters = useFiltersStore((s) => s.resetFilters);
  const openCockpit = useUiStore((s) => s.openCockpit);
  const startTask = useAgentStore((s) => s.startTask);
  const updateStatus = useUpdateFindingStatus();
  const wide = useWideLayout();

  /* --- URL is the source of truth for every linkable filter -------------- */
  const severityParam = params.get("severity");
  const statusParam = params.get("status");
  const severity: FindingsFilters["severity"] = isSeverity(severityParam) ? severityParam : "all";
  const status: FindingsFilters["status"] = isStatus(statusParam) ? statusParam : "all";
  const category = params.get("category") ?? "all";
  const run = params.get("run");
  // Projects and Suites link in scoped to themselves ("show me this project's bugs"),
  // so those params have to reach the query or the link silently does nothing.
  const project = params.get("project");
  const suite = params.get("suite");
  const selectedId = params.get("finding");

  useEffect(() => {
    if (filters.severity !== severity) setFilter("findings", "severity", severity);
    if (filters.status !== status) setFilter("findings", "status", status);
    if (filters.category !== category) setFilter("findings", "category", category);
  }, [category, filters.category, filters.severity, filters.status, setFilter, severity, status]);

  /* --- data -------------------------------------------------------------- */
  const search = useDeferredValue(filters.search);
  const listQuery = useFindings({
    severity: filterValue(severity),
    status: filterValue(status),
    category: filterValue(category),
    runId: run ?? undefined,
    projectId: project ?? undefined,
    suiteId: suite ?? undefined,
    search: search.trim() || undefined,
  });
  // The rollup deliberately ignores the filters: the tiles have to show what the
  // current filter is hiding, not agree with it.
  const allQuery = useFindings();
  const summaryQuery = useDashboardSummary();

  const all = useMemo(() => allQuery.data?.items ?? [], [allQuery.data]);
  // The header numbers are only meaningful once the unfiltered rollup exists.
  const countsReady = !allQuery.isPending;
  const summary = summaryQuery.data;

  const rollup = useMemo(() => {
    const bySeverity: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byCategory = new Map<string, number>();
    const runIds = new Set<string>();
    let confirmed = 0;
    let confidence = 0;

    for (const finding of all) {
      bySeverity[finding.severity] += 1;
      byCategory.set(finding.category, (byCategory.get(finding.category) ?? 0) + 1);
      if (finding.runId) runIds.add(finding.runId);
      if (finding.status === "confirmed") confirmed += 1;
      confidence += finding.confidence;
    }

    return {
      bySeverity,
      confirmed,
      avgConfidence: all.length ? Math.round(confidence / all.length) : 0,
      categories: [...byCategory.entries()]
        .map(([name, count]) => ({ category: name, count }))
        .sort((a, b) => b.count - a.count),
      runIds: [...runIds].sort((a, b) => b.localeCompare(a)),
    };
  }, [all]);

  const rows = useMemo(() => {
    const items = listQuery.data?.items ?? [];
    const direction = filters.sortDir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => direction * compare(a, b, filters.sortBy));
  }, [filters.sortBy, filters.sortDir, listQuery.data]);

  /* --- URL writes -------------------------------------------------------- */
  type ParamPatch = Partial<Record<"severity" | "status" | "category" | "run" | "finding", string | null>>;

  const buildUrl = useCallback(
    (patch: ParamPatch) => {
      const next = {
        severity,
        status,
        category,
        run,
        finding: selectedId,
        ...patch,
      };
      const base = routes.findings({
        severity: next.severity && next.severity !== "all" ? next.severity : undefined,
        status: next.status && next.status !== "all" ? next.status : undefined,
        category: next.category && next.category !== "all" ? next.category : undefined,
        runId: next.run ?? undefined,
      });
      const query = new URLSearchParams(base.split("?")[1] ?? "");
      if (next.finding) query.set("finding", next.finding);
      const serialised = query.toString();
      return serialised ? `${routes.findings()}?${serialised}` : routes.findings();
    },
    [category, run, selectedId, severity, status],
  );

  /** Filters replace — they must not fill the back stack. */
  const replaceParams = useCallback(
    (patch: ParamPatch) => router.replace(buildUrl(patch)),
    [buildUrl, router],
  );

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === "sort") {
        setFilter("findings", "sortBy", value as FindingsFilters["sortBy"]);
        return;
      }
      if (id === "run") {
        replaceParams({ run: value === "all" ? null : value });
        return;
      }
      if (id === "severity") replaceParams({ severity: value });
      else if (id === "status") replaceParams({ status: value });
      else if (id === "category") replaceParams({ category: value });
    },
    [replaceParams, setFilter],
  );

  const onSearchChange = useCallback(
    (value: string) => setFilter("findings", "search", value),
    [setFilter],
  );

  const toggleSortDir = useCallback(
    () => setFilter("findings", "sortDir", filters.sortDir === "asc" ? "desc" : "asc"),
    [filters.sortDir, setFilter],
  );

  const clearFilters = useCallback(() => {
    resetFilters("findings");
    router.replace(selectedId ? routes.finding(selectedId) : routes.findings());
  }, [resetFilters, router, selectedId]);

  /** A tile toggles its own severity off — that is what a filter tile should do. */
  const toggleSeverity = useCallback(
    (value: Severity) => replaceParams({ severity: severity === value ? "all" : value }),
    [replaceParams, severity],
  );

  /* --- selection + row actions ------------------------------------------- */
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [confirmFalsePositive, setConfirmFalsePositive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const openDetail = useCallback(
    (id: string) => router.push(buildUrl({ finding: id })),
    [buildUrl, router],
  );
  const closeDetail = useCallback(() => router.push(buildUrl({ finding: null })), [buildUrl, router]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectedVisible = useMemo(
    () => rows.filter((finding) => selectedIds.has(finding.id)),
    [rows, selectedIds],
  );

  const allSelected = rows.length > 0 && selectedVisible.length === rows.length;
  const someSelected = selectedVisible.length > 0 && !allSelected;

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((previous) =>
      previous.size >= rows.length && rows.every((finding) => previous.has(finding.id))
        ? new Set<string>()
        : new Set(rows.map((finding) => finding.id)),
    );
  }, [rows]);

  const bulkSet = useCallback(
    (next: FindingStatus, label: string) => {
      const ids = selectedVisible.map((finding) => finding.id);
      if (!ids.length) return;
      // The mutation is optimistic, so the rows recolour on this tick.
      for (const id of ids) updateStatus.mutate({ id, status: next });
      setSelectedIds(new Set<string>());
      toast.success(`${ids.length} finding${ids.length === 1 ? "" : "s"} marked ${label}`);
    },
    [selectedVisible, updateStatus],
  );

  /* --- virtualisation over the page's own scroller ------------------------ */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const topRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const hasRows = rows.length > 0;

  // The list scrolls with the page rather than in a nested box, so the
  // virtualiser needs the distance from the top of the scroller to the list —
  // and that distance changes when the chart row wraps.
  useLayoutEffect(() => {
    const list = listRef.current;
    const top = topRef.current;
    if (!list) return;
    const measure = () => setScrollMargin(list.offsetTop);
    measure();
    if (!top || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(top);
    return () => observer.disconnect();
  }, [hasRows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 8,
    scrollMargin,
  });

  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= rows.length) return;
    virtualizer.scrollToIndex(activeIndex, { align: "auto" });
    const id = rows[activeIndex].id;
    const frame = window.requestAnimationFrame(() => {
      // Scoped to the list: the detail pane carries the same attribute.
      listRef.current?.querySelector<HTMLElement>(`[data-finding-id="${id}"]`)?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, rows, virtualizer]);

  /** Rapid triage: j/k walk the inbox, c/f/x set the status of the focused row. */
  const onListKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select")) return;

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((previous) => Math.min(rows.length - 1, previous < 0 ? 0 : previous + 1));
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((previous) => Math.max(0, previous < 0 ? 0 : previous - 1));
        return;
      }

      const id = target.closest<HTMLElement>("[data-finding-id]")?.dataset.findingId;
      if (!id) return;
      const next: FindingStatus | null =
        event.key === "c"
          ? "confirmed"
          : event.key === "f"
            ? "fixed"
            : event.key === "x"
              ? "false-positive"
              : null;
      if (!next) return;
      event.preventDefault();
      updateStatus.mutate({ id, status: next });
    },
    [rows.length, updateStatus],
  );

  /* --- header actions ---------------------------------------------------- */
  const rescan = useCallback(() => {
    void startTask({ prompt: RESCAN_PROMPT, mode: "find-bugs" });
    router.push(routes.workbench());
  }, [router, startTask]);

  const exportCsv = useCallback(() => {
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [
      "id,severity,status,category,confidence,url,element,run,case,detected,title",
      ...rows.map((finding) =>
        [
          finding.id,
          finding.severity,
          finding.status,
          finding.category,
          String(finding.confidence),
          finding.url,
          finding.element,
          finding.runId ?? "",
          finding.caseId ?? "",
          finding.detectedAt ?? "",
          finding.title,
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\n");

    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = href;
    link.download = `findings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(href);
  }, [rows]);

  /* --- derived view data ------------------------------------------------- */
  const filterDefs = useMemo<FilterDef[]>(
    () => [
      {
        id: "severity",
        label: "Severity",
        value: severity,
        options: [
          { value: "all", label: "All severity", count: all.length },
          ...SEVERITIES.map((value) => ({
            value,
            label: value[0].toUpperCase() + value.slice(1),
            count: rollup.bySeverity[value],
          })),
        ],
      },
      {
        id: "status",
        label: "Status",
        value: status,
        options: [
          { value: "all", label: "All status" },
          ...STATUSES.map((value) => ({
            value,
            label: value === "wont-fix" ? "Won't fix" : value.replace(/-/g, " "),
            count: all.filter((finding) => finding.status === value).length,
          })),
        ],
      },
      {
        id: "category",
        label: "Category",
        value: category,
        options: [
          { value: "all", label: "All categories" },
          ...CATEGORIES.map((value) => ({
            value,
            label: value,
            count: rollup.categories.find((entry) => entry.category === value)?.count,
          })),
        ],
      },
      {
        id: "run",
        label: "Run",
        value: run ?? "all",
        options: [
          { value: "all", label: "All runs" },
          ...rollup.runIds.map((value) => ({
            value,
            label: `Run ${value}`,
            count: all.filter((finding) => finding.runId === value).length,
          })),
        ],
      },
      {
        id: "sort",
        label: "Sort",
        value: filters.sortBy,
        options: SORTS.map((option) => ({ value: option.value, label: option.label })),
      },
    ],
    [all, category, filters.sortBy, rollup, run, severity, status],
  );

  const severitySlices = useMemo(
    () =>
      SEVERITIES.map((value) => ({
        name: value,
        value: rollup.bySeverity[value],
        tone: value,
      })),
    [rollup.bySeverity],
  );

  const filtered =
    severity !== "all" || status !== "all" || category !== "all" || Boolean(run) || Boolean(search.trim());

  /* --- panes ------------------------------------------------------------- */
  const listBody = listQuery.isPending ? (
    <LoadingState rows={10} variant="table" />
  ) : listQuery.isError ? (
    <Card>
      <CardContent>
        <ErrorState
          error={listQuery.error}
          onRetry={() => void listQuery.refetch()}
          testId="findings-list-error"
        />
      </CardContent>
    </Card>
  ) : rows.length === 0 ? (
    <Card>
      <CardContent>
        {filtered ? (
          <EmptyState
            icon={Bug}
            title="No findings match these filters"
            description="The severity, status, category, run and search filters together exclude every finding."
            action={
              <Button variant="outline" onClick={clearFilters} data-testid="findings-empty-clear">
                Clear filters
              </Button>
            }
            testId="findings-empty-filtered"
          />
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="No findings — nothing broken was detected"
            description="Send the agent at the app and it will file what it breaks."
            action={
              <Button variant="primary" onClick={rescan} data-testid="findings-empty-scan">
                Run a scan
              </Button>
            }
            testId="findings-empty"
          />
        )}
      </CardContent>
    </Card>
  ) : (
    <div
      className="overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-card"
      onKeyDown={onListKeyDown}
    >
      <div className="flex items-center gap-3 border-b border-border bg-elevated px-4 py-2">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={toggleSelectAll}
          aria-label="Select every visible finding"
          data-testid="findings-select-all"
        />
        <span className="label-mono">
          {rows.length} finding{rows.length === 1 ? "" : "s"}
        </span>
        <span className="label-mono ml-auto hidden text-[10px] lg:inline">
          j / k move · c confirm · f fixed · x false positive
        </span>
      </div>

      <div
        ref={listRef}
        role="list"
        aria-label="Findings inbox"
        data-testid="findings-list"
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          const finding = rows[item.index];
          if (!finding) return null;
          return (
            <div
              key={finding.id}
              role="listitem"
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
            >
              <FindingRow
                finding={finding}
                active={finding.id === selectedId}
                selected={selectedIds.has(finding.id)}
                onOpen={openDetail}
                onOpenCockpit={openCockpit}
                onToggleSelect={toggleSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  const leftPane = (
    <div
      ref={scrollRef}
      data-testid="findings-inbox"
      className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
    >
      <div className="flex flex-col gap-4 p-6">
        <div ref={topRef} className="flex flex-col gap-4">
          <PageHeader
            title="Findings"
            description="Bug intelligence inbox and failure cockpit"
            icon={Bug}
            meta={
              <>
                {/*
                  Counts render as "—" until the rollup query lands. Two reasons:
                  a hard "0 open" while loading is simply wrong, and the page is
                  statically prerendered, so any number baked into the HTML would
                  disagree with the client the moment data arrives (hydration
                  mismatch). "—" is true at build time and at first paint.
                */}
                <span data-testid="findings-count-open">
                  <strong className="font-mono text-foreground">
                    {countsReady ? (summary?.openFindings ?? all.length) : "—"}
                  </strong>{" "}
                  open
                </span>
                <span data-testid="findings-count-critical">
                  <strong className="font-mono text-critical">
                    {countsReady ? (summary?.criticalFindings ?? rollup.bySeverity.critical) : "—"}
                  </strong>{" "}
                  critical
                </span>
                <span data-testid="findings-count-confirmed">
                  <strong className="font-mono text-foreground">
                    {countsReady ? rollup.confirmed : "—"}
                  </strong>{" "}
                  confirmed
                </span>
                <span data-testid="findings-count-confidence">
                  <strong className="font-mono text-foreground">
                    {countsReady ? `${rollup.avgConfidence}%` : "—"}
                  </strong>{" "}
                  avg confidence
                </span>
                <span data-testid="findings-count-shown">
                  {listQuery.isPending ? "…" : `${rows.length} shown`}
                </span>
              </>
            }
            actions={
              <>
                <Button variant="primary" onClick={rescan} data-testid="findings-rescan-btn">
                  <Bug className="size-3.5" aria-hidden />
                  Rescan
                </Button>
                <Button variant="outline" onClick={exportCsv} data-testid="findings-export-btn">
                  <Download className="size-3.5" aria-hidden />
                  Export
                </Button>
              </>
            }
          />

          {/* SEVERITY TRIAGE — the tiles are the fastest filter in the page. */}
          <StatGrid columns={4}>
            {SEVERITIES.map((value) => (
              <StatTile
                key={value}
                label={`${value} findings`}
                value={rollup.bySeverity[value]}
                tone={SEVERITY_TONE[value]}
                icon={value === "critical" ? ShieldAlert : value === "low" ? Gauge : Bug}
                hint={severity === value ? "Filtering — click to clear" : "Click to filter the inbox"}
                onClick={() => toggleSeverity(value)}
                testId={`findings-stat-${value}`}
              />
            ))}
          </StatGrid>

          {run ? (
            <div className="flex flex-wrap items-center gap-2" data-testid="findings-run-chip">
              <Badge variant="primary" size="sm">
                filtered to run {run}
              </Badge>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => replaceParams({ run: null })}
                data-testid="findings-run-chip-clear"
              >
                <X className="size-3" aria-hidden />
                Clear run filter
              </Button>
              <Button variant="ghost" size="xs" asChild data-testid="findings-run-chip-open">
                <Link href={routes.run(run)}>Open run {run}</Link>
              </Button>
            </div>
          ) : null}

          <section aria-label="Finding distribution" className="grid gap-3 xl:grid-cols-2">
            <ChartCard
              title="By severity"
              description="Unfiltered rollup — the tiles above filter the inbox"
              height={180}
              testId="findings-severity-card"
            >
              <DonutChart
                data={severitySlices}
                centerValue={String(all.length)}
                centerLabel="findings"
                height={148}
                testId="findings-severity-chart"
              />
            </ChartCard>

            <ChartCard
              title="By category"
              description="Where the defects cluster"
              height={180}
              testId="findings-category-card"
            >
              <BarSeriesChart
                data={rollup.categories}
                xKey="category"
                series={CATEGORY_SERIES}
                horizontal
                height={148}
                testId="findings-category-chart"
              />
            </ChartCard>
          </section>

          <FilterBar
            search={filters.search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search findings, elements and URLs"
            filters={filterDefs}
            onFilterChange={onFilterChange}
            right={
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleSortDir}
                  aria-label={`Sort ${filters.sortDir === "asc" ? "ascending" : "descending"}`}
                  data-testid="findings-sort-dir"
                >
                  {filters.sortDir === "asc" ? (
                    <SortAsc className="size-3.5" aria-hidden />
                  ) : (
                    <SortDesc className="size-3.5" aria-hidden />
                  )}
                </Button>
                {filtered ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={clearFilters}
                    data-testid="findings-clear-filters"
                  >
                    Clear filters
                  </Button>
                ) : null}
              </>
            }
            testId="findings-filter-bar"
          />

          {selectedVisible.length ? (
            <div
              data-testid="findings-bulk-bar"
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)]",
                "border border-primary/40 bg-primary/10 px-3 py-2",
              )}
            >
              <span className="label-mono text-foreground">
                {selectedVisible.length} selected
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={() => bulkSet("confirmed", "confirmed")}
                data-testid="findings-bulk-confirm"
              >
                <CheckCircle2 className="size-3" aria-hidden />
                Confirm
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => bulkSet("fixed", "fixed")}
                data-testid="findings-bulk-fixed"
              >
                Mark fixed
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={() => setConfirmFalsePositive(true)}
                data-testid="findings-bulk-false-positive"
              >
                <ThumbsDown className="size-3" aria-hidden />
                False positive
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSelectedIds(new Set<string>())}
                data-testid="findings-bulk-clear"
              >
                Clear selection
              </Button>
            </div>
          ) : null}
        </div>

        <section aria-label="Findings inbox" className="cv-auto">
          {listBody}
        </section>
      </div>
    </div>
  );

  const detailPane = selectedId ? (
    <div
      data-testid="findings-detail-pane"
      className="min-h-0 flex-1 overflow-y-auto border-l border-border/60 bg-background p-4"
    >
      <FindingDetail findingId={selectedId} onClose={closeDetail} />
    </div>
  ) : null;

  const splitOpen = Boolean(selectedId) && wide;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="findings-page">
      {splitOpen && detailPane ? (
        <ResizableSplit
          direction="horizontal"
          initialSizes={SPLIT_SIZES}
          minSizes={SPLIT_MIN}
          storageKey="findings"
          testId="findings-split"
        >
          {leftPane}
          {detailPane}
        </ResizableSplit>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{leftPane}</div>
      )}

      {/* Under 1280px the inline pane would crush the list, so it becomes a drawer. */}
      <Drawer
        open={Boolean(selectedId) && !wide}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
      >
        <DrawerContent side="right" size="lg" data-testid="findings-detail-drawer">
          <DrawerHeader>
            <DrawerTitle className="text-sm">Finding {selectedId}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {selectedId ? <FindingDetail findingId={selectedId} onClose={closeDetail} /> : null}
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={confirmFalsePositive}
        onOpenChange={setConfirmFalsePositive}
        title={`Mark ${selectedVisible.length} finding${selectedVisible.length === 1 ? "" : "s"} as false positive?`}
        description="They leave the open queue and stop counting toward the critical badge. The evidence is kept."
        confirmLabel="Mark false positive"
        destructive
        onConfirm={() => bulkSet("false-positive", "false positive")}
        testId="findings-false-positive-confirm"
      />
    </div>
  );
}

/** `useSearchParams` suspends during the static export prerender. */
export default function FindingsPage() {
  return (
    <Suspense fallback={<LoadingState rows={10} variant="panel" />}>
      <FindingsView />
    </Suspense>
  );
}

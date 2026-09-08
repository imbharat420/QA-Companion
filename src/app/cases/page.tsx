"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  KeyRound,
  ListChecks,
  MoreHorizontal,
  Play,
  Sparkles,
  Video,
  XCircle,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { CaseDetail } from "@/components/testing";
import {
  Badge,
  Button,
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Drawer,
  DrawerContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Progress,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import {
  CopyButton,
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
import { routes } from "@/config/nav";
import { useCase, useCases, useFlakyTests, useStartRun, useSuites } from "@/lib/queries";
import { useCasesFilters, useFiltersStore } from "@/store";
import { cn, formatDuration, formatPercent, truncateMiddle } from "@/lib/utils";
import type { Column } from "@/components/shared";
import type { Suite, TestCase, TestStatus } from "@/lib/api/types";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "flaky", label: "Flaky" },
  { value: "skipped", label: "Skipped" },
  { value: "running", label: "Running" },
  { value: "pending", label: "Pending" },
];

const SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "agent", label: "Agent" },
  { value: "recording", label: "Recording" },
  { value: "human", label: "Human" },
];

type Source = "agent" | "recording" | "human";

const SOURCE_META: Record<Source, { label: string; icon: typeof Bot; variant: "primary" | "info" | "muted" }> = {
  agent: { label: "Agent", icon: Bot, variant: "primary" },
  recording: { label: "Recording", icon: Video, variant: "info" },
  human: { label: "Human", icon: KeyRound, variant: "muted" },
};

/** `generatedBy` is optional on the entity; an absent value reads as hand-written. */
const sourceOf = (testCase: TestCase): Source => testCase.generatedBy ?? "human";

function FlakeCell({ rate }: { rate: number }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={cn(
          "w-10 shrink-0 font-mono text-[11px] tabular-nums",
          rate >= 0.15 ? "text-error" : rate > 0 ? "text-waiting" : "text-subtle-foreground",
        )}
      >
        {formatPercent(rate, 0)}
      </span>
      <Progress
        value={Math.min(100, rate * 100 * 4)}
        tone={rate >= 0.15 ? "error" : "warning"}
        className="min-w-8 max-w-16"
        aria-label={`Flake rate ${formatPercent(rate)}`}
      />
    </div>
  );
}

function CasesScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const bag = useCasesFilters();
  const setFilter = useFiltersStore((s) => s.setFilter);
  const resetFilters = useFiltersStore((s) => s.resetFilters);

  // The URL wins; the persisted bag is the fallback, so a filter survives a
  // round trip through another page without an extra sync effect.
  const suiteId = params.get("suite") ?? bag.suiteId;
  const tag = params.get("tag") ?? bag.tag;
  const status = params.get("status") ?? bag.status;
  const search = params.get("q") ?? bag.search;
  const source = params.get("source") ?? "all";
  const grouped = params.get("group") !== "off";
  const caseId = params.get("case") ?? "";

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const query = useMemo(
    () => ({
      suiteId: suiteId === "all" ? undefined : suiteId,
      tag: tag === "all" ? undefined : tag,
      status: status === "all" ? undefined : status,
      search: search.trim() || undefined,
    }),
    [search, status, suiteId, tag],
  );

  const casesQuery = useCases(query);
  const suitesQuery = useSuites();
  const flaky = useFlakyTests();
  const detail = useCase(caseId);
  const startRun = useStartRun();

  const suites = useMemo(() => suitesQuery.data?.items ?? [], [suitesQuery.data]);
  const suiteById = useMemo(() => new Map(suites.map((s) => [s.id, s])), [suites]);

  /* --- url + store ------------------------------------------------------ */

  const writeParams = useCallback(
    (patch: Record<string, string | undefined>, mode: "replace" | "push" = "replace") => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const href = qs ? `${routes.cases()}?${qs}` : routes.cases();
      if (mode === "push") router.push(href);
      else router.replace(href);
    },
    [params, router],
  );

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === "suite") setFilter("cases", "suiteId", value);
      if (id === "tag") setFilter("cases", "tag", value);
      if (id === "status") setFilter("cases", "status", value as TestStatus | "all");
      // `suite` is the control's id but `suite` is also the param name — keep both.
      writeParams({ [id]: value });
    },
    [setFilter, writeParams],
  );

  const onSearchChange = useCallback(
    (value: string) => {
      setFilter("cases", "search", value);
      writeParams({ q: value });
    },
    [setFilter, writeParams],
  );

  const clearFilters = useCallback(() => {
    resetFilters("cases");
    writeParams({ suite: undefined, tag: undefined, status: undefined, q: undefined, source: undefined });
  }, [resetFilters, writeParams]);

  const openCase = useCallback(
    (id: string) => writeParams({ case: id }, "push"),
    [writeParams],
  );

  const closeCase = useCallback(() => writeParams({ case: undefined }), [writeParams]);

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

  /* --- rows ------------------------------------------------------------- */

  const rows = useMemo(() => {
    const items = casesQuery.data?.items ?? [];
    return source === "all" ? items : items.filter((item) => sourceOf(item) === source);
  }, [casesQuery.data, source]);

  const groups = useMemo(() => {
    if (!grouped) return [];
    const byId = new Map<string, TestCase[]>();
    for (const row of rows) {
      const list = byId.get(row.suiteId);
      if (list) list.push(row);
      else byId.set(row.suiteId, [row]);
    }
    return [...byId.entries()].map(([id, members]) => ({
      id,
      suite: suiteById.get(id),
      rows: members,
    }));
  }, [grouped, rows, suiteById]);

  const stats = useMemo(() => {
    const tally = { passed: 0, failed: 0, flaky: 0 };
    for (const row of rows) {
      if (row.status === "passed") tally.passed += 1;
      else if (row.status === "failed") tally.failed += 1;
      else if (row.status === "flaky") tally.flaky += 1;
    }
    return { total: rows.length, ...tally };
  }, [rows]);

  const tagOptions = useMemo(() => {
    // Suite tags are the stable spine — the filtered case set alone would drop
    // the very option you are filtering by the moment it narrows the list.
    const counts = new Map<string, number>();
    for (const suite of suites) for (const entry of suite.tags ?? []) counts.set(entry, 0);
    for (const row of rows) {
      for (const entry of row.tags) counts.set(entry, (counts.get(entry) ?? 0) + 1);
    }
    if (tag !== "all" && !counts.has(tag)) counts.set(tag, 0);
    return [
      { value: "all", label: "All tags" },
      ...[...counts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([value, count]) => ({ value, label: value, count })),
    ];
  }, [rows, suites, tag]);

  const suiteOptions = useMemo(
    () => [
      { value: "all", label: "All suites" },
      ...suites.map((suite) => ({ value: suite.id, label: suite.name, count: suite.cases })),
    ],
    [suites],
  );

  const exportPayload = useMemo(
    () =>
      JSON.stringify(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          suite: suiteById.get(row.suiteId)?.name ?? row.suiteId,
          file: row.file,
          status: row.status,
          durationMs: row.durationMs,
          flakeRate: row.flakeRate,
          owner: row.owner,
          tags: row.tags,
          generatedBy: sourceOf(row),
        })),
        null,
        2,
      ),
    [rows, suiteById],
  );

  /* --- selection + actions --------------------------------------------- */

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const selectAll = useCallback(
    () => setSelected(new Set(rows.map((row) => row.id))),
    [rows],
  );

  const runCases = useCallback(
    async (caseIds: string[], label: string) => {
      if (caseIds.length === 0) return;
      try {
        const run = await startRun.mutateAsync({ caseIds });
        toast.success(`Run ${run.id} started`, { description: label });
        router.push(routes.run(run.id));
      } catch (error) {
        toast.error("Could not start the run", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [router, startRun],
  );

  const runSelected = useCallback(
    () => void runCases([...selected], `${selected.size} cases queued`),
    [runCases, selected],
  );

  const runOne = useCallback(
    (id: string) => void runCases([id], id),
    [runCases],
  );

  const toggleGroup = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* --- columns ---------------------------------------------------------- */

  const columns = useMemo<Column<TestCase>[]>(
    () => [
      {
        id: "select",
        header: "",
        width: "36px",
        align: "center",
        cell: (row) => (
          <Checkbox
            checked={selected.has(row.id)}
            onCheckedChange={() => toggleRow(row.id)}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Select ${row.title}`}
            data-testid={`cases-row-${row.id}-select`}
          />
        ),
      },
      {
        id: "title",
        header: "Case",
        width: "minmax(200px,2.2fr)",
        sortValue: (row) => row.title,
        cell: (row) => (
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-medium text-foreground" title={row.title}>
              {row.title}
            </span>
            <span className="text-code truncate text-subtle-foreground">{row.id}</span>
          </div>
        ),
      },
      {
        id: "suite",
        header: "Suite",
        width: "minmax(120px,1fr)",
        sortValue: (row) => suiteById.get(row.suiteId)?.name ?? row.suiteId,
        cell: (row) => (
          <Link
            href={routes.cases({ suiteId: row.suiteId })}
            onClick={(event) => event.stopPropagation()}
            className="truncate text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
            data-testid={`cases-row-${row.id}-suite`}
          >
            {suiteById.get(row.suiteId)?.name ?? row.suiteId}
          </Link>
        ),
      },
      {
        id: "file",
        header: "File",
        width: "minmax(110px,1fr)",
        sortValue: (row) => row.file,
        cell: (row) => (
          <span className="text-code truncate text-muted-foreground" title={row.file}>
            {truncateMiddle(row.file, 24)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        width: "88px",
        sortValue: (row) => row.status,
        cell: (row) => <StatusBadge status={row.status} size="xs" />,
      },
      {
        id: "durationMs",
        header: "Duration",
        width: "80px",
        align: "right",
        sortValue: (row) => row.durationMs,
        cell: (row) => (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatDuration(row.durationMs)}
          </span>
        ),
      },
      {
        id: "flakeRate",
        header: "Flake",
        width: "104px",
        sortValue: (row) => row.flakeRate,
        cell: (row) => <FlakeCell rate={row.flakeRate} />,
      },
      {
        id: "owner",
        header: "Owner",
        width: "104px",
        sortValue: (row) => row.owner,
        cell: (row) => <span className="truncate text-muted-foreground">{row.owner}</span>,
      },
      {
        id: "tags",
        header: "Tags",
        width: "minmax(120px,1.2fr)",
        cell: (row) => (
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {row.tags.slice(0, 2).map((entry) => (
              <Link
                key={entry}
                href={routes.cases({ tag: entry })}
                onClick={(event) => event.stopPropagation()}
                data-testid={`cases-row-${row.id}-tag-${entry}`}
              >
                <Badge variant="muted" size="xs" className="hover:text-foreground">
                  {entry}
                </Badge>
              </Link>
            ))}
            {row.tags.length > 2 ? (
              <span className="font-mono text-[10px] text-subtle-foreground">
                +{row.tags.length - 2}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "source",
        header: "Source",
        width: "104px",
        sortValue: (row) => sourceOf(row),
        cell: (row) => {
          const meta = SOURCE_META[sourceOf(row)];
          const Icon = meta.icon;
          const badge = (
            <Badge
              variant={meta.variant}
              size="xs"
              data-testid={`cases-row-${row.id}-source`}
              data-source={sourceOf(row)}
            >
              <Icon className="size-3" aria-hidden />
              {meta.label}
            </Badge>
          );
          return sourceOf(row) === "agent" ? (
            <Link
              href={routes.workbench()}
              onClick={(event) => event.stopPropagation()}
              title="Written by the agent — open the workbench"
            >
              {badge}
            </Link>
          ) : (
            badge
          );
        },
      },
      {
        id: "lastRun",
        header: "Last run",
        width: "100px",
        sortValue: (row) => row.lastRun,
        cell: (row) => (
          <span className="truncate text-muted-foreground">{row.lastRun}</span>
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
                aria-label={`Actions for ${row.title}`}
                onClick={(event) => event.stopPropagation()}
                data-testid={`cases-row-${row.id}-menu`}
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="truncate">{row.id}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => runOne(row.id)}
                data-testid={`cases-row-${row.id}-run`}
              >
                <Play className="size-3.5" aria-hidden />
                Run this case
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => openCase(row.id)}
                data-testid={`cases-row-${row.id}-open`}
              >
                <FileCode2 className="size-3.5" aria-hidden />
                Open details
              </DropdownMenuItem>
              <DropdownMenuItem asChild data-testid={`cases-row-${row.id}-workbench`}>
                <Link href={routes.workbench()}>
                  <Bot className="size-3.5" aria-hidden />
                  Open in workbench
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild data-testid={`cases-row-${row.id}-suite`}>
                <Link href={routes.suites()}>
                  <ListChecks className="size-3.5" aria-hidden />
                  View suite
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [openCase, runOne, selected, suiteById, toggleRow],
  );

  const onRowClick = useCallback((row: TestCase) => openCase(row.id), [openCase]);

  const filtered =
    suiteId !== "all" ||
    tag !== "all" ||
    status !== "all" ||
    source !== "all" ||
    search.trim() !== "";

  const emptyState = filtered ? (
    <EmptyState
      icon={FileCode2}
      title={search.trim() ? `No cases match "${search.trim()}"` : "No cases match these filters"}
      description="Loosen the suite, tag, status or source filter to see the rest of the catalog."
      action={
        <Button variant="outline" onClick={clearFilters} data-testid="cases-clear-filters">
          Clear filters
        </Button>
      }
      testId="cases-empty-filtered"
    />
  ) : (
    <EmptyState
      icon={FileCode2}
      title="No cases in this suite"
      description="Describe the flow in the workbench and the agent will generate the spec and its cases."
      action={
        <Button variant="primary" asChild data-testid="cases-empty-generate">
          <Link href={routes.workbench()}>
            <Sparkles className="size-3.5" aria-hidden />
            Generate spec
          </Link>
        </Button>
      }
      testId="cases-empty"
    />
  );

  /* --- table ------------------------------------------------------------ */

  const flatTable = (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(row) => row.id}
      onRowClick={onRowClick}
      selectedKey={caseId || undefined}
      sortBy={sortBy}
      sortDir={sortDir}
      onSortChange={onSortChange}
      stickyHeader
      testId="cases-table"
      virtualize={rows.length > 100}
      empty={emptyState}
    />
  );

  const groupedTable =
    groups.length === 0 ? (
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-card">
        {emptyState}
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <SuiteGroup
            key={group.id}
            suiteId={group.id}
            suite={group.suite}
            rows={group.rows}
            columns={columns}
            open={!collapsed.has(group.id)}
            onToggle={toggleGroup}
            onRowClick={onRowClick}
            selectedKey={caseId || undefined}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={onSortChange}
          />
        ))}
      </div>
    );

  const body = casesQuery.isPending ? (
    <div className="flex flex-col gap-3">
      {grouped ? (
        <div className="surface-inset flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2">
          <span className="label-mono">Loading suites…</span>
        </div>
      ) : null}
      <LoadingState rows={8} variant="table" />
    </div>
  ) : casesQuery.isError ? (
    <ErrorState
      error={casesQuery.error}
      onRetry={() => void casesQuery.refetch()}
      testId="cases-error"
    />
  ) : grouped ? (
    groupedTable
  ) : (
    flatTable
  );

  const flakeEntry = flaky.data?.find((entry) => entry.id === caseId);
  const detailCase = detail.data ?? null;

  return (
    <div className="flex min-w-0 flex-col gap-4 p-6">
      <PageHeader
        title="Test Cases"
        description="Individual cases with steps, assertions and locator provenance."
        icon={FileCode2}
        breadcrumbs={[
          { label: "Test Suites", href: routes.suites() },
          { label: "Test Cases" },
        ]}
        meta={
          <>
            <span data-testid="cases-count">
              <span className="font-mono tabular-nums text-foreground">{rows.length}</span> cases
              {casesQuery.data && casesQuery.data.total !== rows.length ? (
                <span className="text-subtle-foreground"> of {casesQuery.data.total}</span>
              ) : null}
            </span>
            {suiteId !== "all" ? (
              <Link href={routes.suites()} className="text-primary hover:underline">
                {suiteById.get(suiteId)?.name ?? suiteId}
              </Link>
            ) : null}
            <Link href={routes.runs()} className="hover:text-foreground">
              Run history
            </Link>
          </>
        }
        actions={
          <>
            <Button
              variant="primary"
              onClick={runSelected}
              disabled={selected.size === 0}
              loading={startRun.isPending}
              data-testid="cases-run-selected"
            >
              <Play className="size-3.5" aria-hidden />
              Run selected{selected.size ? ` (${selected.size})` : ""}
            </Button>
            <Button variant="outline" asChild data-testid="cases-new-case">
              <Link href={routes.workbench()}>
                <Sparkles className="size-3.5" aria-hidden />
                New case
              </Link>
            </Button>
            <CopyButton value={exportPayload} testId="cases-export" />
          </>
        }
      />

      <StatGrid columns={4}>
        <StatTile
          label="Total"
          value={stats.total}
          icon={FileCode2}
          tone="primary"
          hint="Cases in the current view"
          onClick={() => onFilterChange("status", "all")}
          testId="cases-stat-total"
        />
        <StatTile
          label="Passed"
          value={stats.passed}
          icon={CheckCircle2}
          tone="success"
          onClick={() => onFilterChange("status", "passed")}
          testId="cases-stat-passed"
        />
        <StatTile
          label="Failed"
          value={stats.failed}
          icon={XCircle}
          tone="error"
          onClick={() => onFilterChange("status", "failed")}
          testId="cases-stat-failed"
        />
        <StatTile
          label="Flaky"
          value={stats.flaky}
          icon={Zap}
          tone="warning"
          onClick={() => onFilterChange("status", "flaky")}
          testId="cases-stat-flaky"
        />
      </StatGrid>

      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search test cases"
        filters={[
          { id: "suite", label: "Suite", value: suiteId, options: suiteOptions },
          { id: "status", label: "Status", value: status, options: STATUS_OPTIONS },
          { id: "tag", label: "Tag", value: tag, options: tagOptions },
          { id: "source", label: "Source", value: source, options: SOURCE_OPTIONS },
        ]}
        onFilterChange={onFilterChange}
        right={
          <>
            <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Switch
                checked={grouped}
                onCheckedChange={(next) => writeParams({ group: next ? undefined : "off" })}
                data-testid="cases-group-toggle"
                aria-label="Group by suite"
              />
              Group by suite
            </span>
            {filtered ? (
              <Button variant="ghost" size="xs" onClick={clearFilters} data-testid="cases-reset">
                Clear filters
              </Button>
            ) : null}
          </>
        }
        testId="cases-filters"
      />

      {selected.size > 0 ? (
        <div
          data-testid="cases-bulk-bar"
          className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-primary/30 bg-primary/10 px-3 py-2"
        >
          <span className="font-mono text-xs tabular-nums text-primary">
            {selected.size} {selected.size === 1 ? "case" : "cases"} selected
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="xs"
              onClick={runSelected}
              loading={startRun.isPending}
              data-testid="cases-bulk-run"
            >
              <Play className="size-3" aria-hidden />
              Run
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button variant="outline" size="xs" disabled data-testid="cases-bulk-tag">
                    Add tag
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Tagging needs a case-write method; no adapter exposes one yet.
              </TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="xs" onClick={selectAll} data-testid="cases-bulk-all">
              Select all {rows.length}
            </Button>
            <Button variant="ghost" size="xs" onClick={clearSelection} data-testid="cases-bulk-clear">
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      {body}

      <Drawer open={Boolean(caseId)} onOpenChange={(open) => (open ? undefined : closeCase())}>
        <DrawerContent
          side="right"
          size="lg"
          className="w-[560px] max-w-[94vw]"
          data-testid="cases-drawer"
        >
          <CaseDetail
            testCase={detailCase}
            caseId={caseId}
            suiteName={detailCase ? suiteById.get(detailCase.suiteId)?.name : undefined}
            flake={flakeEntry}
            loading={detail.isPending && Boolean(caseId)}
            error={detail.isError ? detail.error : undefined}
            onRetry={() => void detail.refetch()}
            onRun={runOne}
            running={startRun.isPending}
            onClear={closeCase}
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}

/* ==========================================================================
   GROUP
   One collapsible band per suite. DataTable has no grouping of its own, and a
   table per group keeps sorting, virtualisation and row testids identical to
   the flat view for free.
   ======================================================================== */

interface SuiteGroupProps {
  suiteId: string;
  suite?: Suite;
  rows: TestCase[];
  columns: Column<TestCase>[];
  open: boolean;
  onToggle: (id: string) => void;
  onRowClick: (row: TestCase) => void;
  selectedKey?: string;
  sortBy?: string;
  sortDir: "asc" | "desc";
  onSortChange: (id: string) => void;
}

function SuiteGroup({
  suiteId,
  suite,
  rows,
  columns,
  open,
  onToggle,
  onRowClick,
  selectedKey,
  sortBy,
  sortDir,
  onSortChange,
}: SuiteGroupProps) {
  const passRate = suite ? suite.passRate / 100 : rows.filter((r) => r.status === "passed").length / rows.length;

  return (
    <Collapsible open={open} onOpenChange={() => onToggle(suiteId)}>
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border/70 bg-elevated px-2 py-1.5">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="gap-1.5"
            aria-label={open ? `Collapse ${suite?.name ?? suiteId}` : `Expand ${suite?.name ?? suiteId}`}
            data-testid={`cases-group-${suiteId}-toggle`}
          >
            <ChevronRight
              className={cn("size-3 transition-transform duration-150", open && "rotate-90")}
              aria-hidden
            />
            <span className="font-display text-xs font-semibold text-foreground">
              {suite?.name ?? suiteId}
            </span>
          </Button>
        </CollapsibleTrigger>

        {suite ? <StatusBadge status={suite.status} size="xs" /> : null}

        {suite ? (
          <Link
            href={routes.suites()}
            className="text-code truncate text-subtle-foreground hover:text-foreground"
            data-testid={`cases-group-${suiteId}-suite-link`}
          >
            {suite.file}
          </Link>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {rows.length} cases
          </span>
          <span className="flex w-24 items-center gap-1.5">
            <span className="font-mono text-[11px] tabular-nums text-foreground">
              {formatPercent(passRate, 0)}
            </span>
            <Progress
              value={passRate * 100}
              tone={passRate >= 0.9 ? "success" : passRate >= 0.6 ? "warning" : "error"}
              aria-label={`${suite?.name ?? suiteId} pass rate`}
            />
          </span>
        </div>
      </div>

      <CollapsibleContent className="pt-2">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          onRowClick={onRowClick}
          selectedKey={selectedKey}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={onSortChange}
          testId={`cases-table-${suiteId}`}
          virtualize={rows.length > 100}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function CasesPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState rows={8} />
        </div>
      }
    >
      <CasesScreen />
    </Suspense>
  );
}

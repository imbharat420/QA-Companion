"use client";

import { memo, useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Accessibility,
  ArrowLeft,
  Bot,
  Bug,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  FileCode2,
  GitBranch,
  Gauge,
  Loader,
  Minus,
  RotateCw,
  Timer,
  TriangleAlert,
  User,
  Wrench,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { ChartCard, CHART_CARD_HEIGHT } from "@/components/charts";
import {
  ConfirmDialog,
  EmptyState,
  SeverityBadge,
  StatGrid,
  StatTile,
  StatusBadge,
  toneTextClass,
} from "@/components/shared";
import { useCases, useFindings, useFlakyTests, useStartRun } from "@/lib/queries";
import { cn, formatRelative } from "@/lib/utils";
import { useUiStore } from "@/store";
import { routes } from "@/config/nav";
import { FlakyPanel } from "./FlakyPanel";
import type { Severity, TestRun, TestStatus, Tone } from "@/lib/api/types";

/** Recharts is ~90kB — the failure analysis must paint without waiting for it. */
const DonutChart = dynamic(
  () => import("@/components/charts").then((m) => ({ default: m.DonutChart })),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

const TEST_ICON: Record<TestStatus, LucideIcon> = {
  passed: CircleCheck,
  failed: CircleX,
  flaky: TriangleAlert,
  skipped: Minus,
  running: Loader,
  pending: Circle,
};

const TEST_ICON_CLASS: Record<TestStatus, string> = {
  passed: "text-success",
  failed: "text-error",
  flaky: "text-waiting",
  skipped: "text-subtle-foreground",
  running: "text-executing",
  pending: "text-muted-foreground",
};

/** `RunGroup.tone` is a palette name; the group cards also want a severity read. */
const TONE_SEVERITY: Record<Tone, Severity> = {
  red: "critical",
  amber: "high",
  cyan: "medium",
  violet: "medium",
  green: "low",
  neutral: "low",
};

const OUTCOMES = [
  { key: "passed", label: "Passed", tone: "green" as Tone, bar: "bg-success", text: "text-success" },
  { key: "failed", label: "Failed", tone: "red" as Tone, bar: "bg-error", text: "text-error" },
  { key: "flaky", label: "Flaky", tone: "amber" as Tone, bar: "bg-waiting", text: "text-waiting" },
  { key: "skipped", label: "Skipped", tone: "neutral" as Tone, bar: "bg-idle", text: "text-muted-foreground" },
] as const;

const SPEC_CHIPS = ["all", "passed", "failed", "flaky", "skipped"] as const;
type SpecChip = (typeof SPEC_CHIPS)[number];

const TABS = ["summary", "specs", "flaky"] as const;
type RunTab = (typeof TABS)[number];

const isTab = (value: string | null): value is RunTab =>
  value !== null && (TABS as readonly string[]).includes(value);

/* --------------------------------------------------------------------------
   SPEC TEST -> TEST CASE

   Run specs record the test title as the runner printed it ("payment with
   valid card"); the catalog stores the authored title ("payment with a valid
   card completes"). Comparing article-stripped token prefixes inside the same
   spec file links the two without inventing an id that is not in the data.
   ------------------------------------------------------------------------ */

const ARTICLES = new Set(["a", "an", "the"]);

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((word) => word.length > 0 && !ARTICLES.has(word));
}

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

const isPrefix = (short: string[], long: string[]) =>
  short.length > 0 && short.length <= long.length && short.every((word, i) => word === long[i]);

/* ==========================================================================
   SPEC TEST ROW
   ======================================================================== */

interface SpecTestRowProps {
  name: string;
  status: TestStatus;
  caseId: string | null;
  findingId: string | null;
  runId: string;
  onOpenCockpit: (findingId: string) => void;
}

const SpecTestRow = memo(function SpecTestRow({
  name,
  status,
  caseId,
  findingId,
  runId,
  onOpenCockpit,
}: SpecTestRowProps) {
  const Icon = TEST_ICON[status];
  const testId = `run-spec-test-${name.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div
      data-testid={testId}
      data-status={status}
      className="flex items-center gap-2 border-t border-border/40 py-1.5 pl-9 pr-3"
    >
      <Icon
        className={cn("size-3.5 shrink-0", TEST_ICON_CLASS[status], status === "running" && "animate-spin")}
        aria-hidden
      />
      <span className="sr-only">{status}</span>

      {findingId ? (
        <button
          type="button"
          onClick={() => onOpenCockpit(findingId)}
          data-testid={`${testId}-cockpit`}
          className="min-w-0 flex-1 truncate text-left text-xs text-foreground underline-offset-2 hover:text-primary hover:underline"
        >
          {name}
        </button>
      ) : caseId ? (
        <Link
          href={routes.cases({ caseId })}
          data-testid={`${testId}-case`}
          className="min-w-0 flex-1 truncate text-xs text-foreground hover:text-primary"
        >
          {name}
        </Link>
      ) : status === "failed" ? (
        <Link
          href={routes.findings({ runId })}
          data-testid={`${testId}-findings`}
          className="min-w-0 flex-1 truncate text-xs text-foreground hover:text-primary"
        >
          {name}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{name}</span>
      )}

      {findingId ? (
        <Badge variant="error" size="xs" className="shrink-0">
          <Wrench className="size-2.5" aria-hidden />
          {findingId}
        </Badge>
      ) : null}
    </div>
  );
});

/* ==========================================================================
   RUN DETAIL
   ======================================================================== */

export interface RunDetailProps {
  run: TestRun;
  /** The list route with the current filters, minus `?run=` — always resolvable. */
  backHref: string;
}

export function RunDetail({ run, backHref }: RunDetailProps) {
  const router = useRouter();
  const params = useSearchParams();
  const openCockpit = useUiStore((s) => s.openCockpit);
  const startRun = useStartRun();

  const urlTab = params.get("tab");
  const tab: RunTab = isTab(urlTab) ? urlTab : "summary";

  const [chip, setChip] = useState<SpecChip>("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const findingsQuery = useFindings({ runId: run.id });
  const casesQuery = useCases();
  const flakyQuery = useFlakyTests();

  const total = run.passed + run.failed + run.flaky + run.skipped;

  /* --- cross-link resolution -------------------------------------------- */

  /** `${file}::${test}` -> the case it maps to, resolved once per data change. */
  const caseByTest = useMemo(() => {
    const cases = casesQuery.data?.items ?? [];
    const catalog = cases.map((testCase) => ({
      id: testCase.id,
      file: baseName(testCase.file),
      words: tokens(testCase.title),
    }));

    const map = new Map<string, string>();
    for (const spec of run.specs) {
      const file = baseName(spec.file);
      for (const test of spec.tests) {
        const words = tokens(test.name);
        const hit = catalog.find(
          (entry) =>
            entry.file === file && (isPrefix(words, entry.words) || isPrefix(entry.words, words)),
        );
        if (hit) map.set(`${spec.file}::${test.name}`, hit.id);
      }
    }
    return map;
  }, [casesQuery.data, run.specs]);

  /** caseId -> the finding this run opened against it, so a row can open the cockpit. */
  const findingByCase = useMemo(() => {
    const map = new Map<string, string>();
    for (const finding of findingsQuery.data?.items ?? []) {
      if (finding.caseId && !map.has(finding.caseId)) map.set(finding.caseId, finding.id);
    }
    return map;
  }, [findingsQuery.data]);

  const findings = findingsQuery.data?.items ?? [];

  /* --- specs ------------------------------------------------------------- */

  const specCounts = useMemo(() => {
    const counts: Record<SpecChip, number> = { all: 0, passed: 0, failed: 0, flaky: 0, skipped: 0 };
    for (const spec of run.specs) {
      for (const test of spec.tests) {
        counts.all += 1;
        if (test.status in counts) counts[test.status as SpecChip] += 1;
      }
    }
    return counts;
  }, [run.specs]);

  const visibleSpecs = useMemo(
    () =>
      run.specs
        .map((spec) => ({
          file: spec.file,
          tests: chip === "all" ? spec.tests : spec.tests.filter((test) => test.status === chip),
        }))
        .filter((spec) => spec.tests.length > 0),
    [chip, run.specs],
  );

  const visibleTestCount = visibleSpecs.reduce((sum, spec) => sum + spec.tests.length, 0);

  const toggleFile = useCallback((file: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }, []);

  const collapseAll = useCallback(
    () => setCollapsed(new Set(run.specs.map((spec) => spec.file))),
    [run.specs],
  );
  const expandAll = useCallback(() => setCollapsed(new Set()), []);

  /* --- actions ----------------------------------------------------------- */

  const detailHref = useCallback(
    (nextTab: RunTab) =>
      // `routes.run` models the run param only; `tab` is this view's own state,
      // appended to the builder's URL rather than a hand-written path.
      nextTab === "summary" ? routes.run(run.id) : `${routes.run(run.id)}&tab=${nextTab}`,
    [run.id],
  );

  const onTabChange = useCallback(
    (value: string) => {
      if (isTab(value)) router.replace(detailHref(value));
    },
    [detailHref, router],
  );

  const rerun = useCallback(() => {
    startRun.mutate(
      { projectId: run.projectId },
      { onSuccess: (created) => router.push(routes.run(created.id)) },
    );
  }, [router, run.projectId, startRun]);

  const onOpenCockpit = useCallback((findingId: string) => openCockpit(findingId), [openCockpit]);

  /* --- derived view data -------------------------------------------------- */

  const donutData = useMemo(
    () =>
      OUTCOMES.map((outcome) => ({
        name: outcome.label,
        value: run[outcome.key],
        tone: outcome.tone,
      })).filter((slice) => slice.value > 0),
    [run],
  );

  const passRate = total === 0 ? 0 : Math.round((run.passed / total) * 100);
  const isA11yRun = Boolean(run.engine?.includes("axe"));

  return (
    <div className="flex flex-col gap-4" data-testid="run-detail">
      {/* BACK + HEADER --------------------------------------------------- */}
      <div>
        <Button variant="ghost" size="xs" asChild data-testid="run-detail-back">
          <Link href={backHref}>
            <ArrowLeft className="size-3.5" aria-hidden />
            All runs
          </Link>
        </Button>
      </div>

      <Card data-testid="run-detail-header">
        <CardHeader className="flex-wrap">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-semibold leading-tight">{run.name}</h2>
              <span className="font-mono text-xs text-muted-foreground">{run.id}</span>
              <StatusBadge status={run.status ?? "pending"} />
            </div>
            {run.commitMessage ? (
              <CardDescription className="truncate">{run.commitMessage}</CardDescription>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setConfirmOpen(true)}
              loading={startRun.isPending}
              data-testid="run-detail-rerun"
            >
              <RotateCw className="size-3.5" aria-hidden />
              Re-run
            </Button>
            <Button variant="outline" size="sm" asChild data-testid="run-detail-workbench">
              <Link href={routes.workbench()}>
                <Bot className="size-3.5" aria-hidden />
                Open in workbench
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild data-testid="run-detail-findings">
              <Link href={routes.findings({ runId: run.id })}>
                <Bug className="size-3.5" aria-hidden />
                View findings
                {findings.length > 0 ? (
                  <Badge variant="error" size="xs">
                    {findings.length}
                  </Badge>
                ) : null}
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {/* META CHIPS */}
          <div
            data-testid="run-detail-meta"
            className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground"
          >
            {run.projectId ? (
              <Link
                href={routes.project(run.projectId)}
                data-testid="run-detail-branch"
                className="inline-flex items-center gap-1.5 font-mono hover:text-foreground"
              >
                <GitBranch className="size-3" aria-hidden />
                {run.branch}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono">
                <GitBranch className="size-3" aria-hidden />
                {run.branch}
              </span>
            )}
            {run.trigger ? (
              <span className="inline-flex items-center gap-1.5">
                <Zap className="size-3" aria-hidden />
                {run.trigger}
              </span>
            ) : null}
            {run.engine ? (
              <span className="inline-flex items-center gap-1.5 font-mono">
                <FileCode2 className="size-3" aria-hidden />
                {run.engine}
              </span>
            ) : null}
            {run.author ? (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-3" aria-hidden />
                {run.author}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="size-3" aria-hidden />
              {run.startedAt ? formatRelative(run.startedAt) : run.when}
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono">
              <Timer className="size-3" aria-hidden />
              {run.duration}
            </span>
          </div>

          {/* RESULT SUMMARY BAR */}
          <div data-testid="run-detail-summary-bar" className="flex flex-col gap-2">
            <div
              role="img"
              aria-label={`${run.passed} passed, ${run.failed} failed, ${run.flaky} flaky, ${run.skipped} skipped of ${total}`}
              className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              {OUTCOMES.filter((outcome) => run[outcome.key] > 0).map((outcome) => (
                <div
                  key={outcome.key}
                  className={outcome.bar}
                  style={{ width: `${(run[outcome.key] / Math.max(1, total)) * 100}%` }}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
              {OUTCOMES.map((outcome) => (
                <span
                  key={outcome.key}
                  data-testid={`run-detail-count-${outcome.key}`}
                  className="inline-flex items-center gap-1.5"
                >
                  <span aria-hidden className={cn("size-2 rounded-full", outcome.bar)} />
                  <span className="text-muted-foreground">{outcome.label}</span>
                  <span className={cn("font-mono font-semibold tabular-nums", outcome.text)}>
                    {run[outcome.key]}
                  </span>
                </span>
              ))}
              <span className="ml-auto font-mono tabular-nums text-muted-foreground">
                {passRate}% pass · {total} tests
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABS -------------------------------------------------------------- */}
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList data-testid="run-detail-tabs">
          <TabsTrigger value="summary" data-testid="run-detail-tab-summary">
            Summary
          </TabsTrigger>
          <TabsTrigger value="specs" data-testid="run-detail-tab-specs">
            Specs
            <Badge variant="muted" size="xs">
              {specCounts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="flaky" data-testid="run-detail-tab-flaky">
            Flaky
          </TabsTrigger>
        </TabsList>

        {/* SUMMARY --------------------------------------------------------- */}
        <TabsContent value="summary" className="flex flex-col gap-4">
          <StatGrid columns={4}>
            {OUTCOMES.map((outcome) => (
              <StatTile
                key={outcome.key}
                label={outcome.label}
                value={run[outcome.key]}
                tone={
                  outcome.key === "passed"
                    ? "success"
                    : outcome.key === "failed"
                      ? "error"
                      : outcome.key === "flaky"
                        ? "warning"
                        : "neutral"
                }
                hint={`${outcome.label} in ${run.id}`}
                href={outcome.key === "failed" ? routes.findings({ runId: run.id }) : undefined}
                testId={`run-detail-stat-${outcome.key}`}
              />
            ))}
          </StatGrid>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            {/* FAILURE ANALYSIS — the point of the page. */}
            <section aria-labelledby="run-failure-analysis" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id="run-failure-analysis" className="label-mono flex items-center gap-2">
                  <Wrench className="size-3.5 text-accent" aria-hidden />
                  Failure analysis
                </h3>
                {run.groups.length > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    {run.failed} failures grouped into {run.groups.length} root causes
                  </span>
                ) : null}
              </div>

              {run.groups.length === 0 ? (
                <Card data-testid="run-detail-groups-empty">
                  <CardContent className="pt-4">
                    <EmptyState
                      icon={Wrench}
                      title="No root-cause grouping for this run"
                      description="The agent groups failures when it has a per-spec breakdown to reason over. Open the findings this run produced instead."
                      action={
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={routes.findings({ runId: run.id })}
                            data-testid="run-detail-groups-empty-findings"
                          >
                            View findings from {run.id}
                          </Link>
                        </Button>
                      }
                      testId="run-detail-groups-empty-state"
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
                  {run.groups.map((group) => (
                    // A plain div, not <Card>: the tone tint is a `bg-current`
                    // utility and `.surface-card` sets its own background in the
                    // same layer, so the two would race.
                    <div
                      key={group.title}
                      data-testid={`run-group-${group.title.toLowerCase().replace(/\s+/g, "-")}`}
                      className={cn(
                        "flex flex-col gap-2 rounded-[var(--radius-lg)] border border-current/25 bg-current/10 p-3.5",
                        toneTextClass(group.tone),
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-display text-sm font-semibold text-foreground">
                          {group.title}
                        </h4>
                        <SeverityBadge severity={TONE_SEVERITY[group.tone]} size="xs" />
                      </div>
                      <span className="font-display text-[32px] font-semibold leading-none tabular-nums">
                        {group.count}
                      </span>
                      <span className="label-mono">failures</span>
                      <hr className="border-current/20" />
                      <p className="text-[11px] leading-snug text-muted-foreground">{group.desc}</p>
                      <Button variant="ghost" size="xs" asChild className="self-start">
                        <Link
                          href={routes.findings({ runId: run.id })}
                          data-testid={`run-group-findings-${group.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <Bug className="size-3" aria-hidden />
                          Findings
                          <ChevronRight className="size-3" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SPLIT + RELATED ------------------------------------------- */}
            <div className="flex flex-col gap-3">
              <ChartCard
                title="Outcome split"
                description={`${total} tests`}
                height={CHART_CARD_HEIGHT}
                testId="run-detail-donut-card"
              >
                {donutData.length > 0 ? (
                  <DonutChart
                    data={donutData}
                    centerValue={`${passRate}%`}
                    centerLabel="pass"
                    height={CHART_CARD_HEIGHT}
                    testId="run-detail-donut"
                  />
                ) : (
                  <div className="grid size-full place-items-center text-[11px] text-muted-foreground">
                    This run recorded no test outcomes.
                  </div>
                )}
              </ChartCard>

              <Card data-testid="run-detail-related">
                <CardHeader className="pb-2">
                  <h3 className="label-mono">Related</h3>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5">
                  <Button variant="ghost" size="sm" asChild className="justify-start">
                    <Link
                      href={routes.findings({ runId: run.id })}
                      data-testid="run-detail-related-findings"
                    >
                      <Bug className="size-3.5" aria-hidden />
                      Findings from this run
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="justify-start">
                    <Link href={routes.visual()} data-testid="run-detail-related-visual">
                      <Eye className="size-3.5" aria-hidden />
                      Visual diffs
                    </Link>
                  </Button>
                  {isA11yRun ? (
                    <Button variant="ghost" size="sm" asChild className="justify-start">
                      <Link href={routes.accessibility()} data-testid="run-detail-related-a11y">
                        <Accessibility className="size-3.5" aria-hidden />
                        Accessibility violations
                      </Link>
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" asChild className="justify-start">
                    <Link href={routes.performance()} data-testid="run-detail-related-perf">
                      <Gauge className="size-3.5" aria-hidden />
                      Performance
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="justify-start">
                    <Link href={routes.cases()} data-testid="run-detail-related-cases">
                      <FileCode2 className="size-3.5" aria-hidden />
                      Test cases
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* SPECS ------------------------------------------------------------ */}
        <TabsContent value="specs" className="flex flex-col gap-3">
          {run.specs.length === 0 ? (
            <Card>
              <CardContent className="pt-4">
                <EmptyState
                  icon={FileCode2}
                  title="No per-spec breakdown was uploaded for this run"
                  description="Only the aggregate counts were reported. The summary tab has everything this run recorded."
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid="run-detail-specs-empty-summary"
                    >
                      <Link href={detailHref("summary")}>Back to summary</Link>
                    </Button>
                  }
                  testId="run-detail-specs-empty"
                />
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {SPEC_CHIPS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChip(value)}
                      aria-pressed={chip === value}
                      data-testid={`run-spec-chip-${value}`}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
                        "font-mono text-[10px] uppercase tracking-[0.04em] transition-colors",
                        chip === value
                          ? "border-primary/50 bg-primary/15 text-foreground"
                          : "border-border bg-elevated text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {value}
                      <span className="tabular-nums text-subtle-foreground">
                        {specCounts[value]}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    Showing {visibleTestCount} tests in {visibleSpecs.length} spec files
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={expandAll}
                    data-testid="run-specs-expand-all"
                  >
                    Expand all
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={collapseAll}
                    data-testid="run-specs-collapse-all"
                  >
                    Collapse all
                  </Button>
                </div>
              </div>

              {visibleSpecs.length === 0 ? (
                <Card>
                  <CardContent className="pt-4">
                    <EmptyState
                      icon={FileCode2}
                      title={`No ${chip} tests in this run`}
                      description="Pick another status chip to see the rest of the breakdown."
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setChip("all")}
                          data-testid="run-specs-chip-reset"
                        >
                          Show all tests
                        </Button>
                      }
                      testId="run-specs-filtered-empty"
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="cv-auto flex flex-col gap-2">
                  {visibleSpecs.map((spec) => {
                    const open = !collapsed.has(spec.file);
                    const failedCount = spec.tests.filter((t) => t.status === "failed").length;

                    return (
                      <Collapsible
                        key={spec.file}
                        open={open}
                        onOpenChange={() => toggleFile(spec.file)}
                        className="overflow-hidden rounded-[var(--radius-lg)] border border-border/70 bg-card"
                      >
                        <CollapsibleTrigger
                          data-testid={`run-spec-file-${spec.file}`}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                        >
                          <ChevronRight
                            className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
                            aria-hidden
                          />
                          <span className="text-code min-w-0 flex-1 truncate text-foreground">
                            {spec.file}
                          </span>
                          {failedCount > 0 ? (
                            <Badge variant="error" size="xs">
                              {failedCount} failed
                            </Badge>
                          ) : null}
                          <Badge variant="muted" size="xs">
                            {spec.tests.length}
                          </Badge>
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          {spec.tests.map((test) => {
                            const caseId = caseByTest.get(`${spec.file}::${test.name}`) ?? null;
                            return (
                              <SpecTestRow
                                key={test.name}
                                name={test.name}
                                status={test.status}
                                caseId={caseId}
                                findingId={
                                  test.status === "failed" && caseId
                                    ? (findingByCase.get(caseId) ?? null)
                                    : null
                                }
                                runId={run.id}
                                onOpenCockpit={onOpenCockpit}
                              />
                            );
                          })}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* FLAKY ------------------------------------------------------------ */}
        <TabsContent value="flaky">
          <FlakyPanel
            flaky={flakyQuery.data ?? []}
            isPending={flakyQuery.isPending}
            error={flakyQuery.error}
            onRetry={() => void flakyQuery.refetch()}
            testId="run-detail-flaky-panel"
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Re-run ${run.id}?`}
        description={`Queues a fresh execution of ${run.name} on ${run.branch}. The original run is kept.`}
        confirmLabel="Re-run"
        onConfirm={rerun}
        testId="run-detail-rerun-confirm"
      />
    </div>
  );
}

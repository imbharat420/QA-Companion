"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Bug,
  Camera,
  Check,
  CheckCheck,
  Eye,
  FileImage,
  LayoutGrid,
  List,
  Paintbrush,
  Play,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BaselineCard, CHANGE_KINDS, CHANGE_KIND_META, viewportLabel } from "@/components/quality/BaselineCard";
import { MaskEditor } from "@/components/quality/MaskEditor";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui";
import {
  ConfirmDialog,
  EmptyState,
  DataTable,
  ErrorState,
  FilterBar,
  ImageDiffSlider,
  LoadingState,
  PageHeader,
  StatGrid,
  StatTile,
  StatusBadge,
} from "@/components/shared";
import { ChartCard } from "@/components/charts";
import { routes } from "@/config/nav";
import { useApproveBaseline, useVisualBaselines, useVisualSummary } from "@/lib/queries";
import { useFiltersStore, useVisualFilters } from "@/store";
import { formatCompact, formatPercent, formatRelative, truncateMiddle } from "@/lib/utils";
import type { Column, ImageDiffSliderProps } from "@/components/shared";
import type { SeriesSpec } from "@/components/charts";
import type { VisualBaseline } from "@/lib/api/types";

/** Charts stay off the first-paint path — recharts is the heaviest import here. */
const BarSeriesChart = dynamic(
  () => import("@/components/charts/BarSeriesChart").then((m) => m.BarSeriesChart),
  { ssr: false, loading: () => <Skeleton className="size-full rounded-[var(--radius-md)]" /> },
);

const COMPARE_MODES = [
  { value: "diff", label: "Diff" },
  { value: "actual", label: "Actual" },
  { value: "expected", label: "Expected" },
  { value: "side-by-side", label: "Side by side" },
  { value: "slider", label: "Slider" },
] as const;

type CompareMode = (typeof COMPARE_MODES)[number]["value"];

const isCompareMode = (value: string): value is CompareMode =>
  COMPARE_MODES.some((entry) => entry.value === value);

const VIEWPORT_SERIES: SeriesSpec[] = [
  { key: "total", label: "Captured", tone: "muted" },
  { key: "changed", label: "Changed", tone: "warning" },
];

/**
 * The one baseline whose layout shift was also filed as a finding — the fixture
 * comment on `vis-001` names VIS-77, so the link is data, not decoration.
 */
const FINDING_BY_BASELINE: Record<string, string> = { "vis-001": "VIS-77" };

/** The suite that owns the visual specs; `VIS-77` carries the same id. */
const VISUAL_SUITE_ID = "st-6";

/**
 * The five contract modes over the three the shared slider implements: Actual
 * and Expected are single panes of one capture, which the slider renders by
 * being handed that capture with no diff map.
 */
function stageProps(
  baseline: VisualBaseline,
  mode: CompareMode,
): Omit<ImageDiffSliderProps, "alt"> {
  const { baselineSrc, actualSrc, diffSrc } = baseline;
  switch (mode) {
    case "diff":
      return { mode: "diff", baselineSrc, actualSrc, diffSrc };
    case "actual":
      return { mode: "diff", baselineSrc, actualSrc };
    case "expected":
      return { mode: "diff", baselineSrc, actualSrc: baselineSrc };
    case "side-by-side":
      return { mode: "side-by-side", baselineSrc, actualSrc, diffSrc };
    default:
      return { mode: "slider", baselineSrc, actualSrc, diffSrc };
  }
}

/** Module scope so the memoized table rows never see a new identity. */
const rowKey = (row: VisualBaseline) => row.id;

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="label-mono block text-[9px]">{label}</span>
      <span className="block truncate font-mono text-xs tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function VisualScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const bag = useVisualFilters();
  const setFilter = useFiltersStore((s) => s.setFilter);
  const resetFilters = useFiltersStore((s) => s.resetFilters);

  const baselineId = params.get("baseline") ?? "";
  const modeParam = params.get("mode") ?? "";
  const mode: CompareMode = isCompareMode(modeParam) ? modeParam : "slider";
  const view = params.get("view") === "list" ? "list" : "grid";

  // The URL is authoritative; the persisted bag is the fallback, so filters
  // survive a round trip through a detail view without an extra effect.
  const status = params.get("status") ?? bag.status;
  const viewport = params.get("viewport") ?? bag.viewport;
  const changeKind = params.get("change") ?? "all";
  const search = params.get("q") ?? bag.search;

  const [rejected, setRejected] = useState<readonly string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  /**
   * A detail view has to resolve any id, including one the current filters
   * exclude, so the compare stage reads the unfiltered set.
   */
  const query = useMemo(
    () =>
      baselineId
        ? undefined
        : {
            status: status === "all" ? undefined : status,
            viewport: viewport === "all" ? undefined : viewport,
            search: search || undefined,
          },
    [baselineId, status, viewport, search],
  );

  const baselines = useVisualBaselines(query);
  const summary = useVisualSummary();
  const { mutate: approveBaseline, mutateAsync: approveAsync, isPending: approving, variables: approvingId } =
    useApproveBaseline();

  const writeParams = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${routes.visual()}?${qs}` : routes.visual());
    },
    [params, router],
  );

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === "status") setFilter("visual", "status", value as VisualBaseline["status"] | "all");
      if (id === "viewport") setFilter("visual", "viewport", value);
      writeParams({ [id]: value });
    },
    [setFilter, writeParams],
  );

  // The StatTiles are the coarse version of the Status select: one click writes
  // the same param the FilterBar writes, so both routes stay in sync.
  const showAllStatuses = useCallback(() => onFilterChange("status", "all"), [onFilterChange]);
  const showChangedStatus = useCallback(() => onFilterChange("status", "changed"), [onFilterChange]);
  const showPendingStatus = useCallback(() => onFilterChange("status", "pending"), [onFilterChange]);
  const showApprovedStatus = useCallback(
    () => onFilterChange("status", "approved"),
    [onFilterChange],
  );

  const onSearchChange = useCallback(
    (value: string) => {
      setFilter("visual", "search", value);
      writeParams({ q: value });
    },
    [setFilter, writeParams],
  );

  const onViewChange = useCallback(
    (value: string) => {
      if (value) writeParams({ view: value === "grid" ? undefined : value });
    },
    [writeParams],
  );

  const onModeChange = useCallback(
    (value: string) => {
      if (isCompareMode(value)) writeParams({ mode: value === "slider" ? undefined : value });
    },
    [writeParams],
  );

  const clearFilters = useCallback(() => {
    resetFilters("visual");
    writeParams({ status: undefined, viewport: undefined, change: undefined, q: undefined });
  }, [resetFilters, writeParams]);

  const openBaseline = useCallback(
    (id: string) => router.push(routes.visual({ baselineId: id })),
    [router],
  );

  const openRow = useCallback((row: VisualBaseline) => openBaseline(row.id), [openBaseline]);

  const onApprove = useCallback(
    (id: string) => {
      approveBaseline(id, {
        onSuccess: (updated) => {
          toast.success(`New baseline approved — ${updated.name}`, {
            description: `${viewportLabel(updated.viewport)} · the actual capture is now the reference.`,
          });
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Could not approve that baseline");
        },
      });
    },
    [approveBaseline],
  );

  const onReject = useCallback((id: string) => {
    setRejected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    toast("Kept the current baseline", {
      description: "Nothing was written — the capture stays flagged so the diff can be fixed in code.",
    });
  }, []);

  const rows = useMemo(() => {
    const items = baselines.data?.items ?? [];
    // Change kind is a client-side facet: the DataSource filter has no field
    // for it, and re-querying per facet would cost a round trip per click.
    const faceted = changeKind === "all" ? items : items.filter((row) => row.changeKind === changeKind);
    // Grouped by name so one screen's viewports sit together, widest first.
    return faceted
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name) || b.viewport.width - a.viewport.width);
  }, [baselines.data, changeKind]);

  const selected = baselineId ? (baselines.data?.items.find((row) => row.id === baselineId) ?? null) : null;

  const changedIds = useMemo(
    () => rows.filter((row) => row.status === "changed").map((row) => row.id),
    [rows],
  );

  const approveAllChanged = useCallback(() => {
    const ids = changedIds;
    if (ids.length === 0) return;
    void Promise.all(ids.map((id) => approveAsync(id)))
      .then(() => {
        toast.success(`Approved ${ids.length} changed baselines`, {
          description: "Each actual capture is now its screen's reference.",
        });
      })
      .catch((error: unknown) => {
        toast.error(error instanceof Error ? error.message : "Bulk approval failed");
      });
  }, [approveAsync, changedIds]);

  const onSortChange = useCallback((id: string) => {
    setSortBy((current) => {
      if (current === id) {
        setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
        return id;
      }
      setSortDir("asc");
      return id;
    });
  }, []);

  const stats = summary.data;
  // The four review states partition the set, so "new" is what the other three
  // do not account for — the summary carries no explicit count for it.
  const newCount = stats ? Math.max(0, stats.total - stats.changed - stats.pending - stats.approved) : 0;

  const filters = useMemo(
    () => [
      {
        id: "status",
        label: "Status",
        value: status,
        options: [
          { value: "all", label: "All statuses", count: stats?.total },
          { value: "changed", label: "Changed", count: stats?.changed },
          { value: "pending", label: "Pending", count: stats?.pending },
          { value: "approved", label: "Approved", count: stats?.approved },
          { value: "new", label: "New", count: stats ? newCount : undefined },
        ],
      },
      {
        id: "viewport",
        label: "Viewport",
        value: viewport,
        options: [
          { value: "all", label: "All viewports", count: stats?.total },
          ...(stats?.byViewport ?? []).map((entry) => ({
            value: entry.viewport,
            label: entry.viewport,
            count: entry.total,
          })),
        ],
      },
      {
        id: "change",
        label: "Change kind",
        value: changeKind,
        options: [
          { value: "all", label: "All change kinds" },
          ...CHANGE_KINDS.map((kind) => ({ value: kind, label: CHANGE_KIND_META[kind].label })),
        ],
      },
    ],
    [changeKind, newCount, stats, status, viewport],
  );

  const columns = useMemo<Column<VisualBaseline>[]>(
    () => [
      {
        id: "baseline",
        header: "Baseline",
        width: "210px",
        sortValue: (row) => row.name,
        cell: (row) => (
          <Link
            href={routes.visual({ baselineId: row.id })}
            onClick={(event) => event.stopPropagation()}
            data-testid={`visual-table-name-${row.id}`}
            className="truncate font-medium text-foreground transition-colors hover:text-primary"
          >
            {row.name}
          </Link>
        ),
      },
      {
        id: "target",
        header: "Target",
        width: "220px",
        sortValue: (row) => row.target,
        cell: (row) => (
          <span className="text-code truncate text-muted-foreground" title={row.target}>
            {truncateMiddle(row.target, 40)}
          </span>
        ),
      },
      {
        id: "viewport",
        header: "Viewport",
        width: "160px",
        cell: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onFilterChange("viewport", viewportLabel(row.viewport));
            }}
            data-testid={`visual-table-viewport-${row.id}`}
            className="truncate font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {viewportLabel(row.viewport)}
          </button>
        ),
      },
      {
        id: "branch",
        header: "Branch",
        width: "140px",
        sortValue: (row) => row.branch,
        cell: (row) => <span className="text-code truncate text-muted-foreground">{row.branch}</span>,
      },
      {
        id: "status",
        header: "Status",
        width: "118px",
        sortValue: (row) => row.status,
        cell: (row) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onFilterChange("status", row.status);
            }}
            aria-label={`Filter by status ${row.status}`}
            data-testid={`visual-table-status-${row.id}`}
          >
            <StatusBadge status={row.status} size="xs" />
          </button>
        ),
      },
      {
        id: "diff",
        header: "Diff",
        width: "84px",
        align: "right",
        sortValue: (row) => row.diffPercent,
        cell: (row) => (
          <span
            className={
              row.diffPercent > row.threshold
                ? "font-mono tabular-nums text-waiting"
                : "font-mono tabular-nums text-muted-foreground"
            }
          >
            {formatPercent(row.diffPercent / 100)}
          </span>
        ),
      },
      {
        id: "pixels",
        header: "Pixels",
        width: "88px",
        align: "right",
        sortValue: (row) => row.pixelsChanged,
        cell: (row) => (
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatCompact(row.pixelsChanged)}
          </span>
        ),
      },
      {
        id: "change",
        header: "Change",
        width: "132px",
        sortValue: (row) => row.changeKind,
        cell: (row) => {
          const kind = CHANGE_KIND_META[row.changeKind];
          const KindIcon = kind.icon;
          return (
            <Badge variant={kind.variant} size="xs" className={kind.badgeClass} title={kind.hint}>
              <KindIcon className="size-2.5" aria-hidden />
              {kind.label}
            </Badge>
          );
        },
      },
      {
        id: "threshold",
        header: "Threshold",
        width: "92px",
        align: "right",
        sortValue: (row) => row.threshold,
        cell: (row) => (
          <span className="font-mono tabular-nums text-muted-foreground">
            {formatPercent(row.threshold / 100, 2)}
          </span>
        ),
      },
      {
        id: "run",
        header: "Run",
        width: "88px",
        cell: (row) =>
          row.runId ? (
            <Link
              href={routes.run(row.runId)}
              onClick={(event) => event.stopPropagation()}
              data-testid={`visual-table-run-${row.id}`}
              className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary"
            >
              {row.runId}
            </Link>
          ) : (
            <span className="text-subtle-foreground">—</span>
          ),
      },
      {
        id: "updated",
        header: "Updated",
        width: "112px",
        sortValue: (row) => row.updatedAt,
        cell: (row) => (
          <span className="truncate text-[11px] text-muted-foreground">{formatRelative(row.updatedAt)}</span>
        ),
      },
    ],
    [onFilterChange],
  );

  const hasFilters =
    status !== "all" || viewport !== "all" || changeKind !== "all" || search.length > 0;

  const recapture = (
    <Button variant="outline" asChild data-testid="visual-recapture">
      <Link href={routes.workbench()}>
        <Camera className="size-3.5" aria-hidden />
        Re-capture
      </Link>
    </Button>
  );

  /* ---------------------------------------------------------------- detail */

  if (baselineId) {
    const alt = selected ? `${selected.name} at ${viewportLabel(selected.viewport)}` : baselineId;
    const kind = selected ? CHANGE_KIND_META[selected.changeKind] : null;
    const KindIcon = kind?.icon;
    const findingId = FINDING_BY_BASELINE[baselineId];

    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-6">
        <PageHeader
          title={selected?.name ?? "Baseline"}
          description={selected?.target}
          icon={Eye}
          breadcrumbs={[{ label: "Visual", href: routes.visual() }, { label: selected?.name ?? baselineId }]}
          actions={
            <>
              {recapture}
              <Button variant="ghost" asChild data-testid="visual-back-all">
                <Link href={routes.visual()}>
                  <ArrowLeft className="size-3.5" aria-hidden />
                  All baselines
                </Link>
              </Button>
            </>
          }
        />

        {baselines.isError ? (
          <ErrorState
            error={baselines.error}
            onRetry={() => void baselines.refetch()}
            testId="visual-detail-error"
          />
        ) : baselines.isPending ? (
          <section aria-label="Compare stage loading" className="flex flex-col gap-3">
            <Tabs value={mode} onValueChange={onModeChange} className="items-center">
              <TabsList data-testid="visual-mode-tabs">
                {COMPARE_MODES.map((entry) => (
                  <TabsTrigger
                    key={entry.value}
                    value={entry.value}
                    data-testid={`visual-mode-${entry.value}`}
                  >
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Skeleton className="aspect-[16/10] w-full rounded-[var(--radius-md)]" />
            <LoadingState rows={4} variant="panel" />
          </section>
        ) : !selected || !kind ? (
          <EmptyState
            icon={FileImage}
            title="Baseline not found in this data source"
            description={`No baseline with id "${baselineId}" exists under the active adapter. It may belong to another project or a different API mode.`}
            action={
              <Button variant="outline" asChild data-testid="visual-notfound-back">
                <Link href={routes.visual()}>
                  <ArrowLeft className="size-3.5" aria-hidden />
                  All baselines
                </Link>
              </Button>
            }
            testId="visual-detail-empty"
          />
        ) : (
          <>
            <Card data-testid="visual-detail-header">
              <CardContent className="flex flex-col gap-3 pt-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={selected.status} />
                  <Badge variant={kind.variant} size="sm" className={kind.badgeClass} title={kind.hint}>
                    {KindIcon ? <KindIcon className="size-3" aria-hidden /> : null}
                    {kind.label}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {viewportLabel(selected.viewport)}
                  </Badge>
                  {rejected.includes(selected.id) ? (
                    <Badge variant="muted" size="sm" data-testid="visual-detail-rejected">
                      Kept baseline
                    </Badge>
                  ) : null}
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">{kind.hint}</p>

                <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3 sm:grid-cols-3 lg:grid-cols-6">
                  <MetaCell label="Diff" value={formatPercent(selected.diffPercent / 100)} />
                  <MetaCell label="Pixels changed" value={formatCompact(selected.pixelsChanged)} />
                  <MetaCell
                    label="Threshold"
                    value={
                      <Link
                        href={routes.settings({ tab: "browser" })}
                        data-testid="visual-threshold-hint"
                        className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                      >
                        <Settings className="size-3" aria-hidden />
                        {formatPercent(selected.threshold / 100, 2)}
                      </Link>
                    }
                  />
                  <MetaCell label="Branch" value={selected.branch} />
                  <MetaCell label="Change kind" value={selected.changeKind} />
                  <MetaCell label="Updated" value={formatRelative(selected.updatedAt)} />
                </div>
              </CardContent>
            </Card>

            <section aria-label="Compare stage" className="flex flex-col items-center gap-3">
              <Tabs value={mode} onValueChange={onModeChange} className="w-full items-center">
                <TabsList data-testid="visual-mode-tabs">
                  {COMPARE_MODES.map((entry) => (
                    <TabsTrigger
                      key={entry.value}
                      value={entry.value}
                      data-testid={`visual-mode-${entry.value}`}
                    >
                      {entry.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {COMPARE_MODES.map((entry) => (
                  <TabsContent key={entry.value} value={entry.value} className="w-full">
                    <p className="label-mono pb-1.5 text-center text-[9px]">
                      Showing {entry.label} · {selected.branch}
                    </p>
                    <ImageDiffSlider {...stageProps(selected, entry.value)} alt={alt} />
                  </TabsContent>
                ))}
              </Tabs>
            </section>

            <MaskEditor key={selected.id} baseline={selected} />

            <section
              aria-label="Baseline actions"
              className="surface-card flex flex-wrap items-center gap-2 p-3"
            >
              <Button
                variant="primary"
                size="lg"
                onClick={() => onApprove(selected.id)}
                loading={approving && approvingId === selected.id}
                disabled={selected.status === "approved" || rejected.includes(selected.id)}
                data-testid="visual-detail-approve"
              >
                <Check className="size-4" aria-hidden />
                Approve new baseline
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => onReject(selected.id)}
                disabled={selected.status === "approved" || rejected.includes(selected.id)}
                data-testid="visual-detail-reject"
              >
                <X className="size-4" aria-hidden />
                Reject
              </Button>

              <span aria-hidden className="mx-1 h-6 w-px bg-border" />

              {selected.runId ? (
                <Button variant="ghost" asChild data-testid="visual-detail-run">
                  <Link href={routes.run(selected.runId)}>
                    <Play className="size-3.5" aria-hidden />
                    Open run {selected.runId}
                  </Link>
                </Button>
              ) : null}
              {findingId ? (
                <Button variant="ghost" asChild data-testid="visual-detail-finding">
                  <Link href={routes.finding(findingId)}>
                    <Bug className="size-3.5" aria-hidden />
                    Open finding {findingId}
                  </Link>
                </Button>
              ) : null}
              {selected.status === "changed" ? (
                <Button variant="ghost" asChild data-testid="visual-detail-findings">
                  <Link href={routes.findings({ category: "visual" })}>
                    <Bug className="size-3.5" aria-hidden />
                    Visual findings
                  </Link>
                </Button>
              ) : null}
              <Button variant="ghost" asChild data-testid="visual-detail-cases">
                <Link href={routes.cases({ suiteId: VISUAL_SUITE_ID })}>
                  <SlidersHorizontal className="size-3.5" aria-hidden />
                  Related cases
                </Link>
              </Button>
            </section>
          </>
        )}
      </div>
    );
  }

  /* ------------------------------------------------------------------ list */

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-6">
      <PageHeader
        title="Visual"
        description="Baseline versus actual: which screenshots changed, whether they moved or repainted, and what becomes the new reference."
        icon={Eye}
        actions={
          <>
            {recapture}
            <Button
              variant="primary"
              onClick={() => setBulkOpen(true)}
              disabled={changedIds.length === 0 || approving}
              data-testid="visual-approve-all"
            >
              <CheckCheck className="size-3.5" aria-hidden />
              Approve all changed
            </Button>
          </>
        }
        meta={
          stats ? (
            <>
              <span data-testid="visual-meta-total">
                <strong className="font-mono text-foreground">{stats.total}</strong> baselines
              </span>
              <span>
                <strong className="font-mono text-waiting">{stats.changed}</strong> changed
              </span>
              <span>
                <strong className="font-mono text-foreground">{stats.pending}</strong> pending
              </span>
              <span>
                <strong className="font-mono text-success">{stats.approved}</strong> approved
              </span>
              <Link
                href={routes.settings({ tab: "browser" })}
                data-testid="visual-threshold-settings"
                className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
              >
                <Settings className="size-3" aria-hidden />
                Diff thresholds
              </Link>
            </>
          ) : null
        }
      />

      {summary.isError ? (
        <ErrorState
          error={summary.error}
          onRetry={() => void summary.refetch()}
          testId="visual-summary-error"
        />
      ) : (
        <>
          <StatGrid columns={4}>
            {stats ? (
              <>
                <StatTile
                  label="Total baselines"
                  value={formatCompact(stats.total)}
                  tone="primary"
                  icon={FileImage}
                  hint="Show every status"
                  onClick={showAllStatuses}
                  testId="visual-stat-total"
                />
                <StatTile
                  label="Changed"
                  value={formatCompact(stats.changed)}
                  tone="warning"
                  icon={Paintbrush}
                  hint="Needs a decision"
                  onClick={showChangedStatus}
                  testId="visual-stat-changed"
                />
                <StatTile
                  label="Pending"
                  value={formatCompact(stats.pending)}
                  tone="accent"
                  icon={Eye}
                  hint="Captured, not reviewed"
                  onClick={showPendingStatus}
                  testId="visual-stat-pending"
                />
                <StatTile
                  label="Approved"
                  value={formatCompact(stats.approved)}
                  tone="success"
                  icon={Check}
                  hint="Current reference"
                  onClick={showApprovedStatus}
                  testId="visual-stat-approved"
                />
              </>
            ) : (
              Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-[104px] rounded-[var(--radius-lg)]" />
              ))
            )}
          </StatGrid>

          <ChartCard
            title="Changed vs captured by viewport"
            description="A viewport that changes alone points at a breakpoint, not a component."
            testId="visual-viewport-chart"
          >
            {stats ? (
              <BarSeriesChart
                data={stats.byViewport}
                xKey="viewport"
                series={VIEWPORT_SERIES}
                showLegend
                testId="visual-viewport-bars"
              />
            ) : (
              <Skeleton className="size-full rounded-[var(--radius-md)]" />
            )}
          </ChartCard>
        </>
      )}

      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search baselines and targets"
        filters={filters}
        onFilterChange={onFilterChange}
        right={
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={onViewChange}
            aria-label="Baseline view mode"
          >
            <ToggleGroupItem value="grid" aria-label="Grid view" data-testid="visual-view-grid">
              <LayoutGrid aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" data-testid="visual-view-list">
              <List aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        }
        testId="visual-filters"
      />

      <section aria-label="Baselines" className="cv-auto">
        {baselines.isError ? (
          <ErrorState
            error={baselines.error}
            onRetry={() => void baselines.refetch()}
            testId="visual-list-error"
          />
        ) : baselines.isPending ? (
          <LoadingState rows={8} variant={view === "grid" ? "cards" : "table"} />
        ) : rows.length === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={FileImage}
              title="No baselines match these filters"
              description="Widen the status, viewport or change-kind filter to see the rest of the set."
              action={
                <Button variant="outline" onClick={clearFilters} data-testid="visual-clear-filters">
                  <X className="size-3.5" aria-hidden />
                  Clear filters
                </Button>
              }
              testId="visual-empty-filtered"
            />
          ) : (
            <EmptyState
              icon={Camera}
              title="No baselines captured yet"
              description="Run a visual sweep from the workbench to capture the first reference set for this project."
              action={recapture}
              testId="visual-empty"
            />
          )
        ) : view === "grid" ? (
          <div
            data-testid="visual-grid"
            className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(288px,1fr))]"
          >
            {rows.map((row) => (
              <BaselineCard
                key={row.id}
                baseline={row}
                rejected={rejected.includes(row.id)}
                approving={approving && approvingId === row.id}
                onOpen={openBaseline}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        ) : (
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={rowKey}
            onRowClick={openRow}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={onSortChange}
            stickyHeader
            testId="visual-table"
          />
        )}
      </section>

      <ConfirmDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title={`Approve ${changedIds.length} changed baselines?`}
        description="Every changed capture becomes its screen's new reference in one step. The previous references are replaced and the individual approvals are not recorded separately, so a real regression hidden in this batch will stop being reported."
        confirmLabel={`Approve ${changedIds.length}`}
        destructive
        onConfirm={approveAllChanged}
        testId="visual-approve-all-confirm"
      />
    </div>
  );
}

export default function VisualPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState rows={8} />
        </div>
      }
    >
      <VisualScreen />
    </Suspense>
  );
}

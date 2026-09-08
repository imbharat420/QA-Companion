"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bug,
  FolderKanban,
  FolderTree,
  LayoutGrid,
  List,
  ListChecks,
  PanelLeft,
  PlayCircle,
  Plus,
  Star,
  Target,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  ProjectCard,
  ProjectDetail,
  ProjectSidebar,
  UploadDropzone,
  isQuickView,
  type QuickView,
} from "@/components/projects";
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Skeleton,
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
  ScoreRing,
  StatGrid,
  StatTile,
  StatusBadge,
} from "@/components/shared";
import { routes } from "@/config/nav";
import { WORKSPACE_STATES } from "@/lib/fixtures";
import {
  useCreateProject,
  useDashboardSummary,
  useProjectFolders,
  useProjects,
  useToggleProjectStar,
} from "@/lib/queries";
import {
  useGroupByFolder,
  useProjectSortBy,
  useProjectViewMode,
  useProjectsStore,
  useRecentProjectIds,
  useStarredOverrides,
  useUploadQueue,
} from "@/store";
import { cn, formatCompact, formatPercent, truncateMiddle } from "@/lib/utils";
import type { Column } from "@/components/shared";
import type { ProjectSortBy, ProjectViewMode } from "@/store";
import type { Workspace, WorkspaceState } from "@/lib/api/types";

const SORT_OPTIONS: { value: ProjectSortBy; label: string }[] = [
  { value: "recent", label: "Recent" },
  { value: "name", label: "Name" },
  { value: "health", label: "Health" },
  { value: "tests", label: "Tests" },
];

const isSortBy = (value: string): value is ProjectSortBy =>
  SORT_OPTIONS.some((option) => option.value === value);

/**
 * `lastActive` is prose ("4 days ago"), not a timestamp — the adapter has no
 * epoch for it. Parsing the phrase is what makes "Recent" a real ordering
 * instead of fixture order.
 *
 * ponytail: naive unit table; swap for a real `lastActiveAt` when the API grows one.
 */
const UNIT_MINUTES: Record<string, number> = {
  sec: 1 / 60,
  min: 1,
  hour: 60,
  day: 1440,
  week: 10_080,
  month: 43_800,
  year: 525_600,
};

function staleMinutes(lastActive: string): number {
  const match = /(\d+)\s*(sec|min|hour|day|week|month|year)/i.exec(lastActive);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return Number(match[1]) * UNIT_MINUTES[match[2].toLowerCase()];
}

/** Active in the last day — the same window the "Recent" quick view counts. */
const RECENT_WINDOW_MINUTES = 1440;
const UPLOADS_FOLDER = "Uploads";

const rowKey = (row: Workspace) => row.id;

function ProjectsScreen() {
  const router = useRouter();
  const params = useSearchParams();

  const search = params.get("q") ?? "";
  const category = params.get("category") ?? "all";
  const folder = params.get("folder") ?? "all";
  const rawView = params.get("view") ?? "all";
  const view: QuickView = isQuickView(rawView) ? rawView : "all";
  const selectedId = params.get("project");

  const viewMode = useProjectViewMode();
  const sortBy = useProjectSortBy();
  const groupByFolder = useGroupByFolder();
  const starredOverrides = useStarredOverrides();
  const recentIds = useRecentProjectIds();
  const uploadQueue = useUploadQueue();
  const setViewMode = useProjectsStore((s) => s.setViewMode);
  const setSortBy = useProjectsStore((s) => s.setSortBy);
  const toggleGroupByFolder = useProjectsStore((s) => s.toggleGroupByFolder);
  const toggleStarred = useProjectsStore((s) => s.toggleStarred);
  const setActiveProject = useProjectsStore((s) => s.setActiveProject);

  const projectsQuery = useProjects();
  const foldersQuery = useProjectFolders();
  const summaryQuery = useDashboardSummary();
  const starMutation = useToggleProjectStar();
  const createMutation = useCreateProject();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", path: "", framework: "" });

  const all = useMemo(() => projectsQuery.data?.items ?? [], [projectsQuery.data]);
  const folders = useMemo(() => foldersQuery.data ?? [], [foldersQuery.data]);
  const summary = summaryQuery.data;

  // The open project is app-wide state: the title-bar switcher and the recents
  // list read it, so the URL param is mirrored into the store, not duplicated.
  useEffect(() => {
    if (selectedId) setActiveProject(selectedId);
  }, [selectedId, setActiveProject]);

  const isStarred = useCallback(
    (project: Workspace) => starredOverrides[project.id] ?? Boolean(project.starred),
    [starredOverrides],
  );

  /* --- URL state ---------------------------------------------------------- */

  const setParams = useCallback(
    (patch: Record<string, string | null>, mode: "replace" | "push" = "replace") => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      const href = query ? `${routes.projects()}?${query}` : routes.projects();
      if (mode === "push") router.push(href);
      else router.replace(href, { scroll: false });
    },
    [params, router],
  );

  const openProject = useCallback(
    (id: string) => setParams({ project: id }, "push"),
    [setParams],
  );

  const closeProject = useCallback(() => setParams({ project: null }, "push"), [setParams]);

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === "sort") {
        if (isSortBy(value)) setSortBy(value);
        return;
      }
      setParams({ [id]: value });
    },
    [setParams, setSortBy],
  );

  const onViewChange = useCallback(
    (next: QuickView) => {
      setParams({ view: next });
      setSidebarOpen(false);
    },
    [setParams],
  );

  const onFolderChange = useCallback(
    (next: string) => {
      setParams({ folder: next });
      setSidebarOpen(false);
    },
    [setParams],
  );

  const clearFilters = useCallback(
    () => setParams({ q: null, category: null, folder: null, view: null }),
    [setParams],
  );

  /* --- actions ------------------------------------------------------------- */

  const onToggleStar = useCallback(
    (id: string) => {
      // Optimistic in the store first: the adapter round-trip is invisible, a
      // star that lags behind the click is not.
      toggleStarred(id);
      starMutation.mutate(id, {
        onError: () => {
          toggleStarred(id);
          toast.error("Could not save the star");
        },
      });
    },
    [starMutation, toggleStarred],
  );

  const onRetryIndex = useCallback(
    (id: string) => {
      toast.info("Re-indexing project", { description: id });
      void projectsQuery.refetch();
    },
    [projectsQuery],
  );

  const onCreate = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      createMutation.mutate(
        { name: draft.name.trim(), path: draft.path.trim(), framework: draft.framework.trim() },
        {
          onSuccess: (project) => {
            setCreateOpen(false);
            setDraft({ name: "", path: "", framework: "" });
            toast.success(`Created ${project.name}`);
            openProject(project.id);
          },
          onError: () => toast.error("Could not create the project"),
        },
      );
    },
    [createMutation, draft, openProject],
  );

  /* --- derived ------------------------------------------------------------- */

  const counts = useMemo(
    () => ({
      all: all.length,
      recent: all.filter((p) => staleMinutes(p.lastActive) <= RECENT_WINDOW_MINUTES).length,
      starred: all.filter(isStarred).length,
      uploaded: all.filter((p) => p.folder === UPLOADS_FOLDER).length,
      archived: 0,
    }),
    [all, isStarred],
  );

  const categories = useMemo(
    () => Array.from(new Set(all.map((project) => project.category))).sort(),
    [all],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const matched = all.filter((project) => {
      if (view === "recent" && staleMinutes(project.lastActive) > RECENT_WINDOW_MINUTES) return false;
      if (view === "starred" && !isStarred(project)) return false;
      if (view === "uploaded" && project.folder !== UPLOADS_FOLDER) return false;
      // Nothing carries an archived flag yet, so the view is honestly empty.
      if (view === "archived") return false;
      if (folder !== "all" && project.folder !== folder) return false;
      if (category !== "all" && project.category !== category) return false;
      if (!needle) return true;
      return [project.name, project.path, project.framework].some((field) =>
        field.toLowerCase().includes(needle),
      );
    });

    const ordered = [...matched];
    ordered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "health":
          return b.health - a.health;
        case "tests":
          return b.tests - a.tests;
        default:
          return staleMinutes(a.lastActive) - staleMinutes(b.lastActive);
      }
    });
    return ordered;
  }, [all, category, folder, isStarred, search, sortBy, view]);

  const filtersActive = Boolean(search) || category !== "all" || folder !== "all" || view !== "all";

  const recent = useMemo(() => {
    if (filtersActive) return [];
    const byId = new Map(all.map((project) => [project.id, project]));
    const visited = recentIds
      .map((id) => byId.get(id))
      .filter((project): project is Workspace => Boolean(project));
    const rest = [...all].sort((a, b) => staleMinutes(a.lastActive) - staleMinutes(b.lastActive));
    return [...visited, ...rest.filter((project) => !visited.includes(project))].slice(0, 3);
  }, [all, filtersActive, recentIds]);

  /** Grid sections: one per folder when grouping is on, otherwise a single flat one. */
  const groups = useMemo(() => {
    if (!groupByFolder) return [{ id: "all", label: "All projects", items: filtered }];
    const buckets = new Map<string, Workspace[]>();
    for (const project of filtered) {
      const name = project.folder ?? "Ungrouped";
      const bucket = buckets.get(name);
      if (bucket) bucket.push(project);
      else buckets.set(name, [project]);
    }
    return Array.from(buckets, ([label, items]) => ({ id: label, label, items }));
  }, [filtered, groupByFolder]);

  const stateOf = useCallback(
    (project: Workspace): WorkspaceState => WORKSPACE_STATES[project.id] ?? "ready",
    [],
  );

  const uploadProgressOf = useCallback(
    (project: Workspace) =>
      uploadQueue.find((item) => item.name === project.name && item.state !== "done")?.progress,
    [uploadQueue],
  );

  /* --- list mode ------------------------------------------------------------ */

  const columns = useMemo<Column<Workspace>[]>(
    () => [
      {
        id: "name",
        header: "Project",
        width: "minmax(200px,2fr)",
        sortValue: (row) => row.name,
        cell: (row) => (
          <span className="flex min-w-0 flex-col">
            <Link
              href={routes.project(row.id)}
              onClick={(event) => event.stopPropagation()}
              className="truncate text-xs font-medium text-foreground hover:text-primary"
              data-testid={`projects-row-${row.id}-open`}
            >
              {row.name}
            </Link>
            <span className="text-code truncate text-subtle-foreground">
              {truncateMiddle(row.path, 34)}
            </span>
          </span>
        ),
      },
      {
        id: "framework",
        header: "Framework",
        width: "150px",
        sortValue: (row) => row.framework,
        cell: (row) => <span className="truncate text-muted-foreground">{row.framework}</span>,
      },
      {
        id: "branch",
        header: "Branch",
        width: "160px",
        cell: (row) => <span className="text-code truncate text-subtle-foreground">{row.branch}</span>,
      },
      {
        id: "health",
        header: "Health",
        width: "84px",
        align: "center",
        sortValue: (row) => row.health,
        cell: (row) => <ScoreRing score={row.health} size={30} label={`${row.name} health`} />,
      },
      {
        id: "tests",
        header: "Tests",
        width: "84px",
        align: "right",
        sortValue: (row) => row.tests,
        cell: (row) => (
          <Link
            href={routes.suites({ projectId: row.id })}
            onClick={(event) => event.stopPropagation()}
            className="font-mono tabular-nums text-foreground hover:text-primary"
            data-testid={`projects-row-${row.id}-tests`}
          >
            {formatCompact(row.tests)}
          </Link>
        ),
      },
      {
        id: "sessions",
        header: "Sessions",
        width: "94px",
        align: "right",
        sortValue: (row) => row.sessions,
        cell: (row) => (
          <Link
            href={routes.workbench()}
            onClick={(event) => event.stopPropagation()}
            className="font-mono tabular-nums text-foreground hover:text-primary"
            data-testid={`projects-row-${row.id}-sessions`}
          >
            {row.sessions}
          </Link>
        ),
      },
      {
        id: "lastActive",
        header: "Last active",
        width: "110px",
        sortValue: (row) => staleMinutes(row.lastActive),
        cell: (row) => <span className="truncate text-muted-foreground">{row.lastActive}</span>,
      },
      {
        id: "owner",
        header: "Owner",
        width: "150px",
        cell: (row) => (
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar className="size-5">
              <AvatarFallback>{row.owner.avatar}</AvatarFallback>
            </Avatar>
            <span className="truncate text-muted-foreground">{row.owner.name}</span>
          </span>
        ),
      },
      {
        id: "state",
        header: "State",
        width: "104px",
        cell: (row) => <StatusBadge status={stateOf(row)} size="xs" />,
      },
      {
        id: "starred",
        header: "★",
        width: "48px",
        align: "center",
        cell: (row) => {
          const starred = isStarred(row);
          return (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleStar(row.id);
              }}
              aria-label={starred ? `Unstar ${row.name}` : `Star ${row.name}`}
              aria-pressed={starred}
              data-testid={`projects-row-${row.id}-star`}
              className={cn(
                "grid size-6 place-items-center rounded-[var(--radius-sm)] transition-colors hover:bg-muted",
                starred ? "text-accent" : "text-subtle-foreground",
              )}
            >
              <Star className={cn("size-3.5", starred && "fill-current")} aria-hidden />
            </button>
          );
        },
      },
    ],
    [isStarred, onToggleStar, stateOf],
  );

  const onRowClick = useCallback((row: Workspace) => openProject(row.id), [openProject]);

  /* --- render ---------------------------------------------------------------- */

  const showEmpty = !projectsQuery.isPending && !projectsQuery.isError && filtered.length === 0;

  return (
    <div className="flex min-h-full flex-col min-[1100px]:flex-row">
      <div
        className={cn(
          "shrink-0 border-border/70 min-[1100px]:sticky min-[1100px]:top-0 min-[1100px]:block",
          "min-[1100px]:max-h-screen min-[1100px]:w-[264px] min-[1100px]:overflow-y-auto min-[1100px]:border-r",
          sidebarOpen ? "block border-b" : "hidden",
        )}
      >
        <ProjectSidebar
          projects={all}
          folders={folders}
          view={view}
          folder={folder}
          activeProjectId={selectedId}
          counts={counts}
          onViewChange={onViewChange}
          onFolderChange={onFolderChange}
          onNewProject={() => setCreateOpen(true)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PageHeader
          title="Projects"
          description="Browse, upload and open workspaces"
          icon={FolderKanban}
          meta={
            <span className="flex items-center gap-2">
              <span>
                {filtered.length} of {all.length} workspaces
              </span>
              {view === "all" ? null : (
                <Badge variant="primary" size="xs" data-testid="projects-view-chip">
                  {view}
                </Badge>
              )}
              {folder === "all" ? null : (
                <Badge variant="outline" size="xs" data-testid="projects-folder-chip">
                  {folder}
                </Badge>
              )}
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setSidebarOpen((open) => !open)}
                aria-label="Toggle folder sidebar"
                aria-expanded={sidebarOpen}
                className="min-[1100px]:hidden"
                data-testid="projects-sidebar-toggle"
              >
                <PanelLeft className="size-4" aria-hidden />
              </Button>

              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as ProjectViewMode)}
                aria-label="View mode"
              >
                <ToggleGroupItem value="grid" aria-label="Grid view" data-testid="projects-view-grid">
                  <LayoutGrid aria-hidden />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="List view" data-testid="projects-view-list">
                  <List aria-hidden />
                </ToggleGroupItem>
              </ToggleGroup>

              <Button
                variant="outline"
                onClick={() => setImportOpen(true)}
                data-testid="projects-import-btn"
              >
                <Upload className="size-3.5" aria-hidden />
                Import folder
              </Button>

              <Button
                variant="primary"
                onClick={() => setCreateOpen(true)}
                data-testid="projects-new-btn"
              >
                <Plus className="size-3.5" aria-hidden />
                New project
              </Button>
            </div>
          }
        />

        <StatGrid columns={4}>
          <StatTile
            label="Pass rate"
            value={summary ? formatPercent(summary.passRate / 100) : "—"}
            icon={Target}
            tone="success"
            href={routes.runs()}
            testId="projects-stat-pass-rate"
          />
          <StatTile
            label="Total tests"
            value={summary ? formatCompact(summary.totalTests) : "—"}
            icon={ListChecks}
            tone="primary"
            href={routes.suites()}
            testId="projects-stat-total-tests"
          />
          <StatTile
            label="Open findings"
            value={summary?.openFindings ?? "—"}
            icon={Bug}
            tone="error"
            hint={summary ? `${summary.criticalFindings} critical` : undefined}
            href={routes.findings()}
            testId="projects-stat-open-findings"
          />
          <StatTile
            label="Running runs"
            value={summary?.runningRuns ?? "—"}
            icon={PlayCircle}
            tone="accent"
            href={routes.runs({ status: "running" })}
            testId="projects-stat-running-runs"
          />
        </StatGrid>

        <FilterBar
          testId="projects-filters"
          search={search}
          onSearchChange={(value) => setParams({ q: value })}
          searchPlaceholder="Search projects, paths and frameworks"
          filters={[
            {
              id: "category",
              label: "Category",
              value: category,
              options: [
                { value: "all", label: "All categories", count: all.length },
                ...categories.map((entry) => ({
                  value: entry,
                  label: entry,
                  count: all.filter((project) => project.category === entry).length,
                })),
              ],
            },
            {
              id: "folder",
              label: "Folder",
              value: folder,
              options: [
                { value: "all", label: "All folders", count: all.length },
                ...folders.map((entry) => ({
                  value: entry.name,
                  label: entry.name,
                  count: entry.count,
                })),
              ],
            },
            {
              id: "sort",
              label: "Sort",
              value: sortBy,
              options: SORT_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
            },
          ]}
          onFilterChange={onFilterChange}
          right={
            <Button
              variant={groupByFolder ? "secondary" : "ghost"}
              size="sm"
              onClick={toggleGroupByFolder}
              aria-pressed={groupByFolder}
              data-testid="projects-group-toggle"
            >
              <FolderTree className="size-3.5" aria-hidden />
              Group by folder
            </Button>
          }
        />

        {projectsQuery.isPending ? (
          <div className="flex flex-col gap-3" data-testid="projects-loading">
            <span className="label-mono">All projects</span>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="surface-card flex flex-col gap-2 overflow-hidden p-0">
                  <Skeleton className="aspect-[4/3] w-full rounded-none" />
                  <div className="flex flex-col gap-2 p-3">
                    <Skeleton className="h-3 w-[70%]" />
                    <Skeleton className="h-2.5 w-[45%]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {projectsQuery.isError ? (
          <div className="flex flex-col items-center gap-2">
            <ErrorState
              error={projectsQuery.error}
              onRetry={() => void projectsQuery.refetch()}
              testId="projects-error"
            />
            <Button variant="ghost" size="sm" asChild data-testid="projects-error-data-source">
              <Link href={routes.settings({ tab: "data" })}>Check data source</Link>
            </Button>
          </div>
        ) : null}

        {showEmpty ? (
          filtersActive ? (
            <EmptyState
              icon={FolderKanban}
              title={search ? `No projects match "${search}"` : "No projects in this view"}
              description="Widen the filters, or clear them to see every workspace again."
              action={
                <Button variant="outline" onClick={clearFilters} data-testid="projects-clear-filters">
                  Clear filters
                </Button>
              }
              testId="projects-empty-filtered"
            />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <EmptyState
                icon={FolderKanban}
                title="No workspaces yet"
                description="Import a folder or drop one below to start testing it."
                action={
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setImportOpen(true)}
                    data-testid="projects-empty-import"
                  >
                    <Upload className="size-4" aria-hidden />
                    Import folder
                  </Button>
                }
                testId="projects-empty"
              />
              <div className="w-full max-w-lg">
                <UploadDropzone />
              </div>
            </div>
          )
        ) : null}

        {!projectsQuery.isPending && !projectsQuery.isError && filtered.length > 0 ? (
          viewMode === "list" ? (
            <DataTable
              rows={filtered}
              columns={columns}
              rowKey={rowKey}
              onRowClick={onRowClick}
              selectedKey={selectedId ?? undefined}
              stickyHeader
              testId="projects-table"
            />
          ) : (
            <div className="flex flex-col gap-6 cv-auto">
              {recent.length ? (
                <section aria-label="Recent projects" className="flex flex-col gap-3">
                  <h2 className="label-mono">Recent</h2>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
                    {recent.map((project) => (
                      <ProjectCard
                        key={`recent-${project.id}`}
                        project={project}
                        state={stateOf(project)}
                        starred={isStarred(project)}
                        selected={project.id === selectedId}
                        uploadProgress={uploadProgressOf(project)}
                        onOpen={openProject}
                        onToggleStar={onToggleStar}
                        onRetry={onRetryIndex}
                      />
                    ))}
                  </div>
                </section>
              ) : null}

              {groups.map((group) => (
                <section
                  key={group.id}
                  aria-label={group.label}
                  className="flex flex-col gap-3"
                  data-testid={`projects-group-${group.id}`}
                >
                  <h2 className="label-mono flex items-center gap-2">
                    {group.label}
                    <Badge variant="muted" size="xs">
                      {group.items.length}
                    </Badge>
                  </h2>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
                    {group.items.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        state={stateOf(project)}
                        starred={isStarred(project)}
                        selected={project.id === selectedId}
                        uploadProgress={uploadProgressOf(project)}
                        onOpen={openProject}
                        onToggleStar={onToggleStar}
                        onRetry={onRetryIndex}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : null}
      </div>

      {selectedId ? <ProjectDetail projectId={selectedId} onClose={closeProject} /> : null}

      {/* --- import ------------------------------------------------------------- */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent data-testid="projects-import-dialog">
          <DialogHeader>
            <DialogTitle>Import a project folder</DialogTitle>
            <DialogDescription>
              Drop a folder or pick one — it is indexed locally and appears as a workspace.
            </DialogDescription>
          </DialogHeader>
          <UploadDropzone />
        </DialogContent>
      </Dialog>

      {/* --- new project --------------------------------------------------------- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent data-testid="projects-new-dialog">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Point the agent at a checkout it can run and test.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onCreate} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-project-name">Name</Label>
              <Input
                id="new-project-name"
                required
                value={draft.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="checkout-web"
                data-testid="projects-new-name"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-project-path">Path</Label>
              <Input
                id="new-project-path"
                required
                value={draft.path}
                onChange={(event) => setDraft((prev) => ({ ...prev, path: event.target.value }))}
                placeholder="~/projects/checkout-web"
                data-testid="projects-new-path"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-project-framework">Framework</Label>
              <Input
                id="new-project-framework"
                required
                value={draft.framework}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, framework: event.target.value }))
                }
                placeholder="Next.js 15"
                data-testid="projects-new-framework"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
                data-testid="projects-new-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={createMutation.isPending}
                data-testid="projects-new-submit"
              >
                Create project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState rows={6} variant="cards" />
        </div>
      }
    >
      <ProjectsScreen />
    </Suspense>
  );
}

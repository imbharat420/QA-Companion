"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bot,
  Database,
  FileCode2,
  LayoutGrid,
  Library,
  Plus,
  Repeat2,
  Rows3,
  Sparkles,
  Upload,
} from "lucide-react";

import { ScriptCard, ScriptDetail } from "@/components/scripts";
import {
  KIND_META,
  LANGUAGE_LABEL,
  SCRIPT_KINDS,
  SOURCE_KINDS,
  SOURCE_META,
  bareName,
  readScriptTab,
  scriptFilename,
  sourceHref,
} from "@/components/scripts";
import type { ScriptSourceKind, ScriptTab } from "@/components/scripts";
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
  TreeView,
  type Column,
  type FilterDef,
  type TreeNode,
} from "@/components/shared";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui";
import { routes } from "@/config/nav";
import { qk, usePrefetchOnHover, useSaveScript, useScript, useScripts } from "@/lib/queries";
import { cn, formatCompact, formatRelative, localId } from "@/lib/utils";
import { useAgentStore } from "@/store/agentStore";
import { useFiltersStore } from "@/store/filtersStore";
import type { ScriptEntry, ScriptKind } from "@/lib/api/types";

/* ==========================================================================
   URL STATE
   ======================================================================== */

const SORTS = ["uses", "updated", "name", "version"] as const;
type SortKey = (typeof SORTS)[number];

const SORT_COLUMN: Record<SortKey, string> = {
  uses: "uses",
  updated: "updated",
  name: "name",
  version: "version",
};

const LANGUAGES: ScriptEntry["language"][] = ["typescript", "javascript", "python"];

const readKind = (value: string | null): ScriptKind | "all" =>
  SCRIPT_KINDS.find((kind) => kind === value) ?? "all";

const readSource = (value: string | null): ScriptSourceKind | "all" =>
  SOURCE_KINDS.find((source) => source === value) ?? "all";

const readSort = (value: string | null): SortKey =>
  SORTS.find((sort) => sort === value) ?? "uses";

const KIND_OPTIONS: FilterDef["options"] = [
  { value: "all", label: "All kinds" },
  ...SCRIPT_KINDS.map((kind) => ({ value: kind, label: KIND_META[kind].label })),
];

const SOURCE_OPTIONS: FilterDef["options"] = [
  { value: "all", label: "All sources" },
  ...SOURCE_KINDS.map((source) => ({ value: source, label: SOURCE_META[source].label })),
];

const SORT_OPTIONS: FilterDef["options"] = [
  { value: "uses", label: "Uses" },
  { value: "updated", label: "Updated" },
  { value: "name", label: "Name" },
  { value: "version", label: "Version" },
];

/* ==========================================================================
   HELPERS
   ======================================================================== */

/** Wider than the adapter's search: the contract also matches tags and source. */
function matchesSearch(script: ScriptEntry, needle: string): boolean {
  if (!needle) return true;
  return (
    script.name.toLowerCase().includes(needle) ||
    script.description.toLowerCase().includes(needle) ||
    script.tags.some((tag) => tag.toLowerCase().includes(needle)) ||
    script.code.toLowerCase().includes(needle)
  );
}

function compare(a: ScriptEntry, b: ScriptEntry, sortBy: SortKey): number {
  switch (sortBy) {
    case "name":
      return a.name.localeCompare(b.name);
    case "updated":
      return a.updatedAt.localeCompare(b.updatedAt);
    case "version":
      return a.version - b.version;
    case "uses":
      return a.usageCount - b.usageCount;
  }
}

/** A runnable skeleton, so a brand-new asset opens on something real. */
function starterCode(name: string, kind: ScriptKind, language: ScriptEntry["language"]): string {
  const fn = bareName(name) || "newAsset";
  if (language === "python") {
    return `def ${fn}(page):\n    """${KIND_META[kind].hint}."""\n    page.goto("/")\n    assert page.title() != ""\n`;
  }
  if (kind === "test") {
    return `import { expect, test } from "@playwright/test";\n\ntest("${name}", async ({ page }) => {\n  await page.goto("/");\n  await expect(page).toHaveTitle(/./);\n});\n`;
  }
  return `import type { Page } from "@playwright/test";\n\n/** ${KIND_META[kind].hint}. */\nexport async function ${fn}(page: Page): Promise<void> {\n  await page.goto("/");\n}\n`;
}

const languageFor = (filename: string): ScriptEntry["language"] =>
  filename.endsWith(".py") ? "python" : filename.endsWith(".js") ? "javascript" : "typescript";

/* ==========================================================================
   PAGE
   ======================================================================== */

function ScriptsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const search = searchParams.get("q") ?? "";
  const kind = readKind(searchParams.get("kind"));
  const tag = searchParams.get("tag") ?? "all";
  const source = readSource(searchParams.get("source"));
  const sortBy = readSort(searchParams.get("sort"));
  const sortDir = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const view = searchParams.get("view") === "list" ? "list" : "grid";
  const selectedId = searchParams.get("script");
  const tab = readScriptTab(searchParams.get("tab"));

  /** The URL is the source of truth; `filtersStore.scripts` is the persisted mirror. */
  const setFilter = useFiltersStore((s) => s.setFilter);
  useEffect(() => {
    setFilter("scripts", "kind", kind);
    setFilter("scripts", "tag", tag);
    setFilter("scripts", "search", search);
  }, [kind, tag, search, setFilter]);

  const buildHref = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "" || value === "all") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      return query ? `/scripts?${query}` : "/scripts";
    },
    [searchParams],
  );

  // replace() for filters — a session of tweaking must not fill the history.
  const patchFilters = useCallback(
    (patch: Record<string, string | null>) => {
      router.replace(buildHref(patch), { scroll: false });
    },
    [buildHref, router],
  );

  const onFilterChange = useCallback(
    (id: string, value: string) => {
      if (id === "sort") {
        patchFilters({ sort: value === "uses" ? null : value });
        return;
      }
      patchFilters({ [id]: value });
    },
    [patchFilters],
  );

  const onSearchChange = useCallback((value: string) => patchFilters({ q: value }), [patchFilters]);

  const onSortChange = useCallback(
    (columnId: string) => {
      const next = SORTS.find((sort) => SORT_COLUMN[sort] === columnId);
      if (!next) return;
      const flip = next === sortBy && sortDir === "desc" ? "asc" : "desc";
      patchFilters({ sort: next, dir: flip === "desc" ? null : flip });
    },
    [patchFilters, sortBy, sortDir],
  );

  const onPickKind = useCallback(
    (picked: ScriptKind) => patchFilters({ kind: picked === kind ? "all" : picked }),
    [kind, patchFilters],
  );

  const onPickTag = useCallback(
    (picked: string) => patchFilters({ tag: picked === tag ? "all" : picked }),
    [patchFilters, tag],
  );

  const clearFilters = useCallback(
    () => patchFilters({ q: null, kind: null, tag: null, source: null }),
    [patchFilters],
  );

  // push() for the detail so Back closes the panel; the filters ride along.
  const openScript = useCallback(
    (id: string, nextTab?: ScriptTab) =>
      router.push(buildHref({ script: id, tab: nextTab && nextTab !== "code" ? nextTab : null })),
    [buildHref, router],
  );

  const onOpenCard = useCallback((id: string) => openScript(id), [openScript]);
  const onOpenRow = useCallback((script: ScriptEntry) => openScript(script.id), [openScript]);

  const closeScript = useCallback(
    () => router.replace(buildHref({ script: null, tab: null }), { scroll: false }),
    [buildHref, router],
  );

  const onTabChange = useCallback(
    (next: ScriptTab) => patchFilters({ tab: next === "code" ? null : next }),
    [patchFilters],
  );

  /* --- data ---------------------------------------------------------- */

  // Two reads of one hook: the whole library drives the rail counts, the tag
  // list and the tiles, while the filtered list drives the rows.
  const libraryQuery = useScripts();
  const listQuery = useScripts({
    kind: kind === "all" ? undefined : kind,
    tag: tag === "all" ? undefined : tag,
  });
  const detailQuery = useScript(selectedId ?? "");
  const saveScript = useSaveScript();

  const library = useMemo(() => libraryQuery.data?.items ?? [], [libraryQuery.data]);
  const scripts = useMemo(() => listQuery.data?.items ?? [], [listQuery.data]);
  const selected = detailQuery.data ?? null;

  const prefetch = usePrefetchOnHover();
  const onHoverScript = useCallback(
    (id: string) => prefetch(qk.scripts.detail(id), (s) => s.getScript(id)),
    [prefetch],
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const factor = sortDir === "desc" ? -1 : 1;
    return scripts
      .filter(
        (script) =>
          (source === "all" || script.sourceKind === source) && matchesSearch(script, needle),
      )
      .sort((a, b) => compare(a, b, sortBy) * factor);
  }, [scripts, search, source, sortBy, sortDir]);

  const tags = useMemo(
    () => Array.from(new Set(library.flatMap((script) => script.tags))).sort(),
    [library],
  );

  const kindCounts = useMemo(() => {
    const counts = Object.fromEntries(SCRIPT_KINDS.map((k) => [k, 0])) as Record<ScriptKind, number>;
    for (const script of library) counts[script.kind] += 1;
    return counts;
  }, [library]);

  const totalUses = useMemo(
    () => library.reduce((sum, script) => sum + script.usageCount, 0),
    [library],
  );

  const generatedCount = useMemo(
    () => library.filter((script) => script.sourceKind === "generated").length,
    [library],
  );

  /* --- rail ---------------------------------------------------------- */

  const treeNodes = useMemo<TreeNode[]>(
    () => [
      { id: "kind:all", label: "All assets", icon: Library, badge: library.length },
      ...SCRIPT_KINDS.map((k) => ({
        id: `kind:${k}`,
        label: KIND_META[k].label,
        icon: KIND_META[k].icon,
        badge: kindCounts[k],
      })),
      {
        id: "tags",
        label: "Tags",
        children: tags.map((name) => ({
          id: `tag:${name}`,
          label: name,
          badge: library.filter((script) => script.tags.includes(name)).length,
        })),
      },
    ],
    [kindCounts, library, tags],
  );

  const treeSelected = kind !== "all" ? `kind:${kind}` : tag !== "all" ? `tag:${tag}` : "kind:all";

  const onTreeSelect = useCallback(
    (node: TreeNode) => {
      if (node.id === "kind:all") {
        patchFilters({ kind: null, tag: null });
        return;
      }
      if (node.id.startsWith("kind:")) {
        patchFilters({ kind: node.id.slice(5) });
        return;
      }
      if (node.id.startsWith("tag:")) onPickTag(node.id.slice(4));
    },
    [onPickTag, patchFilters],
  );

  /* --- actions -------------------------------------------------------- */

  const startTask = useAgentStore((s) => s.startTask);

  const runScript = useCallback(
    (script: ScriptEntry, values: Record<string, string>) => {
      const args = script.params
        // A secret's value never leaves the form — the agent resolves it from the vault.
        .map((param) => `${param.name}=${param.type === "secret" ? "«secret»" : values[param.name] ?? ""}`)
        .join(", ");
      void startTask({
        prompt: `Run @script:${bareName(script.name)} (v${script.version}) against the current environment${
          args ? ` with ${args}` : ""
        }. Report any failure as a finding with the failing step and a suggested fix.`,
        mode: "run-script",
      });
      router.push(routes.workbench());
    },
    [router, startTask],
  );

  const insertScript = useCallback(
    (script: ScriptEntry) => {
      // Clipboard is absent on insecure origins and some Tauri webviews; the
      // navigation still has to happen, so the copy failure is not fatal.
      void navigator.clipboard?.writeText(script.code).catch(() => undefined);
      router.push(routes.cases());
    },
    [router],
  );

  const duplicateScript = useCallback(
    (script: ScriptEntry) => {
      void saveScript
        .mutateAsync({
          ...script,
          id: localId("sc"),
          name: `${script.name} copy`,
          version: 0,
          usageCount: 0,
          versions: [],
          sourceKind: "extracted",
          sourceRef: script.id,
          updatedAt: new Date().toISOString(),
        })
        .then((saved) => router.push(routes.scripts({ scriptId: saved.id })));
    },
    [router, saveScript],
  );

  const onSaveScript = useCallback(
    (next: ScriptEntry) => {
      saveScript.mutate(next);
    },
    [saveScript],
  );

  /* --- new script + import -------------------------------------------- */

  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftKind, setDraftKind] = useState<ScriptKind>("test");
  const [draftLanguage, setDraftLanguage] = useState<ScriptEntry["language"]>("typescript");
  const fileInput = useRef<HTMLInputElement | null>(null);

  const createScript = useCallback(() => {
    const name = draftName.trim();
    if (!name) return;
    void saveScript
      .mutateAsync({
        id: localId("sc"),
        name,
        kind: draftKind,
        language: draftLanguage,
        description: `New ${KIND_META[draftKind].label.toLowerCase()} — ${KIND_META[draftKind].hint}.`,
        params: [],
        tags: [draftKind],
        version: 0,
        usageCount: 0,
        code: starterCode(name, draftKind, draftLanguage),
        sourceKind: "upload",
        versions: [],
        updatedAt: new Date().toISOString(),
      })
      .then((saved) => {
        setDialogOpen(false);
        setDraftName("");
        router.push(routes.scripts({ scriptId: saved.id }));
      });
  }, [draftKind, draftLanguage, draftName, router, saveScript]);

  const importFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const imported = await Promise.all(
        Array.from(files).map(async (file) => {
          const language = languageFor(file.name);
          return saveScript.mutateAsync({
            id: localId("sc"),
            name: file.name.replace(/\.[^.]+$/, ""),
            kind: "test",
            language,
            description: `Imported from ${file.name}.`,
            params: [],
            tags: ["imported"],
            version: 0,
            usageCount: 0,
            code: await file.text(),
            sourceKind: "upload",
            sourceRef: file.name,
            versions: [],
            updatedAt: new Date().toISOString(),
          });
        }),
      );
      const last = imported.at(-1);
      if (last) router.push(routes.scripts({ scriptId: last.id }));
    },
    [router, saveScript],
  );

  /* --- columns -------------------------------------------------------- */

  const columns = useMemo<Column<ScriptEntry>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        width: "minmax(180px,1.6fr)",
        cell: (script) => (
          <Link
            href={routes.scripts({ scriptId: script.id })}
            onClick={(event) => event.stopPropagation()}
            onMouseEnter={() => onHoverScript(script.id)}
            className="text-code truncate rounded text-foreground underline-offset-2 hover:underline"
            data-testid={`scripts-row-${script.id}-name`}
          >
            {script.name}
          </Link>
        ),
        sortValue: (script) => script.name,
      },
      {
        id: "kind",
        header: "Kind",
        width: "112px",
        cell: (script) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPickKind(script.kind);
            }}
            aria-label={`Filter by ${KIND_META[script.kind].label}`}
            data-testid={`scripts-row-${script.id}-kind`}
            className="rounded-full"
          >
            <Badge variant={KIND_META[script.kind].variant} size="xs">
              {KIND_META[script.kind].label}
            </Badge>
          </button>
        ),
      },
      {
        id: "language",
        header: "Lang",
        width: "62px",
        cell: (script) => (
          <span className="label-mono text-[10px]" title={script.language}>
            {LANGUAGE_LABEL[script.language]}
          </span>
        ),
      },
      {
        id: "description",
        header: "Description",
        width: "minmax(200px,2fr)",
        cell: (script) => (
          <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
            {script.description}
          </span>
        ),
      },
      {
        id: "params",
        header: "Params",
        width: "72px",
        align: "right",
        cell: (script) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openScript(script.id, "params");
            }}
            aria-label={`Open the parameters of ${script.name}`}
            data-testid={`scripts-row-${script.id}-params`}
            className="rounded font-mono text-[11px] tabular-nums text-foreground hover:text-primary"
          >
            {script.params.length}
          </button>
        ),
        sortValue: (script) => script.params.length,
      },
      {
        id: "tags",
        header: "Tags",
        width: "minmax(130px,1fr)",
        cell: (script) => (
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            {script.tags.slice(0, 3).map((name) => (
              <button
                key={name}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onPickTag(name);
                }}
                aria-label={`Filter by tag ${name}`}
                data-testid={`scripts-row-${script.id}-tag-${name}`}
                className={cn(
                  "rounded-full border border-border/70 bg-elevated px-1.5 py-0.5",
                  "font-mono text-[10px] text-muted-foreground hover:text-foreground",
                )}
              >
                {name}
              </button>
            ))}
          </span>
        ),
      },
      {
        id: "version",
        header: "Version",
        width: "76px",
        align: "right",
        cell: (script) => (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              openScript(script.id, "versions");
            }}
            aria-label={`Open the version history of ${script.name}`}
            data-testid={`scripts-row-${script.id}-version`}
            className="rounded font-mono text-[11px] tabular-nums text-primary"
          >
            v{script.version}
          </button>
        ),
        sortValue: (script) => script.version,
      },
      {
        id: "uses",
        header: "Uses",
        width: "70px",
        align: "right",
        cell: (script) => (
          <span
            className="font-mono text-[11px] tabular-nums text-foreground"
            title={`${script.usageCount} recorded uses`}
          >
            {formatCompact(script.usageCount)}
          </span>
        ),
        sortValue: (script) => script.usageCount,
      },
      {
        id: "source",
        header: "Source",
        width: "148px",
        cell: (script) => {
          const meta = script.sourceKind ? SOURCE_META[script.sourceKind] : null;
          const href = sourceHref(script);
          const Icon = meta?.icon ?? FileCode2;
          return (
            <span className="flex min-w-0 items-center gap-1.5" title={meta?.hint}>
              <Icon className="size-3 shrink-0 text-muted-foreground" aria-hidden />
              {script.sourceRef ? (
                href ? (
                  <Link
                    href={href}
                    onClick={(event) => event.stopPropagation()}
                    className="text-code truncate rounded text-primary underline-offset-2 hover:underline"
                    data-testid={`scripts-row-${script.id}-source`}
                  >
                    {script.sourceRef}
                  </Link>
                ) : (
                  <span className="text-code truncate text-muted-foreground">
                    {script.sourceRef}
                  </span>
                )
              ) : (
                <span className="label-mono text-[10px]">{meta?.label ?? "—"}</span>
              )}
            </span>
          );
        },
      },
      {
        id: "updated",
        header: "Updated",
        width: "94px",
        align: "right",
        cell: (script) => (
          <span className="truncate text-[11px] text-muted-foreground" title={script.updatedAt}>
            {formatRelative(script.updatedAt)}
          </span>
        ),
        sortValue: (script) => script.updatedAt,
      },
    ],
    [onHoverScript, onPickKind, onPickTag, openScript],
  );

  /* --- header + tiles -------------------------------------------------- */

  const filtersActive = search !== "" || kind !== "all" || tag !== "all" || source !== "all";

  const header = (
    <PageHeader
      title="Script Library"
      description="Reusable steps, page objects, fixtures and skills"
      icon={Library}
      meta={
        <>
          <span data-testid="scripts-count">{library.length} assets</span>
          <span className="flex items-center gap-1">
            Call one from chat as
            <code className="text-code rounded-[var(--radius-sm)] bg-elevated px-1.5 py-0.5 text-primary">
              @script:{library[0] ? bareName(library[0].name) : "name"}
            </code>
            <CopyButton
              value={`@script:${library[0] ? bareName(library[0].name) : "name"}`}
              testId="scripts-copy-reference-syntax"
            />
          </span>
          {rows.length !== library.length ? (
            <span data-testid="scripts-filtered-count">{rows.length} shown after filters</span>
          ) : null}
        </>
      }
      actions={
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setDialogOpen(true)}
            data-testid="scripts-new-btn"
          >
            <Plus className="size-3.5" aria-hidden />
            New script
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInput.current?.click()}
            data-testid="scripts-import-btn"
          >
            <Upload className="size-3.5" aria-hidden />
            Import
          </Button>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept=".ts,.js,.py,.mts,.cts"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(event) => {
              void importFiles(event.target.files);
              event.target.value = "";
            }}
            data-testid="scripts-import-input"
          />
        </>
      }
    />
  );

  const tiles = (
    <StatGrid columns={4}>
      <StatTile
        label="Assets"
        value={formatCompact(library.length)}
        tone="primary"
        icon={Library}
        hint="Everything the library holds across all six kinds"
        testId="scripts-stat-assets"
      />
      <StatTile
        label="Total uses"
        value={formatCompact(totalUses)}
        tone="success"
        icon={Repeat2}
        hint="Calls from specs, skills and chat — the reuse this library bought"
        testId="scripts-stat-uses"
      />
      <StatTile
        label="Shared steps"
        value={formatCompact(kindCounts.step)}
        tone="accent"
        icon={KIND_META.step.icon}
        hint="Actions other specs call instead of repeating"
        onClick={() => onPickKind("step")}
        testId="scripts-stat-steps"
      />
      <StatTile
        label="Agent-generated"
        value={formatCompact(generatedCount)}
        tone="warning"
        icon={Bot}
        hint="Written by the agent out of a session"
        onClick={() => patchFilters({ source: source === "generated" ? "all" : "generated" })}
        testId="scripts-stat-generated"
      />
    </StatGrid>
  );

  const rail = (
    <aside
      aria-label="Script kinds"
      className="hidden w-56 shrink-0 flex-col gap-2 overflow-y-auto lg:flex"
      data-testid="scripts-rail"
    >
      {libraryQuery.isPending ? (
        <div className="flex flex-col gap-2 p-1">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      ) : (
        <TreeView
          nodes={treeNodes}
          selectedId={treeSelected}
          onSelect={onTreeSelect}
          defaultExpanded={["tags"]}
          testId="scripts-tree"
        />
      )}
    </aside>
  );

  const filters = useMemo<FilterDef[]>(
    () => [
      { id: "kind", label: "Kind", value: kind, options: KIND_OPTIONS },
      {
        id: "tag",
        label: "Tag",
        value: tag,
        options: [
          { value: "all", label: "All tags" },
          ...tags.map((name) => ({
            value: name,
            label: name,
            count: library.filter((script) => script.tags.includes(name)).length,
          })),
        ],
      },
      { id: "source", label: "Source", value: source, options: SOURCE_OPTIONS },
      { id: "sort", label: "Sort", value: sortBy, options: SORT_OPTIONS },
    ],
    [kind, library, sortBy, source, tag, tags],
  );

  /* --- states --------------------------------------------------------- */

  if (listQuery.isError) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {header}
        <ErrorState
          error={listQuery.error}
          onRetry={() => void listQuery.refetch()}
          testId="scripts-error"
        />
        <div className="flex justify-center">
          <Button variant="outline" size="sm" asChild>
            <Link href={routes.settings({ tab: "data" })} data-testid="scripts-error-data-source">
              <Database className="size-3.5" aria-hidden />
              Check data source
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (listQuery.isPending) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {header}
        {tiles}
        <div className="flex gap-4">
          {rail}
          <div className="min-w-0 flex-1">
            <LoadingState rows={10} variant="table" />
          </div>
        </div>
      </div>
    );
  }

  if (library.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-6">
        {header}
        {tiles}
        <div className="surface-card">
          <EmptyState
            icon={Library}
            title="No scripts yet"
            description="Generate one from a session, or import a folder of specs."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                  data-testid="scripts-empty-new"
                >
                  <Plus className="size-3.5" aria-hidden />
                  New script
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={routes.workbench()} data-testid="scripts-empty-generate">
                    <Sparkles className="size-3.5" aria-hidden />
                    Generate spec
                  </Link>
                </Button>
              </div>
            }
            testId="scripts-empty"
          />
        </div>
      </div>
    );
  }

  const filteredEmpty = (
    <EmptyState
      title="No scripts match these filters"
      description="Widen the kind, tag, source or search to see the rest of the library."
      action={
        <Button
          variant="outline"
          size="sm"
          onClick={clearFilters}
          data-testid="scripts-filtered-empty-clear"
        >
          Clear filters
        </Button>
      }
      testId="scripts-filtered-empty"
    />
  );

  /* --- the page -------------------------------------------------------- */

  return (
    <div className="flex flex-col gap-4 p-6">
      {header}
      {tiles}

      <div className="flex min-w-0 gap-4">
        {rail}

        <section aria-label="Script library" className="flex min-w-0 flex-1 flex-col gap-3">
          <FilterBar
            testId="scripts-filters"
            search={search}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search scripts, tags and code"
            filters={filters}
            onFilterChange={onFilterChange}
            right={
              <>
                <ToggleGroup
                  type="single"
                  value={view}
                  onValueChange={(next) => {
                    if (next) patchFilters({ view: next === "grid" ? null : next });
                  }}
                  aria-label="View mode"
                >
                  <ToggleGroupItem value="grid" aria-label="Grid view" data-testid="scripts-view-grid">
                    <LayoutGrid className="size-3.5" aria-hidden />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="List view" data-testid="scripts-view-list">
                    <Rows3 className="size-3.5" aria-hidden />
                  </ToggleGroupItem>
                </ToggleGroup>
                {filtersActive ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={clearFilters}
                    data-testid="scripts-clear-filters"
                  >
                    Clear filters
                  </Button>
                ) : null}
              </>
            }
          />

          {view === "grid" ? (
            rows.length === 0 ? (
              <div className="surface-card">{filteredEmpty}</div>
            ) : (
              <section
                aria-label="Assets"
                data-testid="scripts-grid"
                className="cv-auto grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
              >
                {rows.map((script) => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    selected={script.id === selectedId}
                    onOpen={onOpenCard}
                    onHover={onHoverScript}
                    onTagClick={onPickTag}
                  />
                ))}
              </section>
            )
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              rowKey={(script) => script.id}
              onRowClick={onOpenRow}
              selectedKey={selectedId ?? undefined}
              sortBy={SORT_COLUMN[sortBy]}
              sortDir={sortDir}
              onSortChange={onSortChange}
              rowHeight={52}
              stickyHeader
              testId="scripts-table"
              empty={filteredEmpty}
            />
          )}
        </section>
      </div>

      <Drawer
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) closeScript();
        }}
      >
        <DrawerContent side="right" size="xl" data-testid="scripts-drawer">
          <DrawerHeader>
            <DrawerTitle className="text-code">
              {selected ? selected.name : "Script"}
            </DrawerTitle>
            {selected ? (
              <span className="text-[11px] text-muted-foreground">
                {scriptFilename(selected)}
              </span>
            ) : null}
          </DrawerHeader>

          {selected ? (
            <ScriptDetail
              key={selected.id}
              script={selected}
              library={library}
              tab={tab}
              onTabChange={onTabChange}
              onRun={runScript}
              onInsert={insertScript}
              onDuplicate={duplicateScript}
              onSave={onSaveScript}
              saving={saveScript.isPending}
            />
          ) : detailQuery.isPending ? (
            <LoadingState rows={6} variant="panel" />
          ) : (
            <EmptyState
              icon={Library}
              title="Script not found in this data source"
              description={`No asset with id "${selectedId}" lives here. It may belong to another project or adapter.`}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeScript}
                  data-testid="scripts-drawer-back"
                >
                  Back to the library
                </Button>
              }
              testId="scripts-drawer-empty"
            />
          )}
        </DrawerContent>
      </Drawer>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" data-testid="scripts-new-dialog">
          <DialogHeader>
            <DialogTitle>New script</DialogTitle>
            <DialogDescription>
              It opens on a runnable skeleton you can edit and save as v1.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="scripts-new-name">Name</Label>
              <Input
                id="scripts-new-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="checkout.refund-path"
                data-testid="scripts-new-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="scripts-new-kind">Kind</Label>
                <Select value={draftKind} onValueChange={(value) => setDraftKind(value as ScriptKind)}>
                  <SelectTrigger id="scripts-new-kind" data-testid="scripts-new-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCRIPT_KINDS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {KIND_META[value].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label htmlFor="scripts-new-language">Language</Label>
                <Select
                  value={draftLanguage}
                  onValueChange={(value) => setDraftLanguage(value as ScriptEntry["language"])}
                >
                  <SelectTrigger id="scripts-new-language" data-testid="scripts-new-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(false)}
              data-testid="scripts-new-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={createScript}
              disabled={draftName.trim() === ""}
              loading={saveScript.isPending}
              data-testid="scripts-new-create"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * `useSearchParams()` needs a Suspense boundary in a statically exported route,
 * so the filter-aware view sits one level down.
 */
export default function ScriptsPage() {
  return (
    <Suspense fallback={<LoadingState rows={10} variant="table" />}>
      <ScriptsView />
    </Suspense>
  );
}

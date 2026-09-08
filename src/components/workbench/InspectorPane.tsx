"use client";

/**
 * THE DEVTOOLS INSPECTOR.
 *
 * Five event-sourced views over one agent run. Everything here is a projection
 * of the store: the DOM tree from the last `dom` event (falling back to the
 * adapter for the current page before one arrives), network and console from
 * the two firehoses, selectors from the adapter for whatever node is currently
 * targeted.
 *
 * Scrubbing: `TimelineStep` carries no captured evidence beyond a screenshot,
 * so the network/console cut is recorded here as each step arrives — the two
 * lists are append-only, which makes "the length they had then" the slice.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bug,
  ChevronRight,
  CircleX,
  Info,
  Layers,
  MousePointerClick,
  Network,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import {
  CopyButton,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  type Column,
} from "@/components/shared";
import { A11Y_TREES } from "@/lib/fixtures";
import { useDomTree, useSelectorCandidates } from "@/lib/queries";
import { cn, formatBytes, truncateMiddle } from "@/lib/utils";
import {
  readAgent,
  useAgentBrowser,
  useAgentDomTree,
  useAgentLogs,
  useAgentNetwork,
  useAgentStore,
  useAgentTimeline,
  useSelectedStep,
} from "@/store/agentStore";
import { useInspectorTab, useUiStore, type InspectorTab } from "@/store/uiStore";
import type {
  ConsoleEntry,
  DomNode,
  NetworkEntry,
  SelectorCandidate,
} from "@/lib/api/types";

const TABS: { id: InspectorTab; label: string; icon: typeof Layers }[] = [
  { id: "dom", label: "DOM", icon: Layers },
  { id: "a11y", label: "A11y", icon: Bug },
  { id: "network", label: "Network", icon: Network },
  { id: "console", label: "Console", icon: Terminal },
  { id: "selectors", label: "Locators", icon: MousePointerClick },
];

const LEVELS: ConsoleEntry["level"][] = ["log", "info", "warn", "error", "debug"];
const STATUS_CLASSES = ["2xx", "3xx", "4xx", "5xx"] as const;

/** Roles that are meaningless to a screen reader without an accessible name. */
const NAME_REQUIRED = new Set([
  "button",
  "link",
  "textbox",
  "searchbox",
  "checkbox",
  "combobox",
  "heading",
]);

/** Query values can carry tokens and PII — the key stays, the value never renders. */
function redactQuery(url: string): string {
  const cut = url.indexOf("?");
  if (cut < 0) return url;
  const params = url
    .slice(cut + 1)
    .split("&")
    .map((pair) => `${pair.split("=")[0]}=•••`)
    .join("&");
  return `${url.slice(0, cut)}?${params}`;
}

const statusTone = (status: number) =>
  status >= 500
    ? "text-critical"
    : status >= 400
      ? "text-destructive"
      : status >= 300
        ? "text-waiting"
        : "text-success";

/* ==========================================================================
   DOM TREE
   TreeView cannot syntax-colour an attribute string, so the row is bespoke.
   ======================================================================== */

interface DomRowProps {
  node: DomNode;
  path: string;
  depth: number;
  highlight: string | null;
  onSelect: (id: string) => void;
}

const DomRow = memo(function DomRow({ node, path, depth, highlight, onSelect }: DomRowProps) {
  const [open, setOpen] = useState(depth < 4);
  const children = node.children ?? [];
  const selected = Boolean(node.id) && node.id === highlight;

  return (
    <div role="group">
      <div
        className={cn(
          "flex items-center gap-1 rounded-[var(--radius-sm)] py-[3px] pr-2 font-mono text-[10.5px]",
          selected ? "bg-primary/15 ring-1 ring-inset ring-primary/50" : "hover:bg-muted/40",
        )}
        style={{ paddingLeft: depth * 12 + 4 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? `Collapse ${node.tag}` : `Expand ${node.tag}`}
            aria-expanded={open}
            data-testid={`inspector-dom-toggle-${path}`}
            className="shrink-0 text-subtle-foreground hover:text-foreground"
          >
            <ChevronRight
              aria-hidden
              className={cn("size-3 transition-transform duration-150", open && "rotate-90")}
            />
          </button>
        ) : (
          <span aria-hidden className="w-3 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => node.id && onSelect(node.id)}
          disabled={!node.id}
          aria-pressed={selected}
          data-testid={`inspector-dom-node-${node.id ?? path}`}
          className="flex min-w-0 flex-1 items-center gap-1 text-left disabled:cursor-default"
        >
          <span className="shrink-0 text-primary">&lt;{node.tag}</span>
          {node.attrs ? <span className="truncate text-accent">{node.attrs}</span> : null}
          <span className="shrink-0 text-primary">&gt;</span>
          {selected ? (
            <Badge variant="primary" size="xs" className="ml-auto shrink-0">
              target
            </Badge>
          ) : null}
        </button>
      </div>

      {open
        ? children.map((child, index) => (
            <DomRow
              key={`${path}.${index}`}
              node={child}
              path={`${path}.${index}`}
              depth={depth + 1}
              highlight={highlight}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
});

/* ==========================================================================
   CONSOLE
   ======================================================================== */

const LEVEL_ICON = { error: CircleX, warn: AlertTriangle, log: Info, info: Info, debug: Info };
const LEVEL_TONE: Record<ConsoleEntry["level"], string> = {
  error: "text-destructive",
  warn: "text-waiting",
  log: "text-muted-foreground",
  info: "text-low",
  debug: "text-subtle-foreground",
};

const ConsoleRow = memo(function ConsoleRow({ entry }: { entry: ConsoleEntry }) {
  const Icon = LEVEL_ICON[entry.level];
  return (
    <div
      data-testid={`inspector-console-row-${entry.id}`}
      className="flex items-start gap-2 border-b border-border/40 px-2 py-1.5 font-mono text-[10.5px] hover:bg-muted/30"
    >
      <Icon className={cn("mt-0.5 size-3 shrink-0", LEVEL_TONE[entry.level])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className={cn("break-words", entry.level === "error" && "text-destructive")}>
          {entry.text}
        </p>
        {entry.source ? (
          <p className="mt-0.5 text-[9.5px] text-subtle-foreground">{entry.source}</p>
        ) : null}
      </div>
      <span className="shrink-0 text-[9.5px] text-subtle-foreground">{entry.ts.slice(11, 19)}</span>
    </div>
  );
});

/* ==========================================================================
   PANE
   ======================================================================== */

export function InspectorPane() {
  const browser = useAgentBrowser();
  const liveDom = useAgentDomTree();
  const network = useAgentNetwork();
  const logs = useAgentLogs();
  const timeline = useAgentTimeline();
  const selectedStep = useSelectedStep();
  const setBrowserPatch = useAgentStore((s) => s.setBrowserPatch);
  const tab = useInspectorTab();
  const setTab = useUiStore((s) => s.setInspectorTab);

  const [level, setLevel] = useState<"all" | ConsoleEntry["level"]>("all");
  const [statusClass, setStatusClass] = useState<"all" | (typeof STATUS_CLASSES)[number]>("all");
  const [resourceType, setResourceType] = useState<string>("all");
  const [netSort, setNetSort] = useState<{ by: string; dir: "asc" | "desc" }>({
    by: "start",
    dir: "asc",
  });

  /* --- the scrubbed slice ------------------------------------------------- */

  const cuts = useRef(new Map<number, [network: number, logs: number]>());
  useEffect(() => {
    const last = timeline.at(-1);
    if (!last || cuts.current.has(last.id)) return;
    // Non-reactive read: this records a high-water mark, it must not re-run
    // every time one of the firehoses appends.
    const live = readAgent();
    cuts.current.set(last.id, [live.network.length, live.logs.length]);
  }, [timeline]);

  const cut = selectedStep ? cuts.current.get(selectedStep.id) : undefined;
  const netSlice = useMemo(() => (cut ? network.slice(0, cut[0]) : network), [cut, network]);
  const logSlice = useMemo(() => (cut ? logs.slice(0, cut[1]) : logs), [cut, logs]);

  /* --- tree + locators ---------------------------------------------------- */

  const domQuery = useDomTree(browser.page);
  const tree = liveDom ?? domQuery.data ?? null;
  const a11y = A11Y_TREES[browser.page] ?? [];
  const target = browser.highlight ?? "";
  const selectorQuery = useSelectorCandidates(browser.page, target);

  const selectNode = useCallback(
    (id: string) => setBrowserPatch({ highlight: id }),
    [setBrowserPatch],
  );

  /* --- filters ------------------------------------------------------------ */

  const types = useMemo(() => {
    const seen = new Set<string>();
    for (const entry of netSlice) if (entry.type) seen.add(entry.type);
    return [...seen].sort();
  }, [netSlice]);

  const netRows = useMemo(
    () =>
      netSlice.filter(
        (entry) =>
          (statusClass === "all" || `${Math.floor(entry.status / 100)}xx` === statusClass) &&
          (resourceType === "all" || entry.type === resourceType),
      ),
    [netSlice, resourceType, statusClass],
  );

  const logRows = useMemo(
    () => (level === "all" ? logSlice : logSlice.filter((entry) => entry.level === level)),
    [level, logSlice],
  );

  const errorCount = useMemo(
    () => logSlice.filter((entry) => entry.level === "error").length,
    [logSlice],
  );
  const failedCount = useMemo(
    () => netSlice.filter((entry) => entry.status >= 400).length,
    [netSlice],
  );

  /** Waterfall scale — the widest bar is the slowest request in view. */
  const span = useMemo(
    () => Math.max(1, ...netRows.map((entry) => (entry.startMs ?? 0) + entry.ms)),
    [netRows],
  );

  const netColumns = useMemo<Column<NetworkEntry>[]>(
    () => [
      {
        id: "method",
        header: "Method",
        width: "62px",
        cell: (row) => <span className="font-mono text-[10.5px]">{row.method}</span>,
        sortValue: (row) => row.method,
      },
      {
        id: "url",
        header: "URL",
        width: "minmax(180px,1fr)",
        cell: (row) => (
          <span className="truncate font-mono text-[10.5px]" title={redactQuery(row.url)}>
            {truncateMiddle(redactQuery(row.url), 44)}
          </span>
        ),
        sortValue: (row) => row.url,
      },
      {
        id: "status",
        header: "Status",
        width: "56px",
        align: "right",
        cell: (row) => (
          <span className={cn("font-mono text-[10.5px] font-semibold", statusTone(row.status))}>
            {row.status}
          </span>
        ),
        sortValue: (row) => row.status,
      },
      {
        id: "type",
        header: "Type",
        width: "76px",
        cell: (row) => (
          <span className="truncate text-[10.5px] text-muted-foreground">{row.type ?? "—"}</span>
        ),
        sortValue: (row) => row.type ?? "",
      },
      {
        id: "size",
        header: "Size",
        width: "68px",
        align: "right",
        cell: (row) => (
          <span className="font-mono text-[10.5px] text-muted-foreground">
            {row.sizeBytes === undefined ? "—" : formatBytes(row.sizeBytes)}
          </span>
        ),
        sortValue: (row) => row.sizeBytes ?? 0,
      },
      {
        id: "start",
        header: "Timing",
        width: "minmax(120px,1fr)",
        cell: (row) => {
          const start = row.startMs ?? 0;
          return (
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="relative h-1.5 min-w-0 flex-1 rounded-full bg-muted">
                <span
                  className={cn(
                    "absolute inset-y-0 rounded-full",
                    row.status >= 400 ? "bg-destructive" : "bg-primary",
                  )}
                  style={{
                    left: `${(start / span) * 100}%`,
                    width: `${Math.max(2, (row.ms / span) * 100)}%`,
                  }}
                />
              </span>
              <span className="w-11 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                {row.ms}ms
              </span>
            </span>
          );
        },
        sortValue: (row) => row.startMs ?? 0,
      },
    ],
    [span],
  );

  const selectorColumns = useMemo<Column<SelectorCandidate>[]>(
    () => [
      {
        id: "selector",
        header: "Selector",
        width: "minmax(200px,1fr)",
        cell: (row) => (
          <span className="truncate font-mono text-[10.5px]" title={row.selector}>
            {row.selector}
          </span>
        ),
        sortValue: (row) => row.selector,
      },
      {
        id: "strategy",
        header: "Strategy",
        width: "80px",
        cell: (row) => (
          <Badge variant={row.strategy === "testid" ? "primary" : "muted"} size="xs">
            {row.strategy}
          </Badge>
        ),
        sortValue: (row) => row.strategy,
      },
      {
        id: "stability",
        header: "Stability",
        width: "110px",
        cell: (row) => (
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "block h-full rounded-full",
                  row.stability >= 80
                    ? "bg-success"
                    : row.stability >= 50
                      ? "bg-waiting"
                      : "bg-destructive",
                )}
                style={{ width: `${row.stability}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right font-mono text-[10px] tabular-nums">
              {row.stability}
            </span>
          </span>
        ),
        sortValue: (row) => row.stability,
      },
      {
        id: "unique",
        header: "Unique",
        width: "62px",
        cell: (row) =>
          row.unique ? (
            <Badge variant="success" size="xs">
              1 node
            </Badge>
          ) : (
            <Badge variant="error" size="xs">
              not unique
            </Badge>
          ),
        sortValue: (row) => (row.unique ? 1 : 0),
      },
      {
        id: "copy",
        header: "",
        width: "36px",
        align: "center",
        cell: (row) => (
          <CopyButton value={row.selector} testId={`inspector-selector-copy-${row.strategy}`} />
        ),
      },
    ],
    [],
  );

  return (
    <div
      className="flex h-full min-w-0 flex-col bg-card"
      data-testid="inspector-pane"
      aria-label="Inspector"
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as InspectorTab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="h-9 w-full shrink-0 justify-start gap-0 overflow-x-auto rounded-none border-x-0 border-t-0 bg-chrome px-1">
          {TABS.map(({ id, label, icon: Icon }) => {
            const badge =
              id === "console" ? errorCount : id === "network" ? failedCount : 0;
            return (
              <TabsTrigger key={id} value={id} data-testid={`inspector-tab-${id}`} className="px-2">
                <Icon aria-hidden />
                <span>{label}</span>
                {badge > 0 ? (
                  <Badge variant="error" size="xs" className="ml-0.5">
                    {badge}
                  </Badge>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {selectedStep ? (
          <div
            className="flex shrink-0 items-center gap-2 border-b border-accent/30 bg-accent/10 px-2 py-1.5"
            data-testid="inspector-step-slice"
          >
            <span className="label-mono truncate text-accent">
              Slice at step {timeline.findIndex((s) => s.id === selectedStep.id) + 1} ·{" "}
              {selectedStep.label}
            </span>
          </div>
        ) : null}

        {/* --- DOM --- */}
        <TabsContent value="dom" className="min-h-0 flex-1 overflow-auto py-1">
          {domQuery.isPending && !tree ? (
            <LoadingState rows={8} variant="panel" />
          ) : domQuery.isError && !tree ? (
            <ErrorState
              error={domQuery.error}
              onRetry={() => void domQuery.refetch()}
              testId="inspector-dom-error"
            />
          ) : tree ? (
            <div data-testid="inspector-dom-tree" role="tree" aria-label="DOM tree">
              <DomRow node={tree} path="0" depth={0} highlight={browser.highlight} onSelect={selectNode} />
            </div>
          ) : (
            <EmptyState
              icon={Layers}
              title="No document yet"
              description="Navigate the browser or start a task — the tree mirrors the page the agent is on."
              testId="inspector-dom-empty"
            />
          )}
        </TabsContent>

        {/* --- A11Y --- */}
        <TabsContent value="a11y" className="min-h-0 flex-1 overflow-auto p-1">
          {a11y.length === 0 ? (
            <EmptyState
              icon={Bug}
              title="No accessibility tree"
              description="The blank page exposes no roles. Navigate the browser to build one."
              testId="inspector-a11y-empty"
            />
          ) : (
            <div data-testid="inspector-a11y-tree" className="flex flex-col">
              {a11y.map((node, index) => {
                const nameless = !node.name && NAME_REQUIRED.has(node.role);
                return (
                  <div
                    key={`${node.role}-${index}`}
                    data-testid={`inspector-a11y-row-${index}`}
                    className="flex items-center gap-2 border-b border-border/40 px-1.5 py-1.5 hover:bg-muted/30"
                  >
                    <Badge variant="info" size="xs" className="shrink-0">
                      {node.role}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-[11px]">
                      {node.name || <span className="text-subtle-foreground">(no name)</span>}
                    </span>
                    {nameless ? (
                      <Badge variant="error" size="xs" className="shrink-0">
                        needs name
                      </Badge>
                    ) : (
                      <Badge variant="muted" size="xs" className="shrink-0">
                        exposed
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* --- NETWORK --- */}
        <TabsContent value="network" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
            <Select value={statusClass} onValueChange={(v) => setStatusClass(v as typeof statusClass)}>
              <SelectTrigger
                aria-label="Filter by status class"
                data-testid="inspector-network-status-filter"
                className="h-7 w-24"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                {STATUS_CLASSES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={resourceType} onValueChange={setResourceType}>
              <SelectTrigger
                aria-label="Filter by resource type"
                data-testid="inspector-network-type-filter"
                className="h-7 w-28"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="label-mono ml-auto shrink-0" data-testid="inspector-network-count">
              {netRows.length}/{netSlice.length}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-1.5">
            <DataTable
              rows={netRows}
              columns={netColumns}
              rowKey={(row) => String(row.id)}
              testId="inspector-network-table"
              rowHeight={30}
              stickyHeader
              virtualize
              sortBy={netSort.by}
              sortDir={netSort.dir}
              onSortChange={(id) =>
                setNetSort((s) =>
                  s.by === id ? { by: id, dir: s.dir === "asc" ? "desc" : "asc" } : { by: id, dir: "asc" },
                )
              }
              empty={
                <EmptyState
                  icon={Network}
                  title={netSlice.length === 0 ? "No requests captured" : "No matching requests"}
                  description={
                    netSlice.length === 0
                      ? "Requests appear here as the agent loads pages."
                      : "Clear the status or type filter to see the rest."
                  }
                  action={
                    netSlice.length === 0 ? null : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setStatusClass("all");
                          setResourceType("all");
                        }}
                        data-testid="inspector-network-clear-filters"
                      >
                        Clear filters
                      </Button>
                    )
                  }
                  testId="inspector-network-empty"
                />
              }
            />
          </div>
        </TabsContent>

        {/* --- CONSOLE --- */}
        <TabsContent value="console" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex shrink-0 items-center gap-1.5 border-b border-border/60 px-2 py-1.5">
            <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
              <SelectTrigger
                aria-label="Filter by console level"
                data-testid="inspector-console-level-filter"
                className="h-7 w-28"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {LEVELS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="label-mono ml-auto shrink-0" data-testid="inspector-console-count">
              {logRows.length}/{logSlice.length}
            </span>
          </div>
          <ConsoleList rows={logRows} pinned={!selectedStep} />
        </TabsContent>

        {/* --- SELECTORS --- */}
        <TabsContent value="selectors" className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 px-2 py-1.5">
            <span className="label-mono shrink-0">Target</span>
            <span
              className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-foreground"
              data-testid="inspector-selector-target"
            >
              {target || "—"}
            </span>
            {target ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setBrowserPatch({ highlight: null })}
                data-testid="inspector-selector-clear-target"
              >
                Clear
              </Button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-1.5">
            {!target ? (
              <EmptyState
                icon={MousePointerClick}
                title="No element targeted"
                description="Pick a node in the DOM tab — its ranked locators appear here."
                action={
                  <Button variant="outline" size="xs" onClick={() => setTab("dom")} data-testid="inspector-selector-goto-dom">
                    Open DOM tree
                  </Button>
                }
                testId="inspector-selectors-empty"
              />
            ) : selectorQuery.isPending ? (
              <LoadingState rows={5} variant="table" />
            ) : selectorQuery.isError ? (
              <ErrorState
                error={selectorQuery.error}
                onRetry={() => void selectorQuery.refetch()}
                testId="inspector-selectors-error"
              />
            ) : (
              <DataTable
                rows={selectorQuery.data ?? []}
                columns={selectorColumns}
                rowKey={(row) => row.selector}
                testId="inspector-selectors-table"
                rowHeight={34}
                stickyHeader
                empty={
                  <EmptyState
                    icon={MousePointerClick}
                    title="No locators for this node"
                    description={`Nothing addressable was found for "${target}".`}
                    testId="inspector-selectors-none"
                  />
                }
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ==========================================================================
   CONSOLE LIST
   Auto-scrolls to the newest line, unless the reader scrolled up — same
   pause-on-user-scroll contract as the chat transcript.
   ======================================================================== */

const NEAR_BOTTOM_PX = 24;

function ConsoleList({ rows, pinned }: { rows: ConsoleEntry[]; pinned: boolean }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !follow || !pinned) return;
    el.scrollTop = el.scrollHeight;
  }, [follow, pinned, rows.length]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX);
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        data-testid="inspector-console-list"
        className="h-full overflow-y-auto"
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={Terminal}
            title="Console is clean"
            description="Nothing was logged at this level."
            testId="inspector-console-empty"
          />
        ) : (
          rows.map((entry) => <ConsoleRow key={entry.id} entry={entry} />)
        )}
      </div>

      {!follow && rows.length > 0 ? (
        <Button
          variant="secondary"
          size="xs"
          onClick={() => {
            setFollow(true);
            const el = scroller.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
          data-testid="inspector-console-jump-latest"
          className="absolute bottom-2 left-1/2 -translate-x-1/2 shadow-lg"
        >
          Jump to latest
        </Button>
      ) : null}
    </div>
  );
}

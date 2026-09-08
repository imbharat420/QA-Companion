"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Columns3,
  FolderOpen,
  MessageSquare,
  Monitor,
  PanelBottomClose,
  PanelBottomOpen,
  SearchCode,
} from "lucide-react";
import { ResizableSplit } from "@/components/shared";
import { Badge, Button, Skeleton, ToggleGroup, ToggleGroupItem } from "@/components/ui";
import { routes } from "@/config/nav";
import { useProject } from "@/lib/queries";
import {
  readUi,
  useActiveProjectId,
  useAgentStore,
  useAgentTaskId,
  useFocusMode,
  useTimelineCollapsed,
  useUiStore,
  type FocusMode,
} from "@/store";

/**
 * The three panes are the heaviest client code in the app (a simulated browser,
 * a DOM tree, a streaming transcript). They load off the first-paint path and
 * then stay mounted for the session — focus mode collapses a pane to zero width
 * rather than unrendering it, so the agent's browser history, scroll positions
 * and in-flight animations survive every layout change.
 */
const ChatPanel = dynamic(
  () => import("@/components/workbench/ChatPanel").then((m) => m.ChatPanel),
  { ssr: false, loading: () => <PaneLoading label="Agent" /> },
);
const BrowserPane = dynamic(
  () => import("@/components/workbench/BrowserPane").then((m) => m.BrowserPane),
  { ssr: false, loading: () => <PaneLoading label="Live browser" bars={2} /> },
);
const InspectorPane = dynamic(
  () => import("@/components/workbench/InspectorPane").then((m) => m.InspectorPane),
  { ssr: false, loading: () => <PaneLoading label="Inspector" /> },
);
const Timeline = dynamic(
  () => import("@/components/workbench/Timeline").then((m) => m.Timeline),
  { ssr: false, loading: () => <PaneLoading label="Execution" bars={1} /> },
);

const H_KEY = "workbench.h";
const V_KEY = "workbench.v";

/** 25 / 48 / 27 lands chat on 360px and the inspector on 380px at 1600px wide. */
const H_DEFAULT = [25, 48, 27];
const H_MIN = [18, 28, 18];
const V_DEFAULT = [78, 22];
const V_MIN = [45, 10];

/** One collapsed layout per focus mode, keyed off `H_KEY` so "none" restores the user's own. */
const FOCUS_LAYOUTS: Record<string, number[]> = {
  [`${H_KEY}.chat`]: [100, 0, 0],
  [`${H_KEY}.browser`]: [0, 100, 0],
  [`${H_KEY}.inspector`]: [0, 0, 100],
};

const FOCUS_CHOICES = [
  { value: "none", label: "All", icon: Columns3 },
  { value: "chat", label: "Chat", icon: MessageSquare },
  { value: "browser", label: "Browser", icon: Monitor },
  { value: "inspector", label: "Inspector", icon: SearchCode },
] as const;

const isPaneFocus = (mode: FocusMode) =>
  mode === "chat" || mode === "browser" || mode === "inspector";

function PaneLoading({ label, bars = 3 }: { label: string; bars?: number }) {
  return (
    <div
      className="flex h-full min-w-0 flex-col gap-2 bg-card p-2.5"
      data-testid={`workbench-pane-loading-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-2">
        <span className="label-mono">{label}</span>
        <Skeleton className="h-3 w-14 rounded-full" />
      </div>
      <Skeleton className="min-h-0 flex-1 rounded-[var(--radius-md)]" />
      {Array.from({ length: bars }, (_, i) => (
        <Skeleton key={i} className="h-3 w-full rounded-full" />
      ))}
    </div>
  );
}

function WorkbenchScreen() {
  const params = useSearchParams();
  const focusMode = useFocusMode();
  const timelineCollapsed = useTimelineCollapsed();
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const toggleTimeline = useUiStore((s) => s.toggleTimeline);
  const selectStep = useAgentStore((s) => s.selectStep);

  const liveTaskId = useAgentTaskId();
  const activeProjectId = useActiveProjectId();
  const project = useProject(activeProjectId ?? "");

  const taskParam = params.get("task");
  const stepParam = params.get("step");

  // ResizableSplit restores a group's sizes when its storageKey changes, and a
  // child's effect runs before this page's — so the focus layouts have to be in
  // the store before any mode is picked, including from the command palette.
  // Seeding them on mount also makes focus mode deterministic: it always fills.
  useEffect(() => {
    const { paneSizes, setPaneSizes } = readUi();
    if (paneSizes[H_KEY]?.length !== 3) setPaneSizes(H_KEY, H_DEFAULT);
    for (const [key, sizes] of Object.entries(FOCUS_LAYOUTS)) setPaneSizes(key, sizes);
  }, []);

  // `?step=` is applied once, and deliberately without waiting for the step to
  // exist: the store just holds the id, so a link that arrives mid-run pins the
  // scrubber the moment that step lands instead of racing the event stream.
  const stepApplied = useRef(false);
  useEffect(() => {
    if (stepApplied.current || !stepParam) return;
    const id = Number(stepParam);
    if (!Number.isInteger(id)) return;
    stepApplied.current = true;
    selectStep(id);
  }, [stepParam, selectStep]);

  const onFocusChange = useCallback(
    (value: string) => setFocusMode((value || "none") as FocusMode),
    [setFocusMode],
  );

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      <ResizableSplit
        direction="horizontal"
        storageKey={isPaneFocus(focusMode) ? `${H_KEY}.${focusMode}` : H_KEY}
        initialSizes={H_DEFAULT}
        minSizes={H_MIN}
        testId="workbench-split-h"
      >
        <ChatPanel />
        <BrowserPane />
        <InspectorPane />
      </ResizableSplit>
    </div>
  );

  const scrubber = (
    // Timeline sizes itself to --timeline-h; inside a resizable pane the split
    // owns the height, so flex-basis has to win over that fixed value.
    <div className="flex h-full min-h-0 flex-col [&>section]:h-auto [&>section]:min-h-0 [&>section]:flex-1">
      <Timeline />
    </div>
  );

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="workbench-page"
      data-focus={focusMode}
    >
      <header className="flex h-9 shrink-0 items-center gap-2 border-b border-border/70 bg-chrome px-2.5">
        <h1 className="shrink-0 font-display text-[13px] font-semibold text-foreground">
          Workbench
        </h1>

        {project.data ? (
          <Link
            href={routes.project(project.data.id)}
            data-testid="workbench-project-chip"
            className="inline-flex min-w-0 shrink items-center gap-1 rounded-full border border-border bg-elevated px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground"
          >
            <FolderOpen className="size-2.5 shrink-0" aria-hidden />
            <span className="truncate">{project.data.name}</span>
          </Link>
        ) : null}

        {taskParam ? (
          <Badge
            variant="outline"
            size="xs"
            className="shrink-0 font-mono tabular-nums"
            data-testid="workbench-task-chip"
          >
            {taskParam === liveTaskId ? "live" : "linked"} · {taskParam}
          </Badge>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ToggleGroup
            type="single"
            value={isPaneFocus(focusMode) ? focusMode : "none"}
            onValueChange={onFocusChange}
            aria-label="Focus one pane"
            data-testid="workbench-focus-mode"
          >
            {FOCUS_CHOICES.map(({ value, label, icon: Icon }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                aria-label={value === "none" ? "Show all panes" : `Focus the ${label} pane`}
                data-testid={`workbench-focus-${value}`}
                className="h-6 px-2 text-[11px]"
              >
                <Icon aria-hidden />
                <span className="hidden xl:inline">{label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <Button
            variant="outline"
            size="xs"
            onClick={toggleTimeline}
            aria-pressed={!timelineCollapsed}
            aria-label={
              timelineCollapsed ? "Show the execution scrubber" : "Hide the execution scrubber"
            }
            data-testid="workbench-timeline-toggle"
          >
            {timelineCollapsed ? (
              <PanelBottomOpen className="size-3" aria-hidden />
            ) : (
              <PanelBottomClose className="size-3" aria-hidden />
            )}
            <span className="hidden xl:inline">Scrubber</span>
          </Button>
        </div>
      </header>

      <ResizableSplit
        direction="vertical"
        storageKey={V_KEY}
        initialSizes={V_DEFAULT}
        minSizes={V_MIN}
        testId="workbench-split-v"
        // A collapsed scrubber leaves the group with one child, which keeps the
        // pane above it — and every agent pane inside it — mounted untouched.
      >
        {timelineCollapsed ? [content] : [content, scrubber]}
      </ResizableSplit>
    </div>
  );
}

export default function WorkbenchPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-full grid-cols-3 gap-px">
          <PaneLoading label="Agent" />
          <PaneLoading label="Live browser" bars={2} />
          <PaneLoading label="Inspector" />
        </div>
      }
    >
      <WorkbenchScreen />
    </Suspense>
  );
}

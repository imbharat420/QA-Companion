"use client";

import { memo, useCallback, useEffect, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Copy, ListChecks, MoreVertical, PlayCircle, RotateCw, Star } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Progress,
  Spinner,
} from "@/components/ui";
import { ScoreRing, SeverityBadge } from "@/components/shared";
import { routes } from "@/config/nav";
import { cn, formatCompact } from "@/lib/utils";
import type { Workspace, WorkspaceState } from "@/lib/api/types";

/* ==========================================================================
   THUMBNAIL PAINTING
   `thumbnail` is a "gradient:<chart-token>" recipe, not a file: a desktop build
   must never reach the network to paint its own chrome. Every value below is a
   Tailwind class off `--chart-n`, so the bands swap with the theme.
   ======================================================================== */

const STOPS: Record<string, string> = {
  "chart-1": "from-chart-1/80 via-chart-1/25 to-chart-3/40",
  "chart-2": "from-chart-2/80 via-chart-2/25 to-chart-1/40",
  "chart-3": "from-chart-3/80 via-chart-3/25 to-chart-4/40",
  "chart-4": "from-chart-4/80 via-chart-4/25 to-chart-6/40",
  "chart-5": "from-chart-5/80 via-chart-5/25 to-chart-2/40",
  "chart-6": "from-chart-6/80 via-chart-6/25 to-chart-3/40",
};

/** "gradient:chart-4" -> token gradient classes. Unknown recipes fall back to slot 1. */
export function projectGradient(thumbnail: string): string {
  const token = thumbnail.startsWith("gradient:")
    ? thumbnail.slice("gradient:".length)
    : "chart-1";
  return cn("bg-linear-to-br", STOPS[token] ?? STOPS["chart-1"]);
}

/* ==========================================================================
   CARD
   ======================================================================== */

export interface ProjectCardProps {
  project: Workspace;
  /** Lifecycle from `WORKSPACE_STATES` — drives the whole card variant. */
  state: WorkspaceState;
  starred: boolean;
  selected?: boolean;
  /** Determinate percentage for an `uploading` card, when the queue knows one. */
  uploadProgress?: number;
  onOpen: (id: string) => void;
  onToggleStar: (id: string) => void;
  onRetry: (id: string) => void;
}

/**
 * An `uploading` card with no queue entry behind it is still a transfer in
 * flight — the adapter reports the state but not the byte count, so the ring
 * advances on its own and holds short of complete rather than lying about 0%.
 *
 * ponytail: local clock, swap for real byte progress when the adapter reports it.
 */
function useTransferProgress(active: boolean): number {
  const [value, setValue] = useState(18);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      setValue((prev) => (prev >= 94 ? 94 : prev + 4));
    }, 900);
    return () => window.clearInterval(timer);
  }, [active]);

  return value;
}

function ProjectCardImpl({
  project,
  state,
  starred,
  selected = false,
  uploadProgress,
  onOpen,
  onToggleStar,
  onRetry,
}: ProjectCardProps) {
  const router = useRouter();
  const offline = state === "offline";
  const transfer = useTransferProgress(state === "uploading" && uploadProgress === undefined);
  const progress = uploadProgress ?? transfer;

  const open = useCallback(() => {
    if (!offline) onOpen(project.id);
  }, [offline, onOpen, project.id]);

  const openWorkbench = useCallback(() => {
    if (!offline) router.push(routes.workbench());
  }, [offline, router]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target !== event.currentTarget) return;
      event.preventDefault();
      open();
    },
    [open],
  );

  const toggleStar = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      onToggleStar(project.id);
    },
    [onToggleStar, project.id],
  );

  const retry = useCallback(
    (event: ReactMouseEvent) => {
      event.stopPropagation();
      onRetry(project.id);
    },
    [onRetry, project.id],
  );

  const copyPath = useCallback(() => {
    void navigator.clipboard
      .writeText(project.path)
      .then(() => toast.success("Path copied", { description: project.path }))
      .catch(() => toast.error("Could not copy the path"));
  }, [project.path]);

  return (
    <article
      data-testid={`projects-card-${project.id}`}
      data-state={state}
      data-starred={starred}
      role="button"
      tabIndex={offline ? -1 : 0}
      aria-label={`Open ${project.name}`}
      aria-disabled={offline || undefined}
      onClick={open}
      onDoubleClick={openWorkbench}
      onKeyDown={onKeyDown}
      className={cn(
        "surface-card group relative flex cursor-pointer flex-col overflow-hidden text-left",
        "transition-[border-color,box-shadow,transform] duration-150 ease-out",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-lg motion-reduce:hover:translate-y-0",
        selected && "border-primary/60 shadow-lg",
        offline && "pointer-events-none cursor-default opacity-50",
      )}
    >
      {/* --- thumbnail band ------------------------------------------------ */}
      <div className={cn("relative aspect-[4/3] w-full", projectGradient(project.thumbnail))}>
        <span
          aria-hidden
          className="absolute inset-2 rounded-[var(--radius-sm)] border border-foreground/15"
        />

        {state === "indexing" ? (
          <span
            aria-hidden
            data-testid={`projects-card-${project.id}-indexing`}
            className={cn(
              "absolute inset-0 animate-shimmer bg-no-repeat",
              "bg-[linear-gradient(90deg,transparent_0%,hsl(var(--foreground)/0.22)_50%,transparent_100%)] bg-[length:200%_100%]",
            )}
          />
        ) : null}

        <div className="absolute right-2 top-2 flex items-center gap-1">
          <button
            type="button"
            onClick={toggleStar}
            aria-label={starred ? `Unstar ${project.name}` : `Star ${project.name}`}
            aria-pressed={starred}
            data-testid={`projects-card-${project.id}-star`}
            className={cn(
              "grid size-7 place-items-center rounded-[var(--radius-sm)] backdrop-blur-sm transition-colors",
              "bg-chrome/50 hover:bg-chrome/80",
              starred ? "text-accent opacity-100" : "text-foreground/70 opacity-0",
              "group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            <Star className={cn("size-3.5", starred && "fill-current")} aria-hidden />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                aria-label={`Actions for ${project.name}`}
                data-testid={`projects-card-${project.id}-menu`}
                className={cn(
                  "grid size-7 place-items-center rounded-[var(--radius-sm)] backdrop-blur-sm transition-colors",
                  "bg-chrome/50 text-foreground/70 opacity-0 hover:bg-chrome/80",
                  "group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                )}
              >
                <MoreVertical className="size-3.5" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem asChild data-testid={`projects-card-${project.id}-menu-workbench`}>
                <Link href={routes.workbench()}>
                  <Bot className="size-3.5" aria-hidden />
                  Open workbench
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild data-testid={`projects-card-${project.id}-menu-suites`}>
                <Link href={routes.suites({ projectId: project.id })}>
                  <ListChecks className="size-3.5" aria-hidden />
                  Open suites
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild data-testid={`projects-card-${project.id}-menu-runs`}>
                <Link href={routes.runs()}>
                  <PlayCircle className="size-3.5" aria-hidden />
                  Open runs
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={copyPath}
                data-testid={`projects-card-${project.id}-menu-copy-path`}
              >
                <Copy className="size-3.5" aria-hidden />
                Copy path
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onToggleStar(project.id)}
                data-testid={`projects-card-${project.id}-menu-star`}
              >
                <Star className={cn("size-3.5", starred && "fill-current")} aria-hidden />
                {starred ? "Remove star" : "Star project"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <span className="absolute bottom-2 right-2 rounded-full bg-chrome/70 p-0.5 backdrop-blur-sm">
          <ScoreRing score={project.health} size={40} label={`${project.name} health`} />
        </span>
      </div>

      {/* --- body ----------------------------------------------------------- */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate font-display text-[13px] font-semibold tracking-tight">
            {project.name}
          </h3>
          <Badge variant="outline" size="xs" className="shrink-0">
            {project.framework}
          </Badge>
        </div>

        <p className="text-code truncate text-subtle-foreground">{project.branch}</p>

        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {project.description}
        </p>

        {/* --- state line ---------------------------------------------------- */}
        {state === "indexing" ? (
          <p
            data-testid={`projects-card-${project.id}-state`}
            className="flex items-center gap-1.5 text-[11px] text-executing"
          >
            <Spinner size="xs" />
            Indexing project files…
          </p>
        ) : null}

        {state === "uploading" ? (
          <div data-testid={`projects-card-${project.id}-state`} className="flex flex-col gap-1">
            <p className="flex items-center justify-between gap-2 text-[11px] text-waiting">
              <span>Uploading…</span>
              <span className="font-mono tabular-nums">{Math.round(progress)}%</span>
            </p>
            <Progress value={progress} tone="warning" aria-label={`Upload progress for ${project.name}`} />
          </div>
        ) : null}

        {state === "error" ? (
          <div
            data-testid={`projects-card-${project.id}-state`}
            className="flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-1.5">
              <SeverityBadge severity="high" size="xs" />
              <span className="text-[11px] text-error">Index failed</span>
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={retry}
              data-testid={`projects-card-${project.id}-retry`}
            >
              <RotateCw className="size-3" aria-hidden />
              Retry
            </Button>
          </div>
        ) : null}

        {state === "offline" ? (
          <p
            data-testid={`projects-card-${project.id}-state`}
            className="text-[11px] text-muted-foreground"
          >
            Offline — reconnect the source to open it.
          </p>
        ) : null}

        {/* --- metric strip -------------------------------------------------- */}
        <div className="mt-auto flex items-center justify-between gap-1 border-t border-border/50 pt-2">
          <Metric
            href={routes.suites({ projectId: project.id })}
            label="tests"
            value={formatCompact(project.tests)}
            testId={`projects-card-${project.id}-tests`}
          />
          <Metric
            href={routes.workbench()}
            label="sessions"
            value={formatCompact(project.sessions)}
            testId={`projects-card-${project.id}-sessions`}
          />
          <Metric
            href={routes.findings({ projectId: project.id })}
            label="health"
            value={`${project.health}`}
            testId={`projects-card-${project.id}-health`}
          />
        </div>

        <p className="text-[10px] text-subtle-foreground">Active {project.lastActive}</p>
      </div>
    </article>
  );
}

function Metric({
  href,
  label,
  value,
  testId,
}: {
  href: string;
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <Link
      href={href}
      onClick={(event) => event.stopPropagation()}
      data-testid={testId}
      className="flex min-w-0 flex-1 flex-col rounded-[var(--radius-sm)] px-1 py-0.5 transition-colors hover:bg-muted"
    >
      <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{value}</span>
      <span className="label-mono truncate text-[9px]">{label}</span>
    </Link>
  );
}

export const ProjectCard = memo(ProjectCardImpl);

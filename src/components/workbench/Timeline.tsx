"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Bug,
  Camera,
  ChevronLeft,
  ChevronRight,
  Code2,
  Crosshair,
  Globe,
  Keyboard,
  ListChecks,
  MousePointerClick,
  Pause,
  Play,
  Radar,
  Radio,
  ScanSearch,
  ShieldAlert,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SeverityBadge } from "@/components/shared";
import { Badge, Button, Spinner } from "@/components/ui";
import { routes } from "@/config/nav";
import { cn, formatDuration } from "@/lib/utils";
import {
  readAgent,
  useAgentFindings,
  useAgentRunning,
  useAgentStore,
  useAgentTimeline,
  useSelectedStepId,
} from "@/store/agentStore";
import { useUiStore } from "@/store/uiStore";
import type { Severity, TimelineKind, TimelineStep } from "@/lib/api/types";

/**
 * THE EXECUTION SCRUBBER.
 *
 * This strip is the run's time axis: selecting a chip is what moves the browser
 * pane and the inspector back to that instant, so the selected chip has to look
 * *locked*, not merely hovered — otherwise a stale screenshot reads as a live
 * browser. Everything else follows from that: playback walks the selection
 * forward, auto-follow stops the moment the user picks a step by hand, and
 * failed steps stay expanded because they are the reason anyone scrubs.
 */

/** Playback cadence — slow enough to read a label, fast enough to watch a run back. */
const PLAY_MS = 900;

const KIND_ICONS: Record<TimelineKind, LucideIcon> = {
  plan: ListChecks,
  navigate: Globe,
  click: MousePointerClick,
  type: Keyboard,
  inspect: ScanSearch,
  assert: BadgeCheck,
  approval: ShieldAlert,
  network: Wifi,
  screenshot: Camera,
  finding: Bug,
  scan: Radar,
  code: Code2,
};

const STATUS_CHIP: Record<TimelineStep["status"], string> = {
  ok: "border-success/35 hover:border-success/60",
  fail: "border-error/60 bg-error/8 hover:border-error",
  warn: "border-waiting/50 bg-waiting/8 hover:border-waiting",
  info: "border-border hover:border-primary/45",
};

const STATUS_ICON: Record<TimelineStep["status"], string> = {
  ok: "bg-success/15 text-success",
  fail: "bg-error/15 text-error",
  warn: "bg-waiting/15 text-waiting",
  info: "bg-muted text-muted-foreground",
};

/* ==========================================================================
   Chip
   ======================================================================== */

interface StepChipProps {
  step: TimelineStep;
  selected: boolean;
  /** Roving tabindex — exactly one chip is in the tab order. */
  focusable: boolean;
  severity?: Severity;
  onSelect: (id: number) => void;
  onOpenFinding: (findingId: string) => void;
}

const StepChip = memo(function StepChip({
  step,
  selected,
  focusable,
  severity,
  onSelect,
  onOpenFinding,
}: StepChipProps) {
  const Icon = KIND_ICONS[step.kind];
  /** A failure is never collapsed — it is the thing the operator came to read. */
  const expanded = selected || step.status === "fail";
  const finding = step.findingId;

  return (
    <div
      role="option"
      aria-selected={selected}
      aria-label={`Step ${step.id}: ${step.label} — ${step.status}`}
      tabIndex={focusable ? 0 : -1}
      data-step-id={step.id}
      data-testid={`timeline-step-${step.id}`}
      data-status={step.status}
      data-kind={step.kind}
      onClick={() => onSelect(step.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(step.id);
        }
      }}
      className={cn(
        "relative z-10 flex shrink-0 cursor-pointer snap-start flex-col gap-1 rounded-[var(--radius-md)]",
        "border bg-card px-2 py-1.5 transition-colors",
        expanded ? "w-56" : "w-44",
        STATUS_CHIP[step.status],
        selected && "border-primary bg-primary/10 ring-2 ring-primary/60",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className={cn(
            "grid size-4 shrink-0 place-items-center rounded-[4px]",
            STATUS_ICON[step.status],
          )}
        >
          <Icon className="size-2.5" />
        </span>
        <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-subtle-foreground">
          {step.id}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px] font-medium",
            step.status === "fail" ? "text-error" : "text-foreground",
          )}
        >
          {step.label}
        </span>
        {selected ? (
          <Crosshair className="size-3 shrink-0 text-primary" aria-hidden />
        ) : null}
      </div>

      <div className="flex items-center gap-1.5 font-mono text-[9.5px] tabular-nums text-subtle-foreground">
        <span className="uppercase tracking-[0.04em]">{step.kind}</span>
        {step.durationMs !== undefined ? <span>· {formatDuration(step.durationMs)}</span> : null}
        {selected ? <span className="ml-auto text-primary">scrubbed</span> : null}
      </div>

      {expanded ? (
        <p className="line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">
          {step.detail}
        </p>
      ) : null}

      {step.screenshotSrc || step.findingId ? (
        <div className="flex flex-wrap items-center gap-1">
          {step.screenshotSrc ? (
            <Badge
              variant="muted"
              size="xs"
              data-testid={`timeline-screenshot-${step.id}`}
              title={step.screenshotSrc}
            >
              <Camera className="size-2.5" aria-hidden /> shot
            </Badge>
          ) : null}
          {finding ? (
            <Link
              href={routes.finding(finding)}
              // Deep-links the Findings page *and* raises the cockpit here, so
              // the operator can triage without leaving the run.
              onClick={(e) => {
                e.stopPropagation();
                onOpenFinding(finding);
              }}
              data-testid={`timeline-finding-${finding}`}
              className="inline-flex items-center gap-1 rounded-full border border-primary/35 bg-primary/10 px-1.5 py-px font-mono text-[9.5px] text-primary transition-colors hover:border-primary"
            >
              {severity ? <SeverityBadge severity={severity} size="xs" showLabel={false} /> : null}
              {finding}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

/* ==========================================================================
   Timeline
   ======================================================================== */

export function Timeline() {
  const steps = useAgentTimeline();
  const selectedStepId = useSelectedStepId();
  const running = useAgentRunning();
  const findings = useAgentFindings();
  const selectStep = useAgentStore((s) => s.selectStep);
  const openCockpit = useUiStore((s) => s.openCockpit);

  const [playing, setPlaying] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const severityById = useMemo(
    () => new Map(findings.map((f) => [f.id, f.severity])),
    [findings],
  );

  const selectedIndex = steps.findIndex((s) => s.id === selectedStepId);

  /* --- selection ---------------------------------------------------------- */

  const focusStep = useCallback((id: number) => {
    scrollerRef.current
      ?.querySelector<HTMLElement>(`[data-step-id="${id}"]`)
      ?.focus({ preventScroll: false });
  }, []);

  /** A manual pick is a decision to stop following the run. */
  const onSelect = useCallback(
    (id: number) => {
      setPlaying(false);
      selectStep(id);
    },
    [selectStep],
  );

  const onOpenFinding = useCallback((findingId: string) => openCockpit(findingId), [openCockpit]);

  const goTo = useCallback(
    (index: number) => {
      const next = steps[Math.max(0, Math.min(steps.length - 1, index))];
      if (!next) return;
      setPlaying(false);
      selectStep(next.id);
      focusStep(next.id);
    },
    [steps, selectStep, focusStep],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (steps.length === 0) return;
      const from = selectedIndex < 0 ? -1 : selectedIndex;
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          goTo(from + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          goTo(from < 0 ? 0 : from - 1);
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(steps.length - 1);
          break;
        default:
      }
    },
    [steps.length, selectedIndex, goTo],
  );

  const backToLive = useCallback(() => {
    setPlaying(false);
    selectStep(null);
  }, [selectStep]);

  /* --- playback ----------------------------------------------------------- */

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      // Read live: the timeline keeps growing underneath a running playback.
      const { timeline, selectedStepId: current } = readAgent();
      const next = timeline[timeline.findIndex((s) => s.id === current) + 1];
      if (!next) {
        setPlaying(false);
        return;
      }
      selectStep(next.id);
      focusStep(next.id);
    }, PLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing, selectStep, focusStep]);

  /* --- follow the newest step, unless the user is scrubbing ---------------- */

  useEffect(() => {
    if (selectedStepId !== null || !running) return;
    const el = scrollerRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [steps.length, running, selectedStepId]);

  const atEnd = selectedIndex >= 0 && selectedIndex === steps.length - 1;

  return (
    <section
      aria-label="Execution scrubber"
      data-testid="timeline"
      className="flex h-[var(--timeline-h)] min-h-0 w-full flex-col overflow-hidden border-t border-border/70 bg-card"
    >
      {/* ---- controls ---- */}
      <header className="flex shrink-0 items-center gap-1.5 border-b border-border/60 px-2.5 py-1.5">
        <span className="label-mono shrink-0">Execution</span>
        <Badge variant="outline" size="xs" className="shrink-0 tabular-nums">
          {steps.length} steps
        </Badge>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setPlaying((v) => !v)}
          disabled={steps.length === 0 || (atEnd && !playing)}
          aria-label={playing ? "Pause playback" : "Play the run back"}
          aria-pressed={playing}
          data-testid="timeline-play-toggle"
        >
          {playing ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goTo(selectedIndex < 0 ? 0 : selectedIndex - 1)}
          disabled={steps.length === 0 || selectedIndex === 0}
          aria-label="Previous step"
          data-testid="timeline-prev-step"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => goTo(selectedIndex + 1)}
          disabled={steps.length === 0 || atEnd}
          aria-label="Next step"
          data-testid="timeline-next-step"
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {selectedStepId !== null ? (
            <>
              <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-primary">
                scrubbed to step {selectedStepId}
              </span>
              <Button
                variant="outline"
                size="xs"
                onClick={backToLive}
                data-testid="timeline-clear-selection"
              >
                <Radio className="size-2.5" aria-hidden /> Back to live
              </Button>
            </>
          ) : (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.04em]",
                running ? "text-executing" : "text-subtle-foreground",
              )}
              data-testid="timeline-follow-state"
            >
              <Radio className="size-2.5" aria-hidden /> {running ? "following live" : "idle"}
            </span>
          )}
        </div>
      </header>

      {/* ---- the scrubber ---- */}
      {steps.length === 0 ? (
        <div
          className="flex min-h-0 flex-1 items-center justify-center gap-2 px-3"
          data-testid="timeline-empty"
        >
          {running ? <Spinner className="size-3 text-executing" /> : null}
          <p className="text-[11px] text-muted-foreground">
            {running
              ? "Waiting for the first step…"
              : "No steps yet — start a task and every action lands here as a scrubbable step."}
          </p>
        </div>
      ) : (
        <div
          ref={scrollerRef}
          role="listbox"
          tabIndex={selectedIndex < 0 ? 0 : -1}
          aria-label="Run steps"
          aria-orientation="horizontal"
          onKeyDown={onKeyDown}
          data-testid="timeline-scrubber"
          className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-2.5 py-2"
        >
          <div className="relative flex h-full items-start gap-1.5">
            {/* The connecting rail — visible in the gaps between chips. */}
            <span aria-hidden className="absolute inset-x-0 top-3.5 h-px bg-border/60" />
            {steps.map((step, i) => (
              <StepChip
                key={step.id}
                step={step}
                selected={step.id === selectedStepId}
                focusable={selectedIndex < 0 ? i === 0 : step.id === selectedStepId}
                severity={step.findingId ? severityById.get(step.findingId) : undefined}
                onSelect={onSelect}
                onOpenFinding={onOpenFinding}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

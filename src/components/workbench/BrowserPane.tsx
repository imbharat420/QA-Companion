"use client";

/**
 * THE LIVE BROWSER PANE.
 *
 * Real chrome (history, editable URL, tabs, viewport sizes) over the fake
 * target site, plus the agent overlay that makes the automation visible.
 *
 * The overlay's coordinate space is the *frame*, not the pane: the frame is
 * what the viewport toggle resizes, so measuring against it keeps the cursor,
 * target box and typing chip aligned at every device width. Element geometry
 * comes from the ref map `reg()` fills — `BrowserState.highlight` and
 * `typing.field` are bare node ids, and this is the only place that can turn
 * one into on-screen pixels. `cursor` / `ripple` arrive as viewport
 * percentages, so they need the frame's size rather than an element.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Hand,
  Lock,
  Monitor,
  MousePointer2,
  Pause,
  Plus,
  RotateCw,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { ConfirmDialog } from "@/components/shared";
import { cn, localId } from "@/lib/utils";
import {
  useAgentBrowser,
  useAgentRunning,
  useAgentStatus,
  useAgentStore,
  useAgentTimeline,
  useSelectedStep,
} from "@/store/agentStore";
import { useAppearance } from "@/store/settingsStore";
import { FakeSite, type RegFn } from "./FakeSite";
import type { BrowserState, BrowserTab, PageId } from "@/lib/api/types";

interface Pt {
  x: number;
  y: number;
}
interface Rect extends Pt {
  w: number;
  h: number;
}

type Viewport = BrowserState["viewport"];

/** Rendered frame widths. Desktop fills the pane; the others are real device widths. */
const FRAME_WIDTH: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "834px",
  mobile: "390px",
};

const VIEWPORTS: { id: Viewport; label: string; icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet", icon: Tablet },
  { id: "mobile", label: "Mobile", icon: Smartphone },
];

/** URL → page, so a typed address lands on the same mock page the agent uses. */
const PAGE_BY_PATH: [needle: string, page: PageId][] = [
  ["/login", "login"],
  ["/signin", "login"],
  ["/checkout", "checkout"],
  ["/confirm", "confirm"],
];

function pageForUrl(url: string): PageId {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("about:")) return "blank";
  const hit = PAGE_BY_PATH.find(([needle]) => trimmed.toLowerCase().includes(needle));
  return hit ? hit[1] : "home";
}

function normaliseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "about:blank";
  if (/^[a-z]+:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Secrets must never be legible in the typing overlay, even on a demo site. */
const SENSITIVE_FIELD = /pass|card|cvv|cvc|secret|token/i;
const maskText = (text: string) => text.replace(/\S/g, "•");

/** OS query plus the in-app appearance switch — the overlay honours both. */
function useReducedMotion(): boolean {
  const { reduceMotion } = useAppearance();
  const [osReduced, setOsReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setOsReduced(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);

  return reduceMotion || osReduced;
}

interface Geometry {
  cursor: Pt | null;
  box: Rect | null;
  field: Rect | null;
  ripple: (Pt & { key: number }) | null;
}

const NO_GEOMETRY: Geometry = { cursor: null, box: null, field: null, ripple: null };

/** Timeline step status → badge variant, for the scrubbed-step card. */
const STEP_TONE = {
  ok: "success",
  fail: "error",
  warn: "warning",
  info: "info",
} as const;

export function BrowserPane() {
  const browser = useAgentBrowser();
  const status = useAgentStatus();
  const running = useAgentRunning();
  const timeline = useAgentTimeline();
  const selectedStep = useSelectedStep();
  const selectStep = useAgentStore((s) => s.selectStep);
  const setBrowserPatch = useAgentStore((s) => s.setBrowserPatch);
  const takeControl = useAgentStore((s) => s.takeControl);
  const reducedMotion = useReducedMotion();

  const frameRef = useRef<HTMLDivElement | null>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const reloadTimer = useRef<number | undefined>(undefined);

  const [geo, setGeo] = useState<Geometry>(NO_GEOMETRY);
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [confirmTakeover, setConfirmTakeover] = useState(false);
  const [shotFailed, setShotFailed] = useState(false);

  /** Session history. The pane never unmounts mid-run, so a local stack is the history. */
  const [history, setHistory] = useState<{ entries: string[]; index: number }>(() => ({
    entries: [browser.url],
    index: 0,
  }));

  const reg: RegFn = useCallback(
    (id) => (el) => {
      if (el) els.current.set(id, el);
      else els.current.delete(id);
    },
    [],
  );

  const scrubbing = Boolean(selectedStep);
  const overlayOn = !scrubbing && !browser.takeover && !reducedMotion;

  /* --- geometry ------------------------------------------------------------ */

  const measure = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const f = frame.getBoundingClientRect();

    const rectOf = (id: string | null | undefined): Rect | null => {
      if (!id) return null;
      const el = els.current.get(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - f.left, y: r.top - f.top, w: r.width, h: r.height };
    };

    const box = rectOf(browser.highlight);
    const field = rectOf(browser.typing?.field);
    // The cursor springs to a known element's centre and falls back to the
    // percentage the event carried while nothing is targeted (mid-click, say).
    const target = box ?? field;
    const cursor = target
      ? { x: target.x + target.w / 2, y: target.y + target.h / 2 }
      : browser.cursor
        ? { x: (browser.cursor.x / 100) * f.width, y: (browser.cursor.y / 100) * f.height }
        : null;

    setGeo({
      cursor,
      box,
      field,
      ripple: browser.ripple
        ? {
            x: (browser.ripple.x / 100) * f.width,
            y: (browser.ripple.y / 100) * f.height,
            key: browser.ripple.key,
          }
        : null,
    });
  }, [browser.cursor, browser.highlight, browser.ripple, browser.typing?.field]);

  useLayoutEffect(() => {
    measure();
  }, [measure, browser.page, browser.inputs, browser.viewport]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(frame);
    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => () => window.clearTimeout(reloadTimer.current), []);

  /* --- navigation --------------------------------------------------------- */

  const navigate = useCallback(
    (rawUrl: string) => {
      const url = normaliseUrl(rawUrl);
      const page = pageForUrl(url);
      setBrowserPatch({
        url,
        page,
        title: page === "blank" ? "New Tab" : url,
        highlight: null,
        cursor: null,
        ripple: null,
        typing: null,
        overlay: null,
        tabs: browser.tabs.map((t) =>
          t.id === browser.activeTab ? { ...t, url, title: page === "blank" ? "New Tab" : url } : t,
        ),
      });
    },
    [browser.activeTab, browser.tabs, setBrowserPatch],
  );

  // An agent-driven navigation has to land in the history too, or Back is a lie.
  useEffect(() => {
    setHistory((h) =>
      h.entries[h.index] === browser.url
        ? h
        : { entries: [...h.entries.slice(0, h.index + 1), browser.url], index: h.index + 1 },
    );
  }, [browser.url]);

  const step = useCallback(
    (delta: -1 | 1) => {
      const index = history.index + delta;
      const url = history.entries[index];
      if (url === undefined) return;
      setHistory({ entries: history.entries, index });
      navigate(url);
    },
    [history, navigate],
  );

  const reload = useCallback(() => {
    window.clearTimeout(reloadTimer.current);
    setBrowserPatch({ loading: true });
    reloadTimer.current = window.setTimeout(() => setBrowserPatch({ loading: false }), 600);
  }, [setBrowserPatch]);

  const openTab = useCallback(() => {
    const tab: BrowserTab = { id: localId("tab"), title: "New Tab", url: "about:blank" };
    setBrowserPatch({
      tabs: [...browser.tabs, tab],
      activeTab: tab.id,
      url: tab.url,
      title: tab.title,
      page: "blank",
    });
  }, [browser.tabs, setBrowserPatch]);

  const selectTab = useCallback(
    (tab: BrowserTab) => {
      const url = tab.url ?? "about:blank";
      setBrowserPatch({ activeTab: tab.id, url, title: tab.title, page: pageForUrl(url) });
    },
    [setBrowserPatch],
  );

  const closeTab = useCallback(
    (tab: BrowserTab) => {
      if (browser.tabs.length < 2) return;
      const tabs = browser.tabs.filter((t) => t.id !== tab.id);
      if (tab.id !== browser.activeTab) {
        setBrowserPatch({ tabs });
        return;
      }
      const next = tabs[Math.min(browser.tabs.indexOf(tab), tabs.length - 1)];
      const url = next.url ?? "about:blank";
      setBrowserPatch({ tabs, activeTab: next.id, url, title: next.title, page: pageForUrl(url) });
    },
    [browser.activeTab, browser.tabs, setBrowserPatch],
  );

  const onTakeControlChange = useCallback(
    (on: boolean) => {
      // Turning it on suspends a running agent, so that direction is confirmed.
      if (on && running) setConfirmTakeover(true);
      else takeControl(on);
    },
    [running, takeControl],
  );

  const secure = browser.url.startsWith("https://");
  const loading = browser.loading || browser.page === "loading";
  const urlValue = draftUrl ?? browser.url;
  const stepIndex = selectedStep ? timeline.findIndex((s) => s.id === selectedStep.id) + 1 : 0;

  return (
    <div className="flex h-full min-w-0 flex-col bg-card" data-testid="live-browser">
      {/* --- chrome --- */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border/70 bg-chrome px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          data-testid="live-browser-back"
          disabled={history.index === 0}
          onClick={() => step(-1)}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Forward"
          data-testid="live-browser-forward"
          disabled={history.index >= history.entries.length - 1}
          onClick={() => step(1)}
        >
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Reload"
          data-testid="live-browser-reload"
          onClick={reload}
        >
          <RotateCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden />
        </Button>

        <form
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border border-input bg-background px-2.5"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(urlValue);
            setDraftUrl(null);
          }}
        >
          <Lock
            className={cn("size-3 shrink-0", secure ? "text-success" : "text-muted-foreground")}
            aria-label={secure ? "Secure connection" : "Not secure"}
            data-testid="live-browser-ssl"
          />
          <input
            value={urlValue}
            onChange={(event) => setDraftUrl(event.target.value)}
            onBlur={() => setDraftUrl(null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setDraftUrl(null);
                event.currentTarget.blur();
              }
            }}
            spellCheck={false}
            aria-label="Address bar"
            data-testid="live-browser-url-bar"
            className="h-7 min-w-0 flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-subtle-foreground"
          />
          {loading ? (
            <span
              aria-hidden
              className="size-1.5 shrink-0 animate-pulse rounded-full bg-executing"
            />
          ) : null}
        </form>

        <ToggleGroup
          type="single"
          value={browser.viewport}
          onValueChange={(value) => value && setBrowserPatch({ viewport: value as Viewport })}
          aria-label="Viewport size"
          data-testid="live-browser-viewport-toggle"
          className="shrink-0"
        >
          {VIEWPORTS.map(({ id, label, icon: Icon }) => (
            <ToggleGroupItem
              key={id}
              value={id}
              aria-label={label}
              data-testid={`live-browser-viewport-${id}`}
              className="min-w-7 px-1.5"
            >
              <Icon aria-hidden />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Button
          variant={browser.takeover ? "accent" : "ghost"}
          size="xs"
          aria-pressed={browser.takeover}
          aria-label="Take control of the browser"
          data-testid="live-browser-take-control"
          onClick={() => onTakeControlChange(!browser.takeover)}
          className="shrink-0"
        >
          <Hand className="size-3.5" aria-hidden />
          <span className="hidden xl:inline">{browser.takeover ? "You drive" : "Take control"}</span>
        </Button>
      </div>

      {/* --- tab strip --- */}
      <div className="flex h-7 shrink-0 items-stretch gap-1 border-b border-border/70 bg-chrome px-2">
        <div className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
          {browser.tabs.map((tab, index) => {
            const active = tab.id === browser.activeTab;
            return (
              <div
                key={tab.id}
                className={cn(
                  "group flex min-w-0 max-w-44 shrink items-center gap-1.5 rounded-t-[var(--radius-sm)] px-2",
                  active ? "bg-card text-foreground" : "text-muted-foreground hover:bg-muted/50",
                )}
              >
                <button
                  type="button"
                  onClick={() => selectTab(tab)}
                  data-testid={`live-browser-tab-${index + 1}`}
                  className="flex min-w-0 items-center gap-1.5 text-[11px]"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      loading && active ? "animate-pulse bg-executing" : "bg-success",
                    )}
                  />
                  <span className="truncate">{tab.title}</span>
                </button>
                <button
                  type="button"
                  onClick={() => closeTab(tab)}
                  disabled={browser.tabs.length < 2}
                  aria-label={`Close ${tab.title}`}
                  data-testid={`live-browser-tab-${index + 1}-close`}
                  className="shrink-0 rounded text-subtle-foreground hover:text-foreground disabled:opacity-30"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </div>
            );
          })}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New tab"
            data-testid="live-browser-new-tab"
            onClick={openTab}
            className="size-6 shrink-0 self-center"
          >
            <Plus className="size-3.5" aria-hidden />
          </Button>
        </div>

        <div className="flex shrink-0 items-center">
          {browser.takeover ? (
            <Badge variant="accent" size="xs" dot data-testid="live-browser-driver">
              You are driving
            </Badge>
          ) : running ? (
            <Badge variant="info" size="xs" data-testid="live-browser-driver">
              <Bot className="size-3" aria-hidden />
              Agent driving
            </Badge>
          ) : status === "waiting" ? (
            <Badge variant="warning" size="xs" data-testid="live-browser-driver">
              <Pause className="size-3" aria-hidden />
              Paused
            </Badge>
          ) : (
            <Badge variant="muted" size="xs" data-testid="live-browser-driver">
              Idle
            </Badge>
          )}
        </div>
      </div>

      {/* --- scrub banner --- */}
      {selectedStep ? (
        <div
          className="flex h-8 shrink-0 items-center gap-2 border-b border-accent/30 bg-accent/10 px-3"
          data-testid="live-browser-scrub-banner"
        >
          <Camera className="size-3.5 shrink-0 text-accent" aria-hidden />
          <span className="label-mono truncate text-accent">
            Viewing step {stepIndex} of {timeline.length} · {selectedStep.label}
          </span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => selectStep(null)}
            data-testid="live-browser-return-live"
            className="ml-auto shrink-0"
          >
            Return to live
          </Button>
        </div>
      ) : null}

      {/* --- viewport --- */}
      <div
        className="grid min-h-0 flex-1 place-items-center overflow-hidden bg-background p-0"
        data-testid="live-browser-viewport"
      >
        <div
          ref={frameRef}
          style={{ width: FRAME_WIDTH[browser.viewport] }}
          className={cn(
            "relative h-full max-w-full overflow-hidden bg-card",
            browser.viewport !== "desktop" && "border-x border-border",
          )}
        >
          <FakeSite page={browser.page} inputs={browser.inputs} reg={reg} />

          {/* The agent owns the pointer until the user takes control. */}
          {running && !browser.takeover && !scrubbing ? (
            <div
              aria-hidden
              data-testid="live-browser-input-shield"
              className="absolute inset-0 z-10 cursor-not-allowed"
            />
          ) : null}

          <div aria-hidden className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
            {browser.overlay && !scrubbing ? (
              <div
                data-testid="live-browser-step-banner"
                className="absolute left-1/2 top-3 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-full border border-executing/40 bg-card/95 px-3 py-1 shadow-lg backdrop-blur"
              >
                <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-executing" />
                <span className="truncate font-mono text-[10px] text-foreground">
                  {browser.overlay}
                </span>
              </div>
            ) : null}

            {overlayOn && geo.box ? (
              <div
                data-testid="live-browser-target-box"
                className="absolute left-0 top-0 rounded-[var(--radius-sm)] border-2 border-executing transition-transform duration-300 ease-out"
                style={{
                  transform: `translate3d(${geo.box.x - 3}px, ${geo.box.y - 3}px, 0)`,
                  width: geo.box.w + 6,
                  height: geo.box.h + 6,
                }}
              >
                {browser.highlight ? (
                  <span className="absolute -top-4 left-0 whitespace-nowrap rounded-sm bg-executing px-1 font-mono text-[9px] text-background">
                    {browser.highlight}
                  </span>
                ) : null}
              </div>
            ) : null}

            {overlayOn && browser.typing && geo.field ? (
              <div
                data-testid="live-browser-typing"
                className="absolute left-0 top-0 flex max-w-[80%] items-center gap-1 rounded-[var(--radius-sm)] border border-executing/40 bg-card/95 px-1.5 py-0.5"
                style={{
                  transform: `translate3d(${geo.field.x}px, ${geo.field.y + geo.field.h + 4}px, 0)`,
                }}
              >
                <span className="truncate font-mono text-[10px] text-foreground">
                  {SENSITIVE_FIELD.test(browser.typing.field)
                    ? maskText(browser.typing.text)
                    : browser.typing.text}
                </span>
                <span className="h-3 w-px animate-pulse bg-executing" />
              </div>
            ) : null}

            {overlayOn && geo.ripple ? (
              <span
                key={geo.ripple.key}
                data-testid="live-browser-ripple"
                className="animate-ripple absolute size-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-executing"
                style={{
                  left: geo.ripple.x,
                  top: geo.ripple.y,
                  animationDuration: "300ms",
                }}
              />
            ) : null}

            {overlayOn && geo.cursor ? (
              <div
                data-testid="live-browser-cursor"
                className="absolute left-0 top-0 transition-transform duration-300 ease-out"
                style={{ transform: `translate3d(${geo.cursor.x}px, ${geo.cursor.y}px, 0)` }}
              >
                <span className="absolute -left-1 -top-1 size-2 rounded-full bg-executing glow-primary" />
                <MousePointer2 className="absolute left-0.5 top-0.5 size-4 fill-executing text-background" />
              </div>
            ) : null}
          </div>

          {/* Scrubbed instant: the captured shot when there is one, the step record otherwise. */}
          {selectedStep ? (
            <div
              data-testid="live-browser-step-capture"
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/95 p-4"
            >
              {selectedStep.screenshotSrc && !shotFailed ? (
                // A raw <img>: the shot is a run artefact fetched by path, not a
                // build-time asset, so next/image has nothing to optimise.
                <img
                  src={selectedStep.screenshotSrc}
                  alt={`Screenshot captured at step ${stepIndex}: ${selectedStep.label}`}
                  onError={() => setShotFailed(true)}
                  className="max-h-full max-w-full rounded-[var(--radius-md)] border border-border object-contain"
                />
              ) : (
                <div className="surface-inset w-full max-w-md rounded-[var(--radius-lg)] p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={STEP_TONE[selectedStep.status]} size="xs">
                      {selectedStep.kind}
                    </Badge>
                    <span className="label-mono">{selectedStep.ts.slice(11, 19)}</span>
                  </div>
                  <p className="mt-2 font-display text-sm font-semibold">{selectedStep.label}</p>
                  <p className="mt-1 break-words font-mono text-[11px] leading-relaxed text-muted-foreground">
                    {selectedStep.detail}
                  </p>
                  <p className="mt-3 border-t border-border/60 pt-2 text-[11px] text-subtle-foreground">
                    No screenshot was captured at this step — the panes below show the network and
                    console slice recorded at this instant.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={confirmTakeover}
        onOpenChange={setConfirmTakeover}
        title="Take control of the browser?"
        description="The agent pauses where it is and the overlay is hidden until you hand control back."
        confirmLabel="Take control"
        onConfirm={() => takeControl(true)}
        testId="live-browser-take-control-confirm"
      />
    </div>
  );
}

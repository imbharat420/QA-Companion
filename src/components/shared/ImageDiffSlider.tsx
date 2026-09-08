"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { ChevronsLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ImageDiffSliderProps {
  baselineSrc: string;
  actualSrc: string;
  diffSrc?: string;
  mode?: "slider" | "side-by-side" | "diff";
  /** Describes what the screenshots show — both panes announce from it. */
  alt: string;
}

/* ==========================================================================
   PLACEHOLDER PAINTING
   Screenshot `src` values are "gradient:<chart-token>" recipes, not files: the
   desktop build has no asset server, so the mock dataset names a token ramp and
   we paint it locally. Everything below is a Tailwind class off `--chart-n`, so
   the placeholders swap with the theme like the rest of the app.
   ======================================================================== */

const STOPS: Record<string, string> = {
  "chart-1": "from-chart-1/80 via-chart-1/20 to-chart-3/40",
  "chart-2": "from-chart-2/80 via-chart-2/20 to-chart-1/40",
  "chart-3": "from-chart-3/80 via-chart-3/20 to-chart-4/40",
  "chart-4": "from-chart-4/80 via-chart-4/20 to-chart-6/40",
  "chart-5": "from-chart-5/80 via-chart-5/20 to-chart-2/40",
  "chart-6": "from-chart-6/80 via-chart-6/20 to-chart-3/40",
};

const DIRECTIONS = ["bg-linear-to-br", "bg-linear-to-tr", "bg-linear-to-r", "bg-linear-to-b"] as const;

const hash = (value: string) => {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
};

/** True when `src` is a recipe we paint rather than a file we load. */
export const isGradientSrc = (src: string) => src.startsWith("gradient:");

/**
 * "gradient:chart-4" -> token gradient classes. The direction is derived from
 * the whole src string, so baseline / actual / diff read as three different
 * captures instead of three identical swatches.
 */
export function gradientFromSrc(src: string): string {
  const token = src.slice(src.indexOf(":") + 1) || "chart-1";
  const stops = STOPS[token] ?? STOPS[`chart-${(hash(token) % 6) + 1}`];
  return cn(DIRECTIONS[hash(src) % DIRECTIONS.length], stops);
}

function Pane({ src, label, alt }: { src: string; label: string; alt: string }) {
  if (!isGradientSrc(src)) {
    return (
      <img
        src={src}
        alt={`${label}: ${alt}`}
        className="size-full select-none object-cover object-top"
        draggable={false}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={`${label}: ${alt}`}
      data-src={src}
      className={cn("relative size-full", gradientFromSrc(src))}
    >
      {/* A faint frame so the placeholder reads as a captured viewport. */}
      <span aria-hidden className="absolute inset-2 rounded-[var(--radius-sm)] border border-foreground/15" />
    </div>
  );
}

function PaneLabel({ children, side }: { children: string; side: "left" | "right" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "label-mono absolute top-2 rounded-full bg-chrome/80 px-2 py-0.5 text-[9px] text-chrome-foreground backdrop-blur-[2px]",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {children}
    </span>
  );
}

const FRAME = "relative aspect-[16/10] w-full overflow-hidden rounded-[var(--radius-md)] border border-border/70 bg-elevated";

export function ImageDiffSlider({
  baselineSrc,
  actualSrc,
  diffSrc,
  mode = "slider",
  alt,
}: ImageDiffSliderProps) {
  const [position, setPosition] = useState(50);
  const frameRef = useRef<HTMLDivElement | null>(null);

  const moveTo = useCallback((clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, Math.round(pct))));
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      // Pointer capture keeps the move events coming even when the cursor
      // leaves the frame mid-drag.
      event.currentTarget.setPointerCapture(event.pointerId);
      moveTo(event.clientX);
    },
    [moveTo],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      moveTo(event.clientX);
    },
    [moveTo],
  );

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    const next =
      event.key === "ArrowLeft"
        ? (p: number) => p - step
        : event.key === "ArrowRight"
          ? (p: number) => p + step
          : event.key === "Home"
            ? () => 0
            : event.key === "End"
              ? () => 100
              : null;
    if (!next) return;
    event.preventDefault();
    setPosition((p) => Math.min(100, Math.max(0, next(p))));
  }, []);

  if (mode === "side-by-side") {
    return (
      <div data-testid="image-diff" data-mode="side-by-side" className="grid grid-cols-2 gap-2">
        <div className={FRAME}>
          <Pane src={baselineSrc} label="Baseline" alt={alt} />
          <PaneLabel side="left">Baseline</PaneLabel>
        </div>
        <div className={FRAME}>
          <Pane src={actualSrc} label="Actual" alt={alt} />
          <PaneLabel side="left">Actual</PaneLabel>
        </div>
      </div>
    );
  }

  if (mode === "diff") {
    return (
      <div data-testid="image-diff" data-mode="diff" className={FRAME}>
        <Pane src={diffSrc ?? actualSrc} label={diffSrc ? "Diff" : "Actual"} alt={alt} />
        <PaneLabel side="left">{diffSrc ? "Pixel diff" : "Actual (no diff map)"}</PaneLabel>
      </div>
    );
  }

  return (
    <div
      data-testid="image-diff"
      data-mode="slider"
      ref={frameRef}
      className={cn(FRAME, "touch-none")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <Pane src={baselineSrc} label="Baseline" alt={alt} />
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${position}%)` }}
      >
        <Pane src={actualSrc} label="Actual" alt={alt} />
      </div>

      <PaneLabel side="left">Baseline</PaneLabel>
      <PaneLabel side="right">Actual</PaneLabel>

      <div
        role="slider"
        tabIndex={0}
        aria-label={`Reveal actual over baseline — ${alt}`}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={position}
        aria-valuetext={`${position}% actual`}
        data-testid="image-diff-handle"
        onKeyDown={onKeyDown}
        className="absolute inset-y-0 z-10 -ml-2 w-4 cursor-ew-resize"
        style={{ left: `${position}%` }}
      >
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary" />
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-primary bg-card text-primary"
        >
          <ChevronsLeftRight className="size-3" />
        </span>
      </div>
    </div>
  );
}

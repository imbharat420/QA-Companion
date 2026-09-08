"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { readUi, useUiStore } from "@/store";
import { cn } from "@/lib/utils";

export interface ResizableSplitProps {
  direction: "horizontal" | "vertical";
  children: ReactNode[];
  /** Percentages, one per child. Ignored (equal split) if the counts disagree. */
  initialSizes: number[];
  minSizes?: number[];
  /** `paneSizes` key in the ui store, e.g. "workbench.h". Persisted for free. */
  storageKey?: string;
  testId: string;
}

const DEFAULT_MIN = 8;
const KEY_STEP = 2;

const equalSplit = (count: number) => Array.from({ length: count }, () => 100 / count);
const resolve = (sizes: number[], count: number) =>
  sizes.length === count ? sizes.slice() : equalSplit(count);

/**
 * Percentage flex panes with a real separator between each pair.
 *
 * Persistence goes through the ui store's `paneSizes` map rather than a private
 * localStorage key, so the layout the user arranged survives a route change and
 * a restart through the one mechanism that already handles both — and it is
 * only written on pointerup, never per pointermove.
 */
export function ResizableSplit({
  direction,
  children,
  initialSizes,
  minSizes,
  storageKey,
  testId,
}: ResizableSplitProps) {
  const horizontal = direction === "horizontal";
  const count = children.length;

  const [sizes, setSizes] = useState<number[]>(() => resolve(initialSizes, count));
  /** The authoritative sizes during a drag; state trails it by one frame. */
  const live = useRef<number[]>(resolve(initialSizes, count));
  const frame = useRef<number | undefined>(undefined);
  const container = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ index: number; origin: number; base: number[]; total: number } | null>(null);

  const setPaneSizes = useUiStore((s) => s.setPaneSizes);

  // Panes can be added or removed at runtime (the workbench hides a pane in
  // focus mode), and stale percentages would leave a pane with no basis.
  const safe = sizes.length === count ? sizes : equalSplit(count);

  // Restored in an effect, not in the initial state: the persisted store
  // rehydrates synchronously on the client, so seeding useState from it would
  // disagree with the prerendered markup and trip hydration.
  useEffect(() => {
    if (!storageKey) return;
    const saved = readUi().paneSizes[storageKey];
    if (saved?.length !== count) return;
    live.current = saved.slice();
    setSizes(saved.slice());
  }, [storageKey, count]);

  useEffect(() => () => {
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current);
  }, []);

  /** Move the boundary after `index`, taking from one neighbour and giving to the other. */
  const shift = useCallback(
    (index: number, deltaPct: number, base: number[]) => {
      const a = base[index];
      const b = base[index + 1];
      const minA = minSizes?.[index] ?? DEFAULT_MIN;
      const minB = minSizes?.[index + 1] ?? DEFAULT_MIN;
      const clamped = Math.max(minA - a, Math.min(b - minB, deltaPct));
      const next = base.slice();
      next[index] = a + clamped;
      next[index + 1] = b - clamped;
      return next;
    },
    [minSizes],
  );

  const commit = useCallback(
    (next: number[]) => {
      live.current = next;
      setSizes(next);
      if (storageKey) setPaneSizes(storageKey, next);
    },
    [setPaneSizes, storageKey],
  );

  const onPointerDown = useCallback(
    (index: number) => (event: ReactPointerEvent<HTMLDivElement>) => {
      const rect = container.current?.getBoundingClientRect();
      if (!rect) return;
      const total = horizontal ? rect.width : rect.height;
      if (total <= 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        index,
        origin: horizontal ? event.clientX : event.clientY,
        base: live.current.slice(),
        total,
      };
    },
    [horizontal],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const active = drag.current;
      if (!active) return;
      const moved = (horizontal ? event.clientX : event.clientY) - active.origin;
      live.current = shift(active.index, (moved / active.total) * 100, active.base);
      // pointermove fires far more often than we can paint; one rAF per frame
      // keeps a drag at 60fps instead of queueing a render per event.
      if (frame.current !== undefined) return;
      frame.current = window.requestAnimationFrame(() => {
        frame.current = undefined;
        setSizes(live.current.slice());
      });
    },
    [horizontal, shift],
  );

  const endDrag = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    if (frame.current !== undefined) {
      window.cancelAnimationFrame(frame.current);
      frame.current = undefined;
    }
    commit(live.current.slice());
  }, [commit]);

  const onKeyDown = useCallback(
    (index: number) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const grow = horizontal ? "ArrowRight" : "ArrowDown";
      const shrink = horizontal ? "ArrowLeft" : "ArrowUp";
      if (event.key !== grow && event.key !== shrink) return;
      event.preventDefault();
      commit(shift(index, event.key === grow ? KEY_STEP : -KEY_STEP, live.current));
    },
    [commit, horizontal, shift],
  );

  return (
    <div
      ref={container}
      data-testid={testId}
      data-direction={direction}
      className={cn("flex min-h-0 min-w-0", horizontal ? "flex-row" : "flex-col")}
    >
      {children.map((child, index) => (
        <Fragment key={index}>
          <div
            data-testid={`${testId}-pane-${index}`}
            className="flex min-h-0 min-w-0 shrink flex-col overflow-hidden"
            style={{ flexBasis: `${safe[index]}%`, flexGrow: 0 }}
          >
            {child}
          </div>

          {index < count - 1 ? (
            <div
              role="separator"
              tabIndex={0}
              aria-orientation={horizontal ? "vertical" : "horizontal"}
              aria-label={`Resize pane ${index + 1}`}
              aria-valuemin={minSizes?.[index] ?? DEFAULT_MIN}
              aria-valuemax={100}
              aria-valuenow={Math.round(safe[index])}
              data-testid={`${testId}-handle-${index}`}
              onPointerDown={onPointerDown(index)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onKeyDown={onKeyDown(index)}
              className={cn(
                "group relative shrink-0 touch-none bg-border/60 transition-colors hover:bg-primary/60",
                horizontal ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
              )}
            >
              {/* The hit area is deliberately wider than the 1px rule. */}
              <span
                aria-hidden
                className={cn(
                  "absolute",
                  horizontal ? "inset-y-0 -left-1.5 -right-1.5" : "inset-x-0 -top-1.5 -bottom-1.5",
                )}
              />
            </div>
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

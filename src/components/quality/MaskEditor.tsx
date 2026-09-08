"use client";

import { useCallback, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { EyeOff, Plus, X } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, Input } from "@/components/ui";
import { CopyButton, ImageDiffSlider } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { VisualBaseline } from "@/lib/api/types";

export interface MaskEditorProps {
  /**
   * The masks are seeded from this baseline once. The page renders the editor
   * with `key={baseline.id}` so switching baseline remounts it with the new
   * selector set — no sync effect needed.
   */
  baseline: VisualBaseline;
}

/** Stable per string, so a mask lands in the same spot on every render. */
function hashOf(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * There is no real screenshot to measure, so a mask's rectangle is derived from
 * its own selector: the point of the overlay is to show *that* a region is
 * excluded and which selector excludes it, not to claim exact coordinates.
 */
function overlayStyle(selector: string): CSSProperties {
  const h = hashOf(selector);
  return {
    left: `${5 + (h % 42)}%`,
    top: `${8 + ((h >> 5) % 52)}%`,
    width: `${24 + ((h >> 11) % 28)}%`,
    height: `${14 + ((h >> 17) % 20)}%`,
  };
}

export function MaskEditor({ baseline }: MaskEditorProps) {
  const [selectors, setSelectors] = useState<string[]>(baseline.maskSelectors);
  const [draft, setDraft] = useState("");

  const add = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = draft.trim();
      if (!value) return;
      setSelectors((prev) => (prev.includes(value) ? prev : [...prev, value]));
      setDraft("");
    },
    [draft],
  );

  const remove = useCallback((selector: string) => {
    setSelectors((prev) => prev.filter((entry) => entry !== selector));
  }, []);

  const viewport = `${baseline.viewport.label} ${baseline.viewport.width}×${baseline.viewport.height}`;

  return (
    <Card data-testid="mask-editor">
      <CardHeader className="pb-2">
        <div className="min-w-0">
          <h3 className="label-mono flex items-center gap-1.5">
            <EyeOff className="size-3.5" aria-hidden />
            Ignored regions
            <span className="font-mono text-[10px] tabular-nums text-subtle-foreground">
              {selectors.length}
            </span>
          </h3>
          <CardDescription>
            Dynamic regions — clocks, prices, live counters, third-party iframes — repaint on every
            capture, so comparing them produces a diff that is not a defect.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <ImageDiffSlider
            mode="diff"
            baselineSrc={baseline.baselineSrc}
            actualSrc={baseline.actualSrc}
            diffSrc={baseline.diffSrc}
            alt={`Masked regions of ${baseline.name} at ${viewport}`}
          />
          {/* Decorative twin of the list below — the list is the accessible copy. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {selectors.map((selector, index) => (
              <span
                key={selector}
                data-testid={`mask-editor-overlay-${index}`}
                style={overlayStyle(selector)}
                className="absolute rounded-[var(--radius-sm)] border border-dashed border-accent bg-accent/20"
              >
                <span className="label-mono absolute left-1 top-1 max-w-[calc(100%-8px)] truncate rounded bg-chrome/80 px-1 text-[9px] normal-case tracking-normal text-accent">
                  {selector}
                </span>
              </span>
            ))}
          </div>
        </div>

        <ul data-testid="mask-editor-list" className="flex flex-col gap-1.5">
          {selectors.length === 0 ? (
            <li className="surface-inset px-2.5 py-2 text-xs text-muted-foreground">
              Nothing ignored — every pixel of this viewport is compared.
            </li>
          ) : (
            selectors.map((selector, index) => (
              <li
                key={selector}
                data-testid={`mask-editor-item-${index}`}
                className="surface-inset flex items-center gap-1.5 py-1 pl-2.5 pr-1"
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[2px] border border-dashed border-accent bg-accent/25"
                />
                <code className="text-code min-w-0 flex-1 truncate text-foreground">{selector}</code>
                <CopyButton value={selector} testId={`mask-editor-copy-${index}`} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(selector)}
                  aria-label={`Stop ignoring ${selector}`}
                  data-testid={`mask-editor-remove-${index}`}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={add} className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="CSS selector to ignore, e.g. .price__amount"
            aria-label="CSS selector to ignore"
            data-testid="mask-editor-input"
            className={cn("flex-1", "font-mono")}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={draft.trim().length === 0}
            data-testid="mask-editor-add"
          >
            <Plus className="size-3.5" aria-hidden />
            Add mask
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { cn } from "@/lib/utils";

/**
 * TONE -> TOKEN CLASS, the one mapping in this directory.
 *
 * Every tone string the domain produces — `Tone`, a severity, an agent status,
 * a chart slot — resolves to a *text* colour utility, and callers paint with
 * `bg-current` / `stroke="currentColor"`. Only `components/charts` is allowed
 * to spell out `hsl(var(--token))`, so shared composites go through classes.
 */
const TONE_TEXT: Record<string, string> = {
  primary: "text-primary",
  accent: "text-accent",
  muted: "text-muted-foreground",
  neutral: "text-muted-foreground",
  foreground: "text-foreground",

  success: "text-success",
  warning: "text-waiting",
  error: "text-error",
  destructive: "text-destructive",
  info: "text-low",

  thinking: "text-thinking",
  planning: "text-planning",
  executing: "text-executing",
  waiting: "text-waiting",
  idle: "text-idle",

  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-low",

  // `Tone` from types.ts, which run groups and chart series also use.
  cyan: "text-executing",
  amber: "text-waiting",
  red: "text-error",
  green: "text-success",
  violet: "text-thinking",

  "chart-1": "text-chart-1",
  "chart-2": "text-chart-2",
  "chart-3": "text-chart-3",
  "chart-4": "text-chart-4",
  "chart-5": "text-chart-5",
  "chart-6": "text-chart-6",
};

const RAMP = [
  "text-chart-1",
  "text-chart-2",
  "text-chart-3",
  "text-chart-4",
  "text-chart-5",
  "text-chart-6",
] as const;

/** Tone -> text-colour utility. Mirrors `toneVar` in charts/ChartTheme.ts. */
export function toneTextClass(tone: string): string {
  const hit = TONE_TEXT[tone];
  if (hit) return hit;
  // Unknown tone: hash into the categorical ramp, so a view with several
  // unmapped tones stays readable instead of drawing everything grey.
  let h = 0;
  for (let i = 0; i < tone.length; i += 1) h = (h * 31 + tone.charCodeAt(i)) | 0;
  return RAMP[Math.abs(h) % RAMP.length];
}

export interface ToneDotProps {
  tone: string;
  pulse?: boolean;
  /** Diameter in px. */
  size?: number;
}

export function ToneDot({ tone, pulse = false, size = 8 }: ToneDotProps) {
  return (
    <span
      aria-hidden
      data-testid="tone-dot"
      data-tone={tone}
      className={cn(
        "inline-block shrink-0 rounded-full bg-current",
        toneTextClass(tone),
        // pulse-ring animates box-shadow from currentColor, so the tone class
        // above is what tints the halo too.
        pulse && "animate-pulse-ring",
      )}
      style={{ width: size, height: size }}
    />
  );
}

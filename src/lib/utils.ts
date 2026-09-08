import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** The one class-merging helper. Every component uses this — never template strings. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 1234567 -> "1.2M". Compact, locale-aware, no dependency. */
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (n: number) => compact.format(n);

/** 0.9342 -> "93.4%" */
export const formatPercent = (ratio: number, digits = 1) =>
  `${(ratio * 100).toFixed(digits)}%`;

/** 1834 -> "1.8s"; 83400 -> "1m 23s" */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s ? `${m}m ${s}s` : `${m}m`;
}

/** 24576 -> "24.0 KB" */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

/**
 * ISO string -> "2 min ago". Uses Intl.RelativeTimeFormat, so no date library.
 * Returns the raw value unchanged if it isn't parseable (fixtures use prose).
 */
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const DIVISIONS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.34524, "week"],
  [12, "month"],
  [Number.POSITIVE_INFINITY, "year"],
];

export function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  let delta = (then - Date.now()) / 1000;
  for (const [amount, unit] of DIVISIONS) {
    if (Math.abs(delta) < amount) return rtf.format(Math.round(delta), unit);
    delta /= amount;
  }
  return iso;
}

/** Truncate a middle-heavy string (file paths, URLs) keeping both ends readable. */
export function truncateMiddle(value: string, max = 48): string {
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

/** Stable, dependency-free id for client-only entities (optimistic rows, toasts). */
let seq = 0;
export const localId = (prefix = "id") => `${prefix}_${(seq++).toString(36)}${Date.now().toString(36)}`;

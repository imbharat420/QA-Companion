"use client";

import { cn } from "@/lib/utils";

export interface KbdProps {
  /** A single key ("K") or a chord/sequence ("g p", "⌘ K") — each token gets a cap. */
  value: string;
  className?: string;
}

export function Kbd({ value, className }: KbdProps) {
  const keys = value.trim().split(/\s+/);
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {keys.map((key, i) => (
        <kbd
          key={`${key}-${i}`}
          className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-[4px] border border-border bg-elevated px-1.5 font-mono text-[10px] leading-none text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

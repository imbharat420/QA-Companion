"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

export interface DiffViewerProps {
  /** Unified diff text. Fixture patches are hunk-less `-`/`+` pairs, which parse fine. */
  diff: string;
  filename?: string;
  maxHeight?: number;
}

type DiffKind = "add" | "del" | "hunk" | "meta" | "context";

interface DiffLine {
  kind: DiffKind;
  text: string;
  /** Null on the side the line does not exist in. */
  oldNo: number | null;
  newNo: number | null;
}

const HUNK = /^@@\s*-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s*@@/;

function parseDiff(diff: string): DiffLine[] {
  let oldNo = 1;
  let newNo = 1;

  return diff.replace(/\n$/, "").split("\n").map<DiffLine>((raw) => {
    const hunk = HUNK.exec(raw);
    if (hunk) {
      // A hunk header re-bases both counters; without one we just keep counting
      // from 1, which is exactly right for a bare -/+ pair.
      oldNo = Number(hunk[1]);
      newNo = Number(hunk[2]);
      return { kind: "hunk", text: raw, oldNo: null, newNo: null };
    }
    if (/^(diff |index |--- |\+\+\+ |old mode|new mode|similarity |rename )/.test(raw)) {
      return { kind: "meta", text: raw, oldNo: null, newNo: null };
    }
    if (raw.startsWith("+")) {
      return { kind: "add", text: raw.slice(1), oldNo: null, newNo: newNo++ };
    }
    if (raw.startsWith("-")) {
      return { kind: "del", text: raw.slice(1), oldNo: oldNo++, newNo: null };
    }
    const text = raw.startsWith(" ") ? raw.slice(1) : raw;
    return { kind: "context", text, oldNo: oldNo++, newNo: newNo++ };
  });
}

const ROW: Record<DiffKind, string> = {
  add: "bg-success/12 text-foreground",
  del: "bg-destructive/12 text-foreground",
  hunk: "bg-elevated text-muted-foreground",
  meta: "text-subtle-foreground",
  context: "text-foreground/80",
};

const SIGIL: Record<DiffKind, string> = {
  add: "+",
  del: "-",
  hunk: "",
  meta: "",
  context: " ",
};

export function DiffViewer({ diff, filename, maxHeight = 340 }: DiffViewerProps) {
  const lines = useMemo(() => parseDiff(diff), [diff]);
  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;

  return (
    <div
      data-testid="diff-viewer"
      className="overflow-hidden rounded-[var(--radius-md)] border border-border/70 bg-card"
    >
      <div className="flex items-center gap-2 border-b border-border/60 bg-elevated px-2.5 py-1.5">
        <span className="text-code truncate text-muted-foreground">{filename ?? "patch"}</span>
        <span className="text-code shrink-0 font-semibold text-success">+{added}</span>
        <span className="text-code shrink-0 font-semibold text-destructive">-{removed}</span>
        <div className="ml-auto shrink-0">
          <CopyButton value={diff} testId="diff-viewer-copy" />
        </div>
      </div>

      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="text-code w-max min-w-full py-1 leading-[1.65]">
          <code>
            {lines.map((line, i) => (
              <span
                key={i}
                data-kind={line.kind}
                className={cn("flex items-baseline px-1", ROW[line.kind])}
              >
                <span
                  aria-hidden
                  className="w-9 shrink-0 select-none pr-1 text-right text-subtle-foreground"
                >
                  {line.oldNo ?? ""}
                </span>
                <span
                  aria-hidden
                  className="w-9 shrink-0 select-none pr-2 text-right text-subtle-foreground"
                >
                  {line.newNo ?? ""}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "w-3 shrink-0 select-none font-bold",
                    line.kind === "add" && "text-success",
                    line.kind === "del" && "text-destructive",
                  )}
                >
                  {SIGIL[line.kind]}
                </span>
                <span className="whitespace-pre">{line.text || " "}</span>
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

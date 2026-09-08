"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

export interface CodeBlockProps {
  code: string;
  language?: string;
  lineNumbers?: boolean;
  /** 1-based line numbers to tint as the interesting ones. */
  highlightLines?: number[];
  maxHeight?: number;
  filename?: string;
}

/**
 * No highlighter dependency on purpose: a tokenizer for six languages costs
 * more than it buys in an operations UI. What actually matters here is the
 * mono grid, stable line numbers and a highlight band pointing at the line the
 * finding is about — all of which are token classes.
 */
export function CodeBlock({
  code,
  language,
  lineNumbers = false,
  highlightLines,
  maxHeight = 320,
  filename,
}: CodeBlockProps) {
  const lines = useMemo(() => code.replace(/\n$/, "").split("\n"), [code]);
  const marked = useMemo(() => new Set(highlightLines ?? []), [highlightLines]);
  const gutter = String(lines.length).length;

  return (
    <div
      data-testid="code-block"
      data-language={language}
      className="overflow-hidden rounded-[var(--radius-md)] border border-border/70 bg-card"
    >
      {filename || language ? (
        <div className="flex items-center gap-2 border-b border-border/60 bg-elevated px-2.5 py-1.5">
          <span className="text-code truncate text-muted-foreground">{filename ?? language}</span>
          {filename && language ? (
            <span className="label-mono shrink-0 text-[10px]">{language}</span>
          ) : null}
          <div className="ml-auto shrink-0">
            <CopyButton value={code} testId="code-block-copy" />
          </div>
        </div>
      ) : (
        <div className="flex justify-end border-b border-border/60 bg-elevated px-2.5 py-1">
          <CopyButton value={code} testId="code-block-copy" />
        </div>
      )}

      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="text-code w-max min-w-full py-2 leading-[1.6]">
          <code>
            {lines.map((line, i) => {
              const number = i + 1;
              const isComment = /^\s*(\/\/|#|\*|\/\*)/.test(line);
              return (
                <span
                  key={number}
                  data-line={number}
                  className={cn(
                    "flex px-2.5",
                    marked.has(number) && "border-l-2 border-primary bg-primary/10 pl-2",
                  )}
                >
                  {lineNumbers ? (
                    <span
                      aria-hidden
                      className="mr-3 shrink-0 select-none text-right text-subtle-foreground"
                      style={{ width: `${gutter}ch` }}
                    >
                      {number}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "whitespace-pre",
                      isComment ? "text-subtle-foreground" : "text-foreground/90",
                    )}
                  >
                    {line || " "}
                  </span>
                </span>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

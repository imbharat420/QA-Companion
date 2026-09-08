"use client";

import { AlertOctagon, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api";

export interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  testId?: string;
}

interface Described {
  title: string;
  detail?: string;
  /** Only populated for an ApiError — the mono line that makes it debuggable. */
  origin?: string;
}

/**
 * A wrong REST base URL and a crashed Tauri command look identical unless the
 * status and the source are on screen, so an ApiError always shows both.
 */
function describe(error: unknown): Described {
  if (error instanceof ApiError) {
    return {
      title: error.message,
      detail: error.detail,
      origin: `${error.status} · ${error.source}`,
    };
  }
  if (error instanceof Error) return { title: error.message || error.name };
  if (typeof error === "string" && error.trim()) return { title: error };
  return { title: "Something went wrong loading this view." };
}

export function ErrorState({ error, onRetry, testId = "error-state" }: ErrorStateProps) {
  const { title, detail, origin } = describe(error);

  return (
    <div
      data-testid={testId}
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <span
        aria-hidden
        className="grid size-11 place-items-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive"
      >
        <AlertOctagon className="size-5" />
      </span>
      <div className="max-w-md">
        <p className="font-display text-sm font-semibold">{title}</p>
        {detail ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        ) : null}
        {origin ? (
          <p data-testid={`${testId}-origin`} className="text-code mt-2 uppercase text-subtle-foreground">
            {origin}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} data-testid={`${testId}-retry`}>
          <RotateCw className="size-3.5" aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface CopyButtonProps {
  value: string;
  /** Shows a text label beside the icon; omit for an icon-only button. */
  label?: string;
  testId: string;
}

type CopyState = "idle" | "copied" | "failed";

export function CopyButton({ value, label, testId }: CopyButtonProps) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    window.clearTimeout(timer.current);
    // Clipboard is absent on insecure origins and in some Tauri webview
    // configurations, so the failure has to be a visible state, not a throw.
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = window.setTimeout(() => setState("idle"), 1600);
  }, [value]);

  const Icon = state === "copied" ? Check : state === "failed" ? XCircle : Copy;
  const text = state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label;

  return (
    <Button
      type="button"
      variant="ghost"
      size={label ? "xs" : "icon-sm"}
      onClick={() => void copy()}
      data-testid={testId}
      data-state={state}
      aria-label={label ? undefined : `Copy ${value.length > 40 ? "value" : value}`}
      className={state === "copied" ? "text-success" : state === "failed" ? "text-destructive" : undefined}
    >
      <Icon className="size-3.5" aria-hidden />
      {text ? <span>{text}</span> : null}
      {/* Announce the result even for the icon-only variant. */}
      <span className="sr-only" role="status">
        {state === "copied" ? "Copied to clipboard" : state === "failed" ? "Copy failed" : ""}
      </span>
    </Button>
  );
}

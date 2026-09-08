"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid = false, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full resize-y rounded-[var(--radius-lg)] border bg-elevated px-2.5 py-2",
        "font-sans text-xs leading-relaxed text-foreground placeholder:text-subtle-foreground",
        "transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-50",
        invalid ? "border-destructive" : "border-input focus-visible:border-ring",
        className,
      )}
      {...props}
    />
  );
});

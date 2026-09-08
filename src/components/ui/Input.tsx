"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leftIcon, invalid = false, type = "text", ...props },
  ref,
) {
  const field = (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "h-8 w-full rounded-[var(--radius-lg)] border bg-elevated px-2.5 font-sans text-xs text-foreground",
        "placeholder:text-subtle-foreground",
        "transition-colors duration-150 ease-out",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "file:mr-2 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground",
        invalid ? "border-destructive" : "border-input focus-visible:border-ring",
        leftIcon && "pl-8",
        className,
      )}
      {...props}
    />
  );

  if (!leftIcon) return field;

  return (
    <div className="relative w-full">
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle-foreground [&_svg]:size-3.5"
      >
        {leftIcon}
      </span>
      {field}
    </div>
  );
});

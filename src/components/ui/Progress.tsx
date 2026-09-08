"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const progressVariants = cva("h-full rounded-full transition-[width] duration-300 ease-out", {
  variants: {
    tone: {
      primary: "bg-primary",
      success: "bg-success",
      warning: "bg-waiting",
      error: "bg-error",
    },
  },
  defaultVariants: { tone: "primary" },
});

export type ProgressVariantProps = VariantProps<typeof progressVariants>;

export interface ProgressProps
  extends Omit<React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, "value">,
    ProgressVariantProps {
  /** 0–100. Values outside the range are clamped so the fill can never overflow. */
  value: number;
  size?: "sm" | "md";
}

export const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(function Progress({ className, value, tone, size = "sm", max = 100, ...props }, ref) {
  const clamped = Math.min(max, Math.max(0, Number.isFinite(value) ? value : 0));
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={clamped}
      max={max}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-muted",
        size === "sm" ? "h-1.5" : "h-2.5",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={progressVariants({ tone })}
        style={{ width: `${(clamped / max) * 100}%` }}
      />
    </ProgressPrimitive.Root>
  );
});

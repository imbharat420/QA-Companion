"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  cn(
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border",
    "font-mono font-semibold uppercase leading-none tracking-[0.04em] tabular-nums",
  ),
  {
    variants: {
      variant: {
        default: "border-border bg-elevated text-foreground",
        primary: "border-primary/30 bg-primary/15 text-primary",
        accent: "border-accent/30 bg-accent/15 text-accent",
        success: "border-success/30 bg-success/15 text-success",
        warning: "border-waiting/30 bg-waiting/15 text-waiting",
        error: "border-error/30 bg-error/15 text-error",
        info: "border-low/30 bg-low/15 text-low",
        outline: "border-border bg-transparent text-muted-foreground",
        muted: "border-transparent bg-muted text-muted-foreground",
      },
      size: {
        xs: "h-[18px] px-1.5 text-[10px]",
        sm: "h-5 px-2 text-[11px]",
      },
    },
    defaultVariants: { variant: "default", size: "sm" },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, BadgeVariantProps {
  /** Leading status dot, inherits the variant's text colour. */
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, size, dot = false, children, ...props },
  ref,
) {
  return (
    <span ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
});

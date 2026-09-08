"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds a hover lift + pointer cursor. Pair with a real button/link inside for keyboard users. */
  interactive?: boolean;
  /** Nested panel look (.surface-inset) instead of the recessed bento card. */
  inset?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, interactive = false, inset = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        inset ? "surface-inset" : "surface-card",
        "text-card-foreground",
        interactive &&
          "cursor-pointer transition-[transform,box-shadow,border-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-border hover:shadow-lg motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    />
  );
});

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardHeader({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex items-start justify-between gap-3 px-4 pb-3 pt-4", className)}
        {...props}
      />
    );
  },
);

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function CardTitle({ className, ...props }, ref) {
    return (
      <h3
        ref={ref}
        className={cn("font-display text-sm font-semibold leading-tight tracking-tight", className)}
        {...props}
      />
    );
  },
);

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function CardDescription({ className, ...props }, ref) {
  return (
    <p ref={ref} className={cn("mt-1 text-xs leading-relaxed text-muted-foreground", className)} {...props} />
  );
});

/** Right-hand action slot for CardHeader. */
export const CardToolbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardToolbar({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex shrink-0 items-center gap-1.5", className)} {...props} />;
  },
);

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardContent({ className, ...props }, ref) {
    return <div ref={ref} className={cn("px-4 pb-4", className)} {...props} />;
  },
);

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function CardFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("flex items-center gap-2 border-t border-border/50 px-4 py-3", className)}
        {...props}
      />
    );
  },
);

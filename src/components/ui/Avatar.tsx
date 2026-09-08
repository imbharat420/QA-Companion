"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

// Initials only: a desktop QA tool has no business fetching gravatars, so
// there is deliberately no AvatarImage export.
export const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(function Avatar({ className, ...props }, ref) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn("relative flex size-7 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
});

export const AvatarFallback = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(function AvatarFallback({ className, delayMs, ...props }, ref) {
  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      // No image to wait for, so never delay the initials.
      delayMs={delayMs ?? 0}
      className={cn(
        "flex size-full items-center justify-center rounded-full border border-border bg-elevated",
        "font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
});

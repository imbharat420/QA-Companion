"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Drawer = DialogPrimitive.Root;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;

type DrawerSide = "right" | "bottom" | "left";
type DrawerSize = "sm" | "md" | "lg" | "xl";

const SIDE_CLASSES: Record<DrawerSide, string> = {
  right: "right-0 top-0 h-full border-l rounded-l-[var(--radius-lg)]",
  left: "left-0 top-0 h-full border-r rounded-r-[var(--radius-lg)]",
  bottom: "bottom-0 left-0 w-full border-t rounded-t-[var(--radius-lg)]",
};

const HORIZONTAL_SIZES: Record<DrawerSize, string> = {
  sm: "w-[320px] max-w-[90vw]",
  md: "w-[440px] max-w-[92vw]",
  lg: "w-[620px] max-w-[94vw]",
  xl: "w-[860px] max-w-[96vw]",
};

const VERTICAL_SIZES: Record<DrawerSize, string> = {
  sm: "h-[240px] max-h-[90vh]",
  md: "h-[400px] max-h-[90vh]",
  lg: "h-[580px] max-h-[92vh]",
  xl: "h-[85vh]",
};

export interface DrawerContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  side?: DrawerSide;
  size?: DrawerSize;
}

export const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DrawerContentProps
>(function DrawerContent({ className, children, side = "right", size = "md", ...props }, ref) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-chrome/80 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        ref={ref}
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 border-border bg-popover p-5 text-popover-foreground shadow-xl",
          "animate-[rise_150ms_ease-out]",
          SIDE_CLASSES[side],
          side === "bottom" ? VERTICAL_SIZES[size] : HORIZONTAL_SIZES[size],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label="Close panel"
          data-testid="drawer-close"
          className="absolute right-3 top-3 grid size-7 place-items-center rounded-[var(--radius-sm)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export const DrawerHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function DrawerHeader({ className, ...props }, ref) {
    return <div ref={ref} className={cn("flex shrink-0 flex-col gap-1 pr-8", className)} {...props} />;
  },
);

export const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DrawerTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn("font-display text-sm font-semibold tracking-tight", className)}
      {...props}
    />
  );
});

export const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DrawerDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn("text-xs leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
});

export const DrawerFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function DrawerFooter({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          "mt-auto flex shrink-0 items-center justify-end gap-2 border-t border-border/50 pt-3",
          className,
        )}
        {...props}
      />
    );
  },
);

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SPINNER_SIZES = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-5",
} as const;

export interface SpinnerProps {
  size?: keyof typeof SPINNER_SIZES;
  className?: string;
}

export function Spinner({ size = "sm", className }: SpinnerProps) {
  return (
    <Loader2
      aria-hidden
      className={cn("shrink-0 animate-spin text-current", SPINNER_SIZES[size], className)}
    />
  );
}

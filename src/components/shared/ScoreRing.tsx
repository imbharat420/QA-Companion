"use client";

import { cn } from "@/lib/utils";
import { toneTextClass } from "./ToneDot";

export interface ScoreRingProps {
  /** 0–100; clamped, so an out-of-range score can never overdraw the arc. */
  score: number;
  size?: number;
  label?: string;
  tone?: string;
}

/**
 * Inline SVG, no chart library: this renders in table cells and stat tiles by
 * the dozen, where a recharts instance per ring would be absurd.
 */
export function ScoreRing({ score, size = 64, label, tone }: ScoreRingProps) {
  const value = Math.min(100, Math.max(0, Number.isFinite(score) ? Math.round(score) : 0));
  const stroke = Math.max(3, Math.round(size / 11));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const resolved = tone ?? (value >= 90 ? "success" : value >= 70 ? "warning" : "error");

  return (
    <div
      data-testid="score-ring"
      data-score={value}
      className="inline-flex shrink-0 flex-col items-center gap-1"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${label ?? "Score"}: ${value} out of 100`}
          // -90deg so the arc starts at 12 o'clock instead of 3.
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-border"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 100)}
            className={cn(
              "transition-[stroke-dashoffset] duration-500 ease-out motion-reduce:transition-none",
              toneTextClass(resolved),
            )}
          />
        </svg>
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 grid place-items-center font-display font-semibold tabular-nums",
            toneTextClass(resolved),
          )}
          style={{ fontSize: Math.max(11, Math.round(size * 0.3)) }}
        >
          {value}
        </span>
      </div>
      {label ? <span className="label-mono text-[10px]">{label}</span> : null}
    </div>
  );
}

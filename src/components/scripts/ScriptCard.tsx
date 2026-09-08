"use client";

import { memo } from "react";
import {
  Bot,
  FileCode2,
  FlaskConical,
  Footprints,
  LayoutTemplate,
  Puzzle,
  Repeat2,
  Scissors,
  Sparkles,
  Upload,
  Video,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui";
import { routes } from "@/config/nav";
import { cn, formatCompact, formatRelative } from "@/lib/utils";
import type { BadgeProps } from "@/components/ui";
import type { ScriptEntry, ScriptKind } from "@/lib/api/types";

/* ==========================================================================
   KIND / SOURCE VOCABULARY
   Shared by the rail, the table, the cards and the panel so a kind never reads
   a different colour in two places. `StatusBadge` deliberately isn't used for
   kinds — its table has no script kinds and would render every one "Unknown".
   ======================================================================== */

export type ScriptSourceKind = NonNullable<ScriptEntry["sourceKind"]>;

export interface KindMeta {
  label: string;
  icon: LucideIcon;
  variant: NonNullable<BadgeProps["variant"]>;
  hint: string;
}

export const KIND_META: Record<ScriptKind, KindMeta> = {
  test: {
    label: "Test",
    icon: FlaskConical,
    variant: "primary",
    hint: "A whole spec — runnable on its own",
  },
  step: {
    label: "Step",
    icon: Footprints,
    variant: "info",
    hint: "A shared action other specs call",
  },
  "page-object": {
    label: "Page object",
    icon: LayoutTemplate,
    variant: "accent",
    hint: "Locators and actions for one screen",
  },
  fixture: {
    label: "Fixture",
    icon: Puzzle,
    variant: "success",
    hint: "Test-scoped setup and teardown",
  },
  api: {
    label: "API",
    icon: Webhook,
    variant: "warning",
    hint: "Contract test against a discovered endpoint",
  },
  skill: {
    label: "Skill",
    icon: Sparkles,
    variant: "outline",
    hint: "A capability the agent can invoke mid-session",
  },
};

export const SCRIPT_KINDS = Object.keys(KIND_META) as ScriptKind[];

export interface SourceMeta {
  label: string;
  icon: LucideIcon;
  hint: string;
}

export const SOURCE_META: Record<ScriptSourceKind, SourceMeta> = {
  generated: { label: "Generated", icon: Bot, hint: "Written by the agent from a session" },
  recording: { label: "Recording", icon: Video, hint: "Captured from a browser recording" },
  extracted: { label: "Extracted", icon: Scissors, hint: "Lifted out of an existing spec" },
  upload: { label: "Upload", icon: Upload, hint: "Imported from the file system" },
};

export const SOURCE_KINDS = Object.keys(SOURCE_META) as ScriptSourceKind[];

export const LANGUAGE_LABEL: Record<ScriptEntry["language"], string> = {
  typescript: "TS",
  javascript: "JS",
  python: "PY",
};

export const FILE_EXTENSION: Record<ScriptEntry["language"], string> = {
  typescript: "ts",
  javascript: "js",
  python: "py",
};

/** The identifier a name exposes — `login(user)` is called as `login`. */
export const bareName = (name: string) => name.replace(/\(.*$/, "").trim();

/** How chat calls a library asset. A library nobody can address is dead weight. */
export const scriptReference = (name: string) => `@script:${bareName(name)}`;

export const scriptFilename = (script: ScriptEntry) =>
  `${bareName(script.name)}.${FILE_EXTENSION[script.language]}`;

/** Provenance target: the finding, run or recording the asset came out of. */
export function sourceHref(script: ScriptEntry): string | null {
  const ref = script.sourceRef;
  if (!ref) return null;
  if (ref.startsWith("rec-")) return routes.workbench({ taskId: ref });
  if (ref.startsWith("#")) return routes.run(ref);
  if (/^(BUG|SEC|API)-/.test(ref)) return routes.finding(ref);
  return null;
}

export interface RelatedSurface {
  label: string;
  href: string;
}

/**
 * The quality surface an asset belongs to. An API contract test is only useful
 * next to the endpoint it guards, and a skill next to the audit it produces.
 */
export function relatedSurface(script: ScriptEntry): RelatedSurface | null {
  if (script.kind === "api") {
    return {
      label: "API surface",
      href: routes.apiIntel(
        script.sourceRef?.startsWith("API-") ? { endpointId: script.sourceRef } : undefined,
      ),
    };
  }
  if (script.kind === "skill") {
    if (script.name.includes("a11y")) return { label: "Accessibility", href: routes.accessibility() };
    if (script.name.includes("visual")) return { label: "Visual", href: routes.visual() };
  }
  return null;
}

/* ==========================================================================
   CARD
   ======================================================================== */

export interface ScriptCardProps {
  script: ScriptEntry;
  selected?: boolean;
  onOpen: (id: string) => void;
  /** Warms `qk.scripts.detail(id)` so the click lands on cached data. */
  onHover: (id: string) => void;
  onTagClick: (tag: string) => void;
}

function ScriptCardImpl({ script, selected = false, onOpen, onHover, onTagClick }: ScriptCardProps) {
  const kind = KIND_META[script.kind];
  const KindIcon = kind.icon;
  const source = script.sourceKind ? SOURCE_META[script.sourceKind] : null;
  const SourceIcon = source?.icon ?? FileCode2;

  return (
    <article
      data-testid={`scripts-card-${script.id}`}
      data-kind={script.kind}
      data-selected={selected || undefined}
      onMouseEnter={() => onHover(script.id)}
      className={cn(
        "surface-card flex flex-col gap-2.5 p-3.5",
        "transition-[border-color,box-shadow] duration-150 ease-out hover:border-border",
        selected && "border-primary",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Badge variant={kind.variant} size="xs" title={kind.hint}>
          <KindIcon className="size-2.5" aria-hidden />
          {kind.label}
        </Badge>
        <Badge variant="muted" size="xs" title={script.language}>
          {LANGUAGE_LABEL[script.language]}
        </Badge>
        <span
          className="label-mono ml-auto text-[10px] text-primary"
          title={`Version ${script.version}`}
        >
          v{script.version}
        </span>
      </div>

      <button
        type="button"
        onClick={() => onOpen(script.id)}
        data-testid={`scripts-card-${script.id}-open`}
        className="flex flex-col gap-1.5 rounded-[var(--radius-md)] text-left"
      >
        <h3 className="text-code truncate text-[12.5px] font-semibold text-foreground">
          {script.name}
        </h3>
        <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
          {script.description}
        </p>
      </button>

      <div className="flex flex-wrap gap-1">
        {script.tags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onTagClick(tag)}
            aria-label={`Filter by tag ${tag}`}
            data-testid={`scripts-card-${script.id}-tag-${tag}`}
            className={cn(
              "rounded-full border border-border/70 bg-elevated px-1.5 py-0.5",
              "font-mono text-[10px] text-muted-foreground",
              "transition-colors hover:border-border hover:text-foreground",
            )}
          >
            {tag}
          </button>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2 border-t border-border/50 pt-2">
        <span
          className="flex items-center gap-1 font-mono text-[11px] tabular-nums text-foreground"
          title={`${script.usageCount} uses across specs and sessions`}
          data-testid={`scripts-card-${script.id}-uses`}
        >
          <Repeat2 className="size-3 text-primary" aria-hidden />
          {formatCompact(script.usageCount)}
          <span className="label-mono text-[9px]">uses</span>
        </span>

        <span
          className="label-mono flex items-center gap-1 text-[9px]"
          title={source ? source.hint : "No recorded provenance"}
          data-testid={`scripts-card-${script.id}-source`}
        >
          <SourceIcon className="size-3" aria-hidden />
          {source ? source.label : "Unknown"}
        </span>

        <span className="ml-auto shrink-0 text-[10px] text-subtle-foreground">
          {formatRelative(script.updatedAt)}
        </span>
      </div>
    </article>
  );
}

export const ScriptCard = memo(ScriptCardImpl);

"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bug,
  Camera,
  Check,
  FileCode2,
  Globe,
  Lightbulb,
  Microscope,
  RefreshCw,
  Sparkles,
  Terminal,
  ThumbsDown,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/Drawer";
import { Progress } from "@/components/ui/Progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { useApplyFindingFix, useFinding, useUpdateFindingStatus } from "@/lib/queries";
import { routes } from "@/config/nav";
import { useAgentStore } from "@/store";
import { cn, formatRelative } from "@/lib/utils";
import type { Evidence, Finding } from "@/lib/api/types";
import { CopyButton } from "./CopyButton";
import { DiffViewer } from "./DiffViewer";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { ImageDiffSlider } from "./ImageDiffSlider";
import { LoadingState } from "./LoadingState";
import { SeverityBadge } from "./SeverityBadge";
import { StatusBadge } from "./StatusBadge";

export interface FailureCockpitProps {
  findingId: string | null;
  onOpenChange: (open: boolean) => void;
}

const EVIDENCE_ICON: Record<Evidence["kind"], LucideIcon> = {
  screenshot: Camera,
  dom: FileCode2,
  console: Terminal,
  network: Globe,
  trace: Microscope,
  video: Camera,
  har: Globe,
};

/**
 * THE FAILURE COCKPIT — the drawer Findings, Runs and the workbench timeline all
 * open. AppShell mounts it app-wide behind next/dynamic, so the closed state has
 * to cost nothing: the query is disabled by an empty id and Radix keeps the
 * portal (and therefore every tab body) unmounted until `open` flips.
 */
export function FailureCockpit({ findingId, onOpenChange }: FailureCockpitProps) {
  const open = findingId !== null;
  const { data: finding, isLoading, error, refetch } = useFinding(findingId ?? "");

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        side="right"
        size="xl"
        data-testid="cockpit-drawer"
        data-finding-id={findingId ?? undefined}
        className="gap-3"
      >
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2 text-[15px]">
            {finding ? <SeverityBadge severity={finding.severity} size="xs" /> : null}
            <span className="min-w-0 truncate">{finding?.title ?? "Failure cockpit"}</span>
          </DrawerTitle>
          {finding ? <HeaderMeta finding={finding} /> : null}
        </DrawerHeader>

        {finding ? (
          // Remount per finding so the tab selection, the slider position and
          // every mutation's state reset instead of leaking across findings.
          <CockpitBody key={finding.id} finding={finding} onOpenChange={onOpenChange} />
        ) : isLoading ? (
          <LoadingState variant="panel" rows={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => void refetch()} testId="cockpit-error" />
        ) : (
          <EmptyState
            icon={Bug}
            title="Finding not found"
            description="It may have been merged into another finding or removed by the active data source."
            testId="cockpit-empty"
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

/* ==========================================================================
   HEADER
   ======================================================================== */

function HeaderMeta({ finding }: { finding: Finding }) {
  const tone = finding.confidence >= 90 ? "success" : finding.confidence >= 70 ? "primary" : "warning";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-code text-muted-foreground">{finding.id}</span>
      <StatusBadge status={finding.status} size="xs" />
      <Badge variant="outline" size="xs">
        {finding.category}
      </Badge>
      <span className="text-code truncate text-subtle-foreground">{finding.url}</span>

      <div className="ml-auto flex w-40 shrink-0 items-center gap-2">
        <span className="label-mono text-[10px]">Conf</span>
        <Progress
          value={finding.confidence}
          tone={tone}
          aria-label={`Agent confidence ${finding.confidence} percent`}
          data-testid="cockpit-confidence"
        />
        <span className="font-mono text-[11px] font-semibold tabular-nums">
          {finding.confidence}%
        </span>
      </div>
    </div>
  );
}

/* ==========================================================================
   BODY
   ======================================================================== */

function CockpitBody({
  finding,
  onOpenChange,
}: {
  finding: Finding;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const startTask = useAgentStore((s) => s.startTask);
  const applyFix = useApplyFindingFix();
  const updateStatus = useUpdateFindingStatus();

  const hasPatch = finding.fix.trim().length > 0;

  const screenshots = useMemo(
    () =>
      (finding.evidence ?? []).flatMap((e) => (e.kind === "screenshot" && e.src ? [e.src] : [])),
    [finding.evidence],
  );
  const artefacts = useMemo(
    () => (finding.evidence ?? []).filter((e) => !(e.kind === "screenshot" && e.src)),
    [finding.evidence],
  );
  const wire = useMemo(
    () =>
      (finding.evidence ?? []).filter(
        (e) => e.kind === "console" || e.kind === "network" || e.kind === "har",
      ),
    [finding.evidence],
  );

  const issueBody = useMemo(
    () =>
      [
        `## ${finding.title}`,
        "",
        `- Finding: \`${finding.id}\` (${finding.severity}, ${finding.confidence}% confidence)`,
        `- URL: ${finding.url}`,
        `- Element: ${finding.element}`,
        finding.runId ? `- Run: ${finding.runId}` : null,
        `- Commit: ${finding.commit}`,
        "",
        `**Expected** ${finding.expected}`,
        `**Actual** ${finding.actual}`,
        "",
        "### Root cause",
        finding.rca,
        hasPatch ? "\n### Proposed patch\n```diff\n" + finding.fix + "\n```" : null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    [finding, hasPatch],
  );

  /** Every agent-driven action is the same handoff: close, go, start streaming. */
  const handOffToAgent = useCallback(
    (mode: string, prompt: string) => {
      onOpenChange(false);
      router.push(routes.workbench());
      void startTask({ prompt, mode, projectId: finding.projectId });
    },
    [finding.projectId, onOpenChange, router, startTask],
  );

  return (
    <>
      <Tabs defaultValue="evidence" className="min-h-0 flex-1">
        <TabsList>
          <TabsTrigger value="evidence" data-testid="cockpit-tab-evidence">
            Evidence
          </TabsTrigger>
          <TabsTrigger value="diagnosis" data-testid="cockpit-tab-diagnosis">
            Diagnosis
          </TabsTrigger>
          <TabsTrigger value="wire" data-testid="cockpit-tab-wire">
            Console &amp; Network
          </TabsTrigger>
          <TabsTrigger value="fix" data-testid="cockpit-tab-fix">
            Fix
          </TabsTrigger>
        </TabsList>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <TabsContent value="evidence" className="flex flex-col gap-3">
            {screenshots.length >= 2 ? (
              <ImageDiffSlider
                baselineSrc={screenshots[0]}
                actualSrc={screenshots[1]}
                mode="slider"
                alt={`${finding.title} — ${finding.url}`}
              />
            ) : screenshots.length === 1 ? (
              <ImageDiffSlider
                baselineSrc={screenshots[0]}
                actualSrc={screenshots[0]}
                diffSrc={screenshots[0]}
                mode="diff"
                alt={`${finding.title} — ${finding.url}`}
              />
            ) : null}

            {artefacts.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {artefacts.map((item) => (
                  <EvidenceCard key={item.id} evidence={item} />
                ))}
              </div>
            ) : screenshots.length ? null : (
              <EmptyState
                icon={Camera}
                title="No evidence captured"
                description="This finding was reported without attachments — reproduce it to collect a screenshot, DOM snapshot and trace."
                testId="cockpit-evidence-empty"
              />
            )}
          </TabsContent>

          <TabsContent value="diagnosis" className="flex flex-col gap-3">
            <div className="surface-inset grid gap-2 p-3 sm:grid-cols-2">
              <Observed label="Expected" value={finding.expected} tone="success" />
              <Observed label="Actual" value={finding.actual} tone="destructive" />
              <Observed label="Element" value={finding.element} />
              <Observed label="Commit" value={finding.commit} />
            </div>

            {/*
              Facts and Inference stay in separate framed panels, never merged
              into one list: a reviewer has to be able to reject the reasoning
              while keeping the measurements. That separation is the product
              requirement, not a layout preference.
            */}
            <div className="grid gap-3 lg:grid-cols-2">
              <DiagnosisPanel
                icon={Microscope}
                title="Facts"
                caption="Measured by the run"
                accent="border-low/40 bg-low/5"
                bullet="text-low"
                items={finding.facts ?? []}
                emptyText="The run recorded no discrete observations."
                testId="cockpit-facts"
              />
              <DiagnosisPanel
                icon={Lightbulb}
                title="Inference"
                caption="Concluded by the agent"
                accent="border-thinking/40 bg-thinking/5"
                bullet="text-thinking"
                items={finding.inferences ?? []}
                emptyText="The agent drew no conclusions beyond the facts."
                testId="cockpit-inferences"
              />
            </div>

            <div className="surface-inset p-3">
              <p className="label-mono mb-1.5">Root cause analysis</p>
              <p className="text-xs leading-relaxed text-foreground/90">{finding.rca}</p>
            </div>
          </TabsContent>

          <TabsContent value="wire" className="flex flex-col gap-2">
            {wire.length ? (
              <>
                <p className="text-[11px] text-muted-foreground">
                  Captured at the failing instant
                  {finding.detectedAt ? ` · ${formatRelative(finding.detectedAt)}` : ""}.
                </p>
                {wire.map((item) => (
                  <EvidenceCard key={item.id} evidence={item} />
                ))}
              </>
            ) : (
              <EmptyState
                icon={Terminal}
                title="No console or network capture"
                description="Nothing was logged or requested in the window around this failure."
                testId="cockpit-wire-empty"
              />
            )}
          </TabsContent>

          <TabsContent value="fix" className="flex flex-col gap-3">
            {hasPatch ? (
              <DiffViewer diff={finding.fix} filename={`${finding.id.toLowerCase()}.patch`} />
            ) : (
              <EmptyState
                icon={Wand2}
                title="No patch proposed yet"
                description="Applying a fix needs a patch preview first — run “Propose fix” to generate one."
                testId="cockpit-fix-empty"
              />
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => applyFix.mutate(finding.id)}
                // Policy: never write to a repository without a reviewable
                // patch on screen.
                disabled={!hasPatch || applyFix.isPending}
                loading={applyFix.isPending}
                data-testid="cockpit-apply-fix-btn"
              >
                <Check className="size-3.5" aria-hidden />
                Apply fix
              </Button>
              {applyFix.isSuccess ? (
                <span className="text-code text-success" role="status">
                  {applyFix.data.commit} · {applyFix.data.detail}
                </span>
              ) : null}
              {applyFix.isError ? (
                <span className="text-code text-destructive" role="status">
                  Apply failed — retry or reproduce first.
                </span>
              ) : null}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <DrawerFooter className="flex-wrap justify-start gap-2">
        <Button
          variant="outline"
          onClick={() =>
            handOffToAgent(
              "reproduce",
              `Reproduce ${finding.id} — ${finding.title}. Navigate to ${finding.url}, exercise ${finding.element} and confirm whether "${finding.actual}" still happens.`,
            )
          }
          data-testid="cockpit-reproduce-btn"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Reproduce
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            handOffToAgent(
              "propose-fix",
              `Propose a patch for ${finding.id} — ${finding.title}. Root cause on record: ${finding.rca}`,
            )
          }
          data-testid="cockpit-propose-fix-btn"
        >
          <Sparkles className="size-3.5" aria-hidden />
          Propose fix
        </Button>

        <Button
          variant="accent"
          onClick={() =>
            handOffToAgent(
              "heal",
              `Self-heal the failing test for ${finding.id} — re-anchor ${finding.element} on ${finding.url} and re-run the ${finding.relatedTests} affected assertions.`,
            )
          }
          data-testid="cockpit-heal-btn"
        >
          <Wand2 className="size-3.5" aria-hidden />
          Heal
        </Button>

        {/* No issue-tracker adapter exists, so this hands over a ready-to-paste
            issue body rather than pretending to file one. */}
        <CopyButton value={issueBody} label="Create issue" testId="cockpit-create-issue-btn" />

        <Button
          variant="ghost"
          className="ml-auto text-muted-foreground"
          onClick={() => {
            updateStatus.mutate({ id: finding.id, status: "false-positive" });
            onOpenChange(false);
          }}
          disabled={finding.status === "false-positive" || updateStatus.isPending}
          data-testid="cockpit-false-positive-btn"
        >
          <ThumbsDown className="size-3.5" aria-hidden />
          Mark false positive
        </Button>
      </DrawerFooter>
    </>
  );
}

/* ==========================================================================
   PIECES
   ======================================================================== */

function Observed({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  return (
    <div className="min-w-0">
      <p className="label-mono text-[10px]">{label}</p>
      <p
        className={cn(
          "text-code break-words",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
          !tone && "text-foreground/90",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function DiagnosisPanel({
  icon: Icon,
  title,
  caption,
  accent,
  bullet,
  items,
  emptyText,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  caption: string;
  accent: string;
  bullet: string;
  items: string[];
  emptyText: string;
  testId: string;
}) {
  return (
    <section
      data-testid={testId}
      className={cn("rounded-[var(--radius-md)] border p-3", accent)}
      aria-labelledby={`${testId}-title`}
    >
      <header className="mb-2 flex items-baseline gap-2">
        <Icon className={cn("size-3.5 shrink-0", bullet)} aria-hidden />
        <h3 id={`${testId}-title`} className="font-display text-xs font-semibold">
          {title}
        </h3>
        <span className="label-mono text-[10px]">{caption}</span>
      </header>
      {items.length ? (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-foreground/90">
              <span
                aria-hidden
                className={cn("mt-1.5 size-1.5 shrink-0 rounded-full bg-current", bullet)}
              />
              <span className="min-w-0 break-words">{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      )}
    </section>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const Icon = EVIDENCE_ICON[evidence.kind];
  return (
    <article
      data-testid={`cockpit-evidence-${evidence.id}`}
      className="surface-inset flex items-start gap-2.5 p-2.5"
    >
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-border bg-card text-muted-foreground"
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{evidence.label}</p>
        <p className="label-mono text-[10px]">
          {evidence.kind}
          {evidence.capturedAt ? ` · ${formatRelative(evidence.capturedAt)}` : ""}
        </p>
      </div>
    </article>
  );
}

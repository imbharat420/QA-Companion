"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bug,
  Camera,
  ExternalLink,
  FileCode2,
  FolderKanban,
  Globe,
  Lightbulb,
  ListChecks,
  Microscope,
  PanelRightOpen,
  PlayCircle,
  ScanSearch,
  Terminal,
  Wand2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import {
  CodeBlock,
  ConfirmDialog,
  CopyButton,
  DiffViewer,
  EmptyState,
  ErrorState,
  LoadingState,
  ScoreRing,
  SeverityBadge,
} from "@/components/shared";
import { useApplyFindingFix, useFinding, useUpdateFindingStatus } from "@/lib/queries";
import { routes } from "@/config/nav";
import { useUiStore } from "@/store";
import { cn, formatRelative } from "@/lib/utils";
import type { Evidence, Finding, FindingStatus } from "@/lib/api/types";

export interface FindingDetailProps {
  findingId: string;
  onClose: () => void;
}

const STATUS_OPTIONS: { value: FindingStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "confirmed", label: "Confirmed" },
  { value: "fixed", label: "Fixed" },
  { value: "false-positive", label: "False positive" },
  { value: "wont-fix", label: "Won't fix" },
];

const EVIDENCE_ICON: Record<Evidence["kind"], LucideIcon> = {
  screenshot: Camera,
  dom: FileCode2,
  console: Terminal,
  network: Globe,
  trace: Microscope,
  video: Camera,
  har: Globe,
};

/** The category audit each finding also belongs to — the contract's category fan-out. */
const CATEGORY_SURFACE: Record<string, { href: string; label: string }> = {
  accessibility: { href: routes.accessibility({ level: "A" }), label: "Accessibility audit" },
  security: { href: routes.security(), label: "Security scan" },
  "api-contract": { href: routes.apiIntel(), label: "API intelligence" },
  visual: { href: routes.visual(), label: "Visual baselines" },
  performance: { href: routes.performance(), label: "Performance report" },
};

const confidenceTone = (value: number) =>
  value >= 90 ? "success" : value >= 70 ? "primary" : "warning";

/* ==========================================================================
   SECTION SHELL
   ======================================================================== */

function Section({
  title,
  icon: Icon,
  action,
  children,
  testId,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <section data-testid={testId} className="surface-card flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        <h3 className="label-mono text-foreground">{title}</h3>
        {action ? <div className="ml-auto shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/* ==========================================================================
   DETAIL
   ======================================================================== */

export function FindingDetail({ findingId, onClose }: FindingDetailProps) {
  const { data: finding, isPending, error, refetch } = useFinding(findingId);

  if (isPending) return <LoadingState rows={6} variant="panel" />;

  if (error) {
    return (
      <ErrorState error={error} onRetry={() => void refetch()} testId="finding-detail-error" />
    );
  }

  if (!finding) {
    return (
      <EmptyState
        icon={Bug}
        title="Finding not found in this data source"
        description={`No record for ${findingId}. It may live in a different adapter, or have been merged into another finding.`}
        action={
          <Button variant="outline" onClick={onClose} data-testid="finding-detail-back">
            All findings
          </Button>
        }
        testId="finding-detail-missing"
      />
    );
  }

  // Remount per finding so the apply-fix dialog and mutation state never leak
  // from the row the user was last looking at.
  return <DetailBody key={finding.id} finding={finding} onClose={onClose} />;
}

function DetailBody({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  const openCockpit = useUiStore((s) => s.openCockpit);
  const updateStatus = useUpdateFindingStatus();
  const applyFix = useApplyFindingFix();
  const [confirmApply, setConfirmApply] = useState(false);

  const hasPatch = finding.fix.trim().length > 0;
  const evidence = finding.evidence ?? [];
  const facts = finding.facts ?? [];
  const inferences = finding.inferences ?? [];
  const surface = CATEGORY_SURFACE[finding.category];

  const onStatusChange = useCallback(
    (value: string) => {
      updateStatus.mutate({ id: finding.id, status: value as FindingStatus });
    },
    [finding.id, updateStatus],
  );

  const onApply = useCallback(() => {
    applyFix.mutate(finding.id, {
      onSuccess: (result) => {
        toast.success(`Patch applied to ${finding.id} — ${result.commit}`, {
          description: result.detail,
        });
      },
      onError: (mutationError) => {
        toast.error(`Could not apply the patch for ${finding.id}`, {
          description: mutationError instanceof Error ? mutationError.message : undefined,
        });
      },
    });
  }, [applyFix, finding.id]);

  const links = useMemo(
    () =>
      [
        finding.runId
          ? { id: "run", icon: PlayCircle, label: `Run ${finding.runId}`, href: routes.run(finding.runId) }
          : null,
        finding.suiteId
          ? {
              id: "suite",
              icon: ListChecks,
              label: `Suite ${finding.suiteId}`,
              href: routes.cases({ suiteId: finding.suiteId }),
            }
          : null,
        finding.caseId
          ? {
              id: "case",
              icon: FileCode2,
              label: `Case ${finding.caseId}`,
              href: routes.cases({ caseId: finding.caseId }),
            }
          : null,
        finding.projectId
          ? {
              id: "project",
              icon: FolderKanban,
              label: `Project ${finding.projectId}`,
              href: routes.project(finding.projectId),
            }
          : null,
        surface ? { id: "surface", icon: ScanSearch, label: surface.label, href: surface.href } : null,
      ].filter((link): link is { id: string; icon: LucideIcon; label: string; href: string } =>
        link !== null,
      ),
    [finding.caseId, finding.projectId, finding.runId, finding.suiteId, surface],
  );

  return (
    <article data-testid="finding-detail" data-finding-id={finding.id} className="flex flex-col gap-3">
      {/* ---------------------------------------------------------------- header */}
      <header className="surface-card flex flex-col gap-3 p-3.5">
        <div className="flex items-start gap-2">
          <SeverityBadge severity={finding.severity} size="xs" />
          <h2 className="min-w-0 flex-1 font-display text-[15px] font-semibold leading-snug">
            {finding.title}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close finding detail"
            data-testid="finding-detail-close"
          >
            <X className="size-3.5" aria-hidden />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-code text-primary">{finding.id}</span>
          <CopyButton value={finding.id} testId="finding-detail-copy-id" />
          <Badge variant="outline" size="xs">
            {finding.category}
          </Badge>
          {finding.detectedAt ? (
            <span className="font-mono text-[10px] text-subtle-foreground">
              detected {formatRelative(finding.detectedAt)}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-44 items-center gap-2">
            <span className="label-mono text-[10px]">Status</span>
            <Select value={finding.status} onValueChange={onStatusChange}>
              <SelectTrigger
                className="h-8 w-40"
                aria-label="Finding status"
                data-testid="finding-detail-status-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    data-testid={`finding-detail-status-${option.value}`}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-40 flex-1 items-center gap-2">
            <span className="label-mono text-[10px]">Conf</span>
            <Progress
              value={finding.confidence}
              tone={confidenceTone(finding.confidence)}
              aria-label={`Agent confidence ${finding.confidence} percent`}
              data-testid="finding-detail-confidence"
            />
            <span className="font-mono text-[11px] font-semibold tabular-nums">
              {finding.confidence}%
            </span>
          </div>

          <Button
            variant="outline"
            onClick={() => openCockpit(finding.id)}
            data-testid="finding-detail-open-cockpit"
          >
            <PanelRightOpen className="size-3.5" aria-hidden />
            Open cockpit
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------------------ what we saw */}
      <Section title="What we saw" icon={ScanSearch} testId="finding-detail-observed">
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="surface-inset p-2.5">
            <p className="label-mono mb-1 text-[10px]">Expected</p>
            <p className="text-code text-success">{finding.expected}</p>
          </div>
          <div className="surface-inset p-2.5">
            <p className="label-mono mb-1 text-[10px]">Actual</p>
            <p className="text-code text-destructive">{finding.actual}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="label-mono text-[10px]">Page</span>
          <a
            href={finding.url}
            target="_blank"
            rel="noreferrer"
            data-testid="finding-detail-url"
            className="text-code inline-flex min-w-0 items-center gap-1 truncate text-primary underline-offset-2 hover:underline"
          >
            {finding.url}
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
        </div>

        <CodeBlock code={finding.element} language="selector" />
      </Section>

      {/* -------------------------------------------------------------- diagnosis */}
      <Section title="Diagnosis" icon={Lightbulb} testId="finding-detail-diagnosis">
        <div className="flex items-start gap-3">
          <ScoreRing score={finding.confidence} size={64} label="confidence" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-foreground/85">{finding.rca}</p>
        </div>

        {/* Facts and inference never share a list: a reviewer has to be able to
            keep the observations while rejecting the reasoning. */}
        <div className="grid gap-2 lg:grid-cols-2">
          <div
            data-testid="finding-detail-facts"
            className="rounded-[var(--radius-md)] border border-success/25 bg-success/[0.06] p-2.5"
          >
            <p className="label-mono mb-1.5 flex items-center gap-1.5 text-success">
              <ScanSearch className="size-3" aria-hidden />
              Facts — observed
            </p>
            {facts.length ? (
              <ul className="flex flex-col gap-1.5">
                {facts.map((fact, i) => (
                  <li key={i} className="flex gap-1.5 text-[11.5px] leading-relaxed text-foreground/85">
                    <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-success" />
                    {fact}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">No observations were recorded.</p>
            )}
          </div>

          <div
            data-testid="finding-detail-inferences"
            className="rounded-[var(--radius-md)] border border-accent/25 bg-accent/[0.06] p-2.5"
          >
            <p className="label-mono mb-1.5 flex items-center gap-1.5 text-accent">
              <Lightbulb className="size-3" aria-hidden />
              Inference — agent
            </p>
            {inferences.length ? (
              <ul className="flex flex-col gap-1.5">
                {inferences.map((inference, i) => (
                  <li key={i} className="flex gap-1.5 text-[11.5px] leading-relaxed text-foreground/85">
                    <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                    {inference}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground">The agent drew no conclusions yet.</p>
            )}
          </div>
        </div>
      </Section>

      {/* --------------------------------------------------------------- evidence */}
      <Section title={`Evidence · ${evidence.length}`} icon={Camera} testId="finding-detail-evidence">
        {evidence.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {evidence.map((item) => {
              const Icon = EVIDENCE_ICON[item.kind];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openCockpit(finding.id)}
                    data-testid={`finding-detail-evidence-${item.id}`}
                    title={item.capturedAt ? `Captured ${formatRelative(item.capturedAt)}` : undefined}
                    className={cn(
                      "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-elevated",
                      "px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors",
                      "hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                    <span className="shrink-0 uppercase text-subtle-foreground">{item.kind}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            No artefacts were captured for this finding.
          </p>
        )}
      </Section>

      {/* ------------------------------------------------------------ proposed fix */}
      <Section
        title="Proposed fix"
        icon={Wand2}
        testId="finding-detail-fix"
        action={
          <div className="flex items-center gap-1.5">
            <Badge variant="muted" size="xs">
              {finding.commit}
            </Badge>
            <CopyButton value={finding.commit} testId="finding-detail-copy-commit" />
          </div>
        }
      >
        {hasPatch ? (
          <DiffViewer diff={finding.fix} filename={`${finding.id}.patch`} maxHeight={260} />
        ) : (
          <p className="text-[11px] text-muted-foreground">
            The agent has not proposed a patch for this finding yet.
          </p>
        )}

        <Button
          variant="primary"
          size="lg"
          disabled={!hasPatch || applyFix.isPending}
          loading={applyFix.isPending}
          onClick={() => setConfirmApply(true)}
          data-testid="finding-detail-apply-fix"
        >
          <Wand2 className="size-3.5" aria-hidden />
          Apply fix
        </Button>

        {applyFix.data ? (
          <p className="text-code text-success" data-testid="finding-detail-apply-result">
            {applyFix.data.commit} · {applyFix.data.detail}
          </p>
        ) : null}
      </Section>

      {/* ------------------------------------------------------------ cross-links */}
      <Section title="Where this came from" icon={PlayCircle} testId="finding-detail-links">
        <ul className="flex flex-wrap gap-1.5">
          {links.map((link) => (
            <li key={link.id}>
              <Link
                href={link.href}
                data-testid={`finding-detail-link-${link.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2 py-1",
                  "font-mono text-[10px] text-muted-foreground transition-colors",
                  "hover:border-primary/40 hover:text-foreground",
                )}
              >
                <link.icon className="size-3" aria-hidden />
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <ConfirmDialog
        open={confirmApply}
        onOpenChange={setConfirmApply}
        title={`Apply the patch for ${finding.id}?`}
        description="The proposed diff is written to the workspace and a regression run is queued. The change lands on the current branch."
        confirmLabel="Apply fix"
        onConfirm={onApply}
        testId="finding-detail-apply-confirm"
      />
    </article>
  );
}

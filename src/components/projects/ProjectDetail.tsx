"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bot,
  Bug,
  ExternalLink,
  ListChecks,
  PlayCircle,
  TerminalSquare,
} from "lucide-react";
import { Badge, Button, Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui";
import {
  CodeBlock,
  CopyButton,
  EmptyState,
  ErrorState,
  LoadingState,
  ScoreRing,
  SeverityBadge,
  StatGrid,
  StatTile,
  StatusBadge,
} from "@/components/shared";
import { routes } from "@/config/nav";
import { useFindings, useProject, useRuns } from "@/lib/queries";
import { WORKSPACE_STATES } from "@/lib/fixtures";
import { formatPercent, truncateMiddle } from "@/lib/utils";
import type { Severity } from "@/lib/api/types";

export interface ProjectDetailProps {
  projectId: string;
  /** Clears `?project=` — the drawer's back affordance and its overlay both call it. */
  onClose: () => void;
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const OPEN_STATUSES = new Set(["new", "confirmed"]);

export function ProjectDetail({ projectId, onClose }: ProjectDetailProps) {
  const projectQuery = useProject(projectId);
  const runsQuery = useRuns({ projectId, limit: 5 });
  const findingsQuery = useFindings({ projectId, limit: 25 });

  const project = projectQuery.data;
  const runs = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);
  const findings = useMemo(() => findingsQuery.data?.items ?? [], [findingsQuery.data]);

  const openFindings = useMemo(
    () => findings.filter((finding) => OPEN_STATUSES.has(finding.status)),
    [findings],
  );

  const topFindings = useMemo(
    () =>
      [...openFindings]
        .sort(
          (a, b) =>
            SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.confidence - a.confidence,
        )
        .slice(0, 4),
    [openFindings],
  );

  const passRate = useMemo(() => {
    const totals = runs.reduce(
      (acc, run) => ({ passed: acc.passed + run.passed, total: acc.total + run.passed + run.failed }),
      { passed: 0, total: 0 },
    );
    return totals.total ? totals.passed / totals.total : undefined;
  }, [runs]);

  return (
    <Drawer
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DrawerContent
        side="right"
        className="w-[460px] max-w-[94vw] gap-3 overflow-y-auto"
        data-testid="projects-detail"
        aria-describedby={undefined}
      >
        <DrawerHeader>
          <Button
            variant="ghost"
            size="xs"
            onClick={onClose}
            className="-ml-2 self-start"
            data-testid="projects-detail-back"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            All projects
          </Button>
          <DrawerTitle data-testid="projects-detail-title">
            {project?.name ?? "Project"}
          </DrawerTitle>
        </DrawerHeader>

        {projectQuery.isPending ? <LoadingState rows={5} variant="panel" /> : null}

        {projectQuery.isError ? (
          <ErrorState
            error={projectQuery.error}
            onRetry={() => void projectQuery.refetch()}
            testId="projects-detail-error"
          />
        ) : null}

        {!projectQuery.isPending && !projectQuery.isError && !project ? (
          <EmptyState
            title="That project is gone"
            description={`No workspace with id "${projectId}" exists in the active data source.`}
            action={
              <Button variant="outline" onClick={onClose} data-testid="projects-detail-missing-back">
                Back to projects
              </Button>
            }
            testId="projects-detail-empty"
          />
        ) : null}

        {project ? (
          <div className="flex flex-col gap-4">
            {/* --- identity ---------------------------------------------------- */}
            <div className="flex items-start gap-3">
              <ScoreRing score={project.health} size={64} label={`${project.name} health`} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="primary" size="xs">
                    {project.framework}
                  </Badge>
                  <Badge variant="outline" size="xs">
                    {project.category}
                  </Badge>
                  <StatusBadge status={WORKSPACE_STATES[project.id] ?? "ready"} size="xs" />
                </div>
                <p className="flex items-center gap-1 text-code text-muted-foreground">
                  <span className="truncate">{truncateMiddle(project.path, 34)}</span>
                  <CopyButton value={project.path} testId="projects-detail-copy-path" />
                </p>
                <p className="text-code truncate text-subtle-foreground">{project.branch}</p>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">{project.description}</p>

            {/* --- metrics ------------------------------------------------------ */}
            <StatGrid columns={2}>
              <StatTile
                label="Tests"
                value={project.tests}
                icon={ListChecks}
                tone="primary"
                href={routes.suites({ projectId: project.id })}
                testId="projects-detail-tile-tests"
              />
              <StatTile
                label="Sessions"
                value={project.sessions}
                icon={Bot}
                tone="accent"
                href={routes.workbench()}
                testId="projects-detail-tile-sessions"
              />
              <StatTile
                label="Open findings"
                value={openFindings.length}
                icon={Bug}
                tone={openFindings.length ? "error" : "success"}
                href={routes.findings({ projectId: project.id })}
                testId="projects-detail-tile-findings"
              />
              <StatTile
                label="Pass rate"
                value={passRate === undefined ? "—" : formatPercent(passRate)}
                icon={PlayCircle}
                tone="success"
                hint={runs.length ? `Last ${runs.length} runs` : "No runs yet"}
                href={routes.runs()}
                testId="projects-detail-tile-passrate"
              />
            </StatGrid>

            {/* --- commands ----------------------------------------------------- */}
            <section aria-label="Commands" className="flex flex-col gap-2">
              <span className="label-mono flex items-center gap-1.5">
                <TerminalSquare className="size-3.5" aria-hidden />
                Commands
              </span>
              <CodeBlock code={project.devCommand} filename="Dev server" language="bash" />
              <CodeBlock code={project.testCommand} filename="Test suite" language="bash" />
            </section>

            {/* --- recent runs --------------------------------------------------- */}
            <section aria-label="Recent runs" className="flex flex-col gap-1.5">
              <span className="label-mono">Recent runs</span>
              {runsQuery.isPending ? <LoadingState rows={3} variant="panel" /> : null}
              {!runsQuery.isPending && runs.length === 0 ? (
                <p className="text-[11px] text-subtle-foreground">
                  No runs recorded for this project yet.
                </p>
              ) : null}
              {runs.map((run) => (
                <Link
                  key={run.id}
                  href={routes.run(run.id)}
                  data-testid={`projects-detail-run-${run.id}`}
                  className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-elevated px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">{run.name}</span>
                    <span className="block text-[10px] text-subtle-foreground">
                      {run.when} · {run.duration}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums">
                    <span className="text-success">{run.passed}</span>
                    <span className="text-subtle-foreground"> / </span>
                    <span className="text-error">{run.failed}</span>
                  </span>
                  {run.status ? <StatusBadge status={run.status} size="xs" /> : null}
                </Link>
              ))}
            </section>

            {/* --- top findings --------------------------------------------------- */}
            <section aria-label="Top findings" className="flex flex-col gap-1.5">
              <span className="label-mono">Top open findings</span>
              {findingsQuery.isPending ? <LoadingState rows={3} variant="panel" /> : null}
              {!findingsQuery.isPending && topFindings.length === 0 ? (
                <p className="text-[11px] text-subtle-foreground">
                  Nothing open — the last sweep came back clean.
                </p>
              ) : null}
              {topFindings.map((finding) => (
                <Link
                  key={finding.id}
                  href={routes.finding(finding.id)}
                  data-testid={`projects-detail-finding-${finding.id}`}
                  className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-elevated px-2 py-1.5 transition-colors hover:bg-muted"
                >
                  <SeverityBadge severity={finding.severity} size="xs" />
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                    {finding.title}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-subtle-foreground">
                    {finding.id}
                  </span>
                </Link>
              ))}
            </section>

            {/* --- provenance ------------------------------------------------------ */}
            <dl className="flex flex-col gap-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-subtle-foreground">Owner</dt>
                <dd className="text-foreground">{project.owner.name}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-subtle-foreground">Folder</dt>
                <dd className="text-foreground">{project.folder ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-subtle-foreground">Last active</dt>
                <dd className="text-foreground">{project.lastActive}</dd>
              </div>
              {project.gitUrl ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-subtle-foreground">Repository</dt>
                  <dd className="flex min-w-0 items-center gap-1">
                    <span className="truncate text-code text-muted-foreground">
                      {truncateMiddle(project.gitUrl, 30)}
                    </span>
                    <CopyButton value={project.gitUrl} testId="projects-detail-copy-git" />
                  </dd>
                </div>
              ) : null}
            </dl>

            {/* --- actions ---------------------------------------------------------- */}
            <div className="flex flex-col gap-2 border-t border-border/50 pt-3">
              <Button variant="primary" size="lg" asChild data-testid="projects-detail-workbench">
                <Link href={routes.workbench()}>
                  <Bot className="size-4" aria-hidden />
                  Open workbench
                </Link>
              </Button>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" asChild data-testid="projects-detail-suites">
                  <Link href={routes.suites({ projectId: project.id })}>
                    <ListChecks className="size-3.5" aria-hidden />
                    Suites
                  </Link>
                </Button>
                <Button variant="outline" asChild data-testid="projects-detail-runs">
                  <Link href={routes.runs()}>
                    <PlayCircle className="size-3.5" aria-hidden />
                    Runs
                  </Link>
                </Button>
                <Button variant="outline" asChild data-testid="projects-detail-findings">
                  <Link href={routes.findings({ projectId: project.id })}>
                    <Bug className="size-3.5" aria-hidden />
                    Findings
                  </Link>
                </Button>
              </div>
              {project.gitUrl ? (
                <Button variant="ghost" size="xs" asChild data-testid="projects-detail-git">
                  <a href={project.gitUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3" aria-hidden />
                    Open repository
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

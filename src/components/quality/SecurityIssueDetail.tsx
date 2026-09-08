"use client";

import { useCallback } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bug,
  ExternalLink,
  FilePlus2,
  MonitorPlay,
  PlayCircle,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Webhook,
} from "lucide-react";
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { CodeBlock, CopyButton, SeverityBadge, StatusBadge } from "@/components/shared";
import { routes } from "@/config/nav";
import { useAgentStore } from "@/store";
import { cn, formatRelative } from "@/lib/utils";
import type { FindingStatus, SecurityIssue } from "@/lib/api/types";

/** The run this scan belongs to — see fixtures/runs.ts and the contract. */
const SCAN_RUN_ID = "#554";

const STATUSES: FindingStatus[] = ["new", "confirmed", "fixed", "false-positive", "wont-fix"];

const STATUS_LABEL: Record<FindingStatus, string> = {
  new: "New",
  confirmed: "Confirmed",
  fixed: "Fixed",
  "false-positive": "False positive",
  "wont-fix": "Won't fix",
};

/** CVSS 3.1 qualitative severity ratings. */
export function cvssBand(score: number): { label: string; className: string } {
  if (score >= 9) return { label: "Critical", className: "text-critical" };
  if (score >= 7) return { label: "High", className: "text-high" };
  if (score >= 4) return { label: "Medium", className: "text-medium" };
  return { label: "Low", className: "text-low" };
}

/** "CWE-347" → the MITRE definition page. */
export const cweHref = (cwe: string): string =>
  `https://cwe.mitre.org/data/definitions/${cwe.replace(/\D/g, "")}.html`;

/**
 * `CodeBlock` renders one line per newline and scrolls sideways rather than
 * wrapping. The evidence is prose, so it is folded to a readable measure here
 * instead of arriving as one 400-character line nobody can read.
 */
function foldToMeasure(text: string, width = 72): string {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line.length > 0 && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line.length > 0 ? `${line} ${word}` : word;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join("\n");
}

export interface SecurityIssueDetailProps {
  issue: SecurityIssue;
  /** Status after any triage override the page is holding. */
  status: FindingStatus;
  /** True when a `Finding` with this id exists, which enables "Open finding". */
  hasFinding: boolean;
  /** Discovered endpoint whose path matches this issue's URL, when there is one. */
  endpointId?: string;
  onStatusChange: (id: string, status: FindingStatus) => void;
  onClose: () => void;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="label-mono">{title}</h3>
      {children}
    </section>
  );
}

function LinkRow({
  href,
  icon: Icon,
  label,
  detail,
  testId,
}: {
  href: string;
  icon: typeof Bug;
  label: string;
  detail: string;
  testId: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        "surface-inset flex items-center gap-2.5 px-2.5 py-2 text-xs",
        "transition-colors hover:border-border hover:bg-muted/40",
      )}
    >
      <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-foreground">{label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>
      </span>
      <ExternalLink className="size-3 shrink-0 text-subtle-foreground" aria-hidden />
    </Link>
  );
}

/**
 * The remediation drawer for one scan finding. Everything here is a report of
 * what our own scanner observed against our own staging environment plus the
 * fix — the agent actions ask for a re-check, never for the issue to be
 * exercised further.
 */
export function SecurityIssueDetail({
  issue,
  status,
  hasFinding,
  endpointId,
  onStatusChange,
  onClose,
}: SecurityIssueDetailProps) {
  const router = useRouter();
  const startTask = useAgentStore((s) => s.startTask);

  const runInWorkbench = useCallback(
    (prompt: string) => {
      void startTask({ prompt, mode: "security-scan" });
      router.push(routes.workbench());
    },
    [router, startTask],
  );

  const reproduce = useCallback(() => {
    runInWorkbench(
      `Re-check ${issue.id} on our own staging environment. Visit ${issue.url} and verify whether ` +
        `"${issue.title}" still holds after the recommended fix: ${issue.remediation} ` +
        `Report the response status, the relevant headers and a pass/fail verdict only — read-only checks, ` +
        `no data changes, no traffic to any third-party host.`,
    );
  }, [issue, runInWorkbench]);

  const createIssue = useCallback(() => {
    runInWorkbench(
      `Open a tracked finding for ${issue.id} — "${issue.title}" (${issue.severity}, CVSS ` +
        `${issue.cvss ?? "n/a"}, ${issue.cwe ?? "no CWE"}) on ${issue.url}. Summarise the evidence, ` +
        `attach the remediation steps and link it to run ${SCAN_RUN_ID}.`,
    );
  }, [issue, runInWorkbench]);

  const markFalsePositive = useCallback(
    () => onStatusChange(issue.id, "false-positive"),
    [issue.id, onStatusChange],
  );

  const changeStatus = useCallback(
    (next: string) => onStatusChange(issue.id, next as FindingStatus),
    [issue.id, onStatusChange],
  );

  const band = issue.cvss === undefined ? null : cvssBand(issue.cvss);
  const evidence = foldToMeasure(issue.evidence);

  return (
    <Drawer
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DrawerContent side="right" size="lg" className="w-[560px] gap-3" data-testid="security-detail">
        <DrawerHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-code text-primary" data-testid="security-detail-id">
              {issue.id}
            </span>
            <SeverityBadge severity={issue.severity} size="xs" />
            {band && issue.cvss !== undefined ? (
              <Badge variant="outline" size="xs" data-testid="security-detail-cvss">
                <span className={cn("font-mono font-semibold tabular-nums", band.className)}>
                  {issue.cvss.toFixed(1)}
                </span>
                <span className="text-subtle-foreground">CVSS {band.label}</span>
              </Badge>
            ) : null}
            {issue.cwe ? (
              <a
                href={cweHref(issue.cwe)}
                target="_blank"
                rel="noreferrer"
                data-testid="security-detail-cwe"
                className="text-code inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/12 px-2 py-0.5 text-primary transition-colors hover:bg-primary/20"
              >
                {issue.cwe}
                <ExternalLink className="size-2.5" aria-hidden />
              </a>
            ) : null}
            <Badge variant="muted" size="xs">
              {issue.category}
            </Badge>
            <StatusBadge status={status} size="xs" />
          </div>
          <DrawerTitle>{issue.title}</DrawerTitle>
          <DrawerDescription>
            Detected {formatRelative(issue.detectedAt)} on our staging environment.
          </DrawerDescription>
        </DrawerHeader>

        {/* Own scroll: evidence and remediation together overflow a 560px panel. */}
        <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2">
          <Section title="Affected URL">
            <div className="surface-inset flex items-center gap-2 py-1 pl-2.5 pr-1">
              <code className="text-code min-w-0 flex-1 truncate" title={issue.url}>
                {issue.url}
              </code>
              <CopyButton value={issue.url} testId="security-detail-copy-url" />
            </div>
          </Section>

          <Section title="Evidence observed">
            <CodeBlock code={evidence} language="scan evidence" maxHeight={200} />
          </Section>

          <Section title="Remediation">
            <p
              data-testid="security-detail-remediation"
              className="rounded-[var(--radius-md)] border border-primary/25 bg-primary/8 px-3 py-2.5 text-xs leading-relaxed text-foreground/90"
            >
              {issue.remediation}
            </p>
          </Section>

          <Section title="Triage">
            <div className="surface-inset flex items-center gap-2 px-2.5 py-2">
              <Label htmlFor="security-detail-status" className="label-mono shrink-0">
                Status
              </Label>
              <Select value={status} onValueChange={changeStatus}>
                <SelectTrigger
                  id="security-detail-status"
                  className="h-8 flex-1"
                  aria-label="Issue status"
                  data-testid="security-detail-status-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((value) => (
                    <SelectItem
                      key={value}
                      value={value}
                      data-testid={`security-detail-status-${value}`}
                    >
                      {STATUS_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Section>

          <Section title="Related">
            <div className="flex flex-col gap-1.5">
              {hasFinding ? (
                <LinkRow
                  href={routes.finding(issue.id)}
                  icon={Bug}
                  label="Open finding"
                  detail={`${issue.id} is tracked in the findings inbox`}
                  testId="security-detail-open-finding"
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} data-testid="security-detail-open-finding-disabled">
                      <Button variant="outline" size="sm" disabled className="w-full justify-start">
                        <Bug className="size-3.5" aria-hidden />
                        Open finding
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>No finding filed for this issue yet</TooltipContent>
                </Tooltip>
              )}

              {endpointId ? (
                <LinkRow
                  href={routes.apiIntel({ endpointId })}
                  icon={Webhook}
                  label="Open endpoint"
                  detail={`Schemas, traffic and contract issues for ${endpointId}`}
                  testId="security-detail-endpoint"
                />
              ) : null}

              <LinkRow
                href={routes.findings({ category: "security" })}
                icon={Bug}
                label="View related findings"
                detail="Findings filtered to the security category"
                testId="security-detail-related-findings"
              />
              <LinkRow
                href={routes.run(SCAN_RUN_ID)}
                icon={PlayCircle}
                label={`Related run ${SCAN_RUN_ID}`}
                detail="The run this passive scan shipped with"
                testId="security-detail-run"
              />
              <LinkRow
                href={routes.settings({ tab: "policy" })}
                icon={SlidersHorizontal}
                label="Scan policy"
                detail="What the agent is allowed to probe, and how deep"
                testId="security-detail-policy"
              />
              <LinkRow
                href={routes.workbench()}
                icon={MonitorPlay}
                label="Open URL in workbench"
                detail={issue.url}
                testId="security-detail-open-url"
              />
            </div>
          </Section>
        </div>

        <DrawerFooter className="flex-wrap justify-start">
          <Button variant="primary" onClick={reproduce} data-testid="security-detail-reproduce-btn">
            <ShieldCheck className="size-3.5" aria-hidden />
            Reproduce with agent
          </Button>
          {hasFinding ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} data-testid="security-detail-create-issue-disabled">
                  <Button variant="outline" disabled>
                    <FilePlus2 className="size-3.5" aria-hidden />
                    Create issue
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{issue.id} is already filed as a finding</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="outline" onClick={createIssue} data-testid="security-detail-create-issue-btn">
              <FilePlus2 className="size-3.5" aria-hidden />
              Create issue
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={markFalsePositive}
            disabled={status === "false-positive"}
            data-testid="security-detail-false-positive-btn"
          >
            <ShieldOff className="size-3.5" aria-hidden />
            {status === "false-positive" ? "Marked false positive" : "Mark false positive"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

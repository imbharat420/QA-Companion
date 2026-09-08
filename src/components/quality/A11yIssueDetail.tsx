"use client";

import { useCallback } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bug, ExternalLink, Highlighter, ListChecks, MonitorPlay, ShieldOff, Wand2 } from "lucide-react";
import {
  Badge,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui";
import { CodeBlock, CopyButton, SeverityBadge, StatusBadge } from "@/components/shared";
import { routes } from "@/config/nav";
import { useAgentStore, useUiStore } from "@/store";
import { cn } from "@/lib/utils";
import type { A11yIssue, FindingStatus } from "@/lib/api/types";

/**
 * WCAG success criteria the fixture set actually cites, mapped to their
 * Understanding page. axe reports bare numbers ("1.4.3"), and a number on its
 * own is unreadable — the name is what tells a developer what they broke, and
 * the slug is the only way to build a working w3.org link.
 */
const CRITERIA: Record<string, { name: string; slug: string }> = {
  "1.1.1": { name: "Non-text Content", slug: "non-text-content" },
  "1.3.1": { name: "Info and Relationships", slug: "info-and-relationships" },
  "1.3.5": { name: "Identify Input Purpose", slug: "identify-input-purpose" },
  "1.4.3": { name: "Contrast (Minimum)", slug: "contrast-minimum" },
  "1.4.4": { name: "Resize Text", slug: "resize-text" },
  "2.1.1": { name: "Keyboard", slug: "keyboard" },
  "2.4.1": { name: "Bypass Blocks", slug: "bypass-blocks" },
  "2.4.3": { name: "Focus Order", slug: "focus-order" },
  "2.4.4": { name: "Link Purpose (In Context)", slug: "link-purpose-in-context" },
  "3.1.1": { name: "Language of Page", slug: "language-of-page" },
  "3.3.2": { name: "Labels or Instructions", slug: "labels-or-instructions" },
  "4.1.1": { name: "Parsing", slug: "parsing" },
  "4.1.2": { name: "Name, Role, Value", slug: "name-role-value" },
};

const UNDERSTANDING = "https://www.w3.org/WAI/WCAG22/Understanding/";

/** The axe rule reference — the fixture rule ids are real 4.10 ids, so these resolve. */
const ruleDocs = (ruleId: string) => `https://dequeuniversity.com/rules/axe/4.10/${ruleId}`;

const criterionHref = (criterion: string) => {
  const entry = CRITERIA[criterion];
  return entry ? `${UNDERSTANDING}${entry.slug}.html` : UNDERSTANDING;
};

const criterionLabel = (criterion: string) => CRITERIA[criterion]?.name ?? "WCAG success criterion";

/** The suite that owns the accessibility sweep — see fixtures/suites.ts (st-5). */
const A11Y_SUITE_ID = "st-5";

export interface A11yIssueDetailProps {
  issue: A11yIssue;
  /** Status after any optimistic override the page is holding. */
  status: FindingStatus;
  /** True when a `Finding` with this id exists, which enables "Open finding". */
  hasFinding: boolean;
  onMarkFalsePositive: (id: string) => void;
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
 * The remediation drawer. It owns its own `Drawer` so the page only has to
 * decide *which* issue is selected, and it starts agent work through the agent
 * store rather than a mutation: a fix is a browser session, not a REST call.
 */
export function A11yIssueDetail({
  issue,
  status,
  hasFinding,
  onMarkFalsePositive,
  onClose,
}: A11yIssueDetailProps) {
  const router = useRouter();
  const startTask = useAgentStore((s) => s.startTask);
  const setInspectorTab = useUiStore((s) => s.setInspectorTab);
  const setFocusMode = useUiStore((s) => s.setFocusMode);

  const runInWorkbench = useCallback(
    (prompt: string) => {
      void startTask({ prompt, mode: "accessibility-audit" });
      router.push(routes.workbench());
    },
    [router, startTask],
  );

  const fixWithAgent = useCallback(() => {
    runInWorkbench(
      `Fix the axe-core "${issue.ruleId}" violation on ${issue.url}. ` +
        `The offending element is ${issue.selector}. ${issue.remediation} ` +
        `Patch the source, re-run the ${issue.ruleId} check and report the new node count (currently ${issue.nodeCount}).`,
    );
  }, [issue, runInWorkbench]);

  const highlightInBrowser = useCallback(() => {
    // The a11y inspector tab is the pane that answers "what does AT see here?",
    // so the browser opens already looking at it.
    setInspectorTab("a11y");
    setFocusMode("browser");
    runInWorkbench(
      `Open ${issue.url} in the live browser, scroll ${issue.selector} into view, highlight it ` +
        `and read out its accessibility-tree node. Do not change any code.`,
    );
  }, [issue.selector, issue.url, runInWorkbench, setFocusMode, setInspectorTab]);

  const markFalsePositive = useCallback(
    () => onMarkFalsePositive(issue.id),
    [issue.id, onMarkFalsePositive],
  );

  return (
    <Drawer
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DrawerContent
        side="right"
        size="lg"
        className="w-[560px] gap-3"
        data-testid="a11y-detail"
      >
        <DrawerHeader>
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={ruleDocs(issue.ruleId)}
              target="_blank"
              rel="noreferrer"
              data-testid="a11y-detail-rule-docs"
              className="text-code inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/12 px-2 py-0.5 text-primary transition-colors hover:bg-primary/20"
            >
              {issue.ruleId}
              <ExternalLink className="size-2.5" aria-hidden />
            </a>
            <SeverityBadge severity={issue.impact} size="xs" />
            <Badge variant="outline" size="xs" data-testid="a11y-detail-level">
              WCAG {issue.wcagLevel}
            </Badge>
            <Badge variant="muted" size="xs">
              {issue.category}
            </Badge>
            <StatusBadge status={status} size="xs" />
          </div>
          <DrawerTitle>{issue.title}</DrawerTitle>
          <DrawerDescription>{issue.description}</DrawerDescription>
        </DrawerHeader>

        {/* Own scroll: the offending markup and the remediation prose are both
            long enough to push the action row off a 560px panel. */}
        <div className="-mr-2 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-2">
          <Section title={`Success criteria · ${issue.criteria.length}`}>
            <ul className="flex flex-wrap gap-1.5">
              {issue.criteria.map((criterion) => (
                <li key={criterion}>
                  <a
                    href={criterionHref(criterion)}
                    target="_blank"
                    rel="noreferrer"
                    data-testid={`a11y-detail-criterion-${criterion}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border border-border bg-elevated px-2 py-0.5",
                      "font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground",
                      "transition-colors hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {criterion}
                    <span className="font-sans normal-case tracking-normal">
                      {criterionLabel(criterion)}
                    </span>
                    <ExternalLink className="size-2.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`Selector · ${issue.nodeCount} ${issue.nodeCount === 1 ? "node" : "nodes"}`}>
            <div className="surface-inset flex items-center gap-2 py-1 pl-2.5 pr-1">
              <code className="text-code min-w-0 flex-1 truncate" title={issue.selector}>
                {issue.selector}
              </code>
              <CopyButton value={issue.selector} testId="a11y-detail-copy-selector" />
            </div>
          </Section>

          <Section title="Offending node">
            <CodeBlock code={issue.html} language="html" maxHeight={180} />
          </Section>

          <Section title="Remediation">
            <p
              data-testid="a11y-detail-remediation"
              className="rounded-[var(--radius-md)] border border-primary/25 bg-primary/8 px-3 py-2.5 text-xs leading-relaxed text-foreground/90"
            >
              {issue.remediation}
            </p>
          </Section>

          <Section title="Related">
            <div className="flex flex-col gap-1.5">
              {hasFinding ? (
                <LinkRow
                  href={routes.finding(issue.id)}
                  icon={Bug}
                  label="Open finding"
                  detail={issue.id}
                  testId="a11y-detail-open-finding"
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0} data-testid="a11y-detail-open-finding-disabled">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="w-full justify-start"
                      >
                        <Bug className="size-3.5" aria-hidden />
                        Open finding
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>No finding opened for this rule yet</TooltipContent>
                </Tooltip>
              )}

              <LinkRow
                href={routes.findings({ category: "accessibility" })}
                icon={Bug}
                label="View related findings"
                detail="Findings filtered to the accessibility category"
                testId="a11y-detail-related-findings"
              />
              <LinkRow
                href={routes.cases({ suiteId: A11Y_SUITE_ID })}
                icon={ListChecks}
                label="Accessibility Audit suite"
                detail="The cases that cover this rule"
                testId="a11y-detail-suite"
              />
              <LinkRow
                href={routes.workbench()}
                icon={MonitorPlay}
                label="Open page in workbench"
                detail={issue.url}
                testId="a11y-detail-open-page"
              />
            </div>
          </Section>
        </div>

        <DrawerFooter className="flex-wrap justify-start">
          <Button variant="primary" onClick={fixWithAgent} data-testid="a11y-detail-fix-btn">
            <Wand2 className="size-3.5" aria-hidden />
            Fix with agent
          </Button>
          <Button variant="outline" onClick={highlightInBrowser} data-testid="a11y-detail-highlight-btn">
            <Highlighter className="size-3.5" aria-hidden />
            Highlight in browser
          </Button>
          <Button
            variant="ghost"
            onClick={markFalsePositive}
            disabled={status === "false-positive"}
            data-testid="a11y-detail-false-positive-btn"
          >
            <ShieldOff className="size-3.5" aria-hidden />
            {status === "false-positive" ? "Marked false positive" : "Mark false positive"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

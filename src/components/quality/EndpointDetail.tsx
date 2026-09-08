"use client";

import { memo } from "react";
import Link from "next/link";
import {
  Activity,
  Bot,
  ExternalLink,
  FileCode2,
  GitCompare,
  ListChecks,
  Lock,
  PlayCircle,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { CopyButton, EmptyState, SeverityBadge } from "@/components/shared";
import { routes } from "@/config/nav";
import { cn, formatCompact, formatDuration, formatPercent, formatRelative } from "@/lib/utils";
import { SchemaTable } from "./SchemaTable";
import type { ApiEndpoint, ApiIssue, HttpMethod, Severity } from "@/lib/api/types";

/* ==========================================================================
   SHARED BITS — the table and this panel must colour a method and a status the
   same way, or the drawer reads like a different product.
   ======================================================================== */

const METHOD_CLASS: Record<HttpMethod, string> = {
  GET: "border-primary/30 bg-primary/15 text-primary",
  POST: "border-accent/30 bg-accent/15 text-accent",
  PUT: "border-executing/30 bg-executing/15 text-executing",
  PATCH: "border-thinking/30 bg-thinking/15 text-thinking",
  DELETE: "border-critical/30 bg-critical/15 text-critical",
  HEAD: "border-low/30 bg-low/15 text-low",
  OPTIONS: "border-border bg-muted text-muted-foreground",
};

export const MethodBadge = memo(function MethodBadge({
  method,
  size = "xs",
}: {
  method: HttpMethod;
  size?: "xs" | "sm";
}) {
  return (
    <Badge
      variant="outline"
      size={size}
      data-testid={`api-method-${method}`}
      className={cn("justify-center", METHOD_CLASS[method])}
    >
      {method}
    </Badge>
  );
});

/** 2xx quiet, 3xx muted, 4xx amber, 5xx red — the tint is the triage. */
function statusClass(status: number): string {
  if (status >= 500) return "border-critical/30 bg-critical/15 text-critical";
  if (status >= 400) return "border-medium/30 bg-medium/15 text-medium";
  if (status >= 300) return "border-border bg-muted text-muted-foreground";
  return "border-success/30 bg-success/15 text-success";
}

export const StatusChip = memo(function StatusChip({ status }: { status: number }) {
  return (
    <Badge
      variant="outline"
      size="xs"
      data-testid={`api-status-${status}`}
      className={statusClass(status)}
    >
      {status}
    </Badge>
  );
});

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low"];

/** Worst severity attached to an endpoint — drives the row's issue badge. */
export function worstSeverity(issues: ApiIssue[]): Severity | null {
  for (const severity of SEVERITY_ORDER) {
    if (issues.some((issue) => issue.severity === severity)) return severity;
  }
  return null;
}

export function hasSchemaDrift(endpoint: ApiEndpoint): boolean {
  return (
    endpoint.requestSchema.some((field) => field.drift) ||
    endpoint.responseSchema.some((field) => field.drift)
  );
}

/** Above 10% the endpoint is broken, above 2% it is degrading. */
export function errorRateClass(rate: number): string {
  if (rate >= 0.1) return "text-critical";
  if (rate >= 0.02) return "text-medium";
  return "text-muted-foreground";
}

/* ==========================================================================
   THE PANEL
   ======================================================================== */

const SOURCE_LABEL: Record<ApiEndpoint["discoveredVia"], string> = {
  openapi: "In the spec",
  traffic: "Traffic only — undocumented",
  manual: "Added by hand — undocumented",
};

/**
 * The two contract tests the script library actually ships, keyed by the
 * endpoint they cover. Anything else links to the library root rather than
 * inventing a script id.
 */
const CONTRACT_SCRIPTS: Record<string, string> = {
  "/api/payments": "sc-012",
  "/api/availability": "sc-013",
};

/** The proxy session these schemas and percentiles were observed in. */
const OBSERVED_RUN = "#558";

interface StatProps {
  label: string;
  value: string;
  valueClass?: string;
  testId: string;
}

function Stat({ label, value, valueClass, testId }: StatProps) {
  return (
    <div className="surface-inset flex flex-col gap-1 p-2.5">
      <span className="label-mono text-[10px]">{label}</span>
      <span
        data-testid={testId}
        className={cn("font-mono text-sm font-semibold tabular-nums", valueClass ?? "text-foreground")}
      >
        {value}
      </span>
    </div>
  );
}

export interface EndpointDetailProps {
  endpoint: ApiEndpoint;
  /** Starts an agent task and leaves for the workbench; issue-scoped when given. */
  onGenerateTest: (issue?: ApiIssue) => void;
}

function EndpointDetailImpl({ endpoint, onGenerateTest }: EndpointDetailProps) {
  const drifting = [...endpoint.requestSchema, ...endpoint.responseSchema].filter(
    (field) => field.drift,
  ).length;
  const scriptId = CONTRACT_SCRIPTS[endpoint.path];
  const worst = worstSeverity(endpoint.issues);

  return (
    <div data-testid="endpoint-detail" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="surface-inset flex flex-col gap-2 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <MethodBadge method={endpoint.method} size="sm" />
          <code className="text-code min-w-0 flex-1 break-all text-foreground">{endpoint.path}</code>
          <CopyButton value={endpoint.path} testId="endpoint-detail-copy-path" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span
            data-testid="endpoint-detail-source"
            className={endpoint.discoveredVia === "openapi" ? undefined : "text-accent"}
          >
            {SOURCE_LABEL[endpoint.discoveredVia]}
          </span>
          <span className="flex items-center gap-1">
            {endpoint.authRequired ? (
              <>
                <Lock className="size-3 text-medium" aria-hidden />
                Auth required
              </>
            ) : (
              "Public — no auth observed"
            )}
          </span>
          <span data-testid="endpoint-detail-last-seen">
            Last seen {formatRelative(endpoint.lastSeen)}
          </span>
          {drifting > 0 ? (
            <span className="flex items-center gap-1 text-accent">
              <GitCompare className="size-3" aria-hidden />
              {drifting} field{drifting === 1 ? "" : "s"} drifting
            </span>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="overview" className="min-h-0 flex-1">
        <TabsList data-testid="endpoint-detail-tabs">
          <TabsTrigger value="overview" data-testid="endpoint-detail-tab-overview">
            <Activity aria-hidden />
            Overview
          </TabsTrigger>
          <TabsTrigger value="request" data-testid="endpoint-detail-tab-request">
            Request
            <span className="font-mono text-[10px] tabular-nums text-subtle-foreground">
              {endpoint.requestSchema.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="response" data-testid="endpoint-detail-tab-response">
            Response
            <span className="font-mono text-[10px] tabular-nums text-subtle-foreground">
              {endpoint.responseSchema.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="issues" data-testid="endpoint-detail-tab-issues">
            Issues
            {endpoint.issues.length > 0 && worst ? (
              <SeverityBadge severity={worst} size="xs" showLabel={false} />
            ) : null}
            <span className="font-mono text-[10px] tabular-nums text-subtle-foreground">
              {endpoint.issues.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* --- overview ------------------------------------------------- */}
        <TabsContent value="overview" className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat
                label="Calls"
                value={formatCompact(endpoint.callCount)}
                testId="endpoint-detail-calls"
              />
              <Stat
                label="p50"
                value={formatDuration(endpoint.p50Ms)}
                testId="endpoint-detail-p50"
              />
              <Stat
                label="p95"
                value={formatDuration(endpoint.p95Ms)}
                valueClass={endpoint.p95Ms >= 500 ? "text-medium" : undefined}
                testId="endpoint-detail-p95"
              />
              <Stat
                label="Error rate"
                value={formatPercent(endpoint.errorRate)}
                valueClass={errorRateClass(endpoint.errorRate)}
                testId="endpoint-detail-error-rate"
              />
            </div>

            <section className="flex flex-col gap-1.5">
              <h3 className="label-mono">Observed statuses</h3>
              <div className="flex flex-wrap gap-1.5" data-testid="endpoint-detail-statuses">
                {endpoint.observedStatuses.map((status) => (
                  <StatusChip key={status} status={status} />
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-1.5">
              <h3 className="label-mono">Tags</h3>
              <div className="flex flex-wrap gap-1.5" data-testid="endpoint-detail-tags">
                {endpoint.tags.map((tag) => (
                  <Badge key={tag} variant="muted" size="xs" className="lowercase">
                    {tag}
                  </Badge>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-1.5">
              <h3 className="label-mono">Act on this endpoint</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onGenerateTest()}
                  data-testid="endpoint-detail-generate-test"
                >
                  <Bot className="size-3.5" aria-hidden />
                  Generate contract test
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={routes.scripts(scriptId ? { scriptId } : undefined)}
                    data-testid="endpoint-detail-link-script"
                  >
                    <FileCode2 className="size-3.5" aria-hidden />
                    {scriptId ? "Contract test" : "Script library"}
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={routes.cases({ tag: "api" })} data-testid="endpoint-detail-link-cases">
                    <ListChecks className="size-3.5" aria-hidden />
                    API test cases
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={routes.run(OBSERVED_RUN)} data-testid="endpoint-detail-link-run">
                    <PlayCircle className="size-3.5" aria-hidden />
                    Observed in {OBSERVED_RUN}
                  </Link>
                </Button>
              </div>
            </section>
          </div>
        </TabsContent>

        {/* --- schemas -------------------------------------------------- */}
        <TabsContent value="request" className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <SchemaTable fields={endpoint.requestSchema} testId="endpoint-request-schema" />
        </TabsContent>

        <TabsContent value="response" className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <SchemaTable fields={endpoint.responseSchema} testId="endpoint-response-schema" />
        </TabsContent>

        {/* --- issues --------------------------------------------------- */}
        <TabsContent value="issues" className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          {endpoint.issues.length === 0 ? (
            <EmptyState
              title="No contract issues"
              description="No detector fired on this endpoint in the observed traffic."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link
                    href={routes.findings({ category: "api-contract" })}
                    data-testid="endpoint-detail-issues-empty-findings"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    All api-contract findings
                  </Link>
                </Button>
              }
              testId="endpoint-detail-issues-empty"
            />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="label-mono">
                  {endpoint.issues.length} detector{endpoint.issues.length === 1 ? "" : "s"} fired
                </h3>
                <Button variant="ghost" size="xs" asChild>
                  <Link
                    href={routes.findings({ category: "api-contract" })}
                    data-testid="endpoint-detail-link-findings"
                  >
                    All api-contract findings
                    <ExternalLink className="size-3" aria-hidden />
                  </Link>
                </Button>
              </div>

              {endpoint.issues.map((issue) => (
                <article
                  key={issue.id}
                  data-testid={`endpoint-detail-issue-${issue.id}`}
                  className="surface-inset flex flex-col gap-2 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="text-code text-accent">{issue.detector}</code>
                    <SeverityBadge severity={issue.severity} size="xs" />
                    <Link
                      href={routes.finding(issue.id)}
                      data-testid={`endpoint-detail-issue-link-${issue.id}`}
                      className="text-code ml-auto rounded text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {issue.id}
                    </Link>
                  </div>
                  <p className="text-xs font-medium leading-snug text-foreground">{issue.summary}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{issue.detail}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onGenerateTest(issue)}
                      data-testid={`endpoint-detail-generate-test-${issue.id}`}
                    >
                      <Bot className="size-3" aria-hidden />
                      Generate contract test
                    </Button>
                    {issue.detector === "api.auth" || issue.detector === "api.authz" ? (
                      <Button variant="ghost" size="xs" asChild>
                        <Link
                          href={routes.security()}
                          data-testid={`endpoint-detail-issue-security-${issue.id}`}
                        >
                          <ShieldAlert className="size-3" aria-hidden />
                          Security scan
                        </Link>
                      </Button>
                    ) : null}
                    {issue.detector === "api.rate_limit_behavior" ||
                    issue.detector === "api.pagination" ? (
                      <span className="flex items-center gap-1 text-[10px] text-subtle-foreground">
                        <Timer className="size-3" aria-hidden />
                        seen across {formatCompact(endpoint.callCount)} calls
                      </span>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const EndpointDetail = memo(EndpointDetailImpl);

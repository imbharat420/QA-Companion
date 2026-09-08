"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { ArrowRight, Check, ShieldAlert, X } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardToolbar,
  Label,
  Skeleton,
  Switch,
} from "@/components/ui";
import { CopyButton, SeverityBadge } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { SecurityHeaderCheck, Severity } from "@/lib/api/types";

/**
 * Response headers can echo session material — a Set-Cookie value, a signed
 * token in a custom header. This panel is the block people screenshot into a
 * ticket, so anything token-shaped is masked before it renders. The expected
 * value is never masked: that is our own policy, not observed traffic.
 */
const SECRET_SHAPED =
  /\beyJ[\w-]{6,}(?:\.[\w-]+){1,2}|\b(?:sk|rk|pk)_[A-Za-z0-9_]{6,}|\b[A-Za-z0-9_-]{32,}\b/g;

export const redactValue = (value: string): string =>
  value.replace(SECRET_SHAPED, (match) => `${match.slice(0, 6)}…redacted`);

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export interface HeaderChecklistProps {
  checks: SecurityHeaderCheck[];
  loading?: boolean;
  /** Header name → the id of the issue tracking it. Pass a stable object. */
  issueByHeader?: Record<string, string>;
  /** Opens that issue's drawer on the page. */
  onOpenIssue?: (issueId: string) => void;
}

/* ==========================================================================
   ROW
   ======================================================================== */

interface HeaderRowProps {
  check: SecurityHeaderCheck;
  issueId?: string;
  onOpenIssue?: (issueId: string) => void;
}

function HeaderRowImpl({ check, issueId, onOpenIssue }: HeaderRowProps) {
  const { header, present, value, expected, severity } = check;
  const observed = present ? redactValue(value ?? "set, value not captured") : "not set";

  const openIssue = useCallback(() => {
    if (issueId) onOpenIssue?.(issueId);
  }, [issueId, onOpenIssue]);

  return (
    <li
      data-testid={`security-header-row-${header}`}
      data-present={present}
      className={cn(
        "flex items-start gap-3 border-b border-border/40 px-3 py-2.5 last:border-b-0",
        // A missing header is the actionable half of this panel, so it carries a
        // coloured rail — the eye finds it without reading a word.
        present ? "border-l-2 border-l-success/50" : "border-l-2 border-l-critical bg-critical/5",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border",
          present
            ? "border-success/30 bg-success/15 text-success"
            : "border-critical/30 bg-critical/15 text-critical",
        )}
      >
        {present ? <Check className="size-3" /> : <X className="size-3" />}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-code font-medium text-foreground">{header}</span>
          <span className="sr-only">{present ? "present" : "absent"}</span>
          <Badge
            variant={present ? "success" : "error"}
            size="xs"
            data-testid={`security-header-state-${header}`}
          >
            {present ? "present" : "missing"}
          </Badge>
          <SeverityBadge severity={severity} size="xs" />
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <span className="label-mono shrink-0 text-[10px]">observed</span>
          <code
            className={cn(
              "text-code min-w-0 truncate",
              present ? "text-foreground/90" : "text-critical",
            )}
            title={observed}
            data-testid={`security-header-value-${header}`}
          >
            {observed}
          </code>
          {present && value ? (
            <CopyButton value={value} testId={`security-header-copy-${header}`} />
          ) : null}
        </div>

        {/* Present rows stay on one line; a missing header expands to show the
            policy it should be sending — the fix, ready to paste. */}
        {present ? null : (
          <div className="flex min-w-0 items-start gap-1.5">
            <span className="label-mono mt-0.5 shrink-0 text-[10px]">expected</span>
            <code
              className="text-code min-w-0 flex-1 whitespace-pre-wrap break-words text-muted-foreground"
              data-testid={`security-header-expected-${header}`}
            >
              {expected}
            </code>
            <CopyButton value={expected} testId={`security-header-copy-expected-${header}`} />
          </div>
        )}
      </div>

      {issueId && onOpenIssue ? (
        <Button
          variant="ghost"
          size="xs"
          onClick={openIssue}
          aria-label={`Open issue ${issueId} for ${header}`}
          data-testid={`security-header-issue-${header}`}
          className="shrink-0 font-mono"
        >
          {issueId}
          <ArrowRight className="size-3" aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}

const HeaderRow = memo(HeaderRowImpl);

/* ==========================================================================
   CHECKLIST
   ======================================================================== */

/**
 * The response-header posture, missing headers first. Deliberately not a
 * `DataTable`: a failing row is two lines (observed + expected) and a passing
 * row is one, which a fixed-height grid row cannot express.
 */
export function HeaderChecklist({
  checks,
  loading = false,
  issueByHeader,
  onOpenIssue,
}: HeaderChecklistProps) {
  const [onlyMissing, setOnlyMissing] = useState(false);

  const ordered = useMemo(
    () =>
      checks
        .slice()
        .sort(
          (a, b) =>
            Number(a.present) - Number(b.present) ||
            SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
            a.header.localeCompare(b.header),
        ),
    [checks],
  );

  const missing = useMemo(() => ordered.filter((check) => !check.present), [ordered]);
  const rows = onlyMissing ? missing : ordered;

  return (
    <Card data-testid="security-headers-card">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-critical" aria-hidden />
            Security headers
          </CardTitle>
          <CardDescription>
            {loading ? (
              "Reading the primary document response…"
            ) : (
              <>
                <strong
                  className={cn(
                    "font-mono tabular-nums",
                    missing.length > 0 ? "text-critical" : "text-success",
                  )}
                  data-testid="security-headers-missing-count"
                >
                  {missing.length}
                </strong>{" "}
                of {ordered.length} missing on the primary document response — the cheapest
                findings on this page to close.
              </>
            )}
          </CardDescription>
        </div>
        <CardToolbar>
          <Label htmlFor="security-headers-only-missing" className="label-mono cursor-pointer">
            Only missing
          </Label>
          <Switch
            id="security-headers-only-missing"
            checked={onlyMissing}
            onCheckedChange={setOnlyMissing}
            data-testid="security-headers-only-missing"
          />
        </CardToolbar>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2" data-testid="security-headers-loading">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-[var(--radius-md)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p
            className="surface-inset px-3 py-4 text-center text-xs text-muted-foreground"
            data-testid="security-headers-empty"
          >
            {checks.length === 0
              ? "No scan has read the response headers yet — every expectation is unchecked."
              : "Every checked header is present. Nothing to fix here."}
          </p>
        ) : (
          <ul
            role="list"
            data-testid="security-headers-list"
            className="overflow-hidden rounded-[var(--radius-md)] border border-border/70 bg-background/40"
          >
            {rows.map((check) => (
              <HeaderRow
                key={check.header}
                check={check}
                issueId={issueByHeader?.[check.header]}
                onOpenIssue={onOpenIssue}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

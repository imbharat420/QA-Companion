/**
 * SINGLE SOURCE OF NAVIGATION TRUTH.
 *
 * The nav rail, the command palette, breadcrumbs and the keyboard-shortcut map
 * are all generated from this file. Adding a page means adding one entry here —
 * never hand-wire a link target in a component.
 */

export type NavGroupId = "workspace" | "testing" | "quality" | "system";

/** Lucide icon export name. Resolved through a static map so tree-shaking works. */
export type LucideIconName =
  | "FolderKanban"
  | "Bot"
  | "ListChecks"
  | "FileCode2"
  | "PlayCircle"
  | "Bug"
  | "Accessibility"
  | "ShieldCheck"
  | "Gauge"
  | "Eye"
  | "Webhook"
  | "Library"
  | "Settings";

/** Which store-derived counter, if any, renders as a badge on the rail item. */
export type NavBadgeKey =
  | "openFindings"
  | "criticalFindings"
  | "runningRuns"
  | "pendingApprovals"
  | "a11yViolations"
  | "securityIssues"
  | "visualDiffs";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIconName;
  group: NavGroupId;
  /** Short description — used by the command palette and rail tooltips. */
  description: string;
  badgeKey?: NavBadgeKey;
  /** Global shortcut, rendered in the palette and bound by useShortcuts(). */
  shortcut?: string;
}

export const NAV_GROUPS: { id: NavGroupId; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "testing", label: "Testing" },
  { id: "quality", label: "Quality" },
  { id: "system", label: "System" },
];

export const NAV_ITEMS: NavItem[] = [
  {
    id: "projects",
    label: "Projects",
    href: "/",
    icon: "FolderKanban",
    group: "workspace",
    description: "Browse, upload and open workspaces",
    shortcut: "g p",
  },
  {
    id: "workbench",
    label: "Workbench",
    href: "/workbench",
    icon: "Bot",
    group: "workspace",
    description: "Live agent workbench — chat, browser, inspector, scrubber",
    badgeKey: "pendingApprovals",
    shortcut: "g w",
  },
  {
    id: "suites",
    label: "Test Suites",
    href: "/suites",
    icon: "ListChecks",
    group: "testing",
    description: "Suite tree and spec catalog",
    shortcut: "g s",
  },
  {
    id: "cases",
    label: "Test Cases",
    href: "/cases",
    icon: "FileCode2",
    group: "testing",
    description: "Individual cases, steps and assertions",
    shortcut: "g c",
  },
  {
    id: "runs",
    label: "Test Runs",
    href: "/runs",
    icon: "PlayCircle",
    group: "testing",
    description: "Run history, pass-rate trend and flake analysis",
    badgeKey: "runningRuns",
    shortcut: "g r",
  },
  {
    id: "findings",
    label: "Findings",
    href: "/findings",
    icon: "Bug",
    group: "quality",
    description: "Bug intelligence inbox and failure cockpit",
    badgeKey: "openFindings",
    shortcut: "g f",
  },
  {
    id: "accessibility",
    label: "Accessibility",
    href: "/accessibility",
    icon: "Accessibility",
    group: "quality",
    description: "WCAG violations, keyboard traversal and contrast audit",
    badgeKey: "a11yViolations",
    shortcut: "g a",
  },
  {
    id: "security",
    label: "Security",
    href: "/security",
    icon: "ShieldCheck",
    group: "quality",
    description: "Headers, secrets, auth and injection surface scan",
    badgeKey: "securityIssues",
  },
  {
    id: "performance",
    label: "Performance",
    href: "/performance",
    icon: "Gauge",
    group: "quality",
    description: "Core Web Vitals, budgets and resource waterfall",
  },
  {
    id: "visual",
    label: "Visual",
    href: "/visual",
    icon: "Eye",
    group: "quality",
    description: "Baseline vs actual diffing and responsive matrix",
    badgeKey: "visualDiffs",
  },
  {
    id: "api-intel",
    label: "API",
    href: "/api-intel",
    icon: "Webhook",
    group: "quality",
    description: "Discovered endpoints, schema drift and contract tests",
  },
  {
    id: "scripts",
    label: "Script Library",
    href: "/scripts",
    icon: "Library",
    group: "system",
    description: "Reusable steps, page objects, fixtures and skills",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: "Settings",
    group: "system",
    description: "Provider, credentials, browser, policy and API source",
    shortcut: "g ,",
  },
];

/** O(1) lookup by id — build once, not per render. */
export const NAV_BY_ID: Record<string, NavItem> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.id, item]),
);

/**
 * DETAIL VIEWS ARE SEARCH PARAMS, NOT DYNAMIC SEGMENTS.
 *
 * The app is a Next static export (`output: 'export'`), where a `[id]` segment
 * only resolves for ids enumerated at build time by generateStaticParams. Ids
 * come from whichever adapter is live — mock, REST or Tauri — so build-time
 * enumeration cannot cover them and an unknown id would 404.
 *
 * So every detail view lives on its list route behind a param (`/runs?run=558`)
 * and renders in place of, or beside, the list. One route per nav item, every id
 * reachable under every adapter, and the back button still works.
 *
 * `DETAIL_PARAMS` maps a nav item to the param that opens its detail view —
 * breadcrumbs and the command palette read it.
 */
export const DETAIL_PARAMS: Record<string, { param: string; label: string }> = {
  projects: { param: "project", label: "Project" },
  runs: { param: "run", label: "Run" },
  findings: { param: "finding", label: "Finding" },
  cases: { param: "case", label: "Case" },
  scripts: { param: "script", label: "Script" },
  visual: { param: "baseline", label: "Baseline" },
  "api-intel": { param: "endpoint", label: "Endpoint" },
  // The three category audits open their detail on `?issue=` as well. They could
  // have used purely local selection, but then a specific violation would not be
  // linkable — and "here is the exact issue I mean" is the whole point of sending
  // someone a URL.
  accessibility: { param: "issue", label: "Violation" },
  security: { param: "issue", label: "Issue" },
  performance: { param: "metric", label: "Metric" },
};

/** Typed deep-link builders. Every cross-page link in the app goes through these. */
export const routes = {
  projects: () => "/",
  project: (projectId: string) => `/?project=${projectId}`,
  workbench: (opts?: { taskId?: string; stepId?: string }) => {
    const q = new URLSearchParams();
    if (opts?.taskId) q.set("task", opts.taskId);
    if (opts?.stepId) q.set("step", opts.stepId);
    const s = q.toString();
    return s ? `/workbench?${s}` : "/workbench";
  },
  suites: (opts?: { projectId?: string }) =>
    opts?.projectId ? `/suites?project=${opts.projectId}` : "/suites",
  cases: (opts?: { suiteId?: string; tag?: string; caseId?: string }) => {
    const q = new URLSearchParams();
    if (opts?.suiteId) q.set("suite", opts.suiteId);
    if (opts?.tag) q.set("tag", opts.tag);
    if (opts?.caseId) q.set("case", opts.caseId);
    const s = q.toString();
    return s ? `/cases?${s}` : "/cases";
  },
  runs: (opts?: { status?: string; suiteId?: string }) => {
    const q = new URLSearchParams();
    if (opts?.status) q.set("status", opts.status);
    if (opts?.suiteId) q.set("suite", opts.suiteId);
    const s = q.toString();
    return s ? `/runs?${s}` : "/runs";
  },
  run: (runId: string) => `/runs?run=${encodeURIComponent(runId)}`,
  findings: (opts?: {
    severity?: string;
    status?: string;
    category?: string;
    runId?: string;
    projectId?: string;
    suiteId?: string;
  }) => {
    const q = new URLSearchParams();
    if (opts?.severity) q.set("severity", opts.severity);
    if (opts?.status) q.set("status", opts.status);
    if (opts?.category) q.set("category", opts.category);
    if (opts?.runId) q.set("run", opts.runId);
    if (opts?.projectId) q.set("project", opts.projectId);
    if (opts?.suiteId) q.set("suite", opts.suiteId);
    const s = q.toString();
    return s ? `/findings?${s}` : "/findings";
  },
  finding: (findingId: string) => `/findings?finding=${encodeURIComponent(findingId)}`,
  accessibility: (opts?: { level?: string; impact?: string; issueId?: string }) => {
    const q = new URLSearchParams();
    if (opts?.level) q.set("level", opts.level);
    if (opts?.impact) q.set("impact", opts.impact);
    if (opts?.issueId) q.set("issue", opts.issueId);
    const s = q.toString();
    return s ? `/accessibility?${s}` : "/accessibility";
  },
  security: (opts?: { category?: string; severity?: string; issueId?: string }) => {
    const q = new URLSearchParams();
    if (opts?.category) q.set("category", opts.category);
    if (opts?.severity) q.set("severity", opts.severity);
    if (opts?.issueId) q.set("issue", opts.issueId);
    const s = q.toString();
    return s ? `/security?${s}` : "/security";
  },
  performance: (opts?: { device?: "desktop" | "mobile"; metricId?: string }) => {
    const q = new URLSearchParams();
    if (opts?.device) q.set("device", opts.device);
    if (opts?.metricId) q.set("metric", opts.metricId);
    const s = q.toString();
    return s ? `/performance?${s}` : "/performance";
  },
  visual: (opts?: { baselineId?: string }) =>
    opts?.baselineId ? `/visual?baseline=${opts.baselineId}` : "/visual",
  apiIntel: (opts?: { endpointId?: string }) =>
    opts?.endpointId ? `/api-intel?endpoint=${opts.endpointId}` : "/api-intel",
  scripts: (opts?: { scriptId?: string }) =>
    opts?.scriptId ? `/scripts?script=${opts.scriptId}` : "/scripts",
  settings: (opts?: { tab?: string }) => (opts?.tab ? `/settings?tab=${opts.tab}` : "/settings"),
} as const;

/** Resolve the active nav item for a pathname (longest prefix wins). */
export function activeNavId(pathname: string): string {
  if (pathname === "/") return "projects";
  let best: NavItem | undefined;
  for (const item of NAV_ITEMS) {
    if (item.href === "/") continue;
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best?.id ?? "projects";
}

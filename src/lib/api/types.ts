/**
 * THE DOMAIN MODEL — single source of truth.
 *
 * Every adapter (mock / http / tauri), every fixture, every store slice and
 * every page imports its types from here. The Rust side in src-tauri/src/models.rs
 * mirrors these shapes field-for-field with serde camelCase renaming.
 *
 * Field names of the pre-existing entities (Workspace, Suite, TestRun, Finding,
 * DomNode) are preserved verbatim from the prototype fixtures so the ported data
 * keeps working. New entities follow the same conventions.
 */

/* ==========================================================================
   PRIMITIVES
   ======================================================================== */

export type Severity = "critical" | "high" | "medium" | "low";

/** Traffic-light tone used by badges, group cards and chart series. */
export type Tone = "cyan" | "amber" | "red" | "green" | "violet" | "neutral";

export type TestStatus = "passed" | "failed" | "flaky" | "skipped" | "running" | "pending";

export type SuiteStatus = "passing" | "failing" | "flaky";

export interface Paged<T> {
  items: T[];
  total: number;
  /** Opaque cursor; absent when there is no further page. */
  nextCursor?: string;
}

export interface ListQuery {
  search?: string;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

/* ==========================================================================
   WORKSPACE / PROJECT
   ======================================================================== */

export interface WorkspaceOwner {
  name: string;
  /** Single-letter initial — avatars are rendered locally, never fetched. */
  avatar: string;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  framework: string;
  branch: string;
  sessions: number;
  tests: number;
  lastActive: string;
  /** 0–100 composite health score. */
  health: number;
  description: string;
  devCommand: string;
  testCommand: string;
  gitUrl?: string;
  category: string;
  thumbnail: string;
  starred?: boolean;
  owner: WorkspaceOwner;
  /** Sidebar grouping: "Local Workspaces" | "GitHub Repositories" | "Uploads" | … */
  folder?: string;
}

/** Lifecycle of a workspace card — drives the Projects page state variants. */
export type WorkspaceState = "ready" | "indexing" | "uploading" | "error" | "offline";

export interface WorkspaceFolder {
  id: string;
  name: string;
  count: number;
  /** Token name for the folder dot, e.g. "chart-1". */
  colorToken: string;
}

/* ==========================================================================
   SUITES / CASES
   ======================================================================== */

export interface Suite {
  id: string;
  name: string;
  file: string;
  cases: number;
  passRate: number;
  lastRun: string;
  status: SuiteStatus;
  /** Present on newer fixtures; older ones omit it. */
  projectId?: string;
  tags?: string[];
}

export interface TestStep {
  id: string;
  index: number;
  action: "navigate" | "click" | "type" | "select" | "hover" | "assert" | "wait" | "screenshot";
  target: string;
  value?: string;
  /** Human-readable line as it appears in the spec editor. */
  code: string;
}

export interface Assertion {
  id: string;
  kind: "visible" | "text" | "url" | "count" | "attribute" | "response" | "a11y" | "visual";
  target: string;
  expected: string;
  soft: boolean;
}

export interface TestCase {
  id: string;
  title: string;
  suiteId: string;
  file: string;
  /** Playwright-style locator this case is anchored on. */
  primaryLocator: string;
  status: TestStatus;
  durationMs: number;
  lastRun: string;
  owner: string;
  tags: string[];
  flakeRate: number;
  steps: TestStep[];
  assertions: Assertion[];
  /** Set when the case was produced by the agent rather than a human. */
  generatedBy?: "agent" | "recording" | "human";
}

/* ==========================================================================
   RUNS
   ======================================================================== */

export interface RunGroup {
  title: string;
  count: number;
  desc: string;
  tone: Tone;
}

export interface RunSpec {
  file: string;
  tests: { name: string; status: TestStatus }[];
}

export interface TestRun {
  id: string;
  name: string;
  branch: string;
  when: string;
  duration: string;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  groups: RunGroup[];
  specs: RunSpec[];
  /** Added for the runs list + detail page. Optional so old fixtures load. */
  projectId?: string;
  trigger?: "manual" | "ci" | "schedule" | "agent";
  engine?: string;
  commitMessage?: string;
  author?: string;
  status?: TestStatus;
  startedAt?: string;
  /** Wall-clock ms; `duration` is the display string. */
  durationMs?: number;
}

export interface TrendPoint {
  run: string;
  pass: number;
  fail: number;
}

export interface FlakyTest {
  id: string;
  title: string;
  file: string;
  flakeRate: number;
  runsAffected: number;
  lastFailure: string;
  suspectedCause: string;
}

/* ==========================================================================
   FINDINGS
   ======================================================================== */

export type FindingStatus = "new" | "confirmed" | "fixed" | "false-positive" | "wont-fix";

export interface Finding {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  /** 0–100 agent confidence. */
  confidence: number;
  status: FindingStatus;
  url: string;
  element: string;
  expected: string;
  actual: string;
  /** Root-cause analysis prose. */
  rca: string;
  /** Proposed patch as a unified diff. */
  fix: string;
  commit: string;
  relatedTests: number;
  /** Cross-links, added for the detail page. */
  runId?: string;
  suiteId?: string;
  caseId?: string;
  projectId?: string;
  detectedAt?: string;
  /** Split diagnosis: what was observed vs what the agent inferred. */
  facts?: string[];
  inferences?: string[];
  evidence?: Evidence[];
}

export interface Evidence {
  id: string;
  kind: "screenshot" | "dom" | "console" | "network" | "trace" | "video" | "har";
  label: string;
  /** Asset path or data URI; mock fixtures use a token-drawn placeholder. */
  src?: string;
  capturedAt?: string;
}

/* ==========================================================================
   ACCESSIBILITY
   ======================================================================== */

export type WcagLevel = "A" | "AA" | "AAA";

export interface A11yIssue {
  id: string;
  /** axe-core rule id, e.g. "color-contrast". */
  ruleId: string;
  title: string;
  description: string;
  impact: Severity;
  wcagLevel: WcagLevel;
  /** WCAG success criteria, e.g. ["1.4.3", "2.4.7"]. */
  criteria: string[];
  url: string;
  selector: string;
  html: string;
  /** axe remediation hint — feeds the patch loop. */
  remediation: string;
  nodeCount: number;
  status: FindingStatus;
  /** "contrast" | "aria" | "keyboard" | "structure" | "forms" | "media" */
  category: string;
}

export interface A11ySummary {
  score: number;
  violations: number;
  passes: number;
  incomplete: number;
  byLevel: Record<WcagLevel, number>;
  byImpact: Record<Severity, number>;
  trend: { run: string; score: number }[];
}

/* ==========================================================================
   SECURITY
   ======================================================================== */

export interface SecurityIssue {
  id: string;
  title: string;
  /** "headers" | "secrets" | "auth" | "authz" | "injection" | "transport" | "deps" */
  category: string;
  severity: Severity;
  /** CVSS 3.1 base score when applicable. */
  cvss?: number;
  cwe?: string;
  url: string;
  evidence: string;
  remediation: string;
  status: FindingStatus;
  detectedAt: string;
}

export interface SecurityHeaderCheck {
  header: string;
  present: boolean;
  value?: string;
  expected: string;
  severity: Severity;
}

export interface SecuritySummary {
  score: number;
  byCategory: { category: string; count: number }[];
  bySeverity: Record<Severity, number>;
  headers: SecurityHeaderCheck[];
  scannedUrls: number;
  lastScan: string;
}

/* ==========================================================================
   PERFORMANCE
   ======================================================================== */

/** Core Web Vitals + lab metrics. */
export type PerfMetricId = "lcp" | "cls" | "inp" | "fcp" | "ttfb" | "tbt" | "si" | "tti";

export interface PerfMetric {
  id: PerfMetricId;
  label: string;
  value: number;
  unit: "ms" | "s" | "score" | "kb";
  /** Budget threshold; over budget renders as a failure. */
  budget: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
  history: { run: string; value: number }[];
}

export interface ResourceEntry {
  id: string;
  url: string;
  type: "document" | "script" | "stylesheet" | "image" | "font" | "xhr" | "media" | "other";
  sizeBytes: number;
  transferBytes: number;
  durationMs: number;
  startMs: number;
  blocking: boolean;
  cached: boolean;
}

export interface PerfSummary {
  score: number;
  url: string;
  device: "desktop" | "mobile";
  metrics: PerfMetric[];
  resources: ResourceEntry[];
  opportunities: { title: string; savingsMs: number; detail: string }[];
  lastRun: string;
}

/* ==========================================================================
   VISUAL REGRESSION
   ======================================================================== */

export interface VisualBaseline {
  id: string;
  name: string;
  /** Page URL or component locator. */
  target: string;
  viewport: { label: string; width: number; height: number };
  branch: string;
  status: "approved" | "pending" | "changed" | "new";
  /** 0–100 percentage of pixels differing. */
  diffPercent: number;
  pixelsChanged: number;
  /** "moved" separates layout shifts from actual repaints. */
  changeKind: "none" | "moved" | "changed" | "added" | "removed";
  baselineSrc: string;
  actualSrc: string;
  diffSrc: string;
  maskSelectors: string[];
  threshold: number;
  updatedAt: string;
  runId?: string;
}

export interface VisualSummary {
  total: number;
  changed: number;
  pending: number;
  approved: number;
  byViewport: { viewport: string; changed: number; total: number }[];
}

/* ==========================================================================
   API INTELLIGENCE
   ======================================================================== */

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface ApiSchemaField {
  name: string;
  type: string;
  required: boolean;
  /** Set when the observed traffic disagrees with the documented schema. */
  drift?: "missing" | "extra" | "type-changed" | "nullability";
  documentedType?: string;
}

export interface ApiEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  /** Where we learned about it. */
  discoveredVia: "traffic" | "openapi" | "manual";
  authRequired: boolean;
  observedStatuses: number[];
  callCount: number;
  p50Ms: number;
  p95Ms: number;
  errorRate: number;
  requestSchema: ApiSchemaField[];
  responseSchema: ApiSchemaField[];
  /** Contract findings attached to this endpoint. */
  issues: ApiIssue[];
  lastSeen: string;
  tags: string[];
}

export interface ApiIssue {
  id: string;
  /** api.schema | api.contract_drift | api.status_codes | api.error_handling | api.validation | api.auth | api.authz | api.pagination | api.idempotency | api.rate_limit_behavior */
  detector: string;
  severity: Severity;
  summary: string;
  detail: string;
}

export interface ApiSummary {
  endpoints: number;
  documented: number;
  undocumented: number;
  driftCount: number;
  bySeverity: Record<Severity, number>;
  specSource?: string;
}

/* ==========================================================================
   SCRIPT LIBRARY
   ======================================================================== */

export type ScriptKind = "test" | "step" | "page-object" | "fixture" | "api" | "skill";

export interface ScriptParam {
  name: string;
  type: "string" | "number" | "boolean" | "secret";
  required: boolean;
  default?: string;
  description?: string;
}

export interface ScriptVersion {
  version: number;
  createdAt: string;
  author: string;
  note: string;
  diff: string;
}

export interface ScriptEntry {
  id: string;
  name: string;
  kind: ScriptKind;
  language: "typescript" | "javascript" | "python";
  description: string;
  params: ScriptParam[];
  tags: string[];
  version: number;
  usageCount: number;
  code: string;
  /** Provenance: the session, finding or recording this came from. */
  sourceRef?: string;
  sourceKind?: "generated" | "recording" | "extracted" | "upload";
  versions: ScriptVersion[];
  updatedAt: string;
}

/* ==========================================================================
   BROWSER / INSPECTOR
   ======================================================================== */

export type PageId = "blank" | "loading" | "home" | "login" | "checkout" | "confirm";

export interface DomNode {
  tag: string;
  attrs?: string;
  id?: string;
  children?: DomNode[];
}

export interface A11yNode {
  role: string;
  name: string;
}

export interface NetworkEntry {
  id: number;
  method: string;
  url: string;
  status: number;
  ms: number;
  /** Optional extras for the waterfall view. */
  type?: ResourceEntry["type"];
  sizeBytes?: number;
  startMs?: number;
}

export interface ConsoleEntry {
  id: number;
  level: "log" | "warn" | "error" | "info" | "debug";
  text: string;
  ts: string;
  source?: string;
}

/** Candidate locator ranked by how likely it is to survive a refactor. */
export interface SelectorCandidate {
  selector: string;
  strategy: "testid" | "role" | "label" | "text" | "css" | "xpath";
  /** 0–100. */
  stability: number;
  unique: boolean;
}

export interface BrowserTab {
  id: string;
  title: string;
  url?: string;
}

export interface BrowserState {
  url: string;
  title: string;
  page: PageId;
  /** Action banner text, e.g. 'Clicking "Checkout"'. */
  overlay: string | null;
  cursor: { x: number; y: number } | null;
  highlight: string | null;
  ripple: { x: number; y: number; key: number } | null;
  typing: { field: string; text: string } | null;
  inputs: Record<string, string>;
  tabs: BrowserTab[];
  activeTab: string;
  viewport: "desktop" | "tablet" | "mobile";
  takeover: boolean;
  loading: boolean;
}

/* ==========================================================================
   AGENT
   ======================================================================== */

export type AgentStatus =
  | "idle"
  | "thinking"
  | "planning"
  | "executing"
  | "waiting"
  | "completed"
  | "stopped"
  | "error";

export interface ChatMessage {
  id: number;
  from: "user" | "agent" | "system";
  text: string;
  ts: string;
  /** Attached structured card, if any. */
  card?: PlanCard | ToolActivity | ApprovalRequest | StuckPrompt;
  cardKind?: "plan" | "tool" | "approval" | "stuck";
}

export interface PlanStage {
  id: string;
  label: string;
  state: "pending" | "active" | "done" | "failed" | "skipped";
  detail?: string;
}

export interface PlanCard {
  id: string;
  goal: string;
  stages: PlanStage[];
  budgetTokens: number;
}

export interface ToolActivity {
  id: string;
  tool: string;
  /** Already redacted for display — never holds a raw secret. */
  argsSummary: string;
  resultSummary: string;
  durationMs: number;
  ok: boolean;
}

export interface ApprovalRequest {
  id: string;
  title: string;
  desc: string;
  action: string;
  risk: "high" | "medium" | "low";
  target?: string;
  payloadPreview?: string;
  payloadHash?: string;
  reason?: string;
  /** How long an "always allow" decision lasts. */
  rememberScope?: "step" | "session" | "project";
}

export interface StuckPrompt {
  id: string;
  reason: string;
  choices: ("retry" | "skip" | "take-control" | "provide-selector" | "stop")[];
}

export type TimelineKind =
  | "plan"
  | "navigate"
  | "click"
  | "type"
  | "inspect"
  | "assert"
  | "approval"
  | "network"
  | "screenshot"
  | "finding"
  | "scan"
  | "code";

export interface TimelineStep {
  id: number;
  ts: string;
  kind: TimelineKind;
  label: string;
  detail: string;
  status: "ok" | "fail" | "warn" | "info";
  /** Evidence attached to this instant — powers scrubbing. */
  screenshotSrc?: string;
  findingId?: string;
  durationMs?: number;
}

/** Discriminated union streamed from the backend (or simulated by the mock). */
export type AgentEvent =
  | { type: "status"; status: AgentStatus; ts: string }
  | { type: "message"; message: ChatMessage }
  | { type: "plan"; plan: PlanCard }
  | { type: "step"; step: TimelineStep }
  | { type: "browser"; patch: Partial<BrowserState> }
  | { type: "network"; entry: NetworkEntry }
  | { type: "console"; entry: ConsoleEntry }
  | { type: "dom"; page: PageId; tree: DomNode }
  | { type: "approval"; request: ApprovalRequest | null }
  | { type: "stuck"; prompt: StuckPrompt | null }
  | { type: "tokens"; total: number }
  | { type: "finding"; finding: Finding }
  | { type: "done"; status: "completed" | "stopped" | "error"; summary: string };

export interface AgentTaskInput {
  prompt: string;
  projectId?: string;
  /** Quick-action slug when launched from a chip. */
  mode?: string;
  budgetTokens?: number;
}

export interface AgentTaskHandle {
  taskId: string;
  startedAt: string;
}

/* ==========================================================================
   DASHBOARD ROLLUP — the counts the nav badges and Projects page read.
   ======================================================================== */

export interface DashboardSummary {
  openFindings: number;
  criticalFindings: number;
  runningRuns: number;
  pendingApprovals: number;
  a11yViolations: number;
  securityIssues: number;
  visualDiffs: number;
  /**
   * Whole percent, 0-100 — the same convention as `Suite.passRate`,
   * `Finding.confidence` and `Workspace.health`. Note that `formatPercent()`
   * takes a 0-1 RATIO, so this needs `/ 100` at the call site.
   * (`errorRate` and `flakeRate` are the ratio-valued fields.)
   */
  passRate: number;
  totalTests: number;
  avgDurationMs: number;
}

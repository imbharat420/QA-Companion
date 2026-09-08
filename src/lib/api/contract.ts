import type {
  A11yIssue,
  A11ySummary,
  AgentEvent,
  AgentTaskHandle,
  AgentTaskInput,
  ApiEndpoint,
  ApiSummary,
  DashboardSummary,
  DomNode,
  Finding,
  FlakyTest,
  ListQuery,
  PageId,
  Paged,
  PerfSummary,
  ScriptEntry,
  SecurityIssue,
  SecuritySummary,
  Suite,
  TestCase,
  TestRun,
  TrendPoint,
  VisualBaseline,
  VisualSummary,
  Workspace,
  WorkspaceFolder,
} from "./types";

/**
 * THE DATA CONTRACT.
 *
 * Every adapter implements this exact surface. Pages never import an adapter
 * directly — they go through the hooks in `@/lib/queries`, which resolve the
 * active adapter from the registry. That indirection is what makes the API
 * source swappable from the Settings screen with one click.
 *
 * Rules for implementers:
 *  - Every method returns a Promise and never throws a non-`ApiError`.
 *  - List methods accept a filter object and return `Paged<T>` so the http
 *    adapter can paginate without the pages changing shape.
 *  - Nothing here holds React state; adapters are plain objects.
 */

export interface FindingFilter extends ListQuery {
  severity?: string;
  status?: string;
  category?: string;
  runId?: string;
  projectId?: string;
  suiteId?: string;
}

export interface CaseFilter extends ListQuery {
  suiteId?: string;
  tag?: string;
  status?: string;
}

export interface RunFilter extends ListQuery {
  status?: string;
  suiteId?: string;
  projectId?: string;
  branch?: string;
}

export interface A11yFilter extends ListQuery {
  level?: string;
  impact?: string;
  category?: string;
}

export interface VisualFilter extends ListQuery {
  status?: string;
  viewport?: string;
}

export interface ApiFilter extends ListQuery {
  method?: string;
  hasIssues?: boolean;
}

export interface ScriptFilter extends ListQuery {
  kind?: string;
  tag?: string;
}

/** Unsubscribe handle returned by the event stream. */
export type Unsubscribe = () => void;

export interface DataSource {
  /** Adapter identity — surfaced in the status bar so the source is never a mystery. */
  readonly id: "mock" | "http" | "tauri";
  readonly label: string;

  /** Cheap round-trip used by the Settings screen's "Test connection" button. */
  health(): Promise<{ ok: boolean; latencyMs: number; detail: string }>;

  /* --- workspaces ---------------------------------------------------- */
  listProjects(query?: ListQuery): Promise<Paged<Workspace>>;
  getProject(id: string): Promise<Workspace | null>;
  listProjectFolders(): Promise<WorkspaceFolder[]>;
  createProject(input: Pick<Workspace, "name" | "path" | "framework"> & Partial<Workspace>): Promise<Workspace>;
  toggleProjectStar(id: string): Promise<Workspace>;

  /* --- suites & cases ------------------------------------------------ */
  listSuites(query?: ListQuery & { projectId?: string }): Promise<Paged<Suite>>;
  listCases(query?: CaseFilter): Promise<Paged<TestCase>>;
  getCase(id: string): Promise<TestCase | null>;

  /* --- runs ----------------------------------------------------------- */
  listRuns(query?: RunFilter): Promise<Paged<TestRun>>;
  getRun(id: string): Promise<TestRun | null>;
  getRunTrend(): Promise<TrendPoint[]>;
  listFlakyTests(): Promise<FlakyTest[]>;
  startRun(input: { suiteId?: string; caseIds?: string[]; projectId?: string }): Promise<TestRun>;

  /* --- findings ------------------------------------------------------- */
  listFindings(query?: FindingFilter): Promise<Paged<Finding>>;
  getFinding(id: string): Promise<Finding | null>;
  updateFindingStatus(id: string, status: Finding["status"]): Promise<Finding>;
  applyFindingFix(id: string): Promise<{ ok: boolean; commit: string; detail: string }>;

  /* --- quality categories -------------------------------------------- */
  listA11yIssues(query?: A11yFilter): Promise<Paged<A11yIssue>>;
  getA11ySummary(): Promise<A11ySummary>;

  listSecurityIssues(query?: ListQuery & { category?: string; severity?: string }): Promise<Paged<SecurityIssue>>;
  getSecuritySummary(): Promise<SecuritySummary>;

  getPerfSummary(query?: { device?: "desktop" | "mobile"; url?: string }): Promise<PerfSummary>;

  listVisualBaselines(query?: VisualFilter): Promise<Paged<VisualBaseline>>;
  getVisualSummary(): Promise<VisualSummary>;
  approveBaseline(id: string): Promise<VisualBaseline>;

  listApiEndpoints(query?: ApiFilter): Promise<Paged<ApiEndpoint>>;
  getApiSummary(): Promise<ApiSummary>;

  /* --- script library ------------------------------------------------- */
  listScripts(query?: ScriptFilter): Promise<Paged<ScriptEntry>>;
  getScript(id: string): Promise<ScriptEntry | null>;
  saveScript(script: ScriptEntry): Promise<ScriptEntry>;

  /* --- rollup --------------------------------------------------------- */
  getDashboardSummary(): Promise<DashboardSummary>;

  /* --- inspector data ------------------------------------------------- */
  getDomTree(page: PageId): Promise<DomNode>;
  getSelectorCandidates(page: PageId, target: string): Promise<import("./types").SelectorCandidate[]>;

  /* --- agent ---------------------------------------------------------- */
  startAgentTask(input: AgentTaskInput): Promise<AgentTaskHandle>;
  stopAgentTask(taskId: string): Promise<void>;
  resolveApproval(taskId: string, approvalId: string, decision: "approve" | "reject"): Promise<void>;
  /**
   * Streams lifecycle events for a task. The mock adapter replays a scripted
   * timeline, http uses SSE, tauri listens on the `agent://event` channel.
   */
  subscribeAgentEvents(taskId: string, onEvent: (event: AgentEvent) => void): Unsubscribe;
}

/** Uniform error every adapter throws, so pages render one error state. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly source: DataSource["id"],
    readonly detail?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Shared helper so the three adapters filter and paginate identically. */
export function paginate<T>(items: T[], query?: ListQuery): Paged<T> {
  const limit = query?.limit ?? items.length;
  const start = query?.cursor ? Number.parseInt(query.cursor, 10) || 0 : 0;
  const slice = items.slice(start, start + limit);
  const end = start + slice.length;
  return {
    items: slice,
    total: items.length,
    nextCursor: end < items.length ? String(end) : undefined,
  };
}

/** Case-insensitive multi-field search used by mock + as an http fallback. */
export function searchFilter<T>(items: T[], search: string | undefined, fields: (keyof T)[]): T[] {
  if (!search?.trim()) return items;
  const needle = search.trim().toLowerCase();
  return items.filter((item) =>
    fields.some((field) => String(item[field] ?? "").toLowerCase().includes(needle)),
  );
}

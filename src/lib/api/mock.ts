import {
  A11Y_ISSUES,
  A11Y_SUMMARY,
  AGENT_SCRIPT,
  AGENT_SCRIPT_STEP_DELAY_MS,
  API_ENDPOINTS,
  API_SUMMARY,
  CASES,
  DOM_TREES,
  FINDINGS,
  FLAKY_TESTS,
  PERF_SUMMARY,
  PERF_SUMMARY_MOBILE,
  RUNS,
  SCRIPTS,
  SECURITY_ISSUES,
  SECURITY_SUMMARY,
  SELECTOR_CANDIDATES,
  SUITES,
  TREND,
  VISUAL_BASELINES,
  WORKSPACE_FOLDERS,
  WORKSPACES,
} from "@/lib/fixtures";
import { ApiError, paginate, searchFilter } from "./contract";
import type {
  A11yFilter,
  ApiFilter,
  CaseFilter,
  DataSource,
  FindingFilter,
  RunFilter,
  ScriptFilter,
  Unsubscribe,
  VisualFilter,
} from "./contract";
import type {
  AgentEvent,
  Finding,
  ListQuery,
  Paged,
  ScriptEntry,
  SelectorCandidate,
  TestRun,
  VisualBaseline,
  VisualSummary,
  Workspace,
} from "./types";

/**
 * THE FIXTURE ADAPTER — the default source, and the one every screenshot shows.
 *
 * Two properties matter more than anything else here:
 *
 *  1. **Reproducibility.** Nothing is random. Latency is a function of result
 *     size, ids are counters, and the "commit sha" returned by a fix is a hash
 *     of the finding id. Reload the app and you get the identical session.
 *  2. **Session persistence.** The fixture arrays are cloned once at load into
 *     the module-level bindings below, and every mutator rebuilds its clone.
 *     A triage keypress, a starred project or an approved baseline therefore
 *     survives until reload — which is what gives the optimistic updates in
 *     `queries.ts` something real to settle against.
 */

/* ==========================================================================
   SESSION STATE — clones, so a mutation never scribbles on the fixture module
   ======================================================================== */

let findings = [...FINDINGS];
let workspaces = [...WORKSPACES];
let runs = [...RUNS];
let baselines = [...VISUAL_BASELINES];
let scripts = [...SCRIPTS];

// The remaining collections have no mutator in the contract, so they are read
// straight from the fixture module rather than pointlessly copied.

/* ==========================================================================
   HELPERS
   ======================================================================== */

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Artificial latency, derived from result size and capped: big lists feel
 * heavier than a single record, loading skeletons actually get to render, and
 * the number is identical on every run.
 */
const latencyFor = (count: number) => Math.min(220, 60 + count);

/** "all" and "" are what a select renders when nothing is chosen. */
function isSet(value: string | undefined): value is string {
  return typeof value === "string" && value !== "" && value !== "all";
}

function byField<T>(items: T[], value: string | undefined, pick: (item: T) => string | undefined): T[] {
  return isSet(value) ? items.filter((item) => pick(item) === value) : items;
}

function byTag<T extends { tags?: string[] }>(items: T[], tag: string | undefined): T[] {
  return isSet(tag) ? items.filter((item) => item.tags?.includes(tag)) : items;
}

/**
 * Ordinal ranks for the enum-ish columns. Sorting them as text puts "low"
 * above "high" and "false-positive" above "confirmed", which reads as a bug.
 */
const RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  failed: 0,
  flaky: 1,
  running: 2,
  pending: 3,
  passed: 4,
  skipped: 5,
  new: 0,
  confirmed: 1,
  changed: 1,
  fixed: 2,
  approved: 3,
  "false-positive": 3,
  "wont-fix": 4,
};

const read = (item: unknown, field: string): unknown => (item as Record<string, unknown>)[field];

/** Generic sort over any top-level field, honouring sortBy/sortDir. */
function sorted<T>(items: T[], query?: ListQuery): T[] {
  const field = query?.sortBy;
  if (!isSet(field)) return items;
  const dir = query?.sortDir === "desc" ? -1 : 1;

  return [...items].sort((a, b) => {
    const left = read(a, field);
    const right = read(b, field);
    if (typeof left === "number" && typeof right === "number") return (left - right) * dir;
    if (typeof left === "boolean" && typeof right === "boolean") {
      return (Number(left) - Number(right)) * dir;
    }
    const l = String(left ?? "");
    const r = String(right ?? "");
    if (l in RANK && r in RANK) return (RANK[l] - RANK[r]) * dir;
    // `numeric` keeps run ids ordered #557 → #558 → #1002 rather than lexically.
    return l.localeCompare(r, undefined, { numeric: true }) * dir;
  });
}

/** Sort → paginate → wait. Every list method ends here. */
async function respond<T>(items: T[], query?: ListQuery): Promise<Paged<T>> {
  await delay(latencyFor(items.length));
  return paginate(sorted(items, query), query);
}

/** Detail getters resolve to null for an unknown id — the contract forbids throwing. */
async function respondOne<T extends { id: string }>(items: T[], id: string): Promise<T | null> {
  await delay(latencyFor(1));
  return items.find((item) => item.id === id) ?? null;
}

/** A mutator, unlike a getter, has nothing sensible to return for a bad id. */
function missing(kind: string, id: string): ApiError {
  return new ApiError(`${kind} ${id} not found`, 404, "mock", "No such record in the fixture set.");
}

const OPEN_STATUSES: Finding["status"][] = ["new", "confirmed"];
const isOpen = (record: { status: Finding["status"] }) => OPEN_STATUSES.includes(record.status);

/**
 * FNV-1a over the seed. `applyFindingFix` has to hand back a commit sha, and a
 * fixture may not invent one from `Math.random` — the same finding must always
 * report the same commit.
 */
function fakeSha(seed: string): string {
  let hash = 0x811c_9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 0x0100_0193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 7);
}

/**
 * Branch values carry their commit ("main · 91ac2f"), so a filter built from a
 * branch *name* has to match the head of the string as well as the whole of it.
 */
function matchesBranch(branch: string, value: string): boolean {
  return branch === value || branch.split(" · ")[0] === value;
}

/** Viewport keys are shared by the filter and the summary so the two agree. */
const viewportKey = (viewport: VisualBaseline["viewport"]) =>
  `${viewport.label} ${viewport.width}×${viewport.height}`;

/* ==========================================================================
   AGENT REPLAY

   `AGENT_SCRIPT` is walked one event per tick by a setTimeout chain. State is
   per task rather than module-global so a second Workbench mount cannot inherit
   the cursor of an abandoned run, and listeners are a Set so several panes can
   attach to the same task.
   ======================================================================== */

interface ReplayState {
  /** Index of the next event to emit. */
  cursor: number;
  timer: ReturnType<typeof setTimeout> | null;
  listeners: Set<(event: AgentEvent) => void>;
  /** Non-null while the chain is parked on an approval gate. */
  gate: string | null;
  done: boolean;
}

const tasks = new Map<string, ReplayState>();
let taskCounter = 0;

function halt(state: ReplayState): void {
  if (state.timer !== null) clearTimeout(state.timer);
  state.timer = null;
}

function emit(state: ReplayState, event: AgentEvent): void {
  // Snapshot: the store's handler is allowed to unsubscribe from inside itself.
  for (const listener of [...state.listeners]) listener(event);
}

function finish(state: ReplayState, status: "completed" | "stopped" | "error", summary: string): void {
  halt(state);
  state.done = true;
  state.gate = null;
  emit(state, { type: "done", status, summary });
}

function schedule(taskId: string): void {
  const state = tasks.get(taskId);
  if (!state || state.timer !== null || state.done || state.gate) return;

  state.timer = setTimeout(() => {
    const live = tasks.get(taskId);
    if (!live) return;
    live.timer = null;

    const event = AGENT_SCRIPT[live.cursor];
    if (!event) {
      live.done = true;
      return;
    }
    live.cursor += 1;

    // A `waiting` status with no open gate describes a moment that has already
    // passed — replaying it would flick the status pill back to "waiting" for a
    // tick after the user approved. Skip it and keep walking.
    if (event.type === "status" && event.status === "waiting" && !live.gate) {
      schedule(taskId);
      return;
    }

    emit(live, event);

    if (event.type === "approval" && event.request) {
      // The gate. Nothing further replays until resolveApproval() lands.
      live.gate = event.request.id;
      return;
    }
    if (event.type === "done") {
      live.done = true;
      return;
    }
    schedule(taskId);
  }, AGENT_SCRIPT_STEP_DELAY_MS);
}

/* ==========================================================================
   THE ADAPTER
   ======================================================================== */

export const mockDataSource: DataSource = {
  id: "mock",
  label: "Mock fixtures",

  async health() {
    return { ok: true, latencyMs: 0, detail: "In-process fixtures" };
  },

  /* --- workspaces ---------------------------------------------------- */

  listProjects(query) {
    const matched = searchFilter(workspaces, query?.search, [
      "name",
      "path",
      "framework",
      "description",
      "category",
      "branch",
    ]);
    return respond(matched, query);
  },

  getProject(id) {
    return respondOne(workspaces, id);
  },

  async listProjectFolders() {
    await delay(latencyFor(WORKSPACE_FOLDERS.length));
    // Counts are recomputed rather than read from the fixture, so a project
    // created this session shows up in its folder's tally immediately.
    return WORKSPACE_FOLDERS.map((folder) => ({
      ...folder,
      count: workspaces.filter((project) => project.folder === folder.name).length,
    }));
  },

  async createProject(input) {
    await delay(latencyFor(1));
    const project: Workspace = {
      branch: "main",
      sessions: 0,
      tests: 0,
      lastActive: "just now",
      health: 100,
      description: "",
      devCommand: "npm run dev",
      testCommand: "npx playwright test",
      category: "Web Application",
      thumbnail: "gradient:chart-2",
      starred: false,
      owner: { name: "Bharat (You)", avatar: "B" },
      folder: "Local Workspaces",
      ...input,
      id: `ws-${String(workspaces.length + 1).padStart(3, "0")}`,
    };
    workspaces = [project, ...workspaces];
    return project;
  },

  async toggleProjectStar(id) {
    await delay(latencyFor(1));
    const current = workspaces.find((project) => project.id === id);
    if (!current) throw missing("Project", id);
    const updated: Workspace = { ...current, starred: !current.starred };
    workspaces = workspaces.map((project) => (project.id === id ? updated : project));
    return updated;
  },

  /* --- suites & cases ------------------------------------------------ */

  listSuites(query) {
    let matched = byField(SUITES, query?.projectId, (suite) => suite.projectId);
    matched = searchFilter(matched, query?.search, ["name", "file", "id"]);
    return respond(matched, query);
  },

  listCases(query?: CaseFilter) {
    let matched = byField(CASES, query?.suiteId, (test) => test.suiteId);
    matched = byField(matched, query?.status, (test) => test.status);
    matched = byTag(matched, query?.tag);
    matched = searchFilter(matched, query?.search, ["title", "file", "primaryLocator", "owner", "id"]);
    return respond(matched, query);
  },

  getCase(id) {
    return respondOne(CASES, id);
  },

  /* --- runs ----------------------------------------------------------- */

  listRuns(query?: RunFilter) {
    let matched = byField(runs, query?.status, (run) => run.status);
    matched = byField(matched, query?.projectId, (run) => run.projectId);

    if (isSet(query?.branch)) {
      const branch = query.branch;
      matched = matched.filter((run) => matchesBranch(run.branch, branch));
    }
    // A TestRun has no suiteId — it has spec files. Resolve the suite's file and
    // keep the runs that executed it, which is what the filter means to express.
    if (isSet(query?.suiteId)) {
      const file = SUITES.find((suite) => suite.id === query.suiteId)?.file;
      matched = file ? matched.filter((run) => run.specs.some((spec) => spec.file === file)) : [];
    }

    matched = searchFilter(matched, query?.search, [
      "id",
      "name",
      "branch",
      "commitMessage",
      "author",
      "engine",
    ]);
    return respond(matched, query);
  },

  getRun(id) {
    return respondOne(runs, id);
  },

  async getRunTrend() {
    await delay(latencyFor(TREND.length));
    return TREND;
  },

  async listFlakyTests() {
    await delay(latencyFor(FLAKY_TESTS.length));
    return FLAKY_TESTS;
  },

  async startRun(input) {
    await delay(latencyFor(1));
    const suite = input.suiteId ? SUITES.find((entry) => entry.id === input.suiteId) : undefined;
    const projectId = input.projectId ?? suite?.projectId ?? workspaces[0]?.id;
    const project = workspaces.find((entry) => entry.id === projectId);

    // Run ids are "#nnn"; continue the sequence instead of inventing a format.
    const highest = runs.reduce((max, run) => Math.max(max, Number.parseInt(run.id.slice(1), 10) || 0), 0);

    const run: TestRun = {
      id: `#${highest + 1}`,
      name: suite ? `${suite.name} — manual run` : "Full regression — manual run",
      branch: project?.branch ?? "main",
      when: "just now",
      duration: "0s",
      passed: 0,
      failed: 0,
      flaky: 0,
      skipped: 0,
      groups: [],
      specs: suite
        ? [{ file: suite.file, tests: [] }]
        : SUITES.filter((entry) => entry.projectId === projectId).map((entry) => ({
            file: entry.file,
            tests: [],
          })),
      projectId,
      trigger: "manual",
      engine: "Chromium 128",
      status: "running",
      startedAt: new Date().toISOString(),
      durationMs: 0,
    };

    runs = [run, ...runs];
    return run;
  },

  /* --- findings ------------------------------------------------------- */

  listFindings(query?: FindingFilter) {
    let matched = byField(findings, query?.severity, (finding) => finding.severity);
    matched = byField(matched, query?.status, (finding) => finding.status);
    matched = byField(matched, query?.category, (finding) => finding.category);
    matched = byField(matched, query?.runId, (finding) => finding.runId);
    matched = byField(matched, query?.projectId, (finding) => finding.projectId);
    matched = byField(matched, query?.suiteId, (finding) => finding.suiteId);
    matched = searchFilter(matched, query?.search, [
      "id",
      "title",
      "category",
      "url",
      "element",
      "rca",
      "commit",
    ]);
    return respond(matched, query);
  },

  getFinding(id) {
    return respondOne(findings, id);
  },

  async updateFindingStatus(id, status) {
    await delay(latencyFor(1));
    const current = findings.find((finding) => finding.id === id);
    if (!current) throw missing("Finding", id);
    const updated: Finding = { ...current, status };
    findings = findings.map((finding) => (finding.id === id ? updated : finding));
    return updated;
  },

  async applyFindingFix(id) {
    await delay(latencyFor(3));
    const current = findings.find((finding) => finding.id === id);
    if (!current) throw missing("Finding", id);

    const commit = fakeSha(id);
    findings = findings.map((finding) =>
      finding.id === id ? { ...finding, status: "fixed", commit } : finding,
    );
    return {
      ok: true,
      commit,
      detail: `Patch applied to ${current.url} — ${current.relatedTests} related test${
        current.relatedTests === 1 ? "" : "s"
      } re-anchored.`,
    };
  },

  /* --- quality categories -------------------------------------------- */

  listA11yIssues(query?: A11yFilter) {
    let matched = byField(A11Y_ISSUES, query?.level, (issue) => issue.wcagLevel);
    matched = byField(matched, query?.impact, (issue) => issue.impact);
    matched = byField(matched, query?.category, (issue) => issue.category);
    matched = searchFilter(matched, query?.search, [
      "id",
      "ruleId",
      "title",
      "description",
      "selector",
      "url",
    ]);
    return respond(matched, query);
  },

  async getA11ySummary() {
    await delay(latencyFor(A11Y_ISSUES.length));
    return A11Y_SUMMARY;
  },

  listSecurityIssues(query) {
    let matched = byField(SECURITY_ISSUES, query?.category, (issue) => issue.category);
    matched = byField(matched, query?.severity, (issue) => issue.severity);
    matched = searchFilter(matched, query?.search, [
      "id",
      "title",
      "category",
      "url",
      "cwe",
      "evidence",
    ]);
    return respond(matched, query);
  },

  async getSecuritySummary() {
    await delay(latencyFor(SECURITY_ISSUES.length));
    return SECURITY_SUMMARY;
  },

  async getPerfSummary(query) {
    const summary = query?.device === "mobile" ? PERF_SUMMARY_MOBILE : PERF_SUMMARY;
    await delay(latencyFor(summary.resources.length));
    return summary;
  },

  listVisualBaselines(query?: VisualFilter) {
    let matched = byField(baselines, query?.status, (baseline) => baseline.status);
    if (isSet(query?.viewport)) {
      const viewport = query.viewport;
      // Accepts either the bare label ("Mobile") or the summary's composed key.
      matched = matched.filter(
        (baseline) => baseline.viewport.label === viewport || viewportKey(baseline.viewport) === viewport,
      );
    }
    matched = searchFilter(matched, query?.search, ["id", "name", "target", "branch"]);
    return respond(matched, query);
  },

  async getVisualSummary() {
    await delay(latencyFor(baselines.length));
    const viewports = [...new Set(baselines.map((baseline) => viewportKey(baseline.viewport)))];
    const summary: VisualSummary = {
      total: baselines.length,
      changed: baselines.filter((baseline) => baseline.status === "changed").length,
      pending: baselines.filter((baseline) => baseline.status === "pending").length,
      approved: baselines.filter((baseline) => baseline.status === "approved").length,
      // Derived, not read from the fixture, so approving a baseline moves the
      // matrix cell the reviewer just acted on.
      byViewport: viewports.map((viewport) => {
        const rows = baselines.filter((baseline) => viewportKey(baseline.viewport) === viewport);
        return {
          viewport,
          changed: rows.filter((row) => row.status === "changed").length,
          total: rows.length,
        };
      }),
    };
    return summary;
  },

  async approveBaseline(id) {
    await delay(latencyFor(1));
    const current = baselines.find((baseline) => baseline.id === id);
    if (!current) throw missing("Baseline", id);
    // The approved actual *becomes* the baseline, so there is nothing left to
    // differ — reporting 0% while still counting changed pixels would be a lie.
    const updated: VisualBaseline = {
      ...current,
      status: "approved",
      diffPercent: 0,
      pixelsChanged: 0,
      changeKind: "none",
    };
    baselines = baselines.map((baseline) => (baseline.id === id ? updated : baseline));
    return updated;
  },

  listApiEndpoints(query?: ApiFilter) {
    let matched = byField(API_ENDPOINTS, query?.method, (endpoint) => endpoint.method);
    if (typeof query?.hasIssues === "boolean") {
      const wanted = query.hasIssues;
      matched = matched.filter((endpoint) => endpoint.issues.length > 0 === wanted);
    }
    matched = searchFilter(matched, query?.search, ["id", "path", "method", "discoveredVia"]);
    return respond(matched, query);
  },

  async getApiSummary() {
    await delay(latencyFor(API_ENDPOINTS.length));
    return API_SUMMARY;
  },

  /* --- script library ------------------------------------------------- */

  listScripts(query?: ScriptFilter) {
    let matched = byField(scripts, query?.kind, (script) => script.kind);
    matched = byTag(matched, query?.tag);
    matched = searchFilter(matched, query?.search, ["id", "name", "description", "kind", "language"]);
    return respond(matched, query);
  },

  getScript(id) {
    return respondOne(scripts, id);
  },

  async saveScript(script) {
    await delay(latencyFor(1));
    const current = scripts.find((entry) => entry.id === script.id);
    const updatedAt = new Date().toISOString();
    const version = (current?.version ?? script.version ?? 0) + 1;

    const saved: ScriptEntry = {
      ...script,
      version,
      updatedAt,
      // The library renders `versions` as the history panel; bumping the number
      // without recording the row would show a v5 script with a v4 history.
      versions: [
        {
          version,
          createdAt: updatedAt,
          author: "Bharat",
          note: current ? "Edited in the script editor" : "Created in the script editor",
          diff: current ? "" : script.code,
        },
        ...(current?.versions ?? script.versions ?? []),
      ],
    };

    scripts = current
      ? scripts.map((entry) => (entry.id === script.id ? saved : entry))
      : [saved, ...scripts];
    return saved;
  },

  /* --- rollup --------------------------------------------------------- */

  async getDashboardSummary() {
    await delay(latencyFor(findings.length));

    const open = findings.filter(isOpen);
    const totals = runs.reduce(
      (acc, run) => ({
        passed: acc.passed + run.passed,
        total: acc.total + run.passed + run.failed + run.flaky + run.skipped,
      }),
      { passed: 0, total: 0 },
    );
    const durations = CASES.reduce((sum, test) => sum + test.durationMs, 0);

    return {
      openFindings: open.length,
      criticalFindings: open.filter((finding) => finding.severity === "critical").length,
      runningRuns: runs.filter((run) => run.status === "running").length,
      // Only tasks somebody is still watching count — an abandoned run parked on
      // a gate must not pin the Workbench badge on for the rest of the session.
      pendingApprovals: [...tasks.values()].filter((task) => task.gate && task.listeners.size > 0)
        .length,
      a11yViolations: A11Y_ISSUES.filter(isOpen).length,
      securityIssues: SECURITY_ISSUES.filter(isOpen).length,
      visualDiffs: baselines.filter((baseline) => baseline.status === "changed").length,
      passRate: totals.total === 0 ? 0 : Math.round((totals.passed / totals.total) * 100),
      totalTests: CASES.length,
      avgDurationMs: CASES.length === 0 ? 0 : Math.round(durations / CASES.length),
    };
  },

  /* --- inspector data ------------------------------------------------- */

  async getDomTree(page) {
    await delay(latencyFor(12));
    return DOM_TREES[page];
  },

  async getSelectorCandidates(page, target) {
    await delay(latencyFor(6));
    const known = SELECTOR_CANDIDATES[target];
    if (known) return known;

    // Unknown node: rank the strategies the way the curated entries do, so the
    // inspector still teaches "test id beats role beats text beats xpath".
    const slug = target.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "node";
    const generic: SelectorCandidate[] = [
      { selector: `[data-testid="${slug}"]`, strategy: "testid", stability: 92, unique: false },
      {
        selector: `getByRole("button", { name: "${target}" })`,
        strategy: "role",
        stability: 73,
        unique: true,
      },
      { selector: `getByLabel("${target}")`, strategy: "label", stability: 64, unique: true },
      { selector: `getByText("${target}")`, strategy: "text", stability: 47, unique: false },
      { selector: `#${slug}`, strategy: "css", stability: 36, unique: true },
      { selector: `//*[@id="${slug}"]`, strategy: "xpath", stability: 13, unique: true },
    ];
    return generic;
  },

  /* --- agent ---------------------------------------------------------- */

  async startAgentTask(input) {
    await delay(latencyFor(1));
    const taskId = `task_${(taskCounter += 1)}`;
    tasks.set(taskId, {
      cursor: 0,
      timer: null,
      listeners: new Set(),
      gate: null,
      done: false,
    });
    // `input` shapes nothing in a scripted replay, but a prompt that never
    // reached the adapter would be a silent contract break worth surfacing.
    if (!input.prompt.trim()) {
      throw new ApiError("An agent task needs a prompt", 400, "mock", "input.prompt was empty");
    }
    return { taskId, startedAt: new Date().toISOString() };
  },

  async stopAgentTask(taskId) {
    await delay(latencyFor(1));
    const state = tasks.get(taskId);
    if (!state || state.done) return;
    finish(state, "stopped", "Run stopped by the operator. Evidence captured so far is retained.");
  },

  async resolveApproval(taskId, approvalId, decision) {
    await delay(latencyFor(1));
    const state = tasks.get(taskId);
    if (!state || state.gate !== approvalId) return;
    state.gate = null;

    if (decision === "reject") {
      finish(
        state,
        "stopped",
        "Approval denied — payment.submit was not executed. The run stopped before the irreversible step.",
      );
      return;
    }
    schedule(taskId);
  },

  subscribeAgentEvents(taskId, onEvent): Unsubscribe {
    const state = tasks.get(taskId);
    if (!state) return () => undefined;

    state.listeners.add(onEvent);
    // The first subscriber starts the chain; a later one joins the run already
    // in flight rather than restarting it.
    schedule(taskId);

    return () => {
      state.listeners.delete(onEvent);
      // Stop only when nobody is listening — tearing the chain down on the first
      // unsubscribe would silence a second pane that is still attached.
      if (state.listeners.size === 0) halt(state);
    };
  },
};

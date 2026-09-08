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
  SelectorCandidate,
  Suite,
  TestCase,
  TestRun,
  TrendPoint,
  VisualBaseline,
  VisualSummary,
  Workspace,
  WorkspaceFolder,
} from "./types";
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
import { ApiError } from "./contract";

/**
 * THE REST ADAPTER.
 *
 * Every method is a one-liner over `request()`, which owns the whole failure
 * surface: query building, timeout, retry, decode, and the conversion of any
 * mishap into a single `ApiError`. If you find yourself writing a try/catch in
 * a method below, the fix belongs in the helper instead.
 */

export interface HttpDataSourceConfig {
  baseUrl: string;
  headers: Record<string, string>;
  timeoutMs: number;
  retries: number;
}

type Verb = "GET" | "POST" | "PATCH" | "PUT";

interface RequestOptions {
  query?: object;
  body?: unknown;
  /** Opt a GET out of retries — the connectivity probe has to fail fast. */
  retry?: boolean;
}

const BACKOFF_MS = 250;

/** Transient classes only: retrying a 404 or a 422 just burns the timeout. */
function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function queryString(query?: object): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

function messageOf(raw: unknown): string {
  return raw instanceof Error ? raw.message : String(raw);
}

/** Pull the human half out of a `{ message }` / `{ error }` error envelope. */
function detailOf(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const bag = parsed as Record<string, unknown>;
      for (const key of ["message", "error", "detail"]) {
        const value = bag[key];
        if (typeof value === "string" && value) return value;
      }
    }
  } catch {
    // Not an envelope — the raw body is the best detail available.
  }
  return text.slice(0, 500);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createHttpDataSource(config: HttpDataSourceConfig): DataSource {
  const base = config.baseUrl.replace(/\/+$/, "");
  const seg = (value: string) => encodeURIComponent(value);

  async function exchange<T>(method: Verb, url: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          ...(body === undefined ? null : { "content-type": "application/json" }),
          ...config.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await response.text();

      if (!response.ok) {
        throw new ApiError(
          `${method} ${url} failed (${response.status})`,
          response.status,
          "http",
          detailOf(text, response.statusText || "empty response body"),
        );
      }
      // 204s and empty 200s are legitimate for the void-returning endpoints.
      if (!text.trim()) return undefined as unknown as T;
      try {
        return JSON.parse(text) as T;
      } catch (raw) {
        throw new ApiError(
          `${method} ${url} returned malformed JSON`,
          response.status,
          "http",
          `${messageOf(raw)} — body: ${text.slice(0, 200)}`,
        );
      }
    } catch (raw) {
      if (raw instanceof ApiError) throw raw;
      if (timedOut) {
        throw new ApiError(`${method} ${url} timed out`, 408, "http", `no response within ${config.timeoutMs}ms`);
      }
      throw new ApiError(`${method} ${url} could not reach the server`, 0, "http", messageOf(raw));
    } finally {
      clearTimeout(timer);
    }
  }

  async function request<T>(method: Verb, path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${base}${path}${queryString(options.query)}`;
    // Only GET is idempotent — a retried POST would double-create.
    const attempts = method === "GET" && options.retry !== false ? Math.max(0, config.retries) + 1 : 1;

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await exchange<T>(method, url, options.body);
      } catch (raw) {
        const error = raw instanceof ApiError ? raw : new ApiError(messageOf(raw), 0, "http");
        if (attempt >= attempts - 1 || !isRetryable(error.status)) throw error;
        await sleep(BACKOFF_MS * 2 ** attempt);
      }
    }
  }

  const get = <T,>(path: string, query?: object) => request<T>("GET", path, { query });
  const post = <T,>(path: string, body?: unknown) => request<T>("POST", path, { body });
  /** 404 on a detail endpoint means "no such record", which is data, not a failure. */
  const getOrNull = async <T,>(path: string): Promise<T | null> => {
    try {
      return await get<T>(path);
    } catch (raw) {
      if (raw instanceof ApiError && raw.status === 404) return null;
      throw raw;
    }
  };

  return {
    id: "http",
    label: "REST API",

    async health() {
      const started = Date.now();
      try {
        await request<unknown>("GET", "/health", { retry: false });
        return { ok: true, latencyMs: Date.now() - started, detail: `${base} responded` };
      } catch (raw) {
        const error = raw instanceof ApiError ? raw : undefined;
        return {
          ok: false,
          latencyMs: Date.now() - started,
          detail: error ? `${error.message}${error.detail ? ` — ${error.detail}` : ""}` : messageOf(raw),
        };
      }
    },

    /* --- workspaces ---------------------------------------------------- */
    listProjects: (query?: ListQuery) => get<Paged<Workspace>>("/projects", query),
    getProject: (id: string) => getOrNull<Workspace>(`/projects/${seg(id)}`),
    listProjectFolders: () => get<WorkspaceFolder[]>("/project-folders"),
    createProject: (input) => post<Workspace>("/projects", input),
    toggleProjectStar: (id: string) => post<Workspace>(`/projects/${seg(id)}/star`),

    /* --- suites & cases ------------------------------------------------ */
    listSuites: (query?: ListQuery & { projectId?: string }) => get<Paged<Suite>>("/suites", query),
    listCases: (query?: CaseFilter) => get<Paged<TestCase>>("/cases", query),
    getCase: (id: string) => getOrNull<TestCase>(`/cases/${seg(id)}`),

    /* --- runs ----------------------------------------------------------- */
    listRuns: (query?: RunFilter) => get<Paged<TestRun>>("/runs", query),
    getRun: (id: string) => getOrNull<TestRun>(`/runs/${seg(id)}`),
    getRunTrend: () => get<TrendPoint[]>("/runs/trend"),
    listFlakyTests: () => get<FlakyTest[]>("/runs/flaky"),
    startRun: (input) => post<TestRun>("/runs", input),

    /* --- findings ------------------------------------------------------- */
    listFindings: (query?: FindingFilter) => get<Paged<Finding>>("/findings", query),
    getFinding: (id: string) => getOrNull<Finding>(`/findings/${seg(id)}`),
    updateFindingStatus: (id: string, status: Finding["status"]) =>
      request<Finding>("PATCH", `/findings/${seg(id)}`, { body: { status } }),
    applyFindingFix: (id: string) =>
      post<{ ok: boolean; commit: string; detail: string }>(`/findings/${seg(id)}/apply-fix`),

    /* --- quality categories -------------------------------------------- */
    listA11yIssues: (query?: A11yFilter) => get<Paged<A11yIssue>>("/accessibility/issues", query),
    getA11ySummary: () => get<A11ySummary>("/accessibility/summary"),

    listSecurityIssues: (query?: ListQuery & { category?: string; severity?: string }) =>
      get<Paged<SecurityIssue>>("/security/issues", query),
    getSecuritySummary: () => get<SecuritySummary>("/security/summary"),

    getPerfSummary: (query?: { device?: "desktop" | "mobile"; url?: string }) =>
      get<PerfSummary>("/performance/summary", query),

    listVisualBaselines: (query?: VisualFilter) => get<Paged<VisualBaseline>>("/visual/baselines", query),
    getVisualSummary: () => get<VisualSummary>("/visual/summary"),
    approveBaseline: (id: string) => post<VisualBaseline>(`/visual/baselines/${seg(id)}/approve`),

    listApiEndpoints: (query?: ApiFilter) => get<Paged<ApiEndpoint>>("/api-intel/endpoints", query),
    getApiSummary: () => get<ApiSummary>("/api-intel/summary"),

    /* --- script library ------------------------------------------------- */
    listScripts: (query?: ScriptFilter) => get<Paged<ScriptEntry>>("/scripts", query),
    getScript: (id: string) => getOrNull<ScriptEntry>(`/scripts/${seg(id)}`),
    saveScript: (script: ScriptEntry) => request<ScriptEntry>("PUT", `/scripts/${seg(script.id)}`, { body: script }),

    /* --- rollup --------------------------------------------------------- */
    getDashboardSummary: () => get<DashboardSummary>("/dashboard/summary"),

    /* --- inspector data ------------------------------------------------- */
    getDomTree: (page: PageId) => get<DomNode>("/inspector/dom", { page }),
    getSelectorCandidates: (page: PageId, target: string) =>
      get<SelectorCandidate[]>("/inspector/selectors", { page, target }),

    /* --- agent ---------------------------------------------------------- */
    startAgentTask: (input: AgentTaskInput) => post<AgentTaskHandle>("/agent/tasks", input),
    stopAgentTask: (taskId: string) => post<void>(`/agent/tasks/${seg(taskId)}/stop`),
    resolveApproval: (taskId: string, approvalId: string, decision: "approve" | "reject") =>
      post<void>(`/agent/tasks/${seg(taskId)}/approvals/${seg(approvalId)}`, { decision }),

    subscribeAgentEvents(taskId: string, onEvent: (event: AgentEvent) => void): Unsubscribe {
      // Static export prerenders these screens, where EventSource does not exist.
      if (typeof window === "undefined") return () => {};

      // EventSource cannot carry `config.headers`, so an authenticated backend
      // has to accept a cookie or a token on the URL for this one stream.
      const source = new EventSource(`${base}/agent/tasks/${seg(taskId)}/events`);
      source.onmessage = (event: MessageEvent<string>) => {
        try {
          onEvent(JSON.parse(event.data) as AgentEvent);
        } catch {
          // One truncated frame must not tear down the whole stream.
        }
      };
      return () => source.close();
    },
  };
}

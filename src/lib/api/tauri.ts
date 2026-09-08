import type { UnlistenFn } from "@tauri-apps/api/event";
import type { DataSource, Unsubscribe } from "./contract";
import { ApiError } from "./contract";
import type { AgentEvent } from "./types";

/**
 * THE TAURI IPC ADAPTER.
 *
 * One `invoke` per DataSource method, snake_case command names, a single
 * camelCase object argument (Tauri renames the keys to snake_case Rust params).
 *
 * The registry imports this module unconditionally — including under `next dev`
 * in a plain browser, where `@tauri-apps/api` has no host to talk to and can
 * throw on load. So the Tauri modules are imported lazily inside the call path
 * and every method fails with a 503 ApiError off-desktop instead of taking the
 * whole bundle down at import time.
 */

const ID = "tauri" as const;

/** True only inside the Tauri webview, where the IPC bridge is injected. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function unavailable(): ApiError {
  return new ApiError("Tauri backend unavailable — running in a browser", 503, ID);
}

// Cached module promises: the dynamic import is resolved once per session, so
// repeated invokes don't re-enter the loader.
let corePromise: Promise<typeof import("@tauri-apps/api/core")> | undefined;
let eventPromise: Promise<typeof import("@tauri-apps/api/event")> | undefined;

function core() {
  corePromise ??= import("@tauri-apps/api/core");
  return corePromise;
}

function events() {
  eventPromise ??= import("@tauri-apps/api/event");
  return eventPromise;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw unavailable();
  try {
    const { invoke } = await core();
    return await invoke<T>(command, args);
  } catch (error) {
    // A Rust `Err(String)` crosses the bridge as a bare string, not an Error.
    const detail = error instanceof Error ? error.message : String(error);
    throw new ApiError(`Tauri command "${command}" failed`, 500, ID, detail);
  }
}

/** The backend tags each emission so one channel can carry every live task. */
type AgentEventEnvelope = AgentEvent & { taskId?: string };

function subscribeAgentEvents(taskId: string, onEvent: (event: AgentEvent) => void): Unsubscribe {
  // Synchronous contract, so there is no promise to reject — throwing keeps the
  // off-desktop failure identical to every other method's.
  if (!isTauri()) throw unavailable();

  let unlisten: UnlistenFn | undefined;
  let cancelled = false;

  void events()
    .then(({ listen }) =>
      listen<AgentEventEnvelope>("agent://event", ({ payload }) => {
        if (cancelled) return;
        // Untagged events are broadcasts (health, global status) — keep those.
        if (payload.taskId !== undefined && payload.taskId !== taskId) return;
        onEvent(payload);
      }),
    )
    .then((fn) => {
      // Unsubscribed while the listener was still registering: tear it down the
      // moment it exists, otherwise the handler outlives its consumer.
      if (cancelled) fn();
      else unlisten = fn;
    })
    .catch(() => {
      /* channel never opened — nothing registered, nothing to tear down */
    });

  return () => {
    cancelled = true;
    unlisten?.();
    unlisten = undefined;
  };
}

export function createTauriDataSource(): DataSource {
  return {
    id: ID,
    label: "Tauri IPC",

    async health() {
      const startedAt = Date.now();
      const result = await call<{ ok: boolean; detail: string }>("health_check");
      // Timed on this side: the backend cannot see the IPC round trip.
      return { ...result, latencyMs: Date.now() - startedAt };
    },

    /* --- workspaces ---------------------------------------------------- */
    listProjects: (query) => call("list_projects", { query }),
    getProject: (id) => call("get_project", { id }),
    listProjectFolders: () => call("list_project_folders"),
    createProject: (input) => call("create_project", { input }),
    toggleProjectStar: (id) => call("toggle_project_star", { id }),

    /* --- suites & cases ------------------------------------------------ */
    listSuites: (query) => call("list_suites", { query }),
    listCases: (query) => call("list_cases", { query }),
    getCase: (id) => call("get_case", { id }),

    /* --- runs ----------------------------------------------------------- */
    listRuns: (query) => call("list_runs", { query }),
    getRun: (id) => call("get_run", { id }),
    getRunTrend: () => call("get_run_trend"),
    listFlakyTests: () => call("list_flaky_tests"),
    startRun: (input) => call("start_run", { input }),

    /* --- findings ------------------------------------------------------- */
    listFindings: (query) => call("list_findings", { query }),
    getFinding: (id) => call("get_finding", { id }),
    updateFindingStatus: (id, status) => call("update_finding_status", { id, status }),
    applyFindingFix: (id) => call("apply_finding_fix", { id }),

    /* --- quality categories -------------------------------------------- */
    listA11yIssues: (query) => call("list_a11y_issues", { query }),
    getA11ySummary: () => call("get_a11y_summary"),

    listSecurityIssues: (query) => call("list_security_issues", { query }),
    getSecuritySummary: () => call("get_security_summary"),

    getPerfSummary: (query) => call("get_perf_summary", { query }),

    listVisualBaselines: (query) => call("list_visual_baselines", { query }),
    getVisualSummary: () => call("get_visual_summary"),
    approveBaseline: (id) => call("approve_baseline", { id }),

    listApiEndpoints: (query) => call("list_api_endpoints", { query }),
    getApiSummary: () => call("get_api_summary"),

    /* --- script library ------------------------------------------------- */
    listScripts: (query) => call("list_scripts", { query }),
    getScript: (id) => call("get_script", { id }),
    saveScript: (script) => call("save_script", { script }),

    /* --- rollup --------------------------------------------------------- */
    getDashboardSummary: () => call("get_dashboard_summary"),

    /* --- inspector data ------------------------------------------------- */
    getDomTree: (page) => call("get_dom_tree", { page }),
    getSelectorCandidates: (page, target) => call("get_selector_candidates", { page, target }),

    /* --- agent ---------------------------------------------------------- */
    startAgentTask: (input) => call("start_agent_task", { input }),
    stopAgentTask: (taskId) => call("stop_agent_task", { taskId }),
    resolveApproval: (taskId, approvalId, decision) =>
      call("resolve_approval", { taskId, approvalId, decision }),
    subscribeAgentEvents,
  };
}

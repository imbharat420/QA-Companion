"use client";

import { useCallback } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { getDataSource } from "@/lib/api";
import type { DataSource } from "@/lib/api/contract";
import type { Finding, PageId, Paged } from "@/lib/api/types";
import { useApiMode, useSettingsStore } from "@/store/settingsStore";

/**
 * THE READ LAYER. Pages import from here and nowhere else — never
 * `getDataSource()` directly. Two things follow from that:
 *
 *  1. The adapter is resolved *inside* `queryFn`, at fetch time. A hook that
 *     captured an adapter at render would keep serving the old source for one
 *     more tick after the Settings screen flips the mode.
 *  2. Every key is prefixed with the active mode, so mock/http/tauri responses
 *     can never collide in the cache even if `AppProviders` skipped its clear.
 */

/** The adapter method's own parameter type, so filters are never restated here. */
type Arg<M extends keyof DataSource, I extends 0 | 1 = 0> =
  DataSource[M] extends (...args: infer A) => unknown ? A[I] : never;

const mode = () => useSettingsStore.getState().api.mode;

const key = (...parts: unknown[]): QueryKey => [mode(), ...parts];

/** Summaries and trends move once per run, not per interaction. */
const SUMMARY_STALE = 120_000;

/* ==========================================================================
   QUERY KEYS
   The non-parameterised entries are getters: `mode()` has to be read when the
   key is used, not when this module is evaluated.
   ======================================================================== */

export const qk = {
  projects: {
    get all() {
      return key("projects");
    },
    list: (query?: Arg<"listProjects">) => key("projects", "list", query),
    detail: (id: string) => key("projects", "detail", id),
    get folders() {
      return key("projects", "folders");
    },
  },
  suites: {
    list: (query?: Arg<"listSuites">) => key("suites", "list", query),
  },
  cases: {
    list: (query?: Arg<"listCases">) => key("cases", "list", query),
    detail: (id: string) => key("cases", "detail", id),
  },
  runs: {
    get all() {
      return key("runs");
    },
    list: (query?: Arg<"listRuns">) => key("runs", "list", query),
    detail: (id: string) => key("runs", "detail", id),
    get trend() {
      return key("runs", "trend");
    },
    get flaky() {
      return key("runs", "flaky");
    },
  },
  findings: {
    get all() {
      return key("findings");
    },
    list: (query?: Arg<"listFindings">) => key("findings", "list", query),
    detail: (id: string) => key("findings", "detail", id),
  },
  a11y: {
    list: (query?: Arg<"listA11yIssues">) => key("a11y", "list", query),
    get summary() {
      return key("a11y", "summary");
    },
  },
  security: {
    list: (query?: Arg<"listSecurityIssues">) => key("security", "list", query),
    get summary() {
      return key("security", "summary");
    },
  },
  perf: {
    summary: (query?: Arg<"getPerfSummary">) => key("perf", "summary", query),
  },
  visual: {
    list: (query?: Arg<"listVisualBaselines">) => key("visual", "list", query),
    get summary() {
      return key("visual", "summary");
    },
  },
  api: {
    list: (query?: Arg<"listApiEndpoints">) => key("api", "list", query),
    get summary() {
      return key("api", "summary");
    },
  },
  scripts: {
    list: (query?: Arg<"listScripts">) => key("scripts", "list", query),
    detail: (id: string) => key("scripts", "detail", id),
  },
  dashboard: {
    get summary() {
      return key("dashboard", "summary");
    },
  },
  inspector: {
    dom: (page: PageId) => key("inspector", "dom", page),
    selectors: (page: PageId, target: string) => key("inspector", "selectors", page, target),
  },
} as const;

/* ==========================================================================
   THE ONE WIRING POINT
   ======================================================================== */

type Fetch<T> = (source: DataSource) => Promise<T>;

function useAdapterQuery<T>(
  queryKey: QueryKey,
  fetch: Fetch<T>,
  opts?: { staleTime?: number; enabled?: boolean },
) {
  /**
   * Subscribe to the mode HERE, not at the call site.
   *
   * `qk.*` prefixes keys via a non-reactive `getState()` read. That is enough to
   * keep the three sources from colliding in the cache, but it cannot re-render
   * a component that does not otherwise watch the mode — the nav-rail badges,
   * for one. Such a component would go on observing the old `["mock", …]` key
   * after the Settings screen switched to REST, and keep showing mock numbers
   * under the new source. Subscribing in the shared helper re-keys all 30-odd
   * hooks on a switch, which is the whole point of the switch being one click.
   */
  const apiMode = useApiMode();

  return useQuery({
    // TanStack hashes keys structurally, so a fresh array each render is fine.
    queryKey: [apiMode, ...queryKey.slice(1)],
    queryFn: () => fetch(getDataSource()),
    ...opts,
  });
}

/* ==========================================================================
   WORKSPACES
   ======================================================================== */

export function useProjects(query?: Arg<"listProjects">) {
  return useAdapterQuery(qk.projects.list(query), (s) => s.listProjects(query));
}

export function useProject(id: string) {
  return useAdapterQuery(qk.projects.detail(id), (s) => s.getProject(id), {
    enabled: Boolean(id),
  });
}

export function useProjectFolders() {
  return useAdapterQuery(qk.projects.folders, (s) => s.listProjectFolders());
}

/* ==========================================================================
   SUITES & CASES
   ======================================================================== */

export function useSuites(query?: Arg<"listSuites">) {
  return useAdapterQuery(qk.suites.list(query), (s) => s.listSuites(query));
}

export function useCases(query?: Arg<"listCases">) {
  return useAdapterQuery(qk.cases.list(query), (s) => s.listCases(query));
}

export function useCase(id: string) {
  return useAdapterQuery(qk.cases.detail(id), (s) => s.getCase(id), { enabled: Boolean(id) });
}

/* ==========================================================================
   RUNS
   ======================================================================== */

export function useRuns(query?: Arg<"listRuns">) {
  return useAdapterQuery(qk.runs.list(query), (s) => s.listRuns(query));
}

export function useRun(id: string) {
  return useAdapterQuery(qk.runs.detail(id), (s) => s.getRun(id), { enabled: Boolean(id) });
}

export function useRunTrend() {
  return useAdapterQuery(qk.runs.trend, (s) => s.getRunTrend(), { staleTime: SUMMARY_STALE });
}

export function useFlakyTests() {
  return useAdapterQuery(qk.runs.flaky, (s) => s.listFlakyTests(), { staleTime: SUMMARY_STALE });
}

/* ==========================================================================
   FINDINGS
   ======================================================================== */

export function useFindings(query?: Arg<"listFindings">) {
  return useAdapterQuery(qk.findings.list(query), (s) => s.listFindings(query));
}

export function useFinding(id: string) {
  return useAdapterQuery(qk.findings.detail(id), (s) => s.getFinding(id), {
    enabled: Boolean(id),
  });
}

/* ==========================================================================
   QUALITY CATEGORIES
   ======================================================================== */

export function useA11yIssues(query?: Arg<"listA11yIssues">) {
  return useAdapterQuery(qk.a11y.list(query), (s) => s.listA11yIssues(query));
}

export function useA11ySummary() {
  return useAdapterQuery(qk.a11y.summary, (s) => s.getA11ySummary(), {
    staleTime: SUMMARY_STALE,
  });
}

export function useSecurityIssues(query?: Arg<"listSecurityIssues">) {
  return useAdapterQuery(qk.security.list(query), (s) => s.listSecurityIssues(query));
}

export function useSecuritySummary() {
  return useAdapterQuery(qk.security.summary, (s) => s.getSecuritySummary(), {
    staleTime: SUMMARY_STALE,
  });
}

export function usePerfSummary(query?: Arg<"getPerfSummary">) {
  return useAdapterQuery(qk.perf.summary(query), (s) => s.getPerfSummary(query), {
    staleTime: SUMMARY_STALE,
  });
}

export function useVisualBaselines(query?: Arg<"listVisualBaselines">) {
  return useAdapterQuery(qk.visual.list(query), (s) => s.listVisualBaselines(query));
}

export function useVisualSummary() {
  return useAdapterQuery(qk.visual.summary, (s) => s.getVisualSummary(), {
    staleTime: SUMMARY_STALE,
  });
}

export function useApiEndpoints(query?: Arg<"listApiEndpoints">) {
  return useAdapterQuery(qk.api.list(query), (s) => s.listApiEndpoints(query));
}

export function useApiSummary() {
  return useAdapterQuery(qk.api.summary, (s) => s.getApiSummary(), { staleTime: SUMMARY_STALE });
}

/* ==========================================================================
   SCRIPT LIBRARY
   ======================================================================== */

export function useScripts(query?: Arg<"listScripts">) {
  return useAdapterQuery(qk.scripts.list(query), (s) => s.listScripts(query));
}

export function useScript(id: string) {
  return useAdapterQuery(qk.scripts.detail(id), (s) => s.getScript(id), {
    enabled: Boolean(id),
  });
}

/* ==========================================================================
   ROLLUP + INSPECTOR
   ======================================================================== */

export function useDashboardSummary() {
  return useAdapterQuery(qk.dashboard.summary, (s) => s.getDashboardSummary(), {
    staleTime: SUMMARY_STALE,
  });
}

export function useDomTree(page: PageId) {
  return useAdapterQuery(qk.inspector.dom(page), (s) => s.getDomTree(page));
}

export function useSelectorCandidates(page: PageId, target: string) {
  return useAdapterQuery(
    qk.inspector.selectors(page, target),
    (s) => s.getSelectorCandidates(page, target),
    { enabled: Boolean(target) },
  );
}

/* ==========================================================================
   MUTATIONS
   ======================================================================== */

export function useUpdateFindingStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Arg<"updateFindingStatus", 1> }) =>
      getDataSource().updateFindingStatus(id, status),

    // Triage is a rapid-fire keyboard flow — the row must recolour on keypress,
    // not a round trip later.
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: qk.findings.all });
      const snapshot = qc.getQueriesData({ queryKey: qk.findings.all });

      qc.setQueryData<Finding | null>(qk.findings.detail(id), (prev) =>
        prev ? { ...prev, status } : prev,
      );
      // Every findings list key shares this prefix, so one pass patches all the
      // cached filter/pagination combinations at once.
      qc.setQueriesData<Paged<Finding>>({ queryKey: key("findings", "list") }, (prev) =>
        prev
          ? { ...prev, items: prev.items.map((f) => (f.id === id ? { ...f, status } : f)) }
          : prev,
      );

      return { snapshot };
    },

    onError: (_error, _vars, ctx) => {
      ctx?.snapshot.forEach(([k, data]) => qc.setQueryData(k, data));
    },

    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.findings.all });
      void qc.invalidateQueries({ queryKey: qk.dashboard.summary });
    },
  });
}

export function useApplyFindingFix() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => getDataSource().applyFindingFix(id),
    onSuccess: (_result, id) => {
      void qc.invalidateQueries({ queryKey: qk.findings.detail(id) });
      void qc.invalidateQueries({ queryKey: key("findings", "list") });
      void qc.invalidateQueries({ queryKey: qk.dashboard.summary });
    },
  });
}

export function useApproveBaseline() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => getDataSource().approveBaseline(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key("visual") });
      void qc.invalidateQueries({ queryKey: qk.dashboard.summary });
    },
  });
}

export function useStartRun() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: Arg<"startRun">) => getDataSource().startRun(input),
    onSuccess: (run) => {
      qc.setQueryData(qk.runs.detail(run.id), run);
      void qc.invalidateQueries({ queryKey: key("runs", "list") });
      void qc.invalidateQueries({ queryKey: qk.dashboard.summary });
    },
  });
}

export function useToggleProjectStar() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => getDataSource().toggleProjectStar(id),
    onSuccess: (project) => {
      qc.setQueryData(qk.projects.detail(project.id), project);
      void qc.invalidateQueries({ queryKey: key("projects", "list") });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: Arg<"createProject">) => getDataSource().createProject(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.projects.all });
    },
  });
}

export function useSaveScript() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (script: Arg<"saveScript">) => getDataSource().saveScript(script),
    onSuccess: (script) => {
      qc.setQueryData(qk.scripts.detail(script.id), script);
      void qc.invalidateQueries({ queryKey: key("scripts", "list") });
    },
  });
}

/* ==========================================================================
   PREFETCH
   ======================================================================== */

/**
 * Warm a detail route from a list row's `onMouseEnter`, so the click lands on
 * cached data. `prefetchQuery` is a no-op when the entry is already fresh.
 */
export function usePrefetchOnHover() {
  const qc = useQueryClient();

  return useCallback(
    <T,>(queryKey: QueryKey, fetch: Fetch<T>) => {
      void qc.prefetchQuery({ queryKey, queryFn: () => fetch(getDataSource()) });
    },
    [qc],
  );
}

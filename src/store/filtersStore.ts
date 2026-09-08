"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  FindingStatus,
  HttpMethod,
  ScriptKind,
  Severity,
  TestStatus,
  VisualBaseline,
  WcagLevel,
} from "@/lib/api/types";

/**
 * LIST FILTERS — one namespaced bag per page.
 *
 * Every list page owns its own key space, so /findings and /accessibility can
 * both have a `category` without overwriting each other. All of it persists:
 * a filter the user set by hand is a preference, not view state.
 *
 * `"all"` is the widened sentinel every enum-ish filter uses; run values
 * through `filterValue()` before handing them to a DataSource query, which
 * expects `undefined` for "no constraint".
 */

export type SortDir = "asc" | "desc";

export interface FindingsFilters {
  severity: Severity | "all";
  status: FindingStatus | "all";
  category: string;
  search: string;
  sortBy: "severity" | "confidence" | "detected" | "title";
  sortDir: SortDir;
}

export interface RunsFilters {
  status: TestStatus | "all";
  branch: string;
  search: string;
}

export interface CasesFilters {
  suiteId: string;
  tag: string;
  status: TestStatus | "all";
  search: string;
}

export interface A11yFilters {
  level: WcagLevel | "all";
  impact: Severity | "all";
  category: string;
  search: string;
}

export interface SecurityFilters {
  category: string;
  severity: Severity | "all";
  search: string;
}

export interface VisualFilters {
  status: VisualBaseline["status"] | "all";
  viewport: string;
  search: string;
}

export interface ApiFilters {
  method: HttpMethod | "all";
  hasIssues: boolean;
  search: string;
}

export interface ScriptsFilters {
  kind: ScriptKind | "all";
  tag: string;
  search: string;
}

/** The filter bags, keyed by page. Adding a page means adding one entry here. */
export interface FilterBags {
  findings: FindingsFilters;
  runs: RunsFilters;
  cases: CasesFilters;
  a11y: A11yFilters;
  security: SecurityFilters;
  visual: VisualFilters;
  api: ApiFilters;
  scripts: ScriptsFilters;
}

export type FilterPage = keyof FilterBags;

export interface FiltersState extends FilterBags {
  setFilter: <P extends FilterPage, K extends keyof FilterBags[P]>(
    page: P,
    key: K,
    value: FilterBags[P][K],
  ) => void;
  resetFilters: (page: FilterPage) => void;
  resetAll: () => void;
}

export const DEFAULT_FILTERS: FilterBags = {
  findings: {
    severity: "all",
    status: "all",
    category: "all",
    search: "",
    sortBy: "severity",
    sortDir: "desc",
  },
  runs: { status: "all", branch: "all", search: "" },
  cases: { suiteId: "all", tag: "all", status: "all", search: "" },
  a11y: { level: "all", impact: "all", category: "all", search: "" },
  security: { category: "all", severity: "all", search: "" },
  visual: { status: "all", viewport: "all", search: "" },
  api: { method: "all", hasIssues: false, search: "" },
  scripts: { kind: "all", tag: "all", search: "" },
};

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      ...DEFAULT_FILTERS,

      // Spread the whole state rather than returning a one-key partial: a
      // computed key from a generic loses its literal type, and this keeps the
      // update type-safe without a cast.
      setFilter: (page, key, value) =>
        set((s) => ({ ...s, [page]: { ...s[page], [key]: value } })),

      resetFilters: (page) => set((s) => ({ ...s, [page]: DEFAULT_FILTERS[page] })),

      resetAll: () => set({ ...DEFAULT_FILTERS }),
    }),
    {
      name: "aether.filters.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Default merge is shallow, so a bag stored before a filter was added
      // would come back missing that key. Re-base every bag on its defaults.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<FilterBags>;
        return {
          ...current,
          findings: { ...DEFAULT_FILTERS.findings, ...saved.findings },
          runs: { ...DEFAULT_FILTERS.runs, ...saved.runs },
          cases: { ...DEFAULT_FILTERS.cases, ...saved.cases },
          a11y: { ...DEFAULT_FILTERS.a11y, ...saved.a11y },
          security: { ...DEFAULT_FILTERS.security, ...saved.security },
          visual: { ...DEFAULT_FILTERS.visual, ...saved.visual },
          api: { ...DEFAULT_FILTERS.api, ...saved.api },
          scripts: { ...DEFAULT_FILTERS.scripts, ...saved.scripts },
        };
      },
    },
  ),
);

/* --- narrow selectors ------------------------------------------------------ */
/** One bag. The reference only changes when that page filters change. */
export const usePageFilters = <P extends FilterPage>(page: P): FilterBags[P] =>
  useFiltersStore((s) => s[page]);

export const useFindingsFilters = () => useFiltersStore((s) => s.findings);
export const useRunsFilters = () => useFiltersStore((s) => s.runs);
export const useCasesFilters = () => useFiltersStore((s) => s.cases);
export const useA11yFilters = () => useFiltersStore((s) => s.a11y);
export const useSecurityFilters = () => useFiltersStore((s) => s.security);
export const useVisualFilters = () => useFiltersStore((s) => s.visual);
export const useApiFilters = () => useFiltersStore((s) => s.api);
export const useScriptsFilters = () => useFiltersStore((s) => s.scripts);

/** True when a page is filtered at all — drives the "Clear filters" affordance. */
export const useHasActiveFilters = <P extends FilterPage>(page: P) =>
  useFiltersStore((s) => {
    const bag = s[page];
    const defaults = DEFAULT_FILTERS[page];
    const keys = Object.keys(defaults) as (keyof FilterBags[P])[];
    return keys.some((key) => bag[key] !== defaults[key]);
  });

/** `"all"` / `""` mean "no constraint" to us and `undefined` to the DataSource. */
export const filterValue = (value: string): string | undefined =>
  value === "all" || value === "" ? undefined : value;

/** Non-reactive read for query-key builders and tests. */
export const readFilters = () => useFiltersStore.getState();

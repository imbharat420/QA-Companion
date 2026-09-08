"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { localId } from "@/lib/utils";

/**
 * PROJECT SHELL STATE — which workspace is open, how the grid is arranged, and
 * the in-flight upload queue.
 *
 * The workspace *records* live in the query cache (adapter-owned); this store
 * only holds the client-side decisions about them. `starred` is an optimistic
 * override on top of `Workspace.starred`, so a star reads instantly and still
 * survives the reload that happens before the adapter round-trip lands.
 */

export type ProjectViewMode = "grid" | "list";
export type ProjectSortBy = "recent" | "name" | "health" | "tests";
export type UploadState = "queued" | "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  name: string;
  /** 0–100. */
  progress: number;
  state: UploadState;
  error?: string;
}

/** The rail only has room for so much history. */
const MAX_RECENT = 8;

export interface ProjectsState {
  activeProjectId: string | null;
  recentProjectIds: string[];
  viewMode: ProjectViewMode;
  sortBy: ProjectSortBy;
  groupByFolder: boolean;
  starred: Record<string, boolean>;
  uploadQueue: UploadItem[];

  setActiveProject: (id: string | null) => void;
  setViewMode: (mode: ProjectViewMode) => void;
  setSortBy: (sortBy: ProjectSortBy) => void;
  toggleGroupByFolder: () => void;
  setStarred: (id: string, starred: boolean) => void;
  toggleStarred: (id: string) => void;
  /** Returns the queue id so the caller can drive `updateUpload`. */
  enqueueUpload: (name: string) => string;
  updateUpload: (id: string, patch: Partial<Omit<UploadItem, "id">>) => void;
  clearFinishedUploads: () => void;
  reset: () => void;
}

const DEFAULTS = {
  activeProjectId: null,
  recentProjectIds: [] as string[],
  viewMode: "grid" as ProjectViewMode,
  sortBy: "recent" as ProjectSortBy,
  groupByFolder: true,
  starred: {} as Record<string, boolean>,
  uploadQueue: [] as UploadItem[],
};

export const useProjectsStore = create<ProjectsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      setActiveProject: (id) =>
        set((s) => ({
          activeProjectId: id,
          recentProjectIds: id
            ? [id, ...s.recentProjectIds.filter((prev) => prev !== id)].slice(0, MAX_RECENT)
            : s.recentProjectIds,
        })),

      setViewMode: (viewMode) => set({ viewMode }),
      setSortBy: (sortBy) => set({ sortBy }),
      toggleGroupByFolder: () => set((s) => ({ groupByFolder: !s.groupByFolder })),

      setStarred: (id, starred) => set((s) => ({ starred: { ...s.starred, [id]: starred } })),
      toggleStarred: (id) => set((s) => ({ starred: { ...s.starred, [id]: !s.starred[id] } })),

      enqueueUpload: (name) => {
        const id = localId("upload");
        set((s) => ({ uploadQueue: [...s.uploadQueue, { id, name, progress: 0, state: "queued" }] }));
        return id;
      },

      updateUpload: (id, patch) =>
        set((s) => ({
          uploadQueue: s.uploadQueue.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),

      clearFinishedUploads: () =>
        set((s) => ({ uploadQueue: s.uploadQueue.filter((item) => item.state !== "done") })),

      reset: () => set({ ...DEFAULTS }),
    }),
    {
      name: "aether.projects.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // The upload queue is per-session: a half-finished transfer cannot resume.
      partialize: (s) => ({
        activeProjectId: s.activeProjectId,
        recentProjectIds: s.recentProjectIds,
        viewMode: s.viewMode,
        sortBy: s.sortBy,
        groupByFolder: s.groupByFolder,
        starred: s.starred,
      }),
    },
  ),
);

/* --- narrow selectors ------------------------------------------------------ */
export const useActiveProjectId = () => useProjectsStore((s) => s.activeProjectId);
export const useRecentProjectIds = () => useProjectsStore((s) => s.recentProjectIds);
export const useProjectViewMode = () => useProjectsStore((s) => s.viewMode);
export const useProjectSortBy = () => useProjectsStore((s) => s.sortBy);
export const useGroupByFolder = () => useProjectsStore((s) => s.groupByFolder);
export const useStarredOverrides = () => useProjectsStore((s) => s.starred);
export const useUploadQueue = () => useProjectsStore((s) => s.uploadQueue);
/** True/false override, or `undefined` when the adapter value should win. */
export const useIsStarred = (id: string): boolean | undefined =>
  useProjectsStore((s) => s.starred[id]);
export const useActiveUploadCount = () =>
  useProjectsStore((s) => s.uploadQueue.filter((item) => item.state === "uploading").length);

/** Non-reactive read for adapters, upload drivers and tests. */
export const readProjects = () => useProjectsStore.getState();

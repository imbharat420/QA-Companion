"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * SHELL LAYOUT STATE — everything about *how* the app is arranged, nothing
 * about what it shows. Pages read one field at a time through the selectors at
 * the bottom; nobody subscribes to the whole store.
 *
 * Persisted: the layout the user arranged by hand (rail, panes, timeline,
 * inspector tab). Not persisted: anything the user would be surprised to find
 * still open after a restart — the palette, focus mode and the cockpit overlay.
 */

export type FocusMode = "none" | "chat" | "browser" | "inspector" | "findings";
export type InspectorTab = "dom" | "a11y" | "network" | "console" | "selectors";

export interface UiState {
  railExpanded: boolean;
  commandPaletteOpen: boolean;
  focusMode: FocusMode;
  activeInspectorTab: InspectorTab;
  /** Non-null while the failure cockpit is open over the current page. */
  cockpitFindingId: string | null;
  /** Resizable-group sizes keyed by group id, e.g. "workbench.h" -> [28, 46, 26]. */
  paneSizes: Record<string, number[]>;
  timelineCollapsed: boolean;
  sidebarSection: string | null;
  lastVisitedRoute: string;

  toggleRail: () => void;
  setRailExpanded: (expanded: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  setFocusMode: (mode: FocusMode) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  openCockpit: (findingId: string) => void;
  closeCockpit: () => void;
  setPaneSizes: (key: string, sizes: number[]) => void;
  toggleTimeline: () => void;
  setSidebarSection: (section: string | null) => void;
  setLastVisitedRoute: (route: string) => void;
}

const DEFAULTS = {
  railExpanded: true,
  commandPaletteOpen: false,
  focusMode: "none" as FocusMode,
  activeInspectorTab: "dom" as InspectorTab,
  cockpitFindingId: null,
  paneSizes: {} as Record<string, number[]>,
  timelineCollapsed: false,
  sidebarSection: null,
  lastVisitedRoute: "/",
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      ...DEFAULTS,

      toggleRail: () => set((s) => ({ railExpanded: !s.railExpanded })),
      setRailExpanded: (railExpanded) => set({ railExpanded }),

      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),
      toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),

      setFocusMode: (focusMode) => set({ focusMode }),
      setInspectorTab: (activeInspectorTab) => set({ activeInspectorTab }),

      openCockpit: (cockpitFindingId) => set({ cockpitFindingId }),
      closeCockpit: () => set({ cockpitFindingId: null }),

      setPaneSizes: (key, sizes) => set((s) => ({ paneSizes: { ...s.paneSizes, [key]: sizes } })),

      toggleTimeline: () => set((s) => ({ timelineCollapsed: !s.timelineCollapsed })),
      setSidebarSection: (sidebarSection) => set({ sidebarSection }),
      setLastVisitedRoute: (lastVisitedRoute) => set({ lastVisitedRoute }),
    }),
    {
      name: "aether.ui.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (s) => ({
        railExpanded: s.railExpanded,
        activeInspectorTab: s.activeInspectorTab,
        paneSizes: s.paneSizes,
        timelineCollapsed: s.timelineCollapsed,
        sidebarSection: s.sidebarSection,
        lastVisitedRoute: s.lastVisitedRoute,
      }),
    },
  ),
);

/* --- narrow selectors ------------------------------------------------------ */
export const useRailExpanded = () => useUiStore((s) => s.railExpanded);
export const useCommandPaletteOpen = () => useUiStore((s) => s.commandPaletteOpen);
export const useFocusMode = () => useUiStore((s) => s.focusMode);
export const useInspectorTab = () => useUiStore((s) => s.activeInspectorTab);
export const useCockpitFindingId = () => useUiStore((s) => s.cockpitFindingId);
export const useTimelineCollapsed = () => useUiStore((s) => s.timelineCollapsed);
export const useSidebarSection = () => useUiStore((s) => s.sidebarSection);
export const useLastVisitedRoute = () => useUiStore((s) => s.lastVisitedRoute);
/** Sizes for one resizable group. `fallback` must be a module-level constant. */
export const usePaneSizes = (key: string, fallback?: number[]) =>
  useUiStore((s) => s.paneSizes[key] ?? fallback);

/** Non-reactive read for shortcut handlers and other non-React callers. */
export const readUi = () => useUiStore.getState();

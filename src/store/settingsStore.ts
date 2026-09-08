"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * WHERE THE APP GETS ITS DATA — the "one-click API change".
 *
 *  mock  : in-process fixtures, zero network. Default, works offline & in tests.
 *  http  : any REST backend at `httpBaseUrl`.
 *  tauri : Rust commands over Tauri IPC (the desktop backend).
 *
 * Switching is a single call: `useSettingsStore.getState().setApiMode('http')`.
 * `AppProviders` watches this field and clears the TanStack Query cache on
 * change, so every screen refetches from the new source with no reload.
 */
export type ApiMode = "mock" | "http" | "tauri";

export const API_MODES: { value: ApiMode; label: string; hint: string }[] = [
  { value: "mock", label: "Mock fixtures", hint: "In-process sample data. Offline, instant." },
  { value: "http", label: "REST API", hint: "Any HTTP backend that implements the contract." },
  { value: "tauri", label: "Tauri IPC", hint: "The bundled Rust desktop backend." },
];

export type AgentProvider = "claude-cli" | "anthropic-api" | "openai" | "local";
export type BrowserEngine = "chromium" | "firefox" | "webkit";
export type Density = "comfortable" | "compact";

export interface ApiSettings {
  mode: ApiMode;
  httpBaseUrl: string;
  /** Extra headers for the http adapter (auth token, tenant id, ...). */
  httpHeaders: Record<string, string>;
  /** Per-request timeout in ms. */
  timeoutMs: number;
  /** Retry count for idempotent GETs. */
  retries: number;
}

export interface AgentSettings {
  provider: AgentProvider;
  model: string;
  maxTokensPerTask: number;
  maxStepsPerTask: number;
  temperature: number;
  /** Actions that always require a human approval before execution. */
  approvalRequired: string[];
  autoApproveReadOnly: boolean;
}

export interface BrowserSettings {
  engine: BrowserEngine;
  headless: boolean;
  viewport: "desktop" | "tablet" | "mobile";
  throttle: "none" | "fast-3g" | "slow-3g";
  defaultTimeoutMs: number;
}

export interface PolicySettings {
  allowedDomains: string[];
  blockedDomains: string[];
  maxCrawlDepth: number;
  maxPagesPerScan: number;
  respectRobotsTxt: boolean;
  redactSecrets: boolean;
}

export interface AppearanceSettings {
  density: Density;
  reduceMotion: boolean;
  showAmbientEffects: boolean;
}

export interface SettingsState {
  api: ApiSettings;
  agent: AgentSettings;
  browser: BrowserSettings;
  policy: PolicySettings;
  appearance: AppearanceSettings;
  /** Bumped on every api-mode/base-url change so consumers can react. */
  apiRevision: number;

  setApiMode: (mode: ApiMode) => void;
  setHttpBaseUrl: (url: string) => void;
  patchApi: (patch: Partial<ApiSettings>) => void;
  patchAgent: (patch: Partial<AgentSettings>) => void;
  patchBrowser: (patch: Partial<BrowserSettings>) => void;
  patchPolicy: (patch: Partial<PolicySettings>) => void;
  patchAppearance: (patch: Partial<AppearanceSettings>) => void;
  reset: () => void;
}

const DEFAULTS = {
  api: {
    mode: "mock" as ApiMode,
    httpBaseUrl: "http://localhost:8787/api",
    httpHeaders: {},
    timeoutMs: 15_000,
    retries: 1,
  },
  agent: {
    provider: "claude-cli" as AgentProvider,
    model: "claude-opus-5",
    maxTokensPerTask: 250_000,
    maxStepsPerTask: 120,
    temperature: 0.2,
    approvalRequired: ["payment.submit", "data.delete", "auth.credentials", "file.write"],
    autoApproveReadOnly: true,
  },
  browser: {
    engine: "chromium" as BrowserEngine,
    headless: false,
    viewport: "desktop" as const,
    throttle: "none" as const,
    defaultTimeoutMs: 30_000,
  },
  policy: {
    allowedDomains: ["localhost", "127.0.0.1", "*.staging.internal"],
    blockedDomains: ["*.bank.com", "accounts.google.com"],
    maxCrawlDepth: 4,
    maxPagesPerScan: 120,
    respectRobotsTxt: true,
    redactSecrets: true,
  },
  appearance: {
    density: "compact" as Density,
    reduceMotion: false,
    showAmbientEffects: true,
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      apiRevision: 0,

      setApiMode: (mode) =>
        set((s) =>
          s.api.mode === mode
            ? s
            : { api: { ...s.api, mode }, apiRevision: s.apiRevision + 1 },
        ),

      setHttpBaseUrl: (httpBaseUrl) =>
        set((s) =>
          s.api.httpBaseUrl === httpBaseUrl
            ? s
            : { api: { ...s.api, httpBaseUrl }, apiRevision: s.apiRevision + 1 },
        ),

      patchApi: (patch) =>
        set((s) => ({ api: { ...s.api, ...patch }, apiRevision: s.apiRevision + 1 })),
      patchAgent: (patch) => set((s) => ({ agent: { ...s.agent, ...patch } })),
      patchBrowser: (patch) => set((s) => ({ browser: { ...s.browser, ...patch } })),
      patchPolicy: (patch) => set((s) => ({ policy: { ...s.policy, ...patch } })),
      patchAppearance: (patch) => set((s) => ({ appearance: { ...s.appearance, ...patch } })),

      reset: () => set((s) => ({ ...DEFAULTS, apiRevision: s.apiRevision + 1 })),
    }),
    {
      name: "aether.settings.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Never persist derived state.
      partialize: ({ apiRevision: _ignored, ...rest }) => rest,
    },
  ),
);

/* --- narrow selectors: components subscribe to a field, never the store ---- */
export const useApiMode = () => useSettingsStore((s) => s.api.mode);
export const useApiRevision = () => useSettingsStore((s) => s.apiRevision);
export const useHttpBaseUrl = () => useSettingsStore((s) => s.api.httpBaseUrl);
export const useAgentSettings = () => useSettingsStore((s) => s.agent);
export const useBrowserSettings = () => useSettingsStore((s) => s.browser);
export const usePolicySettings = () => useSettingsStore((s) => s.policy);
export const useAppearance = () => useSettingsStore((s) => s.appearance);
export const useDensity = () => useSettingsStore((s) => s.appearance.density);

/** Non-reactive read for adapters and other non-React callers. */
export const readApiSettings = () => useSettingsStore.getState().api;

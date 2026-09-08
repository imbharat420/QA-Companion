import type { ApiMode } from "@/store/settingsStore";
import { readApiSettings, useSettingsStore } from "@/store/settingsStore";
import type { DataSource } from "./contract";
import { mockDataSource } from "./mock";
import { createHttpDataSource } from "./http";
import { createTauriDataSource } from "./tauri";

/**
 * THE ADAPTER REGISTRY — the one-click API switch.
 *
 * `getDataSource()` resolves the adapter for whatever mode the settings store
 * currently holds. Adapters are memoised per configuration so we don't rebuild
 * an http client on every query, and the memo key includes the base URL so
 * pointing at a different backend really does produce a different client.
 *
 * To change where the whole app reads from:
 *     useSettingsStore.getState().setApiMode("http")
 * `AppProviders` sees the resulting `apiRevision` bump, clears the query cache,
 * and every mounted screen refetches. No reload, no page-level changes.
 */

const cache = new Map<string, DataSource>();

function build(mode: ApiMode): DataSource {
  const api = readApiSettings();
  const key = `${mode}::${api.httpBaseUrl}::${api.timeoutMs}::${JSON.stringify(api.httpHeaders)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const built: DataSource =
    mode === "http"
      ? createHttpDataSource({
          baseUrl: api.httpBaseUrl,
          headers: api.httpHeaders,
          timeoutMs: api.timeoutMs,
          retries: api.retries,
        })
      : mode === "tauri"
        ? createTauriDataSource()
        : mockDataSource;

  cache.set(key, built);
  return built;
}

/** Resolve the live adapter. Safe to call from render, effects or event handlers. */
export function getDataSource(): DataSource {
  return build(readApiSettings().mode);
}

/** Explicit override — used by the Settings "Test connection" button. */
export function getDataSourceFor(mode: ApiMode): DataSource {
  return build(mode);
}

/**
 * Flip the whole app to a different source. This is the single entry point the
 * Settings UI calls; the cache-clearing half lives in AppProviders.
 */
export function setApiMode(mode: ApiMode) {
  useSettingsStore.getState().setApiMode(mode);
}

/** Drop memoised adapters — call after editing credentials or the base URL. */
export function resetDataSourceCache() {
  cache.clear();
}

export type { DataSource } from "./contract";
export { ApiError } from "./contract";
export * from "./types";

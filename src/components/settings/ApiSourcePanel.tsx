"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Cable,
  CheckCircle2,
  CircleHelp,
  Database,
  MonitorOff,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge, Button, Input, RadioGroup, RadioGroupItem, Spinner } from "@/components/ui";
import { ErrorState, StatusBadge } from "@/components/shared";
import { getDataSourceFor, resetDataSourceCache } from "@/lib/api";
import { isTauri } from "@/lib/api/tauri";
import { API_MODES, useSettingsStore, type ApiMode } from "@/store/settingsStore";
import { routes } from "@/config/nav";
import { cn, formatDuration } from "@/lib/utils";
import { NumberField, SettingsField, SettingsSection } from "./SettingsSection";

/** Which adapter serves the app's resources in each mode — the explainer copy. */
const ADAPTER_NOTE: Record<ApiMode, string> = {
  mock: "src/lib/fixtures serves every resource in-process. No network, works offline and in tests.",
  http: "One fetch per DataSource method against the base URL below, with your headers, timeout and retries.",
  tauri: "One Tauri invoke() per DataSource method, hitting the bundled Rust store over IPC.",
};

type Probe = { ok: boolean; latencyMs: number; detail: string };
type HeaderRow = { key: string; value: string };

const toRows = (headers: Record<string, string>): HeaderRow[] =>
  Object.entries(headers).map(([key, value]) => ({ key, value }));

const toHeaders = (rows: HeaderRow[]): Record<string, string> =>
  Object.fromEntries(rows.filter((r) => r.key.trim() !== "").map((r) => [r.key.trim(), r.value]));

/**
 * THE ONE-CLICK API SWITCH, front half.
 *
 * Picking a card writes `setApiMode` straight away — there is no Save step. The
 * store bumps `apiRevision`, AppProviders drops the query cache, and every
 * mounted screen refetches from the new adapter. This panel's only other job is
 * the http configuration and the health probe, which is the single documented
 * place a page is allowed to touch an adapter directly: it must probe a source
 * that is not live yet.
 */
export function ApiSourcePanel() {
  const api = useSettingsStore((s) => s.api);
  const setApiMode = useSettingsStore((s) => s.setApiMode);
  const setHttpBaseUrl = useSettingsStore((s) => s.setHttpBaseUrl);
  const patchApi = useSettingsStore((s) => s.patchApi);

  const [tauriReady, setTauriReady] = useState(false);
  const [baseUrlDraft, setBaseUrlDraft] = useState(api.httpBaseUrl);
  const [rows, setRows] = useState<HeaderRow[]>(() => toRows(api.httpHeaders));
  const [probing, setProbing] = useState(false);
  const [probedMode, setProbedMode] = useState<ApiMode | null>(null);
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probeError, setProbeError] = useState<unknown>(null);

  // `isTauri()` reads `window`, so it can only be trusted after mount.
  useEffect(() => setTauriReady(isTauri()), []);
  useEffect(() => setBaseUrlDraft(api.httpBaseUrl), [api.httpBaseUrl]);

  const commitBaseUrl = useCallback(() => {
    const next = baseUrlDraft.trim();
    if (next === "" || next === api.httpBaseUrl) {
      setBaseUrlDraft(api.httpBaseUrl);
      return;
    }
    setHttpBaseUrl(next);
    // The memo key covers the URL, but a stale client for the old URL has no
    // reason to stay resident once the user has retargeted the backend.
    resetDataSourceCache();
  }, [api.httpBaseUrl, baseUrlDraft, setHttpBaseUrl]);

  const commitHeaders = useCallback(
    (next: HeaderRow[]) => {
      setRows(next);
      patchApi({ httpHeaders: toHeaders(next) });
      resetDataSourceCache();
    },
    [patchApi],
  );

  const selectMode = useCallback(
    (value: string) => {
      const mode = value as ApiMode;
      if (mode === api.mode) return;
      setApiMode(mode);
      setProbedMode(null);
      setProbe(null);
      setProbeError(null);
      toast.success(`Data source → ${API_MODES.find((m) => m.value === mode)?.label ?? mode}`, {
        description: "Cached responses were dropped; every open screen is refetching from the new adapter.",
      });
    },
    [api.mode, setApiMode],
  );

  const testConnection = useCallback(async () => {
    // Probe what is on screen, not what was last committed.
    commitBaseUrl();
    const mode = api.mode;
    setProbing(true);
    setProbedMode(mode);
    setProbe(null);
    setProbeError(null);
    try {
      setProbe(await getDataSourceFor(mode).health());
    } catch (error) {
      setProbeError(error);
    } finally {
      setProbing(false);
    }
  }, [api.mode, commitBaseUrl]);

  return (
    <div className="flex flex-col gap-3">
      <SettingsSection
        title="Data source"
        description="One click switches where the whole app reads from. There is no save button — the switch is the click."
        icon={Database}
        testId="settings-api-section"
        actions={
          <Badge variant="primary" size="xs" data-testid="settings-api-active-mode">
            {api.mode}
          </Badge>
        }
      >
        <SettingsField
          label="Adapter"
          help="Selecting a card applies immediately and refetches every open screen."
          stacked
        >
          <RadioGroup
            value={api.mode}
            onValueChange={selectMode}
            aria-label="Data source adapter"
            data-testid="settings-api-mode-select"
            className="grid w-full gap-2 lg:grid-cols-3"
          >
            {API_MODES.map((mode) => {
              const blocked = mode.value === "tauri" && !tauriReady;
              const active = api.mode === mode.value;
              return (
                <label
                  key={mode.value}
                  htmlFor={`settings-api-mode-${mode.value}-input`}
                  className={cn(
                    "surface-inset flex cursor-pointer flex-col gap-2 p-3 transition-colors duration-150 ease-out",
                    active ? "border-primary/60 bg-primary/10" : "hover:border-border",
                    blocked && "cursor-not-allowed opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{mode.label}</span>
                    <RadioGroupItem
                      id={`settings-api-mode-${mode.value}-input`}
                      value={mode.value}
                      disabled={blocked}
                      data-testid={`settings-api-mode-${mode.value}`}
                    />
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{mode.hint}</p>
                  <Availability
                    mode={mode.value}
                    tauriReady={tauriReady}
                    probing={probing && probedMode === mode.value}
                    probe={probedMode === mode.value ? probe : null}
                    failed={probedMode === mode.value && probeError !== null}
                  />
                </label>
              );
            })}
          </RadioGroup>
        </SettingsField>

        {api.mode === "http" ? (
          <>
            <SettingsField
              label="Base URL"
              help="Every DataSource method is a path under this origin. Commits on blur."
              htmlFor="settings-api-base-url"
            >
              <Input
                id="settings-api-base-url"
                value={baseUrlDraft}
                onChange={(e) => setBaseUrlDraft(e.target.value)}
                onBlur={commitBaseUrl}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitBaseUrl();
                  }
                }}
                placeholder="http://localhost:8787/api"
                spellCheck={false}
                className="w-full text-code sm:w-[300px]"
                data-testid="settings-api-base-url"
              />
            </SettingsField>

            <SettingsField
              label="Headers"
              help="Sent on every request — auth token, tenant id, API version."
              stacked
            >
              <div className="flex w-full flex-col gap-2">
                {rows.length === 0 ? (
                  <p className="text-[11px] text-subtle-foreground" data-testid="settings-api-headers-empty">
                    No headers. The adapter sends only <span className="text-code">content-type</span>.
                  </p>
                ) : null}

                {rows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={row.key}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)),
                        )
                      }
                      onBlur={() => commitHeaders(rows)}
                      placeholder="authorization"
                      spellCheck={false}
                      aria-label={`Header ${i + 1} name`}
                      className="min-w-0 flex-1 text-code"
                      data-testid={`settings-api-header-key-${i}`}
                    />
                    <Input
                      value={row.value}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)),
                        )
                      }
                      onBlur={() => commitHeaders(rows)}
                      placeholder="Bearer …"
                      spellCheck={false}
                      aria-label={`Header ${i + 1} value`}
                      className="min-w-0 flex-1 text-code"
                      data-testid={`settings-api-header-value-${i}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove header ${row.key || i + 1}`}
                      onClick={() => commitHeaders(rows.filter((_, j) => j !== i))}
                      data-testid={`settings-api-header-remove-${i}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="xs"
                  className="self-start"
                  onClick={() => setRows((prev) => [...prev, { key: "", value: "" }])}
                  data-testid="settings-api-header-add"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Add header
                </Button>
              </div>
            </SettingsField>

            <SettingsField
              label="Timeout"
              help="Per-request abort. A slow backend fails as an ApiError instead of hanging a screen."
              htmlFor="settings-api-timeout"
            >
              <NumberField
                id="settings-api-timeout"
                value={api.timeoutMs}
                min={500}
                max={120_000}
                step={500}
                suffix="ms"
                onCommit={(timeoutMs) => {
                  patchApi({ timeoutMs });
                  resetDataSourceCache();
                }}
                testId="settings-api-timeout"
              />
            </SettingsField>

            <SettingsField
              label="Retries"
              help="Applied to idempotent GETs only, so a retry can never double-submit."
              htmlFor="settings-api-retries"
            >
              <NumberField
                id="settings-api-retries"
                value={api.retries}
                min={0}
                max={5}
                onCommit={(retries) => {
                  patchApi({ retries });
                  resetDataSourceCache();
                }}
                testId="settings-api-retries"
              />
            </SettingsField>
          </>
        ) : null}

        <SettingsField
          label="Test connection"
          help={`Probes ${api.mode} with a health round-trip before you trust it with a run.`}
          stacked
        >
          <div className="flex w-full flex-col gap-2">
            <Button
              variant="primary"
              onClick={testConnection}
              loading={probing}
              disabled={probing}
              data-testid="settings-api-test-connection"
            >
              <Cable className="size-3.5" aria-hidden />
              Test connection
            </Button>

            {probing ? (
              <p
                className="flex items-center gap-2 text-[11px] text-muted-foreground"
                data-testid="settings-api-probe-loading"
              >
                <Spinner size="xs" />
                Probing {api.mode}…
              </p>
            ) : null}

            {!probing && probe ? (
              <div
                className={cn(
                  "surface-inset flex flex-wrap items-center gap-2 px-3 py-2",
                  probe.ok ? "border-success/40" : "border-error/40",
                )}
                data-testid="settings-api-probe-result"
                data-ok={probe.ok}
              >
                <StatusBadge status={probe.ok ? "passed" : "failed"} size="xs" />
                <span className="text-[11px] text-foreground">
                  {probedMode} · {formatDuration(probe.latencyMs)}
                </span>
                <span className="text-code text-muted-foreground">{probe.detail}</span>
              </div>
            ) : null}

            {!probing && probeError !== null ? (
              <div className="surface-inset border-error/40" data-testid="settings-api-probe-error">
                <ErrorState
                  error={probeError}
                  onRetry={testConnection}
                  testId="settings-api-probe-error-state"
                />
                <p className="px-4 pb-4 text-center text-[11px] text-muted-foreground">
                  Still failing? Read from{" "}
                  <button
                    type="button"
                    onClick={() => selectMode("mock")}
                    className="text-primary underline-offset-2 hover:underline"
                    data-testid="settings-api-fallback-mock"
                  >
                    mock fixtures
                  </button>{" "}
                  meanwhile, or go back to{" "}
                  <Link
                    href={routes.findings()}
                    className="text-primary underline-offset-2 hover:underline"
                    data-testid="settings-api-probe-error-findings"
                  >
                    findings
                  </Link>
                  .
                </p>
              </div>
            ) : null}
          </div>
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title="What this changes"
        description="Pages read through @/lib/queries, never an adapter, which is what makes the swap live."
        icon={CircleHelp}
        testId="settings-api-explainer"
      >
        <div className="flex flex-col gap-2 px-4 py-3.5">
          {API_MODES.map((mode) => (
            <div key={mode.value} className="flex flex-col gap-1 sm:flex-row sm:gap-3">
              <Badge
                variant={api.mode === mode.value ? "primary" : "outline"}
                size="xs"
                className="w-fit shrink-0"
              >
                {mode.value}
              </Badge>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {ADAPTER_NOTE[mode.value]}
              </p>
            </div>
          ))}
          <p className="mt-1 border-t border-border/60 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            Every resource — projects, suites, cases, runs, findings, scripts, agent events — moves
            together: the adapter is resolved per call, query keys are namespaced by mode so two
            sources can never share a cache entry, and no reload is needed.
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}

function Availability({
  mode,
  tauriReady,
  probing,
  probe,
  failed,
}: {
  mode: ApiMode;
  tauriReady: boolean;
  probing: boolean;
  probe: Probe | null;
  failed: boolean;
}) {
  if (probing) {
    return (
      <span
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        data-testid={`settings-api-availability-${mode}`}
      >
        <Spinner size="xs" />
        Probing…
      </span>
    );
  }

  if (failed || (probe && !probe.ok)) {
    return (
      <span
        className="flex items-center gap-1.5 text-[11px] text-error"
        data-testid={`settings-api-availability-${mode}`}
        data-available="false"
      >
        <XCircle className="size-3.5" aria-hidden />
        Unreachable
      </span>
    );
  }

  if (probe?.ok) {
    return (
      <span
        className="flex items-center gap-1.5 text-[11px] text-success"
        data-testid={`settings-api-availability-${mode}`}
        data-available="true"
      >
        <CheckCircle2 className="size-3.5" aria-hidden />
        Reachable · {formatDuration(probe.latencyMs)}
      </span>
    );
  }

  if (mode === "mock") {
    return (
      <span
        className="flex items-center gap-1.5 text-[11px] text-success"
        data-testid="settings-api-availability-mock"
        data-available="true"
      >
        <CheckCircle2 className="size-3.5" aria-hidden />
        Always available
      </span>
    );
  }

  if (mode === "tauri" && !tauriReady) {
    return (
      <span
        className="flex items-center gap-1.5 text-[11px] text-waiting"
        data-testid="settings-api-availability-tauri"
        data-available="false"
      >
        <MonitorOff className="size-3.5" aria-hidden />
        Browser session — no Rust backend to talk to
      </span>
    );
  }

  return (
    <span
      className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
      data-testid={`settings-api-availability-${mode}`}
      data-available="unknown"
    >
      <CircleHelp className="size-3.5" aria-hidden />
      Untested — run Test connection
    </span>
  );
}

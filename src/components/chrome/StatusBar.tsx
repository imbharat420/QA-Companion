"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Chrome, Database, GitBranch, ShieldAlert, Zap } from "lucide-react";
import { routes } from "@/config/nav";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { useAgentRunning, useAgentStore } from "@/store/agentStore";
import { useApiMode, useBrowserSettings, useSettingsStore } from "@/store/settingsStore";
import { API_MODES } from "@/store/settingsStore";
import { useProjectsStore } from "@/store/projectsStore";
import { useProjects } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * 26px of always-visible truth: which branch, which engine, where the data is
 * coming from, and a kill switch that is never more than one click away.
 */
export function StatusBar() {
  const apiMode = useApiMode();
  const engine = useBrowserSettings().engine;
  const running = useAgentRunning();
  const stopTask = useAgentStore((s) => s.stopTask);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const { data: projects } = useProjects();

  const project = projects?.items.find((p) => p.id === activeProjectId) ?? projects?.items[0];
  const source = API_MODES.find((m) => m.value === apiMode);

  return (
    <footer
      data-testid="statusbar"
      className="flex h-[var(--statusbar-h)] shrink-0 items-center gap-3 border-t border-border bg-chrome px-3 text-[10px] text-chrome-foreground"
    >
      <span className="flex items-center gap-1.5" data-testid="statusbar-git-branch">
        <GitBranch className="size-3" aria-hidden />
        <span className="text-code">{project?.branch ?? "no branch"}</span>
      </span>

      <span aria-hidden className="h-3 w-px bg-border" />

      {/* The data source is the single most useful thing to keep visible while
          the API-mode switch exists — clicking it jumps straight to the switch. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={routes.settings({ tab: "api" })}
            className="flex items-center gap-1.5 rounded px-1 hover:text-foreground"
            data-testid="statusbar-data-source"
          >
            <Database className="size-3" aria-hidden />
            <span className="text-code uppercase">{apiMode}</span>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="top">
          Data source: {source?.label}. {source?.hint} Click to change.
        </TooltipContent>
      </Tooltip>

      <span aria-hidden className="h-3 w-px bg-border" />

      <span className="flex items-center gap-1.5" data-testid="statusbar-engine-badge">
        <Chrome className="size-3" aria-hidden />
        <span className="text-code capitalize">{engine}</span>
      </span>

      <Latency />

      <div className="flex-1" />

      {running ? (
        <button
          type="button"
          onClick={stopTask}
          data-testid="kill-switch"
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/12 px-2 py-0.5",
            "font-mono text-[10px] font-semibold uppercase tracking-wide text-destructive",
            "hover:bg-destructive hover:text-destructive-foreground transition-colors",
          )}
        >
          <ShieldAlert className="size-3" aria-hidden />
          Stop agent
        </button>
      ) : null}

      <SessionId />
    </footer>
  );
}

/**
 * Real measured round-trip to the live adapter rather than a decorative number —
 * it is the fastest way to notice that a REST base URL is wrong.
 */
function Latency() {
  const apiRevision = useSettingsStore((s) => s.apiRevision);
  const apiMode = useApiMode();
  const [latency, setLatency] = useState<number | null>(null);
  const [ok, setOk] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const { getDataSource } = await import("@/lib/api");
      try {
        const result = await getDataSource().health();
        if (cancelled) return;
        setLatency(Math.round(result.latencyMs));
        setOk(result.ok);
      } catch {
        if (cancelled) return;
        setLatency(null);
        setOk(false);
      }
    };
    void ping();
    const timer = window.setInterval(ping, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apiMode, apiRevision]);

  return (
    <span className="flex items-center gap-1.5" data-testid="statusbar-ping">
      <Activity className={cn("size-3", ok ? "text-success" : "text-destructive")} aria-hidden />
      <span className="text-code">{latency === null ? "—" : `${latency}ms`}</span>
    </span>
  );
}

/** Session id is stable per app launch, so it is generated once on the client. */
function SessionId() {
  const [id, setId] = useState("");
  useEffect(() => {
    setId(Math.random().toString(16).slice(2, 6));
  }, []);

  return (
    <span className="flex items-center gap-1.5" data-testid="statusbar-session-id">
      <Zap className="size-3" aria-hidden />
      <span className="text-code">sess_{id || "…"}</span>
    </span>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Command, Minus, Moon, Square, Sun, X } from "lucide-react";
import { activeNavId, NAV_BY_ID, routes } from "@/config/nav";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/Tooltip";
import { AgentStatusPill } from "@/components/shared/AgentStatusPill";
import { useAgentStatus, useAgentTokens } from "@/store/agentStore";
import { useProjectsStore } from "@/store/projectsStore";
import { useUiStore } from "@/store/uiStore";
import { useAgentSettings } from "@/store/settingsStore";
import { useProjects } from "@/lib/queries";
import { cn, formatCompact } from "@/lib/utils";

/**
 * Frameless-window title bar. `decorations: false` in tauri.conf.json means we
 * own the drag region and the window buttons; in a plain browser the buttons
 * are hidden because there is no window to control.
 */
export function TitleBar() {
  const pathname = usePathname();
  const status = useAgentStatus();
  const tokens = useAgentTokens();
  const budget = useAgentSettings().maxTokensPerTask;
  const openPalette = useUiStore((s) => s.openCommandPalette);
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const setActiveProject = useProjectsStore((s) => s.setActiveProject);
  const { data: projects } = useProjects();

  const items = projects?.items ?? [];
  const activeProject = items.find((p) => p.id === activeProjectId) ?? items[0];
  const current = NAV_BY_ID[activeNavId(pathname)];
  const tokenRatio = budget > 0 ? Math.min(1, tokens / budget) : 0;

  return (
    <header
      data-testid="titlebar"
      className="drag-region flex h-[var(--titlebar-h)] shrink-0 items-center gap-2 border-b border-border bg-chrome pl-3 pr-1"
    >
      <Link
        href={routes.projects()}
        className="no-drag flex items-center gap-2 rounded-[var(--radius-sm)] px-1 py-0.5"
        data-testid="titlebar-home"
      >
        <span aria-hidden className="grid size-5 place-items-center rounded-[6px] bg-primary">
          <span className="font-display text-[11px] font-bold leading-none text-primary-foreground">
            A
          </span>
        </span>
        <span className="font-display text-xs font-semibold tracking-tight">Aether</span>
      </Link>

      <span aria-hidden className="h-4 w-px bg-border" />

      {/* Project switcher — the app's scope selector. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="xs"
            className="no-drag max-w-52"
            data-testid="titlebar-project-switcher"
          >
            <span className="truncate">{activeProject?.name ?? "No project"}</span>
            <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Switch project</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {items.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onSelect={() => setActiveProject(project.id)}
              data-testid={`titlebar-project-${project.id}`}
            >
              <span className="flex-1 truncate">{project.name}</span>
              <span className="label-mono text-[10px]">{project.framework}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={routes.projects()}>Browse all projects…</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Where you are — the title bar doubles as a breadcrumb. */}
      <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
        <span aria-hidden>/</span>
        <span>{current?.label}</span>
      </span>

      <div className="flex-1" />

      <AgentStatusPill status={status} />

      {/* Token budget — a QA agent that burns tokens invisibly is a support ticket. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="no-drag hidden items-center gap-1.5 rounded-full border border-border bg-elevated px-2 py-1 lg:flex"
            data-testid="titlebar-token-counter"
          >
            <span className="text-code text-[10px] text-muted-foreground">
              {formatCompact(tokens)}
            </span>
            <span aria-hidden className="flex gap-[2px]">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-2.5 w-[3px] rounded-full",
                    tokenRatio > i / 4 ? "bg-primary" : "bg-border",
                  )}
                />
              ))}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {formatCompact(tokens)} of {formatCompact(budget)} token budget used
        </TooltipContent>
      </Tooltip>

      <ThemeToggle />

      <Button
        variant="ghost"
        size="xs"
        onClick={openPalette}
        className="no-drag gap-1.5"
        data-testid="titlebar-command-launcher"
      >
        <Command className="size-3" aria-hidden />
        <Kbd value="⌘ K" />
      </Button>

      <WindowControls />
    </header>
  );
}

/**
 * Theme is a token swap (see globals.css), so this only flips the attribute
 * next-themes owns. We avoid `next-themes`' own hook here to keep the title bar
 * from re-rendering on unrelated theme-provider churn.
 */
function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("aether.theme");
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      window.localStorage.setItem("aether.theme", next);
      return next;
    });
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      className="no-drag"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      data-testid="titlebar-theme-toggle"
    >
      {theme === "dark" ? (
        <Moon className="size-3.5" aria-hidden />
      ) : (
        <Sun className="size-3.5" aria-hidden />
      )}
    </Button>
  );
}

/** Only rendered inside Tauri — a browser tab has no window to minimise. */
function WindowControls() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setIsDesktop(typeof window !== "undefined" && "__TAURI_INTERNALS__" in window);
  }, []);

  const act = useCallback(async (action: "minimize" | "toggleMaximize" | "close") => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      if (action === "minimize") await win.minimize();
      else if (action === "toggleMaximize") await win.toggleMaximize();
      else await win.close();
    } catch {
      // Not in Tauri, or the window API is unavailable — nothing to do.
    }
  }, []);

  if (!isDesktop) return null;

  return (
    <div className="no-drag ml-1 flex items-center">
      <button
        type="button"
        onClick={() => void act("minimize")}
        aria-label="Minimize window"
        data-testid="titlebar-minimize"
        className="grid h-[var(--titlebar-h)] w-11 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Minus className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => void act("toggleMaximize")}
        aria-label="Maximize window"
        data-testid="titlebar-maximize"
        className="grid h-[var(--titlebar-h)] w-11 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Square className="size-3" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => void act("close")}
        aria-label="Close window"
        data-testid="titlebar-close"
        className="grid h-[var(--titlebar-h)] w-11 place-items-center text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

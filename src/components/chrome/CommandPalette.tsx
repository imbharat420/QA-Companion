"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Circle, CornerDownLeft, Play, Search, Square, Sparkles } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS, routes } from "@/config/nav";
import { NAV_ICONS } from "./navIcons";
import { Kbd } from "@/components/ui/Kbd";
import { SeverityBadge } from "@/components/shared/SeverityBadge";
import { useUiStore } from "@/store/uiStore";
import { useAgentRunning, useAgentStore } from "@/store/agentStore";
import { useFindings, useRuns } from "@/lib/queries";
import { QUICK_ACTIONS } from "@/lib/fixtures/browser";
import { cn } from "@/lib/utils";

/**
 * ⌘K is the app's other navigation surface: every page, every open finding,
 * every recent run and every agent quick-action, in one keystroke.
 *
 * Data comes from the same query hooks the pages use, so the palette shows what
 * the live adapter actually has — not a hardcoded action list.
 */
export function CommandPalette() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandPaletteOpen);
  const close = useUiStore((s) => s.closeCommandPalette);
  const setFocusMode = useUiStore((s) => s.setFocusMode);
  const running = useAgentRunning();
  const startTask = useAgentStore((s) => s.startTask);
  const stopTask = useAgentStore((s) => s.stopTask);

  // Only fetch the lists while the palette is actually open.
  const { data: findings } = useFindings(open ? { status: "new", limit: 8 } : undefined);
  const { data: runs } = useRuns(open ? { limit: 6 } : undefined);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const run = useCallback(
    (fn: () => void) => {
      close();
      fn();
    },
    [close],
  );

  const groups = useMemo(
    () => NAV_GROUPS.map((g) => ({ ...g, items: NAV_ITEMS.filter((i) => i.group === g.id) })),
    [],
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => (next ? undefined : close())}
      label="Command palette"
      data-testid="command-palette"
      // cmdk renders its own portal, overlay and content wrapper — `className`
      // lands on the Command root, so the panel styling goes on contentClassName.
      overlayClassName="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      contentClassName={cn(
        "fixed left-1/2 top-[18vh] z-50 w-[min(640px,92vw)] -translate-x-1/2",
        "overflow-hidden rounded-[var(--radius-lg)] border border-border bg-popover shadow-2xl",
        "animate-rise",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Command.Input
          placeholder="Jump to a page, finding or run — or tell the agent what to test…"
          data-testid="command-palette-input"
          className="h-11 flex-1 bg-transparent text-[13px] outline-none placeholder:text-subtle-foreground"
        />
        <Kbd value="esc" />
      </div>

      <Command.List className="max-h-[52vh] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-xs text-muted-foreground">
          Nothing matches. Try a page name, a finding id, or describe a test.
        </Command.Empty>

        <Command.Group heading="Agent" className="cmd-group">
          {QUICK_ACTIONS.map((action) => (
            <Command.Item
              key={action.slug}
              value={`agent ${action.label} ${action.prompt}`}
              onSelect={() => run(() => void startTask({ prompt: action.prompt, mode: action.slug }))}
              data-testid={`command-quick-action-${action.slug}`}
              className="cmd-item"
            >
              <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="flex-1 truncate">{action.label}</span>
              <span className="label-mono text-[10px]">agent</span>
            </Command.Item>
          ))}
          {running ? (
            <Command.Item
              value="stop agent kill"
              onSelect={() => run(stopTask)}
              data-testid="command-stop-agent"
              className="cmd-item"
            >
              <Square className="size-3.5 shrink-0 text-destructive" aria-hidden />
              <span className="flex-1">Stop the running agent</span>
            </Command.Item>
          ) : (
            <Command.Item
              value="open workbench run"
              onSelect={() => go(routes.workbench())}
              data-testid="command-open-workbench"
              className="cmd-item"
            >
              <Play className="size-3.5 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">Open the live workbench</span>
            </Command.Item>
          )}
        </Command.Group>

        {groups.map((group) => (
          <Command.Group key={group.id} heading={group.label} className="cmd-group">
            {group.items.map((item) => {
              const Icon = NAV_ICONS[item.icon] ?? Circle;
              return (
                <Command.Item
                  key={item.id}
                  value={`${item.label} ${item.description}`}
                  onSelect={() => go(item.href)}
                  data-testid={`command-nav-${item.id}`}
                  className="cmd-item"
                >
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.shortcut ? <Kbd value={item.shortcut} /> : null}
                </Command.Item>
              );
            })}
          </Command.Group>
        ))}

        {findings?.items.length ? (
          <Command.Group heading="Open findings" className="cmd-group">
            {findings.items.map((finding) => (
              <Command.Item
                key={finding.id}
                value={`${finding.id} ${finding.title} ${finding.category}`}
                onSelect={() => go(routes.finding(finding.id))}
                data-testid={`command-finding-${finding.id}`}
                className="cmd-item"
              >
                <SeverityBadge severity={finding.severity} size="xs" showLabel={false} />
                <span className="flex-1 truncate">{finding.title}</span>
                <span className="text-code text-[10px] text-muted-foreground">{finding.id}</span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        {runs?.items.length ? (
          <Command.Group heading="Recent runs" className="cmd-group">
            {runs.items.map((testRun) => (
              <Command.Item
                key={testRun.id}
                value={`${testRun.id} ${testRun.name} ${testRun.branch}`}
                onSelect={() => go(routes.run(testRun.id))}
                data-testid={`command-run-${testRun.id}`}
                className="cmd-item"
              >
                <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1 truncate">{testRun.name}</span>
                <span className="text-code text-[10px] text-muted-foreground">
                  {testRun.passed}/{testRun.passed + testRun.failed}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        ) : null}

        <Command.Group heading="View" className="cmd-group">
          {(["none", "chat", "browser", "inspector", "findings"] as const).map((mode) => (
            <Command.Item
              key={mode}
              value={`focus ${mode} layout`}
              onSelect={() => run(() => setFocusMode(mode))}
              data-testid={`command-focus-${mode}`}
              className="cmd-item"
            >
              <span className="flex-1 capitalize">
                {mode === "none" ? "Reset layout" : `Focus ${mode}`}
              </span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

import { useState } from "react";
import { ChevronDown, Command, Bell, Cpu, FolderGit2, Check } from "lucide-react";
import { useAgent, type AgentStatus } from "@/lib/agentContext";
import { WORKSPACES } from "@/lib/mockData";
import { toast } from "sonner";

const STATUS_STYLE: Record<AgentStatus, { label: string; cls: string; dot: string }> = {
  idle: { label: "Idle", cls: "text-zinc-400 border-white/10", dot: "bg-zinc-500" },
  thinking: { label: "Thinking", cls: "text-violet-300 border-violet-400/30 bg-violet-400/10", dot: "bg-violet-400 animate-pulse-soft" },
  planning: { label: "Planning", cls: "text-blue-300 border-blue-400/30 bg-blue-400/10", dot: "bg-blue-400 animate-pulse-soft" },
  executing: { label: "Executing", cls: "text-cyan-300 border-cyan-400/30 bg-cyan-400/10", dot: "bg-cyan-400 animate-pulse-soft" },
  waiting: { label: "Needs approval", cls: "text-amber-300 border-amber-400/30 bg-amber-400/10", dot: "bg-amber-400 animate-pulse-soft" },
  completed: { label: "Completed", cls: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", dot: "bg-emerald-400" },
  stopped: { label: "Stopped", cls: "text-red-300 border-red-400/30 bg-red-400/10", dot: "bg-red-400" },
};

function ProjectSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(WORKSPACES[0]);
  return (
    <div className="relative">
      <button
        data-testid="project-switcher-button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-white/5"
      >
        <FolderGit2 className="size-3.5 text-cyan-300" />
        {current.name}
        <ChevronDown className={`size-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div data-testid="project-switcher-menu" className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-white/10 bg-popover p-1 shadow-2xl shadow-black/60">
            {WORKSPACES.map((w) => (
              <button
                key={w.id}
                data-testid={`project-option-${w.name}`}
                onClick={() => { setCurrent(w); setOpen(false); toast.success(`Workspace switched → ${w.name}`); }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
              >
                <span>
                  <span className="block font-mono text-[11px] text-foreground">{w.name}</span>
                  <span className="block text-[10px] text-muted-foreground">{w.path}</span>
                </span>
                {w.id === current.id && <Check className="size-3.5 text-cyan-300" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TitleBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { status, tokens, sessionId } = useAgent();
  const s = STATUS_STYLE[status];
  return (
    <header data-testid="titlebar" className="flex h-9 shrink-0 items-center gap-3 border-b border-white/8 bg-[#0E1119] px-3 select-none">
      <div className="flex items-center gap-1.5" data-testid="window-controls">
        <span className="size-3 rounded-full bg-[#FF5F57] transition-transform hover:scale-110" />
        <span className="size-3 rounded-full bg-[#FEBC2E] transition-transform hover:scale-110" />
        <span className="size-3 rounded-full bg-[#28C840] transition-transform hover:scale-110" />
      </div>
      <div className="flex items-center gap-2 border-l border-white/10 pl-3">
        <span className="flex size-4 items-center justify-center rounded-[4px] bg-cyan-400 font-mono text-[9px] font-bold text-[#03252B]">Æ</span>
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground">AETHER</span>
      </div>
      <ProjectSwitcher />
      <div className="flex-1" />
      <div data-testid="agent-status-pill" className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${s.cls}`}>
        <span className={`size-1.5 rounded-full ${s.dot}`} />
        {s.label}
        <span className="font-mono text-[9px] opacity-60">{sessionId}</span>
      </div>
      <div data-testid="token-counter" className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
        <Cpu className="size-3 text-cyan-300" />
        {tokens.toLocaleString()} tok
      </div>
      <span className="rounded-md border border-white/10 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">Claude Sonnet 4.6</span>
      <button
        data-testid="command-palette-button"
        onClick={onOpenPalette}
        className="flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-cyan-400/40 hover:text-foreground"
      >
        <Command className="size-3" /> K
      </button>
      <button data-testid="notifications-button" className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground">
        <Bell className="size-3.5" />
        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-amber-400" />
      </button>
      <img
        src="https://images.unsplash.com/photo-1654110455429-cf322b40a906?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwxfHxkZXZlbG9wZXIlMjBhdmF0YXIlMjBoZWFkc2hvdCUyMHByb2ZpbGV8ZW58MHx8fHwxNzg4Nzc1MjIzfDA&ixlib=rb-4.1.0&q=85"
        alt="profile"
        data-testid="profile-avatar"
        className="size-5.5 rounded-full border border-white/15 object-cover"
      />
    </header>
  );
}

import { Bot, FlaskConical, Play, Bug, Settings as SettingsIcon, LayoutGrid } from "lucide-react";

export type View = "workbench" | "suites" | "runs" | "findings" | "settings";

const ITEMS: { id: View; label: string; icon: typeof Bot; badge?: string }[] = [
  { id: "workbench", label: "Agent", icon: Bot },
  { id: "suites", label: "Test Suites", icon: FlaskConical },
  { id: "runs", label: "Test Runs", icon: Play },
  { id: "findings", label: "Findings", icon: Bug, badge: "8" },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export function NavRail({ view, go, onOpenWorkspaces }: { view: View; go: (v: View) => void; onOpenWorkspaces: () => void }) {
  return (
    <nav data-testid="nav-rail" className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-white/8 bg-[#0E1119] py-2 select-none">
      <button
        data-testid="nav-workspaces"
        onClick={onOpenWorkspaces}
        className="group relative mb-2 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
      >
        <LayoutGrid className="size-4" />
        <Tip label="Workspaces" />
      </button>
      <div className="h-px w-6 bg-white/10" />
      <div className="mt-2 flex flex-col gap-1">
        {ITEMS.map((item) => {
          const active = view === item.id;
          return (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              onClick={() => go(item.id)}
              className={`group relative flex size-9 items-center justify-center rounded-lg transition-all ${
                active ? "bg-cyan-400/10 text-cyan-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              {active && <span className="absolute left-[-9px] h-5 w-[2px] rounded-full bg-cyan-400" />}
              <item.icon className="size-4" />
              {item.badge && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 font-mono text-[8px] font-bold text-white">
                  {item.badge}
                </span>
              )}
              <Tip label={item.label} />
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      <span className="mb-1 size-1.5 rounded-full bg-emerald-400 animate-pulse-soft" data-testid="nav-connection-dot" />
    </nav>
  );
}

function Tip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-full z-50 ml-3 origin-left scale-90 whitespace-nowrap rounded-md border border-white/10 bg-[#1A1E2B] px-2 py-1 text-[10px] text-foreground opacity-0 shadow-xl shadow-black/50 transition-all group-hover:scale-100 group-hover:opacity-100">
      {label}
    </span>
  );
}

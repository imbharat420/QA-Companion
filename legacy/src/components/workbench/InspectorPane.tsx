import { useState } from "react";
import { ChevronRight, X, AlertTriangle, Info, CircleX, Globe, Clock3, Tag } from "lucide-react";
import { useAgent, type TimelineEvent } from "@/lib/agentContext";
import { DOM_TREES, A11Y_TREES, type DomNode } from "@/lib/mockData";

type Tab = "elements" | "a11y" | "network" | "console";

function DomTreeNode({ n, depth, highlight }: { n: DomNode; depth: number; highlight: string | null }) {
  const [open, setOpen] = useState(true);
  const hot = n.id && n.id === highlight;
  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded py-[3px] pr-2 font-mono text-[10.5px] ${hot ? "bg-cyan-400/10 ring-1 ring-inset ring-cyan-400/40" : "hover:bg-white/[0.03]"}`}
        style={{ paddingLeft: depth * 14 + 6 }}
      >
        {n.children && n.children.length > 0 ? (
          <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-muted-foreground">
            <ChevronRight className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="text-cyan-300">&lt;{n.tag}</span>
        {n.attrs && <span className="truncate text-amber-200/70"> {n.attrs}</span>}
        <span className="text-cyan-300">&gt;</span>
        {hot && <span className="ml-auto rounded bg-cyan-400/20 px-1 text-[8px] text-cyan-200">target</span>}
      </div>
      {open && n.children?.map((c, i) => <DomTreeNode key={i} n={c} depth={depth + 1} highlight={highlight} />)}
    </div>
  );
}

export function InspectorPane({ selected, onClose }: { selected: TimelineEvent | null; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("elements");
  const { browser, network, logs } = useAgent();
  const tree = DOM_TREES[browser.page] ?? DOM_TREES.blank;
  const a11y = A11Y_TREES[browser.page] ?? [];
  const errCount = logs.filter((l) => l.level === "error").length;

  const TABS: { id: Tab; label: string; badge?: number }[] = [
    { id: "elements", label: "Elements" },
    { id: "a11y", label: "A11y" },
    { id: "network", label: "Network", badge: network.length },
    { id: "console", label: "Console", badge: errCount },
  ];

  return (
    <div className="flex h-full flex-col bg-[#0E1119]" data-testid="inspector-panel">
      <div className="flex h-9 shrink-0 items-center border-b border-white/8 px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            data-testid={`inspector-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-1 px-2.5 py-2 text-[10px] font-medium transition-colors ${tab === t.id ? "text-cyan-300" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`rounded-full px-1 font-mono text-[8px] ${t.id === "console" ? "bg-red-500/20 text-red-300" : "bg-white/10 text-muted-foreground"}`}>{t.badge}</span>
            )}
            {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-px bg-cyan-400" />}
          </button>
        ))}
      </div>

      {selected && (
        <div className="shrink-0 border-b border-cyan-400/20 bg-cyan-400/5 px-3 py-2.5" data-testid="inspector-event-banner">
          <div className="flex items-center gap-2">
            <Globe className="size-3 shrink-0 text-cyan-300" />
            <span className="text-[8px] font-semibold tracking-[.12em] text-cyan-200">SELECTED TRACE EVENT</span>
            <span className={`rounded px-1.5 py-0.5 font-mono text-[8px] uppercase ${selected.status === "fail" ? "bg-red-400/15 text-red-300" : selected.status === "warn" ? "bg-amber-400/15 text-amber-200" : "bg-emerald-400/15 text-emerald-300"}`}>{selected.status}</span>
            <button data-testid="inspector-event-close" onClick={onClose} className="ml-auto rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="size-3" /></button>
          </div>
          <p className="mt-2 text-[11px] font-medium text-foreground">{selected.label}</p>
          <p className="mt-1 break-words font-mono text-[9.5px] leading-relaxed text-foreground/75">{selected.detail}</p>
          <div className="mt-2 flex items-center gap-3 border-t border-white/8 pt-2 font-mono text-[8.5px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock3 className="size-3" /> {selected.ts}</span>
            <span className="flex items-center gap-1"><Tag className="size-3" /> {selected.kind}</span>
            <span>event #{selected.id}</span>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "elements" && (
          <div className="py-1.5" data-testid="inspector-dom-tree">
            <DomTreeNode n={tree} depth={0} highlight={browser.highlight} />
          </div>
        )}
        {tab === "a11y" && (
          <div className="space-y-px p-1.5" data-testid="inspector-a11y-tree">
            {a11y.length === 0 && <p className="p-3 text-[10px] text-muted-foreground">No accessibility tree yet — navigate the browser first.</p>}
            {a11y.map((n, i) => (
              <div key={i} className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-white/[0.03]">
                <span className="rounded border border-indigo-400/30 bg-indigo-400/10 px-1.5 py-0.5 font-mono text-[9px] text-indigo-300">{n.role}</span>
                <span className="truncate text-[10.5px] text-foreground/80">{n.name || "—"}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "network" && (
          <div className="p-1.5" data-testid="inspector-network-list">
            {network.length === 0 && <p className="p-3 text-[10px] text-muted-foreground">No requests captured yet.</p>}
            <div className="grid grid-cols-[44px_1fr_40px_44px] gap-2 border-b border-white/8 px-2 py-1 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">
              <span>Method</span>
              <span>URL</span>
              <span>Status</span>
              <span className="text-right">Time</span>
            </div>
            {network.map((n) => (
              <div key={n.id} className="grid grid-cols-[44px_1fr_40px_44px] items-center gap-2 rounded px-2 py-1.5 font-mono text-[10px] hover:bg-white/[0.03]">
                <span className="text-muted-foreground">{n.method}</span>
                <span className="truncate text-foreground/80">{n.url}</span>
                <span className={n.status < 300 ? "text-emerald-400" : n.status < 500 ? "text-amber-400" : "text-red-400"}>{n.status}</span>
                <span className="text-right text-muted-foreground">{n.ms}ms</span>
              </div>
            ))}
          </div>
        )}
        {tab === "console" && (
          <div className="space-y-px p-1.5" data-testid="inspector-console-list">
            {logs.length === 0 && <p className="p-3 text-[10px] text-muted-foreground">Console is clean.</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 rounded px-2 py-1.5 font-mono text-[10px] hover:bg-white/[0.03]">
                {l.level === "error" ? (
                  <CircleX className="mt-0.5 size-3 shrink-0 text-red-400" />
                ) : l.level === "warn" ? (
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-amber-400" />
                ) : (
                  <Info className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                )}
                <span className={l.level === "error" ? "text-red-300" : "text-foreground/75"}>{l.text}</span>
                <span className="ml-auto shrink-0 text-[8.5px] text-muted-foreground">{l.ts}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

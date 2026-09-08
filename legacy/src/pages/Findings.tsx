import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Wrench, RotateCcw, CircleCheck, Bug, Sparkles, GitCommitHorizontal } from "lucide-react";
import { FINDINGS, type Finding, type Severity } from "@/lib/mockData";
import { useAgent } from "@/lib/agentContext";
import type { View } from "@/components/chrome/NavRail";
import { toast } from "sonner";

const SEV: Record<Severity, string> = {
  critical: "border-red-500/50 bg-red-500/15 text-red-300",
  high: "border-orange-400/40 bg-orange-400/10 text-orange-300",
  medium: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  low: "border-sky-400/40 bg-sky-400/10 text-sky-300",
};

const FILTERS: ("all" | Severity)[] = ["all", "critical", "high", "medium", "low"];

export default function Findings({ go }: { go: (v: View) => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [sel, setSel] = useState<Finding | null>(null);
  const [fixedIds, setFixedIds] = useState<Set<string>>(new Set());
  const { runTask } = useAgent();

  const list = FINDINGS.filter((f) => filter === "all" || f.severity === filter);

  const applyFix = (f: Finding) => {
    setFixedIds((s) => new Set(s).add(f.id));
    toast.success(`Fix applied for ${f.id} — regression run queued`);
  };

  return (
    <div className="relative h-full overflow-hidden bg-background" data-testid="findings-page">
      <div className="h-full overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          <p className="mb-1 font-mono text-[10px] tracking-[0.25em] text-cyan-300">BUG INTELLIGENCE</p>
          <h1 className="text-xl font-semibold tracking-tight">Findings Inbox</h1>
          <p className="mt-1 text-xs text-muted-foreground">{FINDINGS.length} open findings · AI-correlated, deduplicated, evidence-backed</p>

          <div className="mb-4 mt-5 flex gap-1.5" data-testid="findings-filters">
            {FILTERS.map((f) => (
              <button
                key={f}
                data-testid={`filter-${f}`}
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-[10px] font-medium capitalize transition-all ${
                  filter === f ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-muted-foreground hover:border-white/25 hover:text-foreground"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-white/10">
            {list.map((f, i) => {
              const fixed = fixedIds.has(f.id) || f.status === "fixed";
              return (
                <motion.button
                  key={f.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  data-testid={`finding-row-${f.id.toLowerCase()}`}
                  onClick={() => setSel(f)}
                  className={`flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors last:border-0 ${sel?.id === f.id ? "bg-cyan-400/5" : "bg-[#0E1119] hover:bg-white/[0.02]"}`}
                >
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase ${SEV[f.severity]}`}>{f.severity}</span>
                  <span className="w-20 shrink-0 font-mono text-[10px] text-cyan-300">{f.id}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs ${fixed ? "text-muted-foreground line-through" : "text-foreground"}`}>{f.title}</span>
                    <span className="block font-mono text-[9px] text-muted-foreground">{f.url} · {f.category}</span>
                  </span>
                  {fixed ? (
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400"><CircleCheck className="size-3" /> fixed</span>
                  ) : (
                    <span className="font-mono text-[10px] text-muted-foreground">{f.confidence}%</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {sel && (
          <motion.aside
            initial={{ x: 480 }}
            animate={{ x: 0 }}
            exit={{ x: 480 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="absolute bottom-0 right-0 top-0 z-30 flex w-[480px] flex-col border-l border-white/12 bg-[#0E1119] shadow-2xl shadow-black/60"
            data-testid="finding-cockpit"
          >
            <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
              <Bug className="size-4 text-red-400" />
              <span className="font-mono text-xs font-semibold text-cyan-300">{sel.id}</span>
              <span className={`rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase ${SEV[sel.severity]}`}>{sel.severity}</span>
              <span className="ml-auto font-mono text-[9px] text-muted-foreground">{sel.confidence}% confidence</span>
              <button data-testid="cockpit-close" onClick={() => setSel(null)} className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{sel.title}</h2>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{sel.url} · {sel.element}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                  <p className="mb-1 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">Expected</p>
                  <p className="font-mono text-[10px] text-emerald-300">{sel.expected}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-2.5">
                  <p className="mb-1 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">Actual</p>
                  <p className="font-mono text-[10px] text-red-300">{sel.actual}</p>
                </div>
              </div>

              <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/5 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-wider text-cyan-300">
                  <Sparkles className="size-3" /> AI root cause
                </p>
                <p className="text-[11px] leading-relaxed text-foreground/85">{sel.rca}</p>
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
                  <GitCommitHorizontal className="size-3" /> introduced in {sel.commit} · {sel.relatedTests} related tests
                </p>
              </div>

              <div>
                <p className="mb-1.5 font-mono text-[8.5px] uppercase tracking-wider text-muted-foreground">Suggested fix</p>
                <pre data-testid="cockpit-fix-diff" className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[10px] leading-relaxed">
                  {sel.fix.split("\n").map((l, i) => (
                    <span key={i} className={`block ${l.startsWith("+") ? "text-emerald-300" : l.startsWith("-") ? "text-red-300/80" : "text-foreground/70"}`}>
                      {l}
                    </span>
                  ))}
                </pre>
              </div>
            </div>

            <div className="flex gap-2 border-t border-white/8 p-3">
              <button
                data-testid="cockpit-apply-fix"
                onClick={() => applyFix(sel)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-500 px-3 py-2 text-[11px] font-semibold text-emerald-950 transition-all hover:bg-emerald-400 active:scale-[0.98]"
              >
                <Wrench className="size-3.5" /> Apply fix
              </button>
              <button
                data-testid="cockpit-reproduce"
                onClick={() => {
                  runTask(`Reproduce ${sel.id}: ${sel.title}`);
                  go("workbench");
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-cyan-400/40 px-3 py-2 text-[11px] font-medium text-cyan-300 transition-all hover:bg-cyan-400/10 active:scale-[0.98]"
              >
                <RotateCcw className="size-3.5" /> Reproduce
              </button>
              <button
                data-testid="cockpit-dismiss"
                onClick={() => setSel(null)}
                className="rounded-md border border-white/15 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

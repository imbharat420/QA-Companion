import { useState } from "react";
import { motion } from "motion/react";
import { CircleCheck, CircleX, TriangleAlert, Minus, ChevronRight, Wrench, GitCommitHorizontal } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { RUNS, TREND, type TestRun } from "@/lib/mockData";
import { toast } from "sonner";

const TONE: Record<string, string> = {
  cyan: "border-cyan-400/30 bg-cyan-400/5 text-cyan-300",
  amber: "border-amber-400/30 bg-amber-400/5 text-amber-300",
  red: "border-red-400/30 bg-red-400/5 text-red-300",
};

const T_ICON = {
  passed: <CircleCheck className="size-3 text-emerald-400" />,
  failed: <CircleX className="size-3 text-red-400" />,
  flaky: <TriangleAlert className="size-3 text-amber-400" />,
  skipped: <Minus className="size-3 text-muted-foreground" />,
};

export default function TestRuns() {
  const [sel, setSel] = useState<TestRun>(RUNS[0]);

  return (
    <div className="h-full overflow-y-auto bg-background p-6" data-testid="test-runs-page">
      <div className="mx-auto max-w-6xl">
        <p className="mb-1 font-mono text-[10px] tracking-[0.25em] text-cyan-300">TESTING</p>
        <h1 className="text-xl font-semibold tracking-tight">Test Runs</h1>
        <p className="mt-1 text-xs text-muted-foreground">Live and historical executions with AI failure analysis</p>

        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            { label: "Passed", value: sel.passed, cls: "text-emerald-400 border-emerald-400/20" },
            { label: "Failed", value: sel.failed, cls: "text-red-400 border-red-400/20" },
            { label: "Flaky", value: sel.flaky, cls: "text-amber-400 border-amber-400/20" },
            { label: "Skipped", value: sel.skipped, cls: "text-muted-foreground border-white/10" },
          ].map((k) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} data-testid={`kpi-${k.label.toLowerCase()}`}
              className={`rounded-xl border bg-[#12151E] p-4 ${k.cls}`}>
              <p className="text-2xl font-bold tracking-tight">{k.value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{k.label} · {sel.id}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-[#12151E] p-4" data-testid="pass-rate-chart">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pass rate trend</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={TREND} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gPass" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00F2FE" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00F2FE" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="run" tick={{ fill: "#6B7280", fontSize: 9, fontFamily: "JetBrains Mono Variable" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B7280", fontSize: 9 }} axisLine={false} tickLine={false} domain={[50, 100]} />
                <Tooltip contentStyle={{ background: "#1A1E2B", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                <Area type="monotone" dataKey="pass" stroke="#00F2FE" strokeWidth={2} fill="url(#gPass)" />
                <Area type="monotone" dataKey="fail" stroke="#EF4444" strokeWidth={1.5} fill="transparent" strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_1.2fr] gap-4">
          <div className="overflow-hidden rounded-xl border border-white/10" data-testid="run-history-table">
            <div className="border-b border-white/8 bg-[#12151E] px-4 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">History</div>
            {RUNS.map((r) => (
              <button
                key={r.id}
                data-testid={`run-row-${r.id.slice(1)}`}
                onClick={() => setSel(r)}
                className={`flex w-full items-center gap-3 border-b border-white/5 px-4 py-2.5 text-left transition-colors last:border-0 ${sel.id === r.id ? "bg-cyan-400/5" : "bg-[#0E1119] hover:bg-white/[0.02]"}`}
              >
                <span className="font-mono text-[11px] font-semibold text-cyan-300">{r.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-foreground">{r.name}</span>
                  <span className="block font-mono text-[9px] text-muted-foreground">{r.branch} · {r.when}</span>
                </span>
                <span className="font-mono text-[10px] text-emerald-400">{r.passed}✓</span>
                <span className="font-mono text-[10px] text-red-400">{r.failed}✗</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0E1119] p-4" data-testid="run-detail-panel">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-foreground">{sel.id} · {sel.name}</p>
                <p className="font-mono text-[9px] text-muted-foreground">{sel.duration} · {sel.branch}</p>
              </div>
              <span className="rounded border border-white/10 px-2 py-0.5 font-mono text-[9px] text-muted-foreground">AI ANALYSIS</span>
            </div>
            {sel.groups.length > 0 ? (
              <>
                <p className="mb-2 text-[10px] text-muted-foreground">{sel.failed} failures → {sel.groups.length} root causes</p>
                <div className="space-y-2">
                  {sel.groups.map((g) => (
                    <div key={g.title} className={`flex items-center gap-3 rounded-lg border p-2.5 ${TONE[g.tone]}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold">{g.title} <span className="ml-1 font-mono text-[9px] opacity-70">{g.count} failures</span></p>
                        <p className="truncate text-[10px] opacity-80">{g.desc}</p>
                      </div>
                      <button
                        data-testid={`fix-group-${g.title.toLowerCase().replace(/\s+/g, "-")}`}
                        onClick={() => toast.success(`Agent is drafting fixes for "${g.title}"`)}
                        className="flex items-center gap-1 rounded-md border border-white/15 bg-black/20 px-2 py-1 text-[9px] font-medium text-foreground hover:border-cyan-400/40"
                      >
                        <Wrench className="size-3" /> Fix tests
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-1.5">
                  {sel.specs.map((sp) => (
                    <div key={sp.file} className="rounded-lg border border-white/8 bg-black/20">
                      <p className="flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] text-muted-foreground">
                        <ChevronRight className="size-3 rotate-90" />{sp.file}
                      </p>
                      {sp.tests.map((t) => (
                        <p key={t.name} className="flex items-center gap-2 px-7 py-1 text-[10.5px] text-foreground/80">
                          {T_ICON[t.status]}{t.name}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <GitCommitHorizontal className="mb-2 size-5 text-muted-foreground" />
                <p className="text-[11px] text-muted-foreground">Summary run — open #558 for full AI failure analysis.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

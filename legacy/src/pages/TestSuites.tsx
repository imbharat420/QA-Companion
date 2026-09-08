import { useState } from "react";
import { motion } from "motion/react";
import { Search, Play, Sparkles, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { SUITES } from "@/lib/mockData";
import { useAgent } from "@/lib/agentContext";
import type { View } from "@/components/chrome/NavRail";
import { toast } from "sonner";

const STATUS_ICON = {
  passing: <CircleCheck className="size-3.5 text-emerald-400" />,
  failing: <CircleX className="size-3.5 text-red-400" />,
  flaky: <TriangleAlert className="size-3.5 text-amber-400" />,
};

export default function TestSuites({ go }: { go: (v: View) => void }) {
  const [q, setQ] = useState("");
  const { runTask } = useAgent();
  const filtered = SUITES.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  const totalCases = SUITES.reduce((a, s) => a + s.cases, 0);
  const avg = Math.round(SUITES.reduce((a, s) => a + s.passRate, 0) / SUITES.length);

  const run = (name: string) => {
    runTask(`Run suite: ${name}`);
    go("workbench");
    toast.success(`Suite "${name}" queued — agent is driving`);
  };

  return (
    <div className="h-full overflow-y-auto bg-background p-6" data-testid="test-suites-page">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-1 font-mono text-[10px] tracking-[0.25em] text-cyan-300">TESTING</p>
            <h1 className="text-xl font-semibold tracking-tight">Test Suites</h1>
            <p className="mt-1 text-xs text-muted-foreground">{SUITES.length} suites · {totalCases} cases · {avg}% avg pass rate</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                data-testid="suites-search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter suites…"
                className="w-36 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button
              data-testid="generate-suite-button"
              onClick={() => toast.info("Agent will draft a new suite from your routes")}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:bg-cyan-400/20"
            >
              <Sparkles className="size-3.5" /> Generate suite
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10">
          <div className="grid grid-cols-[1fr_90px_140px_110px_90px] gap-3 border-b border-white/8 bg-[#12151E] px-4 py-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            <span>Suite</span><span>Cases</span><span>Pass rate</span><span>Last run</span><span className="text-right">Action</span>
          </div>
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              data-testid={`suite-row-${s.id}`}
              className="grid grid-cols-[1fr_90px_140px_110px_90px] items-center gap-3 border-b border-white/5 bg-[#0E1119] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.02]"
            >
              <div className="flex items-center gap-2.5">
                {STATUS_ICON[s.status]}
                <div>
                  <p className="text-xs font-medium text-foreground">{s.name}</p>
                  <p className="font-mono text-[9.5px] text-muted-foreground">{s.file}</p>
                </div>
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">{s.cases}</span>
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/8">
                  <div className={`h-full rounded-full ${s.passRate >= 90 ? "bg-emerald-400" : s.passRate >= 70 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${s.passRate}%` }} />
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">{s.passRate}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{s.lastRun}</span>
              <div className="text-right">
                <button
                  data-testid={`suite-run-${s.id}`}
                  onClick={() => run(s.name)}
                  className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-all hover:border-cyan-400/40 hover:text-cyan-300"
                >
                  <Play className="size-3" /> Run
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Bot, FlaskConical, Play, Bug, Settings as SettingsIcon, SquareTerminal, CirclePlay } from "lucide-react";
import type { View } from "./NavRail";
import { useAgent } from "@/lib/agentContext";

interface Cmd { id: string; label: string; hint: string; icon: typeof Bot; run: () => void; }

export function CommandPalette({ open, onClose, go }: { open: boolean; onClose: () => void; go: (v: View) => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { runTask, stopAgent } = useAgent();

  useEffect(() => {
    if (open) { setQ(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const nav = (v: View) => { go(v); onClose(); };
  const commands: Cmd[] = [
    { id: "c1", label: "Go to Agent Workbench", hint: "view", icon: Bot, run: () => nav("workbench") },
    { id: "c2", label: "Go to Test Suites", hint: "view", icon: FlaskConical, run: () => nav("suites") },
    { id: "c3", label: "Go to Test Runs", hint: "view", icon: Play, run: () => nav("runs") },
    { id: "c4", label: "Go to Findings Inbox", hint: "view", icon: Bug, run: () => nav("findings") },
    { id: "c5", label: "Go to Settings", hint: "view", icon: SettingsIcon, run: () => nav("settings") },
    { id: "c6", label: "New task: test this website", hint: "agent", icon: CirclePlay, run: () => { runTask("Test this website"); nav("workbench"); } },
    { id: "c7", label: "Stop agent", hint: "agent", icon: SquareTerminal, run: () => { stopAgent(); onClose(); } },
  ];
  const filtered = commands.filter((c) => c.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-[18vh] backdrop-blur-sm"
          onClick={onClose}
          data-testid="command-palette-overlay"
        >
          <motion.div
            initial={{ scale: 0.97, y: -8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: -8 }} transition={{ duration: 0.15, ease: "easeOut" }}
            className="w-[520px] overflow-hidden rounded-xl border border-white/12 bg-[#12151E] shadow-2xl shadow-black/70"
            onClick={(e) => e.stopPropagation()}
            data-testid="command-palette"
          >
            <div className="flex items-center gap-2.5 border-b border-white/8 px-4 py-3">
              <Search className="size-4 text-cyan-300" />
              <input
                ref={inputRef}
                data-testid="command-palette-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                  if (e.key === "Enter" && filtered[0]) filtered[0].run();
                }}
                placeholder="Run a command or search…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">ESC</kbd>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  data-testid={`command-${c.id}`}
                  onClick={c.run}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-cyan-400/8"
                >
                  <c.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1 text-xs text-foreground">{c.label}</span>
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{c.hint}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="px-3 py-6 text-center text-xs text-muted-foreground">No commands match.</p>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

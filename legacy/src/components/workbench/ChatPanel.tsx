import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Bot, SendHorizonal, ShieldAlert, Square, Zap } from "lucide-react";
import { useAgent } from "@/lib/agentContext";
import { QUICK_ACTIONS } from "@/lib/mockData";

export function ChatPanel() {
  const { messages, status, approval, approve, deny, runTask, stopAgent, running } = useAgent();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, approval, status]);

  const send = () => {
    if (!draft.trim()) return;
    runTask(draft.trim());
    setDraft("");
  };

  const busy = status === "thinking" || status === "planning" || status === "executing";

  return (
    <div className="flex h-full flex-col bg-[#0E1119]" data-testid="chat-panel">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-widest text-muted-foreground">AGENT</span>
          <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">Checkout QA</span>
        </div>
        {running && (
          <button
            data-testid="agent-stop-button"
            onClick={stopAgent}
            className="flex items-center gap-1 rounded-md border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-300 transition-colors hover:bg-red-400/20"
          >
            <Square className="size-2.5" /> Stop
          </button>
        )}
      </div>

      <div className="shrink-0 border-b border-white/8 p-2.5">
        <div className="mb-1.5 flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
          <Zap className="size-2.5 text-cyan-300" /> Top picks
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a}
              data-testid={`quick-action-${a.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => runTask(a)}
              className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-left text-[10px] text-muted-foreground transition-all hover:border-cyan-400/40 hover:text-cyan-300"
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" data-testid="chat-messages">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {m.from === "user" && (
                <div className="ml-8 rounded-lg rounded-br-sm border border-cyan-400/25 bg-cyan-400/8 px-3 py-2">
                  <p className="text-xs leading-relaxed text-foreground">{m.text}</p>
                  <p className="mt-1 text-right font-mono text-[9px] text-muted-foreground">{m.ts}</p>
                </div>
              )}
              {m.from === "agent" && (
                <div className="mr-4 flex gap-2.5">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-300">
                    <Bot className="size-3" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs leading-relaxed text-foreground/90">{m.text}</p>
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground">{m.ts}</p>
                  </div>
                </div>
              )}
              {m.from === "system" && (
                <div className="flex items-center gap-2 py-0.5">
                  <span className="h-px flex-1 bg-white/8" />
                  <span className="font-mono text-[9px] text-muted-foreground">{m.text}</span>
                  <span className="h-px flex-1 bg-white/8" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {busy && (
          <div className="mr-4 flex gap-2.5" data-testid="chat-thinking-indicator">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-cyan-400/15 text-cyan-300">
              <Bot className="size-3" />
            </span>
            <span className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1 rounded-full bg-cyan-300"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </span>
          </div>
        )}

        <AnimatePresence>
          {approval && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="rounded-lg border border-amber-400/40 bg-amber-400/5 p-3 shadow-[0_0_30px_rgba(245,158,11,0.08)]"
              data-testid="approval-card"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <ShieldAlert className="size-4 text-amber-300" />
                <span className="text-xs font-semibold text-amber-200">{approval.title}</span>
                <span className="ml-auto rounded border border-amber-400/40 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider text-amber-300">
                  {approval.risk} risk
                </span>
              </div>
              <p className="mb-2 text-[11px] leading-relaxed text-foreground/80">{approval.desc}</p>
              <p className="mb-3 rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[10px] text-cyan-200">{approval.action}</p>
              <div className="flex gap-2">
                <button
                  data-testid="approval-approve-btn"
                  onClick={approve}
                  className="flex-1 rounded-md bg-emerald-500 px-3 py-1.5 text-[11px] font-semibold text-emerald-950 transition-all hover:bg-emerald-400 active:scale-[0.98]"
                >
                  Approve
                </button>
                <button
                  data-testid="approval-deny-btn"
                  onClick={deny}
                  className="flex-1 rounded-md border border-white/15 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-all hover:border-red-400/40 hover:text-red-300 active:scale-[0.98]"
                >
                  Deny
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-white/8 p-2.5">
        <div className="flex items-end gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors focus-within:border-cyan-400/50">
          <textarea
            data-testid="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask the agent to test, explore, fix…"
            rows={1}
            className="max-h-24 flex-1 resize-none bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            data-testid="chat-send-button"
            onClick={send}
            disabled={!draft.trim()}
            className="flex size-7 items-center justify-center rounded-md bg-cyan-400 text-[#03252B] transition-all hover:bg-cyan-300 active:scale-95 disabled:opacity-30"
          >
            <SendHorizonal className="size-3.5" />
          </button>
        </div>
        <p className="mt-1.5 px-1 font-mono text-[9px] text-muted-foreground">Enter to send · context: blixen-tours/.claude</p>
      </div>
    </div>
  );
}

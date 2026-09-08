import { useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, ArrowRight, RotateCw, Lock, Plus, X, MousePointer2, Bot, Pause } from "lucide-react";
import { useAgent } from "@/lib/agentContext";
import { FakeSite, type RegFn } from "./fakesite";

interface Pt {
  x: number;
  y: number;
}
interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function BrowserPane() {
  const { browser, status, running } = useAgent();
  const viewportRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const reg: RegFn = (id) => (el) => {
    if (el) els.current.set(id, el);
    else els.current.delete(id);
  };
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [hl, setHl] = useState<Rect | null>(null);
  const [ripple, setRipple] = useState<(Pt & { key: number }) | null>(null);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const v = vp.getBoundingClientRect();
    const local = (el: HTMLElement): Rect => {
      const r = el.getBoundingClientRect();
      return { x: r.left - v.left, y: r.top - v.top, w: r.width, h: r.height };
    };
    if (browser.cursorTarget) {
      const el = els.current.get(browser.cursorTarget);
      if (el) {
        const r = local(el);
        setCursor({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
      }
    } else setCursor(null);
    if (browser.highlight) {
      const el = els.current.get(browser.highlight);
      setHl(el ? local(el) : null);
    } else setHl(null);
    if (browser.clickPulse) {
      const el = els.current.get(browser.clickPulse.target);
      if (el) {
        const r = local(el);
        setRipple({ x: r.x + r.w / 2, y: r.y + r.h / 2, key: browser.clickPulse.key });
      }
    }
  }, [browser.cursorTarget, browser.highlight, browser.page, browser.clickPulse, browser.inputs]);

  const loading = browser.page === "loading";

  return (
    <div className="flex h-full flex-col bg-[#0B0D13]" data-testid="live-browser">
      <div className="flex h-8 shrink-0 items-end gap-1 border-b border-white/8 bg-[#0E1119] px-2">
        {browser.tabs.map((t) => (
          <div
            key={t.id}
            data-testid={`browser-tab-${t.id}`}
            className="flex h-7 items-center gap-2 rounded-t-lg border-x border-t border-white/10 bg-[#161A26] px-3"
          >
            <span className={`size-1.5 rounded-full ${loading ? "bg-cyan-400 animate-pulse-soft" : "bg-emerald-400"}`} />
            <span className="max-w-36 truncate text-[10px] text-foreground/80">{t.title}</span>
            <X className="size-3 text-muted-foreground hover:text-foreground" />
          </div>
        ))}
        <button data-testid="browser-new-tab" className="mb-1 rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground">
          <Plus className="size-3.5" />
        </button>
        <div className="flex-1" />
        <div
          data-testid="browser-driving-chip"
          className={`mb-1 flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-wide ${
            running
              ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
              : status === "waiting"
                ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                : "border-white/10 text-muted-foreground"
          }`}
        >
          {running ? <Bot className="size-3 animate-pulse-soft" /> : status === "waiting" ? <Pause className="size-3" /> : null}
          {running ? "AGENT DRIVING" : status === "waiting" ? "PAUSED — APPROVAL" : "IDLE"}
        </div>
      </div>

      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-white/8 bg-[#12151E] px-2">
        <button data-testid="browser-back" className="rounded p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground">
          <ArrowLeft className="size-3.5" />
        </button>
        <button data-testid="browser-forward" className="rounded p-1.5 text-muted-foreground/40">
          <ArrowRight className="size-3.5" />
        </button>
        <button data-testid="browser-reload" className="rounded p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground">
          <RotateCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <div data-testid="browser-url-bar" className="flex h-6.5 flex-1 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3">
          <Lock className="size-3 text-emerald-400" />
          <span className="flex-1 truncate font-mono text-[11px] text-foreground/80">{browser.url}</span>
        </div>
        <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">1280×800</span>
        <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">Chromium</span>
      </div>

      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden" data-testid="browser-viewport">
        <FakeSite page={browser.page} inputs={browser.inputs} reg={reg} />

        <AnimatePresence>
          {browser.overlay && (
            <motion.div
              key={browser.overlay}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              data-testid="browser-action-overlay"
              className="absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-cyan-400/30 bg-[#0B0D13]/90 px-3 py-1.5 shadow-xl shadow-black/50 backdrop-blur"
            >
              <span className="size-1.5 rounded-full bg-cyan-400 animate-pulse-soft" />
              <span className="font-mono text-[10px] text-cyan-100">{browser.overlay}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {hl && (
          <motion.div
            data-testid="browser-highlight-box"
            className="pointer-events-none absolute z-20 rounded-md border-2 border-cyan-400 shadow-[0_0_24px_rgba(0,242,254,0.35)]"
            animate={{ x: hl.x - 4, y: hl.y - 4, width: hl.w + 8, height: hl.h + 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          >
            {browser.highlightLabel && (
              <span className="absolute -top-6 left-0 whitespace-nowrap rounded border border-cyan-400/40 bg-[#0B0D13] px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
                {browser.highlightLabel}
              </span>
            )}
          </motion.div>
        )}

        {ripple && (
          <span
            key={ripple.key}
            data-testid="browser-click-ripple"
            className="animate-ripple pointer-events-none absolute z-30 size-10 rounded-full border-2 border-cyan-300"
            style={{ left: ripple.x, top: ripple.y }}
          />
        )}

        {cursor && (
          <motion.div
            data-testid="agent-cursor"
            className="pointer-events-none absolute left-0 top-0 z-40"
            animate={{ x: cursor.x, y: cursor.y }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            <span className="absolute -left-1 -top-1 size-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.9)]" />
            <MousePointer2 className="absolute left-0.5 top-0.5 size-4 fill-cyan-400 text-cyan-950 drop-shadow-[0_0_6px_rgba(0,242,254,0.8)]" />
          </motion.div>
        )}
      </div>
    </div>
  );
}

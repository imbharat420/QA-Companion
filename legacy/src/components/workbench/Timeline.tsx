import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Camera, ChevronLeft, ChevronRight, Globe, Keyboard, ListChecks, MousePointer2, MousePointerClick, Pause, Play, ScanSearch, ShieldAlert, SkipBack, SkipForward, Wifi, X, Image as ImageIcon, Video, SplitSquareVertical } from "lucide-react";
import { useAgent, type TimelineEvent } from "@/lib/agentContext";
import { FakeSite, type RegFn } from "./fakesite";

const ICONS: Record<TimelineEvent["kind"], typeof Globe> = { plan: ListChecks, navigate: Globe, click: MousePointerClick, type: Keyboard, inspect: ScanSearch, assert: BadgeCheck, approval: ShieldAlert, network: Wifi, screenshot: Camera };
const TONES: Record<TimelineEvent["kind"], string> = {
  plan: "border-violet-400/45 bg-violet-400/15 text-violet-200", navigate: "border-sky-400/45 bg-sky-400/15 text-sky-200", click: "border-cyan-300/50 bg-cyan-300/15 text-cyan-100", type: "border-indigo-400/45 bg-indigo-400/15 text-indigo-200", inspect: "border-amber-300/45 bg-amber-300/15 text-amber-100", assert: "border-emerald-400/45 bg-emerald-400/15 text-emerald-100", approval: "border-amber-400/55 bg-amber-400/15 text-amber-100", network: "border-rose-400/45 bg-rose-400/15 text-rose-100", screenshot: "border-fuchsia-400/45 bg-fuchsia-400/15 text-fuchsia-100",
};
const LANE: Record<TimelineEvent["kind"], "actions" | "browser" | "frames"> = { plan: "actions", inspect: "actions", assert: "actions", approval: "actions", navigate: "browser", click: "browser", type: "browser", network: "browser", screenshot: "frames" };
const LANES = [{ id: "actions", label: "ACTIONS", dot: "bg-violet-400" }, { id: "browser", label: "BROWSER", dot: "bg-cyan-300" }, { id: "frames", label: "FRAMES", dot: "bg-emerald-400" }] as const;
const noRef: RegFn = () => () => {};

function eventPage(event: TimelineEvent) {
  if (event.detail.includes("Pay") || event.label.includes("payment") || event.label.includes("Request failed")) return "checkout" as const;
  if (event.kind === "type" || event.detail.includes("Sign in")) return "login" as const;
  return "home" as const;
}

function Snapshot({ event, expected = false }: { event: TimelineEvent; expected?: boolean }) {
  const pointer = event.kind === "click" || event.kind === "type" ? { left: eventPage(event) === "login" ? "52%" : "84%", top: eventPage(event) === "login" ? "56%" : "15%" } : null;
  return <div className={`relative h-full overflow-hidden bg-[#f6f7f9] ${expected ? "brightness-[1.02] saturate-[.9]" : ""}`}>
    <div className="absolute inset-0 h-[172%] w-[172%] origin-top-left scale-[.58]"><FakeSite page={eventPage(event)} inputs={eventPage(event) === "login" ? { "login-email": "demo@blixen.tours", "login-password": "••••••••" } : {}} reg={noRef} /></div>
    {expected && <div className="absolute inset-0 border-[3px] border-emerald-400/35" />}
    {pointer && <div className="absolute z-10" style={pointer}><span className="absolute -left-3 -top-3 size-6 rounded-full border-2 border-cyan-400/75 animate-pulse-soft" /><MousePointer2 className="size-5 fill-cyan-300 text-slate-900 drop-shadow-md" /></div>}
  </div>;
}

function TraceDetailModal({ event, onClose }: { event: TimelineEvent; onClose: () => void }) {
  const [mode, setMode] = useState<"snapshot" | "clip" | "diff">("snapshot");
  const [clipPlaying, setClipPlaying] = useState(false);
  const [diff, setDiff] = useState(52);
  const Icon = ICONS[event.kind];
  return createPortal(<div className="fixed inset-0 z-[60] grid place-items-center bg-black/65 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Trace event details" onMouseDown={onClose}>
    <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-cyan-300/25 bg-[#0d131d] shadow-2xl shadow-black/70" onMouseDown={(e) => e.stopPropagation()}>
      <header className="flex items-center gap-3 border-b border-white/10 bg-[#101923] px-4 py-3">
        <span className={`flex size-8 items-center justify-center rounded-md border ${TONES[event.kind]}`}><Icon className="size-4" /></span>
        <div className="min-w-0"><p className="text-[10px] font-semibold tracking-[.14em] text-cyan-200">TRACE EVENT · #{event.id}</p><h2 className="text-sm font-semibold text-white">{event.label}</h2></div>
        <div className="ml-auto flex items-center gap-2"><span className="rounded bg-white/5 px-2 py-1 font-mono text-[9px] text-slate-400">{event.ts}</span><button onClick={onClose} className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close trace details"><X className="size-4" /></button></div>
      </header>
      <div className="flex items-center gap-1 border-b border-white/10 bg-[#0b1018] px-4 py-2">{([ ["snapshot", ImageIcon, "Screenshot"], ["clip", Video, "Replay clip"], ["diff", SplitSquareVertical, "Visual diff"] ] as const).map(([id, TabIcon, label]) => <button key={id} onClick={() => setMode(id)} className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[10px] transition-colors ${mode === id ? "bg-cyan-400/15 text-cyan-100" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}><TabIcon className="size-3" />{label}</button>)}</div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_230px]">
        <div className="min-h-0 bg-[#080c12] p-4">
          {mode === "snapshot" && <div className="h-full min-h-[360px]"><div className="mb-2 flex items-center justify-between text-[9px] text-slate-500"><span>CAPTURED SCREENSHOT · 1280 × 800</span><span className="text-cyan-200">pointer location recorded</span></div><div className="h-[calc(100%-24px)] overflow-hidden rounded-lg border border-white/10 shadow-xl"><Snapshot event={event} /></div></div>}
          {mode === "clip" && <div className="h-full min-h-[360px]"><div className="mb-2 flex items-center justify-between text-[9px] text-slate-500"><span>REPLAY CLIP · 2.4 SEC</span><span className="text-cyan-200">{clipPlaying ? "PLAYING" : "PAUSED"}</span></div><div className="relative h-[calc(100%-24px)] overflow-hidden rounded-lg border border-white/10"><Snapshot event={event} /><div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-[#080c12]/90 px-3 py-2 backdrop-blur"><button onClick={() => setClipPlaying((playing) => !playing)} className="rounded bg-cyan-400/20 p-1.5 text-cyan-100">{clipPlaying ? <Pause className="size-3" /> : <Play className="size-3 fill-current" />}</button><div className="h-1 flex-1 overflow-hidden rounded bg-white/15"><div className={`h-full bg-cyan-300 transition-all ${clipPlaying ? "w-3/4" : "w-1/3"}`} /></div><span className="font-mono text-[9px] text-slate-300">00:01.2 / 00:02.4</span></div></div></div>}
          {mode === "diff" && <div className="h-full min-h-[360px]"><div className="mb-2 flex items-center justify-between text-[9px] text-slate-500"><span>ACTUAL ↔ EXPECTED · DRAG THE HANDLE</span><span className="text-emerald-300">visual check</span></div><div className="relative h-[calc(100%-48px)] overflow-hidden rounded-lg border border-white/10"><Snapshot event={event} expected /><div className="absolute inset-y-0 left-0 overflow-hidden border-r-2 border-cyan-300" style={{ width: `${diff}%` }}><div className="h-full" style={{ width: `calc(100vw - 340px)` }}><Snapshot event={event} /></div></div><div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-cyan-100" style={{ left: `${diff}%` }}><span className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-200 bg-[#0c1822] text-cyan-100">↔</span></div><span className="absolute left-3 top-3 rounded bg-[#0b1018]/80 px-2 py-1 font-mono text-[9px] text-cyan-100">ACTUAL</span><span className="absolute right-3 top-3 rounded bg-[#0b1018]/80 px-2 py-1 font-mono text-[9px] text-emerald-200">EXPECTED</span></div><input aria-label="Visual diff position" type="range" min="0" max="100" value={diff} onChange={(e) => setDiff(Number(e.target.value))} className="mt-3 w-full accent-cyan-300" /></div>}
        </div>
        <aside className="overflow-y-auto border-l border-white/10 bg-[#10151e] p-4"><p className="text-[9px] font-semibold tracking-[.14em] text-slate-500">EVENT DETAILS</p><p className="mt-2 break-words font-mono text-[10px] leading-relaxed text-slate-200">{event.detail}</p><dl className="mt-4 space-y-3 border-t border-white/10 pt-3 font-mono text-[9px]"><div className="flex justify-between gap-3"><dt className="text-slate-500">ACTION</dt><dd className="uppercase text-slate-200">{event.kind}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">LANE</dt><dd className="uppercase text-slate-200">{LANE[event.kind]}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">STATUS</dt><dd className="uppercase text-emerald-300">{event.status}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">MOUSE</dt><dd className="text-cyan-100">recorded</dd></div></dl><div className="mt-5 rounded border border-cyan-300/15 bg-cyan-300/5 p-2 text-[9px] leading-relaxed text-slate-400">The screenshot and replay are tied to this exact trace event.</div></aside>
      </div>
    </section>
  </div>, document.body);
}

function eventLabel(event: TimelineEvent) {
  if (event.kind === "click") return `CLICK: ${event.detail.replace(/button |→.*$/g, "").replace(/"/g, "")}`;
  if (event.kind === "type") return `TYPE: ${event.detail.split(" →")[0]}`;
  return event.label.toUpperCase();
}

export function Timeline({ selectedId, onSelect }: { selectedId: number | null; onSelect: (e: TimelineEvent) => void }) {
  const { timeline, running } = useAgent();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "actions" | "browser" | "frames">("all");
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hovered, setHovered] = useState<{ event: TimelineEvent; rect: DOMRect; below: boolean } | null>(null);
  const [detailEvent, setDetailEvent] = useState<TimelineEvent | null>(null);
  const visible = useMemo(() => timeline.filter((event) => filter === "all" || LANE[event.kind] === filter), [filter, timeline]);
  const positions = useMemo(() => new Map(timeline.map((event, index) => [event.id, 36 + index * 148])), [timeline]);
  const width = Math.max(760, 92 + timeline.length * 148);
  const currentIndex = cursor ?? timeline.findIndex((event) => event.id === selectedId);

  useEffect(() => { scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" }); }, [timeline.length]);
  useEffect(() => {
    if (!playing || timeline.length === 0) return;
    const timer = window.setInterval(() => setCursor((index) => {
      const next = index === null || index >= timeline.length - 1 ? 0 : index + 1;
      onSelect(timeline[next]); return next;
    }), 1100);
    return () => window.clearInterval(timer);
  }, [playing, timeline, onSelect]);

  const move = (amount: number) => {
    if (!timeline.length) return;
    const next = Math.max(0, Math.min(timeline.length - 1, (currentIndex < 0 ? 0 : currentIndex) + amount));
    setCursor(next); onSelect(timeline[next]);
  };
  const select = (event: TimelineEvent) => { setPlaying(false); setCursor(timeline.findIndex((item) => item.id === event.id)); onSelect(event); setDetailEvent(event); };
  const showDetails = (event: TimelineEvent, target: HTMLButtonElement) => {
    const rect = target.getBoundingClientRect();
    setHovered({ event, rect, below: rect.top < 126 });
  };

  return <section className="flex h-full flex-col overflow-hidden bg-[#080c12] font-mono text-[9px]" data-testid="execution-timeline">
    <header className="flex h-8 shrink-0 items-center gap-2 border-b border-cyan-300/15 bg-[#0b1018] px-3 select-none">
      <span className="flex items-center gap-1.5 font-sans text-[10px] font-semibold tracking-[.14em] text-cyan-100"><span className="text-cyan-300">⌁</span> TRACE TIMELINE</span>
      <span className="rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[8px] text-cyan-200">00:00.24 / 00:04.20</span>
      <button onClick={() => move(-1)} className="rounded px-1 text-slate-400 hover:bg-white/10 hover:text-white" title="Previous event"><ChevronLeft className="size-3" /></button>
      <button onClick={() => move(1)} className="rounded px-1 text-slate-400 hover:bg-white/10 hover:text-white" title="Next event"><ChevronRight className="size-3" /></button>
      <div className="mx-auto flex items-center gap-1 rounded border border-white/8 bg-black/25 p-0.5">
        <button onClick={() => { setCursor(0); timeline[0] && onSelect(timeline[0]); }} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-cyan-200" title="First event"><SkipBack className="size-3" /></button>
        <button onClick={() => setPlaying((value) => !value)} className="rounded bg-cyan-400/20 p-1 text-cyan-200 hover:bg-cyan-400/30" title={playing ? "Pause replay" : "Replay trace"}>{playing ? <Pause className="size-3" /> : <Play className="size-3 fill-current" />}</button>
        <button onClick={() => { const last = timeline.length - 1; setCursor(last); timeline[last] && onSelect(timeline[last]); }} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-cyan-200" title="Latest event"><SkipForward className="size-3" /></button>
        <span className="px-1 text-[8px] text-slate-500">1.0×</span>
      </div>
      <div className="flex items-center gap-1">{(["all", "actions", "browser", "frames"] as const).map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded px-1.5 py-1 text-[8px] uppercase transition-colors ${filter === item ? "bg-cyan-400/20 text-cyan-100" : "text-slate-500 hover:bg-white/5 hover:text-slate-200"}`}>{item}{item === "all" ? ` (${timeline.length})` : ""}</button>)}</div>
      {running && <span className="ml-1 flex items-center gap-1 text-emerald-300"><span className="size-1 rounded-full bg-emerald-300 animate-pulse-soft" /> LIVE</span>}
    </header>
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden" data-testid="timeline-events"><div className="min-w-full" style={{ width }}>
      <div className="ml-[78px] flex h-5 border-b border-white/[.06] text-[8px] text-slate-600">{Array.from({ length: Math.max(6, Math.ceil(width / 148)) }, (_, index) => <span key={index} className="w-[148px] border-l border-white/[.045] pl-1.5 pt-1">{index === 0 ? "00:00" : `+${(index * 0.7).toFixed(1)}s`}</span>)}</div>
      <div className="relative ml-[78px]" style={{ height: 90, backgroundImage: "linear-gradient(90deg, rgba(148,163,184,.075) 1px, transparent 1px)", backgroundSize: "148px 100%" }}>
        {LANES.map((lane, laneIndex) => <div key={lane.id} className="absolute left-[-78px] right-0 flex h-[30px] items-center border-b border-white/[.055]" style={{ top: laneIndex * 30 }}><span className="flex w-[78px] items-center gap-1.5 px-2 text-[8px] tracking-wide text-slate-500"><span className={`size-1 rounded-full ${lane.dot}`} />{lane.label}</span><div className="h-px flex-1 bg-white/[.025]" /></div>)}
        {visible.map((event) => { const Icon = ICONS[event.kind]; const active = event.id === selectedId; const laneIndex = LANES.findIndex((lane) => lane.id === LANE[event.kind]); return <button key={event.id} data-testid={`timeline-event-${event.id}`} onClick={() => select(event)} onMouseEnter={(e) => showDetails(event, e.currentTarget)} onMouseLeave={() => setHovered(null)} style={{ left: positions.get(event.id), top: laneIndex * 30 + 5 }} className={`absolute flex h-5 max-w-[138px] items-center gap-1.5 truncate rounded border px-1.5 text-left shadow-[0_0_12px_rgba(34,211,238,.04)] transition-all hover:-translate-y-px hover:brightness-125 ${TONES[event.kind]} ${active ? "ring-1 ring-cyan-200/70 shadow-[0_0_16px_rgba(34,211,238,.25)]" : ""}`}><Icon className="size-2.5 shrink-0" /><span className="truncate text-[8px] font-semibold">{eventLabel(event)}</span></button>; })}
        {selectedId && positions.get(selectedId) && <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-cyan-300/70 shadow-[0_0_9px_2px_rgba(34,211,238,.32)]" style={{ left: positions.get(selectedId)! + 10 }} />}
        {timeline.length === 0 && <div className="absolute inset-0 grid place-items-center font-sans text-[10px] text-slate-500">Run a task — each browser action will appear here as a replayable trace.</div>}
      </div>
    </div></div>
    {hovered && createPortal(<div role="tooltip" className="pointer-events-none fixed z-50 w-56 rounded-md border border-cyan-300/30 bg-[#101923] p-2.5 font-sans shadow-[0_10px_24px_rgba(0,0,0,.55)]" style={{ left: Math.min(window.innerWidth - 232, Math.max(8, hovered.rect.left + hovered.rect.width / 2 - 112)), top: hovered.below ? hovered.rect.bottom + 8 : hovered.rect.top - 8, transform: hovered.below ? undefined : "translateY(-100%)" }}>
      <span className={`absolute size-2 rotate-45 border-cyan-300/30 bg-[#101923] ${hovered.below ? "-top-1 left-1/2 -translate-x-1/2 border-l border-t" : "-bottom-1 left-1/2 -translate-x-1/2 border-b border-r"}`} />
      <div className="relative flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${hovered.event.status === "fail" ? "bg-red-400" : hovered.event.status === "warn" ? "bg-amber-300" : "bg-emerald-300"}`} /><span className="text-[9px] font-semibold tracking-wide text-cyan-100">TRACE EVENT</span><span className="ml-auto font-mono text-[8px] text-slate-500">#{hovered.event.id}</span></div>
      <p className="relative mt-1 text-[11px] font-medium text-white">{hovered.event.label}</p>
      <p className="relative mt-0.5 break-words font-mono text-[9px] leading-snug text-slate-300">{hovered.event.detail}</p>
      <div className="relative mt-1.5 flex gap-2 border-t border-white/10 pt-1.5 font-mono text-[8px] text-slate-500"><span>TIME <b className="ml-0.5 font-medium text-slate-300">{hovered.event.ts}</b></span><span>TYPE <b className="ml-0.5 font-medium uppercase text-slate-300">{hovered.event.kind}</b></span><span>STATUS <b className="ml-0.5 font-medium uppercase text-slate-300">{hovered.event.status}</b></span></div>
    </div>, document.body)}
    {detailEvent && <TraceDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />}
  </section>;
}

import { useEffect, useRef } from "react";
import { Globe, MousePointerClick, Keyboard, ScanSearch, BadgeCheck, ShieldAlert, Wifi, Camera, ListChecks } from "lucide-react";
import { useAgent, type TimelineEvent } from "@/lib/agentContext";

const ICONS: Record<TimelineEvent["kind"], typeof Globe> = {
  plan: ListChecks, navigate: Globe, click: MousePointerClick, type: Keyboard,
  inspect: ScanSearch, assert: BadgeCheck, approval: ShieldAlert, network: Wifi, screenshot: Camera,
};

const DOT: Record<TimelineEvent["status"], string> = {
  ok: "bg-emerald-400", fail: "bg-red-400", warn: "bg-amber-400", info: "bg-cyan-300",
};

export function Timeline({ selectedId, onSelect }: { selectedId: number | null; onSelect: (e: TimelineEvent) => void }) {
  const { timeline, running } = useAgent();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ left: scrollRef.current.scrollWidth, behavior: "smooth" });
  }, [timeline.length]);

  return (
    <div className="flex h-full flex-col bg-[#0E1119]" data-testid="execution-timeline">
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-white/8 px-3">
        <span className="text-[9px] font-semibold tracking-widest text-muted-foreground">EXECUTION TIMELINE</span>
        {running && (
          <span className="flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-1.5 py-px text-[8px] font-semibold text-cyan-300">
            <span className="size-1 rounded-full bg-cyan-400 animate-pulse-soft" /> LIVE
          </span>
        )}
        <span className="ml-auto font-mono text-[9px] text-muted-foreground">{timeline.length} events</span>
      </div>
      <div ref={scrollRef} className="flex min-h-0 flex-1 items-stretch gap-1.5 overflow-x-auto p-2" data-testid="timeline-events">
        {timeline.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[10px] text-muted-foreground">Run a task — every agent action lands here, clickable and inspectable.</p>
          </div>
        )}
        {timeline.map((e) => {
          const Icon = ICONS[e.kind];
          const active = selectedId === e.id;
          return (
            <button
              key={e.id}
              data-testid={`timeline-event-${e.id}`}
              onClick={() => onSelect(e)}
              className={`flex min-w-max items-center gap-2 rounded-lg border px-2.5 text-left transition-all ${
                active ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/8 bg-white/[0.02] hover:border-white/20"
              }`}
            >
              <span className={`size-1.5 shrink-0 rounded-full ${DOT[e.status]}`} />
              <Icon className={`size-3.5 shrink-0 ${active ? "text-cyan-300" : "text-muted-foreground"}`} />
              <span>
                <span className={`block text-[10px] font-medium leading-tight ${active ? "text-cyan-200" : "text-foreground/85"}`}>{e.label}</span>
                <span className="block max-w-44 truncate font-mono text-[8.5px] leading-tight text-muted-foreground">{e.detail}</span>
              </span>
              <span className="pl-1 font-mono text-[8px] text-muted-foreground/70">{e.ts}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

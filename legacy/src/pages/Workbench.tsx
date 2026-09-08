import { useState } from "react";
import type { TimelineEvent } from "@/lib/agentContext";
import { ChatPanel } from "@/components/workbench/ChatPanel";
import { BrowserPane } from "@/components/workbench/BrowserPane";
import { InspectorPane } from "@/components/workbench/InspectorPane";
import { Timeline } from "@/components/workbench/Timeline";

function DragHandle({ vertical, onDown, testid }: { vertical: boolean; onDown: (e: React.MouseEvent) => void; testid: string }) {
  return (
    <div
      data-testid={testid}
      onMouseDown={onDown}
      className={`group relative z-20 shrink-0 ${vertical ? "w-[5px] cursor-col-resize -mx-[2px]" : "h-[5px] cursor-row-resize -my-[2px]"}`}
    >
      <div className={`absolute bg-transparent transition-colors group-hover:bg-cyan-400/50 group-active:bg-cyan-400 ${vertical ? "inset-y-0 left-[2px] w-px" : "inset-x-0 top-[2px] h-px"}`} />
    </div>
  );
}

function startDrag(e: React.MouseEvent, start: number, set: (v: number) => void, min: number, max: number, axis: "x" | "y", dir = 1) {
  e.preventDefault();
  const p0 = axis === "x" ? e.clientX : e.clientY;
  const move = (ev: MouseEvent) => {
    const p = axis === "x" ? ev.clientX : ev.clientY;
    set(Math.min(max, Math.max(min, start + (p - p0) * dir)));
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

export default function Workbench() {
  const [leftW, setLeftW] = useState(340);
  const [rightW, setRightW] = useState(340);
  const [tlH, setTlH] = useState(148);
  const [sel, setSel] = useState<TimelineEvent | null>(null);

  return (
    <div className="flex h-full flex-col bg-background" data-testid="workbench">
      <div className="flex min-h-0 flex-1">
        <div style={{ width: leftW }} className="min-w-0 shrink-0" data-testid="pane-chat">
          <ChatPanel />
        </div>
        <DragHandle vertical testid="resize-chat-handle" onDown={(e) => startDrag(e, leftW, setLeftW, 280, 480, "x")} />
        <div className="min-w-0 flex-1" data-testid="pane-browser">
          <BrowserPane />
        </div>
        <DragHandle vertical testid="resize-inspector-handle" onDown={(e) => startDrag(e, rightW, setRightW, 300, 480, "x", -1)} />
        <div style={{ width: rightW }} className="min-w-0 shrink-0" data-testid="pane-inspector">
          <InspectorPane selected={sel} onClose={() => setSel(null)} />
        </div>
      </div>
      <DragHandle vertical={false} testid="resize-timeline-handle" onDown={(e) => startDrag(e, tlH, setTlH, 108, 260, "y", -1)} />
      <div style={{ height: tlH }} className="shrink-0" data-testid="pane-timeline">
        <Timeline selectedId={sel?.id ?? null} onSelect={setSel} />
      </div>
    </div>
  );
}

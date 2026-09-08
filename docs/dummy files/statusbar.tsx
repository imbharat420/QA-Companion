import { GitBranch, Lock, Wifi, Box, Fingerprint } from "lucide-react";
import { useAgent } from "@/lib/agentContext";

export function StatusBar() {
  const { sessionId, status } = useAgent();
  return (
    <footer data-testid="status-bar" className="flex h-6 shrink-0 items-center gap-4 border-t border-white/8 bg-[#0E1119] px-3 text-[10px] text-muted-foreground select-none">
      <span className="flex items-center gap-1.5 transition-colors hover:text-foreground">
        <GitBranch className="size-3" />
        <span className="font-mono">main · 91ac2f</span>
      </span>
      <span className="flex items-center gap-1.5">
        <Fingerprint className="size-3" />
        <span className="font-mono">{sessionId}</span>
      </span>
      <span className="font-mono">~/projects/blixen-tours</span>
      <div className="flex-1" />
      <span className={`flex items-center gap-1.5 ${status === "executing" ? "text-cyan-300" : ""}`}>
        <Wifi className="size-3" /> 12 ms
      </span>
      <span className="flex items-center gap-1.5">
        <Box className="size-3" /> Chromium 141 · Playwright 1.55
      </span>
      <span>Local provider</span>
      <span className="flex items-center gap-1.5 text-emerald-400/80">
        <Lock className="size-3" /> Local-first
      </span>
    </footer>
  );
}

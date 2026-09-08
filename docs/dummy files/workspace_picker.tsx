import { motion } from "motion/react";
import { FolderOpen, Plus, ArrowRight, GitBranch, Layers, FlaskConical, Command, ShieldCheck, Boxes } from "lucide-react";
import { WORKSPACES } from "@/lib/mockData";

const line = {
  hidden: { y: "110%" },
  show: (i: number) => ({ y: "0%", transition: { delay: 0.25 + i * 0.14, duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } }),
};

export default function WorkspacePicker({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#0B0D13]" data-testid="workspace-picker">
      <div className="bg-grid-dark absolute inset-0" />
      <div className="absolute -top-40 left-1/3 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-cyan-400/8 blur-[120px]" />
      <div className="absolute bottom-0 right-0 h-72 w-96 rounded-full bg-indigo-500/6 blur-[100px]" />

      <header className="relative z-10 flex items-center justify-between px-10 pt-8">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-400 font-mono text-sm font-bold text-[#03252B]">Æ</span>
          <span className="text-xs font-semibold tracking-[0.25em] text-foreground">AETHER</span>
          <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] text-muted-foreground">Desktop · v0.9.2</span>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><ShieldCheck className="size-3 text-emerald-400" /> Local-first</span>
          <span className="flex items-center gap-1.5"><Boxes className="size-3 text-cyan-300" /> .claude aware</span>
        </motion.div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col justify-center px-10 lg:px-20">
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-5 font-mono text-[11px] tracking-[0.3em] text-cyan-300"
        >
          PROJECT-AWARE AI BROWSER AGENT
        </motion.p>
        <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          <span className="block overflow-hidden pb-1"><motion.span custom={0} variants={line} initial="hidden" animate="show" className="block">Watch your agent</motion.span></span>
          <span className="block overflow-hidden pb-2"><motion.span custom={1} variants={line} initial="hidden" animate="show" className="block">drive the <span className="text-cyan-300">browser.</span></motion.span></span>
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5 }}
          className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground"
        >
          Pick a workspace. The agent reads your repo, opens a real browser beside the chat, and tests, explores and fixes — while you watch every click.
        </motion.p>

        <div className="mt-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WORKSPACES.map((w, i) => (
            <motion.button
              key={w.id}
              data-testid={`workspace-card-${w.name}`}
              onClick={onEnter}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 + i * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              className="group relative rounded-xl border border-white/10 bg-[#12151E]/90 p-4 text-left transition-colors hover:border-cyan-400/40"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-foreground">{w.name}</span>
                <ArrowRight className="size-3.5 -translate-x-1 text-cyan-300 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </div>
              <p className="mb-3 truncate font-mono text-[10px] text-muted-foreground">{w.path}</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-muted-foreground">{w.framework}</span>
                <span className="flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-muted-foreground"><GitBranch className="size-2.5" />{w.branch}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Layers className="size-3" />{w.sessions}</span>
                <span className="flex items-center gap-1"><FlaskConical className="size-3" />{w.tests}</span>
                <span>{w.lastActive}</span>
              </div>
              <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full bg-cyan-400/70" style={{ width: `${w.health}%` }} />
              </div>
            </motion.button>
          ))}
          <motion.button
            data-testid="create-workspace-button"
            onClick={onEnter}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.5 }}
            whileHover={{ y: -4 }}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 p-4 text-muted-foreground transition-colors hover:border-cyan-400/40 hover:text-cyan-300"
          >
            <span className="flex gap-2">
              <FolderOpen className="size-4" />
              <Plus className="size-4" />
            </span>
            <span className="text-[11px] font-medium">Open folder / Create workspace</span>
          </motion.button>
        </div>
      </div>

      <motion.footer
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
        className="relative z-10 flex items-center gap-6 px-10 pb-7 text-[10px] text-muted-foreground"
      >
        <span className="flex items-center gap-1.5"><Command className="size-3" />K — command palette</span>
        <span>Every workspace is isolated: context, credentials, browser profile</span>
      </motion.footer>
    </div>
  );
}

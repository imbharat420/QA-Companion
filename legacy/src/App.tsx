import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AgentProvider } from "@/lib/agentContext";
import WorkspacePicker from "@/pages/WorkspacePicker";
import Workbench from "@/pages/Workbench";
import TestSuites from "@/pages/TestSuites";
import TestRuns from "@/pages/TestRuns";
import Findings from "@/pages/Findings";
import Settings from "@/pages/Settings";
import { TitleBar } from "@/components/chrome/TitleBar";
import { NavRail, type View } from "@/components/chrome/NavRail";
import { StatusBar } from "@/components/chrome/StatusBar";
import { CommandPalette } from "@/components/chrome/CommandPalette";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  const [screen, setScreen] = useState<"picker" | "app">("picker");
  const [view, setView] = useState<View>("workbench");
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <AgentProvider>
      <AnimatePresence mode="wait">
        {screen === "picker" ? (
          <motion.div
            key="picker"
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25 }}
            className="h-full w-full"
          >
            <WorkspacePicker
              onEnter={() => {
                setView("workbench");
                setScreen("app");
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="app"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex h-full flex-col bg-background"
            data-testid="desktop-shell"
          >
            <TitleBar
              onOpenPalette={() => setPaletteOpen(true)}
              onGoHome={() => setScreen("picker")}
            />
            <div className="flex min-h-0 flex-1">
              <NavRail
                view={view}
                go={setView}
                onOpenWorkspaces={() => setScreen("picker")}
              />
              <main className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={view}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="h-full"
                  >
                    {view === "workbench" && <Workbench />}
                    {view === "suites" && <TestSuites go={setView} />}
                    {view === "runs" && <TestRuns />}
                    {view === "findings" && <Findings go={setView} />}
                    {view === "settings" && <Settings />}
                  </motion.div>
                </AnimatePresence>
              </main>
            </div>
            <StatusBar />
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        go={(v) => {
          setView(v);
          setScreen("app");
        }}
      />
      <Toaster position="bottom-right" />
    </AgentProvider>
  );
}

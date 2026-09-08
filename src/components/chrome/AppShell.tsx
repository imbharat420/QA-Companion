"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { TitleBar } from "./TitleBar";
import { NavRail } from "./NavRail";
import { StatusBar } from "./StatusBar";
import { useShortcuts } from "./useShortcuts";
import { useUiStore } from "@/store/uiStore";

/**
 * The palette and the failure cockpit are mounted app-wide but are closed on
 * first paint, so they load on demand rather than on the critical path.
 */
const CommandPalette = dynamic(
  () => import("./CommandPalette").then((m) => ({ default: m.CommandPalette })),
  { ssr: false },
);

const FailureCockpit = dynamic(
  () => import("@/components/shared/FailureCockpit").then((m) => ({ default: m.FailureCockpit })),
  { ssr: false },
);

/**
 * The desktop frame: a fixed title bar, a fixed rail, a scrolling content well
 * and a fixed status bar. The frame never unmounts on navigation, so the agent
 * session, pane sizes and browser pane survive every route change.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const cockpitFindingId = useUiStore((s) => s.cockpitFindingId);
  const closeCockpit = useUiStore((s) => s.closeCockpit);
  const setLastVisitedRoute = useUiStore((s) => s.setLastVisitedRoute);

  useShortcuts();

  useEffect(() => {
    setLastVisitedRoute(pathname);
  }, [pathname, setLastVisitedRoute]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <NavRail />
        <main
          id="main"
          data-testid="app-main"
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
        >
          {children}
        </main>
      </div>
      <StatusBar />

      <CommandPalette />
      <FailureCockpit
        findingId={cockpitFindingId}
        onOpenChange={(open) => {
          if (!open) closeCockpit();
        }}
      />
    </div>
  );
}

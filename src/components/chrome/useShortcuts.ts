"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/config/nav";
import { useUiStore } from "@/store/uiStore";
import { useAgentStore } from "@/store/agentStore";

/** True when the event came from somewhere the user is typing. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Global keyboard map, registered once by AppShell.
 *
 *   ⌘K / Ctrl+K     command palette
 *   g then <key>    jump to a page (the leader sequence declared in nav.ts)
 *   ⌘B              collapse/expand the nav rail
 *   ⌘Enter          approve a pending approval
 *   Esc             close the palette / cockpit, or clear focus mode
 *
 * Shortcuts are ignored while the user is typing, except ⌘K and Escape.
 */
export function useShortcuts() {
  const router = useRouter();
  const leader = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = useUiStore.getState();
      const agent = useAgentStore.getState();
      const mod = event.metaKey || event.ctrlKey;
      const typing = isTypingTarget(event.target);

      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        ui.toggleCommandPalette();
        return;
      }

      if (event.key === "Escape") {
        if (ui.commandPaletteOpen) ui.closeCommandPalette();
        else if (ui.cockpitFindingId) ui.closeCockpit();
        else if (ui.focusMode !== "none") ui.setFocusMode("none");
        return;
      }

      if (typing) return;

      if (mod && event.key.toLowerCase() === "b") {
        event.preventDefault();
        ui.toggleRail();
        return;
      }

      if (mod && event.key === "Enter" && agent.approval) {
        event.preventDefault();
        void agent.resolveApproval("approve");
        return;
      }

      // Leader sequence: "g" then the item's second key, within 1.2s.
      if (event.key === "g" && !mod) {
        leader.current = { key: "g", at: Date.now() };
        return;
      }

      if (leader.current && Date.now() - leader.current.at < 1200) {
        const combo = `g ${event.key}`;
        const target = NAV_ITEMS.find((item) => item.shortcut === combo);
        leader.current = null;
        if (target) {
          event.preventDefault();
          router.push(target.href);
        }
        return;
      }

      leader.current = null;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);
}

import {
  Accessibility,
  Bot,
  Bug,
  Eye,
  FileCode2,
  FolderKanban,
  Gauge,
  Library,
  ListChecks,
  PlayCircle,
  Settings,
  ShieldCheck,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { LucideIconName } from "@/config/nav";

/**
 * Static map instead of a dynamic `icons[name]` lookup: a dynamic index into
 * lucide's barrel pulls the entire icon set into the bundle.
 */
export const NAV_ICONS: Record<LucideIconName, LucideIcon> = {
  FolderKanban,
  Bot,
  ListChecks,
  FileCode2,
  PlayCircle,
  Bug,
  Accessibility,
  ShieldCheck,
  Gauge,
  Eye,
  Webhook,
  Library,
  Settings,
};

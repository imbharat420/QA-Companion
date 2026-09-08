"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { Archive, Clock, FolderOpen, Plus, Star, UploadCloud } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { ToneDot, TreeView } from "@/components/shared";
import { routes } from "@/config/nav";
import { cn, formatCompact } from "@/lib/utils";
import { UploadDropzone } from "./UploadDropzone";
import type { TreeNode } from "@/components/shared";
import type { Workspace, WorkspaceFolder } from "@/lib/api/types";

export const QUICK_VIEWS = ["all", "recent", "starred", "uploaded", "archived"] as const;
export type QuickView = (typeof QUICK_VIEWS)[number];

export const isQuickView = (value: string): value is QuickView =>
  (QUICK_VIEWS as readonly string[]).includes(value);

const QUICK_VIEW_META: { id: Exclude<QuickView, "all">; label: string; icon: typeof Clock }[] = [
  { id: "recent", label: "Recent", icon: Clock },
  { id: "starred", label: "Starred", icon: Star },
  { id: "uploaded", label: "Uploaded", icon: UploadCloud },
  { id: "archived", label: "Archived", icon: Archive },
];

export interface ProjectSidebarProps {
  /** Every workspace, unfiltered — the sidebar is the map, not the result set. */
  projects: Workspace[];
  folders: WorkspaceFolder[];
  view: QuickView;
  /** "all" or a folder name, mirroring the Folder select in the filter bar. */
  folder: string;
  activeProjectId: string | null;
  counts: Record<QuickView, number>;
  onViewChange: (view: QuickView) => void;
  onFolderChange: (folder: string) => void;
  onNewProject: () => void;
}

export function ProjectSidebar({
  projects,
  folders,
  view,
  folder,
  activeProjectId,
  counts,
  onViewChange,
  onFolderChange,
  onNewProject,
}: ProjectSidebarProps) {
  const folderTone = useMemo(
    () => new Map(folders.map((entry) => [entry.name, entry.colorToken])),
    [folders],
  );

  const nodes = useMemo<TreeNode[]>(
    () =>
      folders.map((entry) => ({
        id: entry.id,
        label: entry.name,
        badge: entry.count,
        colorToken: entry.colorToken,
        data: entry.name,
        children: projects
          .filter((project) => project.folder === entry.name)
          .map((project) => ({
            id: `${entry.id}-${project.id}`,
            label: project.name,
            badge: formatCompact(project.tests),
            href: routes.project(project.id),
          })),
      })),
    [folders, projects],
  );

  const onSelect = useCallback(
    (node: TreeNode) => {
      // Folder rows carry their name in `data`; workspace children navigate by href.
      if (typeof node.data === "string") onFolderChange(node.data === folder ? "all" : node.data);
    },
    [folder, onFolderChange],
  );

  const selectedFolderId = folders.find((entry) => entry.name === folder)?.id;

  return (
    <aside
      data-testid="projects-sidebar"
      aria-label="Project folders"
      className="flex w-full flex-col gap-4 p-3"
    >
      {/* --- header ---------------------------------------------------------- */}
      <button
        type="button"
        onClick={() => {
          onViewChange("all");
          onFolderChange("all");
        }}
        data-testid="projects-sidebar-all"
        aria-pressed={view === "all" && folder === "all"}
        className={cn(
          "flex items-center justify-between gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left transition-colors",
          view === "all" && folder === "all"
            ? "bg-secondary text-foreground"
            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        )}
      >
        <span className="flex items-center gap-2">
          <FolderOpen className="size-4" aria-hidden />
          <span className="font-display text-[13px] font-semibold">All projects</span>
        </span>
        <Badge variant="muted" size="xs">
          {counts.all}
        </Badge>
      </button>

      {/* --- quick views ------------------------------------------------------ */}
      <nav aria-label="Quick views" className="flex flex-col gap-0.5">
        {QUICK_VIEW_META.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(view === id ? "all" : id)}
            aria-pressed={view === id}
            data-testid={`projects-sidebar-view-${id}`}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-xs transition-colors",
              view === id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
            <Badge variant="muted" size="xs" className="ml-auto shrink-0">
              {counts[id]}
            </Badge>
          </button>
        ))}
      </nav>

      <hr className="border-border/60" />

      {/* --- workspaces ------------------------------------------------------- */}
      <section aria-label="Projects" className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="label-mono">Projects</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onNewProject}
            aria-label="New project"
            data-testid="projects-sidebar-new"
          >
            <Plus className="size-3.5" aria-hidden />
          </Button>
        </div>

        {projects.map((project) => (
          <Link
            key={project.id}
            href={routes.project(project.id)}
            data-testid={`projects-sidebar-project-${project.id}`}
            aria-current={project.id === activeProjectId ? "true" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1 text-xs transition-colors",
              project.id === activeProjectId
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            <ToneDot tone={folderTone.get(project.folder ?? "") ?? "chart-1"} size={7} />
            <span className="truncate">{project.name}</span>
            <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-subtle-foreground">
              {formatCompact(project.tests)}
            </span>
          </Link>
        ))}
      </section>

      <hr className="border-border/60" />

      {/* --- folders ---------------------------------------------------------- */}
      <section aria-label="Folders" className="flex flex-col gap-1">
        <span className="px-2 label-mono">Folders</span>
        <TreeView
          nodes={nodes}
          selectedId={selectedFolderId}
          onSelect={onSelect}
          defaultExpanded={folders.map((entry) => entry.id)}
          testId="projects-sidebar-tree"
        />
      </section>

      <UploadDropzone compact className="mt-auto pt-2" />
    </aside>
  );
}

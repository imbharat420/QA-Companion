import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Folder, Plus, ArrowRight, GitBranch, Terminal, Sparkles, Search,
  LayoutGrid, List, SlidersHorizontal, ChevronDown, Check, Star,
  Trash2, Bell, RefreshCw, PanelLeftClose, ChevronRight, UploadCloud,
  FileCode, CheckCircle2, Zap, ArrowUpDown, X, Globe, Layers, FolderGit2
} from "lucide-react";
import { useAgent } from "@/lib/agentContext";
import type { Workspace } from "@/lib/mockData";
import { AddProjectModal } from "@/components/modals/AddProjectModal";

interface Props {
  onEnter: (workspace?: Workspace) => void;
}

export default function WorkspacePicker({ onEnter }: Props) {
  const { workspaces, currentWorkspace, setCurrentWorkspace } = useAgent();

  // Navigation / active section
  const [activeNav, setActiveNav] = useState<string>("all-projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");

  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [designsOpen, setDesignsOpen] = useState(true);
  const [projectsSectionOpen, setProjectsSectionOpen] = useState(true);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return workspaces.filter((w) => {
      const matchesSearch =
        w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.framework.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.testCommand.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === "all" || w.framework.toLowerCase().includes(typeFilter.toLowerCase());
      const matchesCategory = categoryFilter === "all" || w.category === categoryFilter;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [workspaces, searchQuery, typeFilter, categoryFilter]);

  const handleOpenProject = (project: Workspace) => {
    setCurrentWorkspace(project);
    onEnter(project);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0D13] text-[#F3F4F6] select-none font-sans" data-testid="workspace-picker">
      {/* ========================================================================= */}
      {/* 1. LEFT SIDEBAR (Matching docs/design/project-ui.webp & home.png)          */}
      {/* ========================================================================= */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/8 bg-[#0E1119] text-xs" data-testid="projects-sidebar">
        {/* Top Window Bar */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/8 px-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-[#FF5F57]" />
            <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="size-2.5 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <button
              onClick={() => setIsAddModalOpen(true)}
              title="Add Project"
              className="rounded p-1 hover:bg-white/5 hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
            <button
              onClick={() => window.location.reload()}
              title="Refresh"
              className="rounded p-1 hover:bg-white/5 hover:text-foreground"
            >
              <RefreshCw className="size-3.5" />
            </button>
            <button
              title="Collapse"
              className="rounded p-1 hover:bg-white/5 hover:text-foreground"
            >
              <PanelLeftClose className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Brand & Create Project Button */}
        <div className="p-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00F2FE] to-[#6366F1] py-2.5 text-xs font-semibold text-[#03252B] shadow-lg shadow-cyan-500/20 transition-all hover:opacity-95 active:scale-[0.98]"
            data-testid="sidebar-create-project-btn"
          >
            <Plus className="size-4 stroke-[2.5]" />
            <span>Create / Add Project</span>
          </button>
        </div>

        {/* Scrollable Navigation Tree */}
        <div className="flex-1 space-y-4 overflow-y-auto px-3 py-1">

          {/* Section: Projects (Accordion matching project-ui.webp) */}
          <div>
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-medium text-muted-foreground">
              <button
                onClick={() => setProjectsSectionOpen(!projectsSectionOpen)}
                className="flex items-center gap-1.5 hover:text-foreground"
              >
                <ChevronDown className={`size-3 transition-transform ${projectsSectionOpen ? "" : "-rotate-90"}`} />
                <span>Projects</span>
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="rounded p-0.5 hover:bg-white/5 hover:text-foreground"
                title="Add Project"
              >
                <Plus className="size-3" />
              </button>
            </div>

            {projectsSectionOpen && (
              <div className="mt-1 space-y-1">
                {workspaces.map((w, idx) => {
                  const isCurrent = currentWorkspace?.id === w.id;
                  const dotColors = ["bg-cyan-400", "bg-purple-400", "bg-emerald-400", "bg-amber-400", "bg-indigo-400"];
                  const dotColor = dotColors[idx % dotColors.length];

                  return (
                    <button
                      key={w.id}
                      onClick={() => handleOpenProject(w)}
                      className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-all ${
                        isCurrent
                          ? "bg-white/10 font-medium text-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`size-2 shrink-0 rounded-full ${dotColor}`} />
                        <span className="truncate text-xs">{w.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[10px] text-muted-foreground">{w.tests}</span>
                        {isCurrent && <ChevronRight className="size-3 text-cyan-300" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Smart Folders & Tags */}
          <div className="space-y-1 pt-1">
            <button
              onClick={() => setActiveNav("untagged")}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors ${
                activeNav === "untagged" ? "bg-white/10 text-cyan-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-sm bg-pink-400" />
                <span>Untagged</span>
              </span>
              <span className="font-mono text-[10px]">6</span>
            </button>

            <button
              onClick={() => setActiveNav("smart-folder")}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors ${
                activeNav === "smart-folder" ? "bg-white/10 text-cyan-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-sm bg-blue-400" />
                <span>Smart folder</span>
              </span>
              <span className="font-mono text-[10px]">12</span>
            </button>

            <button
              onClick={() => setActiveNav("prototype")}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors ${
                activeNav === "prototype" ? "bg-white/10 text-cyan-300" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="size-2 rounded-sm bg-amber-400" />
                <span>Prototype</span>
                <span className="rounded bg-emerald-500/20 px-1 py-0.2 font-mono text-[8px] font-semibold text-emerald-300">New</span>
              </span>
              <span className="font-mono text-[10px]">3</span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer: Theme Toggle & Profile */}
        <div className="border-t border-white/8 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 rounded-lg border border-white/10 bg-white/[0.04] p-0.5 text-[11px]">
              <button
                onClick={() => setThemeMode("light")}
                className={`flex-1 rounded py-1 text-center font-medium transition-all ${
                  themeMode === "light" ? "bg-white text-slate-900 shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setThemeMode("dark")}
                className={`flex-1 rounded py-1 text-center font-medium transition-all ${
                  themeMode === "dark" ? "bg-[#1E2433] text-cyan-300 shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Dark
              </button>
            </div>
            <button className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-cyan-300 hover:bg-cyan-400/10">
              <Zap className="size-3.5 fill-cyan-400 text-cyan-400" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 font-mono text-[10px] font-bold text-white">
                B
              </span>
              <span className="text-xs font-medium text-foreground">Bharat</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bell className="size-3.5 hover:text-foreground" />
              <Trash2 className="size-3.5 hover:text-foreground" />
            </div>
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA (Matching docs/design/home.png)                       */}
      {/* ========================================================================= */}
      <main className="relative flex flex-1 flex-col overflow-y-auto">
        {/* Atmospheric Top Glow matching home.png */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[60rem] -translate-x-1/2 rounded-full bg-gradient-to-b from-purple-500/12 via-cyan-400/8 to-transparent blur-[110px]" />

        {/* Top Header Controls Bar */}
        <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/8 px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-400 font-mono text-sm font-bold text-[#03252B]">
              Æ
            </span>
            <span className="text-xs font-semibold tracking-[0.25em] text-foreground">AETHER AI COMPANION</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onEnter(currentWorkspace)}
              className="flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-1.5 text-xs font-semibold text-[#03252B] transition-all hover:bg-cyan-300 active:scale-95"
            >
              <span>Open Automation QA</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </header>

        {/* Dashboard Main Container */}
        <div className="relative z-10 mx-auto w-full max-w-6xl p-8 space-y-8">
          {/* Title and Global Search Bar */}
          <div className="text-center space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              All projects
            </h1>

            {/* Pill Search Input */}
            <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-full border border-white/15 bg-[#12151E] px-4 py-2.5 shadow-xl shadow-black/40 transition-all focus-within:border-cyan-400/60 focus-within:ring-2 focus-within:ring-cyan-400/20">
              <Search className="size-4 text-cyan-300" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search designs, folders, projects and repos..."
                className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdown Pills matching home.png */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs outline-none hover:border-white/25 hover:text-foreground"
              >
                <option value="all">Type: All Frameworks</option>
                <option value="Next.js">Next.js</option>
                <option value="Remix">Remix</option>
                <option value="Vite">Vite + React</option>
                <option value="Tailwind">React + Tailwind</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs outline-none hover:border-white/25 hover:text-foreground"
              >
                <option value="all">Category: All</option>
                <option value="Web Application">Web Application</option>
                <option value="E-Commerce">E-Commerce</option>
                <option value="Design Tool">Design Tool</option>
                <option value="Web3 / Grants">Web3 / Grants</option>
                <option value="Design System">Design System</option>
              </select>

              <button className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs hover:border-white/25 hover:text-foreground">
                <span>Owner: All</span>
                <ChevronDown className="size-3" />
              </button>

              <button className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs hover:border-white/25 hover:text-foreground">
                <span>Date modified ▾</span>
              </button>
            </div>
          </div>

          {/* Controls Bar: Sort, View Toggle, Add New Project */}
          <div className="flex items-center justify-between border-b border-white/8 pb-3">
            <p className="text-sm font-semibold text-foreground">
              {filteredProjects.length} {filteredProjects.length === 1 ? "Project" : "Projects"} available
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-muted-foreground hover:border-white/20 hover:text-foreground"
                title={`Switch to ${viewMode === "grid" ? "List view" : "Grid view"}`}
              >
                {viewMode === "grid" ? <List className="size-3.5" /> : <LayoutGrid className="size-3.5" />}
                <span className="capitalize">{viewMode} view</span>
              </button>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-[#03252B] transition-all hover:bg-cyan-300 active:scale-95"
              >
                <Plus className="size-3.5 stroke-[2.5]" />
                <span>New Project</span>
              </button>
            </div>
          </div>

          {/* Section 1: Recents */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">Recents</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {workspaces.slice(0, 4).map((item) => (
                <div
                  key={`recent-${item.id}`}
                  onClick={() => handleOpenProject(item)}
                  className="group cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#12151E] p-3 transition-all hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10"
                >
                  <div className="relative mb-2.5 h-28 w-full overflow-hidden rounded-lg bg-black/40">
                    <img
                      src={item.thumbnail}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300 backdrop-blur">
                      {item.framework}
                    </span>
                  </div>
                  <p className="truncate text-xs font-semibold text-foreground group-hover:text-cyan-300">{item.name}</p>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{item.lastActive}</span>
                    <span className="font-mono text-emerald-400">{item.health}% health</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Folders */}
          <div className="space-y-3">
            <button
              onClick={() => setFoldersOpen(!foldersOpen)}
              className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground hover:text-cyan-300"
            >
              <ChevronDown className={`size-3.5 transition-transform ${foldersOpen ? "" : "-rotate-90"}`} />
              <span>Folders</span>
            </button>

            {foldersOpen && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: "Local Workspaces", count: "3 projects", icon: Folder },
                  { name: "GitHub Repositories", count: "1 repo connected", icon: Globe },
                  { name: "Uploads & Bundles", count: "2 projects", icon: UploadCloud },
                ].map((f) => (
                  <div
                    key={f.name}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#12151E] p-3.5 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.03]"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                      <f.icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{f.count}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Projects / Designs Catalog */}
          <div className="space-y-3">
            <button
              onClick={() => setDesignsOpen(!designsOpen)}
              className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground hover:text-cyan-300"
            >
              <ChevronDown className={`size-3.5 transition-transform ${designsOpen ? "" : "-rotate-90"}`} />
              <span>All Projects & Designs</span>
            </button>

            {designsOpen && (
              <>
                {viewMode === "grid" ? (
                  /* ========================================================================= */
                  /* GRID VIEW                                                                 */
                  /* ========================================================================= */
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredProjects.map((p) => (
                      <div
                        key={p.id}
                        data-testid={`project-card-${p.name}`}
                        className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#12151E] transition-all hover:border-cyan-400/40 hover:shadow-xl hover:shadow-black/50"
                      >
                        {/* Thumbnail & Badges */}
                        <div className="relative h-40 w-full overflow-hidden bg-black/40">
                          <img
                            src={p.thumbnail}
                            alt={p.name}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-[#12151E] via-transparent to-black/30" />
                          <div className="absolute left-3 top-3 flex gap-1.5">
                            <span className="rounded-md bg-black/70 px-2 py-0.5 font-mono text-[10px] text-cyan-300 backdrop-blur">
                              {p.framework}
                            </span>
                            <span className="rounded-md bg-black/70 px-2 py-0.5 font-mono text-[10px] text-muted-foreground backdrop-blur">
                              {p.category}
                            </span>
                          </div>
                          {p.gitUrl && (
                            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 font-mono text-[9px] text-emerald-400 backdrop-blur">
                              <Globe className="size-2.5" /> git
                            </span>
                          )}
                        </div>

                        {/* Card Details */}
                        <div className="flex flex-1 flex-col p-4">
                          <div className="mb-1 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground group-hover:text-cyan-300">
                              {p.name}
                            </h3>
                            <span className="font-mono text-[10px] text-muted-foreground">{p.lastActive}</span>
                          </div>

                          <p className="mb-3 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                            {p.description}
                          </p>

                          {/* Commands & Scripts */}
                          <div className="mt-auto space-y-1.5 rounded-lg border border-white/8 bg-black/30 p-2.5 font-mono text-[10px]">
                            <div className="flex items-center gap-2 truncate text-cyan-300/90">
                              <Terminal className="size-3 shrink-0 text-cyan-300" />
                              <span className="truncate">{p.devCommand}</span>
                            </div>
                            <div className="flex items-center gap-2 truncate text-emerald-400">
                              <Sparkles className="size-3 shrink-0 text-emerald-400" />
                              <span className="truncate">{p.testCommand}</span>
                            </div>
                          </div>

                          {/* Launch Button */}
                          <button
                            onClick={() => handleOpenProject(p)}
                            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-cyan-400/10 py-2 text-xs font-semibold text-cyan-300 border border-cyan-400/30 transition-all hover:bg-cyan-400 hover:text-[#03252B]"
                          >
                            <span>Open Automation QA</span>
                            <ArrowRight className="size-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* ========================================================================= */
                  /* DETAILED LIST VIEW (With full description and commands)                   */
                  /* ========================================================================= */
                  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#12151E]" data-testid="projects-list-view">
                    <div className="grid grid-cols-[200px_1fr_220px_140px] border-b border-white/8 bg-[#0E1119] px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <span>Project / Framework</span>
                      <span>Description & Commands</span>
                      <span>Stats & Branch</span>
                      <span className="text-right">Action</span>
                    </div>

                    <div className="divide-y divide-white/5">
                      {filteredProjects.map((p) => (
                        <div
                          key={`row-${p.id}`}
                          className="grid grid-cols-[200px_1fr_220px_140px] items-center gap-4 px-4 py-3.5 transition-colors hover:bg-white/[0.02]"
                        >
                          {/* Project Name & Framework */}
                          <div>
                            <p className="text-xs font-bold text-foreground">{p.name}</p>
                            <span className="inline-block mt-1 rounded bg-cyan-400/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300 border border-cyan-400/20">
                              {p.framework}
                            </span>
                            <p className="mt-1 font-mono text-[9px] text-muted-foreground truncate">{p.path}</p>
                          </div>

                          {/* Full Detailed Description & Commands */}
                          <div className="space-y-1.5">
                            <p className="text-[11px] leading-relaxed text-foreground/90">{p.description}</p>
                            <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                              <span className="rounded bg-black/40 px-2 py-0.5 text-cyan-300 border border-white/8">
                                Dev: {p.devCommand}
                              </span>
                              <span className="rounded bg-black/40 px-2 py-0.5 text-emerald-400 border border-white/8">
                                Test: {p.testCommand}
                              </span>
                            </div>
                          </div>

                          {/* Stats & Branch */}
                          <div className="font-mono text-[10px] text-muted-foreground space-y-1">
                            <div className="flex items-center gap-1.5">
                              <GitBranch className="size-3 text-cyan-300" />
                              <span className="text-foreground">{p.branch}</span>
                            </div>
                            <div>
                              <span>{p.tests} tests</span> · <span className="text-emerald-400">{p.health}% health</span>
                            </div>
                            <div className="text-[9px]">Last active: {p.lastActive}</div>
                          </div>

                          {/* Action Button */}
                          <div className="text-right">
                            <button
                              onClick={() => handleOpenProject(p)}
                              className="inline-flex items-center gap-1 rounded-lg bg-cyan-400 px-3 py-1.5 text-xs font-semibold text-[#03252B] transition-all hover:bg-cyan-300 active:scale-95"
                            >
                              <span>Open QA</span>
                              <ArrowRight className="size-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Add Project Modal */}
      <AddProjectModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddedAndOpen={(p) => handleOpenProject(p)}
      />
    </div>
  );
}

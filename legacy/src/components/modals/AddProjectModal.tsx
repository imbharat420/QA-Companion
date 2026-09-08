import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Folder, GitBranch, UploadCloud, CheckCircle2, Sparkles, Terminal, Globe, ArrowRight } from "lucide-react";
import { useAgent } from "@/lib/agentContext";
import type { Workspace } from "@/lib/mockData";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onAddedAndOpen?: (project: Workspace) => void;
}

export function AddProjectModal({ open, onClose, onAddedAndOpen }: Props) {
  const { addWorkspace, setCurrentWorkspace } = useAgent();
  const [tab, setTab] = useState<"folder" | "github" | "upload">("folder");

  // Local folder fields
  const [folderPath, setFolderPath] = useState("~/projects/customer-portal");
  const [name, setName] = useState("customer-portal");
  const [framework, setFramework] = useState("Next.js 15");
  const [description, setDescription] = useState("Customer account dashboard with billing portal, SSO integration, and automated user journey regression suites.");
  const [devCommand, setDevCommand] = useState("npm run dev");
  const [testCommand, setTestCommand] = useState("npx playwright test e2e/portal.spec.ts");

  // GitHub fields
  const [gitUrl, setGitUrl] = useState("https://github.com/acme-corp/customer-portal");
  const [branch, setBranch] = useState("main");
  const [isCloning, setIsCloning] = useState(false);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleGitHubFetch = () => {
    setIsCloning(true);
    setTimeout(() => {
      setIsCloning(false);
      const inferredName = gitUrl.split("/").pop()?.replace(".git", "") || "github-project";
      setName(inferredName);
      setFolderPath(`~/projects/${inferredName}`);
      setDescription(`Imported from ${gitUrl} on branch ${branch}. Verified Playwright and Chromium automation compatibility.`);
      toast.success(`Repository metadata fetched from ${gitUrl}`);
    }, 900);
  };

  const handleSimulatedUpload = () => {
    setUploadProgress(10);
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p === null) return 10;
        if (p >= 90) {
          clearInterval(interval);
          setTimeout(() => {
            setUploadProgress(100);
            setTimeout(() => setUploadProgress(null), 500);
          }, 300);
          return 90;
        }
        return p + 25;
      });
    }, 250);
  };

  const createProjectObject = (): Workspace => {
    const id = `ws-${Date.now().toString().slice(-4)}`;
    return {
      id,
      name: name.trim() || "untitled-project",
      path: folderPath.trim() || "~/projects/untitled",
      framework,
      branch: branch || "main",
      sessions: 0,
      tests: 24,
      lastActive: "Just now",
      health: 100,
      description: description.trim() || "Project imported into Aether AI QA Workspace.",
      devCommand: devCommand.trim() || "npm run dev",
      testCommand: testCommand.trim() || "npx playwright test",
      gitUrl: tab === "github" ? gitUrl : undefined,
      category: tab === "github" ? "GitHub Import" : "Local Workspace",
      thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80",
      starred: false,
      owner: { name: "Bharat (You)", avatar: "B" },
      folder: tab === "github" ? "GitHub Repositories" : "Local Workspaces",
    };
  };

  const handleSaveOnly = () => {
    const project = createProjectObject();
    addWorkspace(project);
    toast.success(`Project "${project.name}" added successfully`);
    onClose();
  };

  const handleSaveAndLaunch = () => {
    const project = createProjectObject();
    addWorkspace(project);
    setCurrentWorkspace(project);
    toast.success(`Project "${project.name}" added — launching Automation QA`);
    onClose();
    if (onAddedAndOpen) {
      onAddedAndOpen(project);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md select-none"
        onClick={onClose}
        data-testid="add-project-modal-backdrop"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0E1119] shadow-2xl shadow-black/80"
          data-testid="add-project-modal"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/8 bg-[#12151E] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                <Folder className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Add New Project</h2>
                <p className="text-[11px] text-muted-foreground">Import from local folder, clone from GitHub, or drop your repository</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-white/8 bg-[#0B0D13] px-6">
            <button
              onClick={() => setTab("folder")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-all ${
                tab === "folder" ? "border-cyan-400 text-cyan-300" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Folder className="size-3.5" /> Local Folder
            </button>
            <button
              onClick={() => setTab("github")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-all ${
                tab === "github" ? "border-cyan-400 text-cyan-300" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitBranch className="size-3.5" /> GitHub Repository
            </button>
            <button
              onClick={() => setTab("upload")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-medium transition-all ${
                tab === "upload" ? "border-cyan-400 text-cyan-300" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <UploadCloud className="size-3.5" /> Drag & Drop Upload
            </button>
          </div>

          {/* Content Body */}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto p-6 text-xs">
            {tab === "folder" && (
              <div className="space-y-3.5">
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Project Directory Path</label>
                  <div className="flex gap-2">
                    <input
                      value={folderPath}
                      onChange={(e) => setFolderPath(e.target.value)}
                      placeholder="/Users/username/projects/my-app"
                      className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-cyan-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setFolderPath("D:/vibe/projects/customer-portal");
                        setName("customer-portal");
                        toast.info("Selected folder: D:/vibe/projects/customer-portal");
                      }}
                      className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-foreground hover:bg-white/10"
                    >
                      Browse...
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Project Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. blixen-tours"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-foreground outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Framework / Runtime</label>
                    <select
                      value={framework}
                      onChange={(e) => setFramework(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-[#12151E] px-3 py-2 text-xs text-foreground outline-none focus:border-cyan-400/50"
                    >
                      <option value="Next.js 15">Next.js 15 (App Router)</option>
                      <option value="Remix">Remix / React Router 7</option>
                      <option value="Vite + React">Vite + React</option>
                      <option value="React 19 + Tailwind">React 19 + Tailwind</option>
                      <option value="Vue 3 + Vite">Vue 3 + Vite</option>
                      <option value="SvelteKit">SvelteKit</option>
                      <option value="Custom HTML/Node">Custom HTML/Node</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Project Description</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this application does and critical paths to test..."
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-foreground outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Terminal className="size-3 text-cyan-300" /> Start / Dev Command
                    </label>
                    <input
                      value={devCommand}
                      onChange={(e) => setDevCommand(e.target.value)}
                      placeholder="npm run dev"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-cyan-300 outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Sparkles className="size-3 text-emerald-400" /> Automation QA Test Command
                    </label>
                    <input
                      value={testCommand}
                      onChange={(e) => setTestCommand(e.target.value)}
                      placeholder="npx playwright test"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-emerald-300 outline-none focus:border-cyan-400/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {tab === "github" && (
              <div className="space-y-3.5">
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">GitHub Repository Link</label>
                  <div className="flex gap-2">
                    <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                      <Globe className="size-3.5 text-muted-foreground" />
                      <input
                        value={gitUrl}
                        onChange={(e) => setGitUrl(e.target.value)}
                        placeholder="https://github.com/organization/repo-name"
                        className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={isCloning}
                      onClick={handleGitHubFetch}
                      className="flex items-center gap-1.5 rounded-lg bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-300 border border-cyan-400/30 hover:bg-cyan-400/20 disabled:opacity-50"
                    >
                      {isCloning ? <span className="size-3 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" /> : <GitBranch className="size-3.5" />}
                      Fetch Repo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Branch</label>
                    <input
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="main"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Project Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="repo-name"
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-foreground outline-none focus:border-cyan-400/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Description & QA Scope</label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-foreground outline-none focus:border-cyan-400/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Start / Dev Command</label>
                    <input
                      value={devCommand}
                      onChange={(e) => setDevCommand(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-cyan-300 outline-none focus:border-cyan-400/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Automation QA Command</label>
                    <input
                      value={testCommand}
                      onChange={(e) => setTestCommand(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-emerald-300 outline-none focus:border-cyan-400/50"
                    />
                  </div>
                </div>
              </div>
            )}

            {tab === "upload" && (
              <div className="space-y-4">
                <div
                  onClick={handleSimulatedUpload}
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/20 bg-white/[0.02] p-8 text-center transition-all hover:border-cyan-400/50 hover:bg-cyan-400/5"
                >
                  <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300 transition-transform group-hover:scale-110">
                    <UploadCloud className="size-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Drag and drop your project repository or folder</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Supports .zip, git bundle, or folder upload with package.json detection</p>
                  <button
                    type="button"
                    className="mt-4 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-1.5 text-xs font-medium text-foreground hover:bg-white/10"
                  >
                    Select Folder
                  </button>
                </div>

                {uploadProgress !== null && (
                  <div className="rounded-xl border border-white/10 bg-[#12151E] p-4">
                    <div className="mb-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-cyan-300">
                        {uploadProgress < 100 ? `Sending... ${uploadProgress}%` : "Repository unpacked & verified ✓"}
                      </span>
                      <span className="text-muted-foreground">{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-cyan-400 transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-white/8 bg-[#12151E] px-6 py-4">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span>Chromium & Playwright ready</span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOnly}
                className="rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-400/20"
              >
                Add to Projects
              </button>
              <button
                type="button"
                onClick={handleSaveAndLaunch}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-[#03252B] transition-all hover:bg-cyan-300 active:scale-95"
              >
                <span>Launch Automation QA</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

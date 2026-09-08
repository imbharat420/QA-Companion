"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Chrome,
  Database,
  FileText,
  Info,
  KeyRound,
  Palette,
  Plus,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Badge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui";
import {
  ConfirmDialog,
  CopyButton,
  LoadingState,
  PageHeader,
  StatGrid,
  StatTile,
} from "@/components/shared";
import { ApiSourcePanel, NumberField, SettingsField, SettingsSection } from "@/components/settings";
import { isTauri } from "@/lib/api/tauri";
import {
  API_MODES,
  useSettingsStore,
  type AgentProvider,
  type BrowserEngine,
  type Density,
} from "@/store/settingsStore";
import { routes } from "@/config/nav";
import { cn } from "@/lib/utils";

/**
 * Shipped in the Tauri bundle, so the version has to be a build-time constant:
 * `process.env.npm_package_version` is a Node-only value and package.json is
 * not part of the client graph.
 */
const APP_VERSION = "1.0.0";
const APP_NAME = "Aether QA Companion";

const TABS = [
  { id: "api", label: "API Source", icon: Database },
  { id: "agent", label: "Agent", icon: Bot },
  { id: "browser", label: "Browser", icon: Chrome },
  { id: "policy", label: "Policy", icon: ShieldCheck },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "about", label: "About", icon: Info },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** `?tab=data` is what the other pages' ErrorStates link to; treat it as `api`. */
const TAB_ALIAS: Record<string, TabId> = { data: "api", source: "api", ui: "appearance" };

function canonicalTab(raw: string | null): TabId {
  if (!raw) return "api";
  if (TABS.some((t) => t.id === raw)) return raw as TabId;
  return TAB_ALIAS[raw] ?? "api";
}

const PROVIDERS: { value: AgentProvider; label: string; credential: string }[] = [
  {
    value: "claude-cli",
    label: "Claude CLI",
    credential: "Delegated to the signed-in Claude CLI session — nothing is stored here.",
  },
  {
    value: "anthropic-api",
    label: "Anthropic API",
    credential: "Read from the OS keychain entry aether/anthropic at task start.",
  },
  {
    value: "openai",
    label: "OpenAI",
    credential: "Read from the OS keychain entry aether/openai at task start.",
  },
  {
    value: "local",
    label: "Local model",
    credential: "No credential — the runner talks to a local endpoint.",
  },
];

const ENGINES: { value: BrowserEngine; label: string }[] = [
  { value: "chromium", label: "Chromium" },
  { value: "firefox", label: "Firefox" },
  { value: "webkit", label: "WebKit" },
];

const VIEWPORTS = [
  { value: "desktop", label: "Desktop" },
  { value: "tablet", label: "Tablet" },
  { value: "mobile", label: "Mobile" },
] as const;

const THROTTLES = [
  { value: "none", label: "No throttling" },
  { value: "fast-3g", label: "Fast 3G" },
  { value: "slow-3g", label: "Slow 3G" },
] as const;

const DENSITIES: { value: Density; label: string }[] = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" },
];

const DOCS = [
  { label: "Build rules", path: "docs/BUILD-RULES.md" },
  { label: "Page contract", path: "docs/BUILD-CONTRACT.md" },
  { label: "Design reference", path: "docs/design/nexus-analytics-dashboard-2-DESIGN.md" },
];

/* ==========================================================================
   Chip list — approvals and the two domain lists share it
   ========================================================================== */

function ChipList({
  items,
  onChange,
  placeholder,
  tone = "outline",
  testId,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  tone?: "primary" | "error" | "outline";
  testId: string;
}) {
  const [draft, setDraft] = useState("");

  const add = useCallback(() => {
    const value = draft.trim();
    if (value === "" || items.includes(value)) {
      setDraft("");
      return;
    }
    onChange([...items, value]);
    setDraft("");
  }, [draft, items, onChange]);

  return (
    <div className="flex w-full flex-col gap-2" data-testid={testId}>
      {items.length === 0 ? (
        <p className="text-[11px] text-subtle-foreground" data-testid={`${testId}-empty`}>
          Nothing in this list yet — add the first entry below.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item}>
              <Badge variant={tone} size="sm" className="gap-1.5 pr-1 normal-case tracking-normal">
                <span className="text-code">{item}</span>
                <button
                  type="button"
                  onClick={() => onChange(items.filter((i) => i !== item))}
                  aria-label={`Remove ${item}`}
                  data-testid={`${testId}-remove-${item}`}
                  className="grid size-4 place-items-center rounded-full text-current transition-colors hover:bg-muted"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          spellCheck={false}
          aria-label={placeholder}
          className="min-w-0 flex-1 text-code"
          data-testid={`${testId}-input`}
        />
        <Button variant="outline" size="sm" onClick={add} data-testid={`${testId}-add`}>
          <Plus className="size-3.5" aria-hidden />
          Add
        </Button>
      </div>
    </div>
  );
}

/* ==========================================================================
   The page
   ========================================================================== */

function SettingsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const rawTab = params.get("tab");
  const tab = canonicalTab(rawTab);

  const agent = useSettingsStore((s) => s.agent);
  const browser = useSettingsStore((s) => s.browser);
  const policy = useSettingsStore((s) => s.policy);
  const appearance = useSettingsStore((s) => s.appearance);
  const apiMode = useSettingsStore((s) => s.api.mode);
  const patchAgent = useSettingsStore((s) => s.patchAgent);
  const patchBrowser = useSettingsStore((s) => s.patchBrowser);
  const patchPolicy = useSettingsStore((s) => s.patchPolicy);
  const patchAppearance = useSettingsStore((s) => s.patchAppearance);
  const reset = useSettingsStore((s) => s.reset);

  const [resetOpen, setResetOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [runtime, setRuntime] = useState<"desktop" | "browser">("browser");

  useEffect(() => {
    setRuntime(isTauri() ? "desktop" : "browser");
    setTheme(window.localStorage.getItem("aether.theme") === "light" ? "light" : "dark");
  }, []);

  // An unknown or aliased `?tab=` is rewritten so the URL always names the
  // section that is actually on screen.
  useEffect(() => {
    if (rawTab !== null && rawTab !== tab) {
      router.replace(routes.settings({ tab }), { scroll: false });
    }
  }, [rawTab, router, tab]);

  /** A section is view state, not history — replace, like every other filter. */
  const onTabChange = useCallback(
    (next: string) => router.replace(routes.settings({ tab: next }), { scroll: false }),
    [router],
  );

  const applyTheme = useCallback((next: string) => {
    if (next !== "dark" && next !== "light") return;
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("aether.theme", next);
    setTheme(next);
  }, []);

  const provider = PROVIDERS.find((p) => p.value === agent.provider) ?? PROVIDERS[0];
  const sourceLabel = API_MODES.find((m) => m.value === apiMode)?.label ?? apiMode;

  return (
    <div className="flex w-full flex-col gap-5 p-6">
      <PageHeader
        title="Settings"
        description="Where the data comes from, how the agent behaves, what the browser does and what it is never allowed to touch."
        icon={SettingsIcon}
        breadcrumbs={[{ label: "Projects", href: routes.projects() }, { label: "Settings" }]}
        meta={
          <>
            <span>
              Source <span className="text-code text-foreground">{apiMode}</span>
            </span>
            <span>
              Provider <span className="text-code text-foreground">{agent.provider}</span>
            </span>
            <span>
              Engine <span className="text-code text-foreground">{browser.engine}</span>
            </span>
            <span>
              Runtime <span className="text-code text-foreground">{runtime}</span>
            </span>
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={onTabChange}
        orientation="vertical"
        className="flex-row items-start gap-4"
      >
        <TabsList
          className="h-auto w-[188px] shrink-0 flex-col items-stretch gap-1 rounded-[var(--radius-lg)] bg-card p-1.5 xl:w-[220px]"
          data-testid="settings-tabs"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              data-testid={`settings-tab-${id}`}
              className={cn(
                "h-11 justify-start gap-2 border-l-2 border-transparent px-2.5 text-xs",
                "data-[state=active]:border-l-primary data-[state=active]:bg-secondary",
              )}
            >
              <Icon aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-w-0 flex-1">
          <TabsContent value="api" className="max-w-[760px]">
            <ApiSourcePanel />
          </TabsContent>

          {/* --- agent ------------------------------------------------------ */}
          <TabsContent value="agent" className="max-w-[760px]">
            <SettingsSection
              title="Agent"
              description="Which model plans and drives the browser, and how much rope it gets per task."
              icon={Bot}
              testId="settings-agent-section"
            >
              <SettingsField
                label="Provider"
                help="Where completions come from. Credentials never live in this app's storage."
                htmlFor="settings-agent-provider"
              >
                <Select
                  value={agent.provider}
                  onValueChange={(value) => patchAgent({ provider: value as AgentProvider })}
                >
                  <SelectTrigger
                    id="settings-agent-provider"
                    className="w-full sm:w-[220px]"
                    data-testid="settings-agent-provider"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsField>

              <SettingsField
                label="Credential"
                help={provider.credential}
              >
                <Badge
                  variant={agent.provider === "local" ? "muted" : "success"}
                  size="sm"
                  className="gap-1.5 normal-case tracking-normal"
                  data-testid="settings-agent-keychain-status"
                >
                  <KeyRound className="size-3" aria-hidden />
                  {agent.provider === "claude-cli"
                    ? "CLI session"
                    : agent.provider === "local"
                      ? "Not required"
                      : "OS keychain"}
                </Badge>
              </SettingsField>

              <SettingsField
                label="Model"
                help="Exact model id passed to the provider."
                htmlFor="settings-agent-model"
              >
                <Input
                  id="settings-agent-model"
                  value={agent.model}
                  onChange={(e) => patchAgent({ model: e.target.value })}
                  spellCheck={false}
                  className="w-full text-code sm:w-[220px]"
                  data-testid="settings-agent-model"
                />
              </SettingsField>

              <SettingsField
                label="Max tokens per task"
                help={
                  <>
                    Hard budget for one task.{" "}
                    <Link
                      href={routes.workbench()}
                      className="text-primary underline-offset-2 hover:underline"
                      data-testid="settings-agent-workbench-link"
                    >
                      Live spend is in the workbench
                    </Link>
                    .
                  </>
                }
                htmlFor="settings-agent-max-tokens"
              >
                <NumberField
                  id="settings-agent-max-tokens"
                  value={agent.maxTokensPerTask}
                  min={1_000}
                  max={2_000_000}
                  step={1_000}
                  suffix="tokens"
                  onCommit={(maxTokensPerTask) => patchAgent({ maxTokensPerTask })}
                  testId="settings-agent-max-tokens"
                />
              </SettingsField>

              <SettingsField
                label="Max steps per task"
                help="The agent stops and asks for direction rather than looping forever."
                htmlFor="settings-agent-max-steps"
              >
                <NumberField
                  id="settings-agent-max-steps"
                  value={agent.maxStepsPerTask}
                  min={1}
                  max={1_000}
                  suffix="steps"
                  onCommit={(maxStepsPerTask) => patchAgent({ maxStepsPerTask })}
                  testId="settings-agent-max-steps"
                />
              </SettingsField>

              <SettingsField
                label="Temperature"
                help="Low keeps repro steps deterministic; high explores more of the UI."
              >
                <div className="flex w-full items-center gap-3 sm:w-[220px]">
                  <Slider
                    value={[agent.temperature]}
                    min={0}
                    max={1}
                    step={0.05}
                    onValueChange={([temperature]) => patchAgent({ temperature })}
                    aria-label="Temperature"
                    data-testid="settings-agent-temperature"
                  />
                  <span className="w-9 shrink-0 text-right text-code tabular-nums text-foreground">
                    {agent.temperature.toFixed(2)}
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label="Always require approval"
                help="Action ids the agent must pause on, whatever else it has been told."
                stacked
              >
                <ChipList
                  items={agent.approvalRequired}
                  onChange={(approvalRequired) => patchAgent({ approvalRequired })}
                  placeholder="payment.submit"
                  tone="primary"
                  testId="settings-agent-approvals"
                />
              </SettingsField>

              <SettingsField
                label="Auto-approve read-only steps"
                help="Clicks, scrolls and assertions that change nothing run without a prompt."
                htmlFor="settings-agent-auto-approve"
              >
                <Switch
                  id="settings-agent-auto-approve"
                  checked={agent.autoApproveReadOnly}
                  onCheckedChange={(autoApproveReadOnly) => patchAgent({ autoApproveReadOnly })}
                  data-testid="settings-agent-auto-approve"
                />
              </SettingsField>
            </SettingsSection>
          </TabsContent>

          {/* --- browser ---------------------------------------------------- */}
          <TabsContent value="browser" className="max-w-[760px]">
            <SettingsSection
              title="Browser"
              description="The engine and conditions every run starts from unless a case overrides them."
              icon={Chrome}
              testId="settings-browser-section"
            >
              <SettingsField label="Engine" help="Playwright launches this build for every run.">
                <ToggleGroup
                  type="single"
                  value={browser.engine}
                  onValueChange={(value) => value && patchBrowser({ engine: value as BrowserEngine })}
                  aria-label="Browser engine"
                  data-testid="settings-browser-engine"
                >
                  {ENGINES.map((e) => (
                    <ToggleGroupItem
                      key={e.value}
                      value={e.value}
                      data-testid={`settings-browser-engine-${e.value}`}
                    >
                      {e.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </SettingsField>

              <SettingsField
                label="Headless"
                help="Off shows the live browser pane — the point of the workbench."
                htmlFor="settings-browser-headless"
              >
                <Switch
                  id="settings-browser-headless"
                  checked={browser.headless}
                  onCheckedChange={(headless) => patchBrowser({ headless })}
                  data-testid="settings-browser-headless"
                />
              </SettingsField>

              <SettingsField label="Viewport" help="Starting window size for a new page.">
                <ToggleGroup
                  type="single"
                  value={browser.viewport}
                  onValueChange={(value) =>
                    value && patchBrowser({ viewport: value as (typeof VIEWPORTS)[number]["value"] })
                  }
                  aria-label="Viewport"
                  data-testid="settings-browser-viewport"
                >
                  {VIEWPORTS.map((v) => (
                    <ToggleGroupItem
                      key={v.value}
                      value={v.value}
                      data-testid={`settings-browser-viewport-${v.value}`}
                    >
                      {v.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </SettingsField>

              <SettingsField
                label="Network throttle"
                help="Applied to every request, so perf numbers stay comparable between runs."
                htmlFor="settings-browser-throttle"
              >
                <Select
                  value={browser.throttle}
                  onValueChange={(value) =>
                    patchBrowser({ throttle: value as (typeof THROTTLES)[number]["value"] })
                  }
                >
                  <SelectTrigger
                    id="settings-browser-throttle"
                    className="w-full sm:w-[180px]"
                    data-testid="settings-browser-throttle"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THROTTLES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingsField>

              <SettingsField
                label="Default timeout"
                help="Per-action wait before a step is called failed."
                htmlFor="settings-browser-timeout"
              >
                <NumberField
                  id="settings-browser-timeout"
                  value={browser.defaultTimeoutMs}
                  min={1_000}
                  max={300_000}
                  step={1_000}
                  suffix="ms"
                  onCommit={(defaultTimeoutMs) => patchBrowser({ defaultTimeoutMs })}
                  testId="settings-browser-timeout"
                />
              </SettingsField>
            </SettingsSection>
          </TabsContent>

          {/* --- policy ----------------------------------------------------- */}
          <TabsContent value="policy" className="max-w-[760px]">
            <SettingsSection
              title="Policy"
              description="The guard rails. Blocked always beats allowed, and the agent cannot widen these itself."
              icon={ShieldCheck}
              testId="settings-policy-section"
            >
              <SettingsField
                label="Allowed domains"
                help="Navigation outside this list needs a human approval. Wildcards allowed."
                stacked
              >
                <ChipList
                  items={policy.allowedDomains}
                  onChange={(allowedDomains) => patchPolicy({ allowedDomains })}
                  placeholder="*.staging.internal"
                  tone="primary"
                  testId="settings-policy-allowed"
                />
              </SettingsField>

              <SettingsField
                label="Blocked domains"
                help="Never visited, never typed into — this list wins over the allow list."
                stacked
              >
                <ChipList
                  items={policy.blockedDomains}
                  onChange={(blockedDomains) => patchPolicy({ blockedDomains })}
                  placeholder="*.bank.com"
                  tone="error"
                  testId="settings-policy-blocked"
                />
              </SettingsField>

              <SettingsField
                label="Max crawl depth"
                help="How far from the entry URL a discovery pass may wander."
                htmlFor="settings-policy-depth"
              >
                <NumberField
                  id="settings-policy-depth"
                  value={policy.maxCrawlDepth}
                  min={1}
                  max={20}
                  suffix="levels"
                  onCommit={(maxCrawlDepth) => patchPolicy({ maxCrawlDepth })}
                  testId="settings-policy-depth"
                />
              </SettingsField>

              <SettingsField
                label="Max pages per scan"
                help="Upper bound on one scan, so a link farm cannot burn the whole budget."
                htmlFor="settings-policy-pages"
              >
                <NumberField
                  id="settings-policy-pages"
                  value={policy.maxPagesPerScan}
                  min={1}
                  max={5_000}
                  step={10}
                  suffix="pages"
                  onCommit={(maxPagesPerScan) => patchPolicy({ maxPagesPerScan })}
                  testId="settings-policy-pages"
                />
              </SettingsField>

              <SettingsField
                label="Respect robots.txt"
                help="Honour crawl directives on every domain, including your own staging hosts."
                htmlFor="settings-policy-robots"
              >
                <Switch
                  id="settings-policy-robots"
                  checked={policy.respectRobotsTxt}
                  onCheckedChange={(respectRobotsTxt) => patchPolicy({ respectRobotsTxt })}
                  data-testid="settings-policy-robots"
                />
              </SettingsField>

              <SettingsField
                label="Redact secrets"
                help={
                  <>
                    Masks tokens, cookies and form values in transcripts and evidence.{" "}
                    <Link
                      href={routes.findings()}
                      className="text-primary underline-offset-2 hover:underline"
                      data-testid="settings-policy-findings-link"
                    >
                      See findings redaction
                    </Link>
                    .
                  </>
                }
                htmlFor="settings-policy-redact"
              >
                <Switch
                  id="settings-policy-redact"
                  checked={policy.redactSecrets}
                  onCheckedChange={(redactSecrets) => patchPolicy({ redactSecrets })}
                  data-testid="settings-policy-redact"
                />
              </SettingsField>

              {!policy.redactSecrets ? (
                <div
                  className="flex items-start gap-2 bg-destructive/10 px-4 py-3"
                  data-testid="settings-policy-redact-warning"
                >
                  <AlertTriangle className="mt-px size-4 shrink-0 text-destructive" aria-hidden />
                  <p className="text-[11px] leading-relaxed text-foreground">
                    Redaction is off. Raw request headers, cookies and typed credentials will be
                    written into transcripts, screenshots and exported findings in clear text.
                  </p>
                </div>
              ) : null}
            </SettingsSection>
          </TabsContent>

          {/* --- appearance -------------------------------------------------- */}
          <TabsContent value="appearance" className="max-w-[760px]">
            <SettingsSection
              title="Appearance"
              description="Local to this machine — none of it travels with a project or a run."
              icon={Palette}
              testId="settings-appearance-section"
            >
              <SettingsField label="Theme" help="A pure token swap; shared with the title bar toggle.">
                <ToggleGroup
                  type="single"
                  value={theme}
                  onValueChange={applyTheme}
                  aria-label="Theme"
                  data-testid="settings-appearance-theme"
                >
                  <ToggleGroupItem value="dark" data-testid="settings-appearance-theme-dark">
                    Dark
                  </ToggleGroupItem>
                  <ToggleGroupItem value="light" data-testid="settings-appearance-theme-light">
                    Light
                  </ToggleGroupItem>
                </ToggleGroup>
              </SettingsField>

              <SettingsField label="Density" help="Compact fits more rows per screen in tables and timelines.">
                <ToggleGroup
                  type="single"
                  value={appearance.density}
                  onValueChange={(value) => value && patchAppearance({ density: value as Density })}
                  aria-label="Density"
                  data-testid="settings-appearance-density"
                >
                  {DENSITIES.map((d) => (
                    <ToggleGroupItem
                      key={d.value}
                      value={d.value}
                      data-testid={`settings-appearance-density-${d.value}`}
                    >
                      {d.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </SettingsField>

              <SettingsField
                label="Reduce motion"
                help="Stops chart animations and panel transitions app-wide, on top of the OS setting."
                htmlFor="settings-appearance-reduce-motion"
              >
                <Switch
                  id="settings-appearance-reduce-motion"
                  checked={appearance.reduceMotion}
                  onCheckedChange={(reduceMotion) => patchAppearance({ reduceMotion })}
                  data-testid="settings-appearance-reduce-motion"
                />
              </SettingsField>

              <SettingsField
                label="Ambient effects"
                help="Grid field and brand glow behind focal panels. Off is cheaper on integrated GPUs."
                htmlFor="settings-appearance-ambient"
              >
                <Switch
                  id="settings-appearance-ambient"
                  checked={appearance.showAmbientEffects}
                  onCheckedChange={(showAmbientEffects) => patchAppearance({ showAmbientEffects })}
                  data-testid="settings-appearance-ambient"
                />
              </SettingsField>
            </SettingsSection>
          </TabsContent>

          {/* --- about ------------------------------------------------------- */}
          <TabsContent value="about" className="max-w-[760px]">
            <div className="flex flex-col gap-3">
              <StatGrid columns={2}>
                <StatTile
                  label="Application"
                  value={APP_NAME}
                  hint={`Version ${APP_VERSION}`}
                  icon={Info}
                  testId="settings-about-app"
                />
                <StatTile
                  label="Data source"
                  value={sourceLabel}
                  hint="Change it on the API Source tab"
                  icon={Database}
                  tone="accent"
                  href={routes.settings({ tab: "api" })}
                  testId="settings-about-source"
                />
                <StatTile
                  label="Runtime"
                  value={runtime === "desktop" ? "Tauri desktop" : "Browser"}
                  hint={
                    runtime === "desktop"
                      ? "Rust backend reachable over IPC"
                      : "No Rust backend — Tauri IPC is unavailable"
                  }
                  icon={Chrome}
                  tone={runtime === "desktop" ? "success" : "warning"}
                  testId="settings-about-runtime"
                />
                <StatTile
                  label="Agent provider"
                  value={provider.label}
                  hint={agent.model}
                  icon={Bot}
                  href={routes.settings({ tab: "agent" })}
                  testId="settings-about-provider"
                />
              </StatGrid>

              <SettingsSection
                title="Documentation"
                description="The conventions this build follows. Paths are relative to the repo root."
                icon={FileText}
                testId="settings-about-docs"
              >
                {DOCS.map((doc) => (
                  <div
                    key={doc.path}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{doc.label}</p>
                      <p className="mt-0.5 truncate text-code text-muted-foreground">{doc.path}</p>
                    </div>
                    <CopyButton
                      value={doc.path}
                      label="Copy path"
                      testId={`settings-about-doc-${doc.label.toLowerCase().replace(/\s+/g, "-")}`}
                    />
                  </div>
                ))}
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  <Button variant="outline" size="sm" asChild data-testid="settings-about-workbench">
                    <Link href={routes.workbench()}>Open the workbench</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild data-testid="settings-about-findings">
                    <Link href={routes.findings()}>Review findings</Link>
                  </Button>
                </div>
              </SettingsSection>

              <SettingsSection
                title="Reset"
                description="Puts every tab back to the shipped defaults on this machine."
                icon={RotateCcw}
                testId="settings-about-reset-section"
              >
                <SettingsField
                  label="Reset all settings"
                  help="Data source, agent, browser, policy and appearance. Runs, findings and projects are untouched."
                >
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setResetOpen(true)}
                    data-testid="settings-reset-all"
                  >
                    <RotateCcw className="size-3.5" aria-hidden />
                    Reset all settings
                  </Button>
                </SettingsField>
              </SettingsSection>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset all settings?"
        description="Every tab returns to its default. The data source goes back to mock fixtures, which clears the query cache and refetches every open screen."
        confirmLabel="Reset everything"
        destructive
        onConfirm={reset}
        testId="settings-reset-confirm"
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <LoadingState rows={6} variant="panel" />
        </div>
      }
    >
      <SettingsScreen />
    </Suspense>
  );
}

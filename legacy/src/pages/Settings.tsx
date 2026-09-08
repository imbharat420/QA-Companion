import { useState } from "react";
import { motion } from "motion/react";
import { Brain, Gauge, Monitor, ShieldCheck, KeyRound, Eye, EyeOff, Save } from "lucide-react";
import { toast } from "sonner";

function Toggle({ on, onClick, testid }: { on: boolean; onClick: () => void; testid: string }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-cyan-400" : "bg-white/15"}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: typeof Brain; title: string; desc: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/10 bg-[#0E1119] p-4"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cyan-300">
          <Icon className="size-3.5" />
        </span>
        <div>
          <h2 className="text-xs font-semibold text-foreground">{title}</h2>
          <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}

const inputCls = "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-xs text-foreground outline-none transition-colors focus:border-cyan-400/50";
const labelCls = "mb-1 block text-[10px] font-medium text-muted-foreground";

export default function Settings() {
  const [headless, setHeadless] = useState(false);
  const [watchdog, setWatchdog] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState<"local" | "browserless">("local");
  const [secMode, setSecMode] = useState("passive");

  return (
    <div className="h-full overflow-y-auto bg-background p-6" data-testid="settings-page">
      <div className="mx-auto max-w-4xl">
        <p className="mb-1 font-mono text-[10px] tracking-[0.25em] text-cyan-300">CONFIGURATION</p>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-xs text-muted-foreground">Workspace blixen-tours · stored in .claude/settings.json</p>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <Section icon={Brain} title="Agent model" desc="Provider and reasoning profile">
            <label className={labelCls}>Model</label>
            <select data-testid="settings-model-select" className={inputCls} defaultValue="claude-sonnet-4.6">
              <option value="claude-sonnet-4.6">Claude Sonnet 4.6 · via Claude CLI</option>
              <option value="claude-opus">Claude Opus 4.8 · high reasoning</option>
              <option value="gpt-5.4-mini">GPT-5.4 Mini · fallback</option>
            </select>
            <label className={`${labelCls} mt-3`}>Reasoning effort</label>
            <select data-testid="settings-reasoning-select" className={inputCls} defaultValue="standard">
              <option value="low">Low — fast exploration</option>
              <option value="standard">Standard</option>
              <option value="high">High — deep diagnosis</option>
            </select>
          </Section>

          <Section icon={Gauge} title="Budgets" desc="Hard limits — the agent stops and asks">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Tokens / task</label>
                <input data-testid="settings-token-budget" className={inputCls} defaultValue="120000" />
              </div>
              <div>
                <label className={labelCls}>Tool calls</label>
                <input data-testid="settings-toolcall-budget" className={inputCls} defaultValue="60" />
              </div>
              <div>
                <label className={labelCls}>Time (min)</label>
                <input data-testid="settings-time-budget" className={inputCls} defaultValue="15" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <span className="text-[11px] text-foreground/85">Loop watchdog — pause when no progress</span>
              <Toggle testid="settings-watchdog-toggle" on={watchdog} onClick={() => setWatchdog((v) => !v)} />
            </div>
          </Section>

          <Section icon={Monitor} title="Browser engine" desc="Where the agent's browser runs">
            <div className="mb-3 grid grid-cols-2 gap-2">
              {(["local", "browserless"] as const).map((p) => (
                <button
                  key={p}
                  data-testid={`settings-provider-${p}`}
                  onClick={() => setProvider(p)}
                  className={`rounded-lg border px-3 py-2 text-left transition-all ${provider === p ? "border-cyan-400/50 bg-cyan-400/8" : "border-white/10 hover:border-white/25"}`}
                >
                  <p className="text-[11px] font-semibold text-foreground">{p === "local" ? "Local Chromium" : "Browserless"}</p>
                  <p className="text-[9.5px] text-muted-foreground">{p === "local" ? "Playwright · private default" : "Remote CDP · shareable live URL"}</p>
                </button>
              ))}
            </div>
            <label className={labelCls}>Viewport</label>
            <select data-testid="settings-viewport-select" className={inputCls} defaultValue="1280x800">
              <option value="1280x800">1280 × 800 (desktop)</option>
              <option value="1440x900">1440 × 900</option>
              <option value="390x844">390 × 844 (mobile)</option>
            </select>
            <div className="mt-3 flex items-center justify-between rounded-lg border border-white/8 bg-black/20 px-3 py-2">
              <span className="text-[11px] text-foreground/85">Headless mode</span>
              <Toggle testid="settings-headless-toggle" on={headless} onClick={() => setHeadless((v) => !v)} />
            </div>
          </Section>

          <Section icon={ShieldCheck} title="Security scope" desc="What the security agent may touch">
            <div className="space-y-1.5">
              {[
                { id: "passive", label: "Passive", desc: "observe only — headers, cookies, config" },
                { id: "safe", label: "Safe active", desc: "non-destructive probes on staging" },
                { id: "auth", label: "Authenticated", desc: "includes logged-in routes" },
              ].map((m) => (
                <button
                  key={m.id}
                  data-testid={`settings-secmode-${m.id}`}
                  onClick={() => setSecMode(m.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-all ${secMode === m.id ? "border-cyan-400/50 bg-cyan-400/8" : "border-white/10 hover:border-white/25"}`}
                >
                  <span className={`size-2.5 rounded-full border-2 ${secMode === m.id ? "border-cyan-400 bg-cyan-400/40" : "border-white/30"}`} />
                  <span>
                    <span className="block text-[11px] font-semibold text-foreground">{m.label}</span>
                    <span className="block text-[9.5px] text-muted-foreground">{m.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section icon={KeyRound} title="Credentials" desc="Stored in OS keychain — never in context">
            <label className={labelCls}>Anthropic API key (fallback)</label>
            <div className="relative">
              <input
                data-testid="settings-api-key"
                type={showKey ? "text" : "password"}
                className={`${inputCls} pr-9`}
                defaultValue="sk-ant-aether-9f2k-local-vault"
              />
              <button
                data-testid="settings-api-key-reveal"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            <p className="mt-2 font-mono text-[9px] text-muted-foreground">Primary auth: Claude CLI session (authenticated)</p>
          </Section>

          <div className="flex items-end justify-end">
            <button
              data-testid="settings-save-button"
              onClick={() => toast.success("Workspace settings saved")}
              className="flex items-center gap-2 rounded-lg bg-cyan-400 px-5 py-2 text-xs font-semibold text-[#03252B] transition-all hover:bg-cyan-300 active:scale-[0.98]"
            >
              <Save className="size-3.5" /> Save settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

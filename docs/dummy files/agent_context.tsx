import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

export type AgentStatus = "idle" | "thinking" | "planning" | "executing" | "waiting" | "completed" | "stopped";
export type PageId = "blank" | "loading" | "home" | "login" | "checkout" | "confirm";

export interface ChatMsg { id: number; from: "user" | "agent" | "system"; text: string; ts: string; }
export interface TimelineEvent {
  id: number; ts: string;
  kind: "plan" | "navigate" | "click" | "type" | "inspect" | "assert" | "approval" | "network" | "screenshot";
  label: string; detail: string; status: "ok" | "fail" | "warn" | "info";
}
export interface NetEntry { id: number; method: string; url: string; status: number; ms: number; }
export interface LogEntry { id: number; level: "log" | "warn" | "error"; text: string; ts: string; }
export interface Approval { title: string; desc: string; action: string; risk: "high" | "medium"; }

export interface BrowserState {
  url: string; title: string; page: PageId;
  overlay: string | null;
  cursorTarget: string | null;
  highlight: string | null; highlightLabel: string | null;
  clickPulse: { target: string; key: number } | null;
  inputs: Record<string, string>;
  tabs: { id: string; title: string }[];
  activeTab: string;
}

interface AgentCtx {
  status: AgentStatus; messages: ChatMsg[]; timeline: TimelineEvent[];
  network: NetEntry[]; logs: LogEntry[]; approval: Approval | null;
  browser: BrowserState; tokens: number; running: boolean; sessionId: string;
  runTask: (prompt: string) => void; approve: () => void; deny: () => void; stopAgent: () => void;
}

const Ctx = createContext<AgentCtx | null>(null);
export const useAgent = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAgent outside provider");
  return v;
};

const now = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

const INITIAL_BROWSER: BrowserState = {
  url: "about:blank", title: "New Tab", page: "blank",
  overlay: null, cursorTarget: null, highlight: null, highlightLabel: null,
  clickPulse: null, inputs: {},
  tabs: [{ id: "tab-1", title: "New Tab" }], activeTab: "tab-1",
};

export function AgentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 0, from: "agent", ts: now(), text: "Workspace blixen-tours loaded — .claude context, 384 tests, Chromium ready. Ask me to test, explore or fix anything." },
  ]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [network, setNetwork] = useState<NetEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [browser, setBrowser] = useState<BrowserState>(INITIAL_BROWSER);
  const [tokens, setTokens] = useState(0);
  const [running, setRunning] = useState(false);

  const idRef = useRef(1);
  const timers = useRef<number[]>([]);
  const nid = () => idRef.current++;

  const clearTimers = () => {
    timers.current.forEach((t) => { clearTimeout(t); clearInterval(t); });
    timers.current = [];
  };
  const schedule = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const msg = (from: ChatMsg["from"], text: string) =>
    setMessages((m) => [...m, { id: nid(), from, text, ts: now() }]);
  const tl = (kind: TimelineEvent["kind"], label: string, detail: string, status: TimelineEvent["status"] = "ok") =>
    setTimeline((t) => [...t, { id: nid(), ts: now(), kind, label, detail, status }]);
  const net = (method: string, url: string, status: number, ms: number) =>
    setNetwork((n) => [...n, { id: nid(), method, url, status, ms }]);
  const log = (level: LogEntry["level"], text: string) =>
    setLogs((l) => [...l, { id: nid(), level, text, ts: now() }]);
  const patch = (p: Partial<BrowserState>) => setBrowser((b) => ({ ...b, ...p }));

  const startTicker = () => {
    timers.current.push(window.setInterval(() => setTokens((t) => t + 12 + Math.floor(Math.random() * 38)), 650));
  };

  const finish = (finalStatus: AgentStatus) => {
    clearTimers();
    setRunning(false);
    setStatus(finalStatus);
    patch({ overlay: null, cursorTarget: null, highlight: null, highlightLabel: null });
  };

  const typeInto = (start: number, target: string, text: string) => {
    for (let i = 1; i <= text.length; i++) {
      const slice = text.slice(0, i);
      schedule(start + i * 55, () =>
        setBrowser((b) => ({ ...b, inputs: { ...b.inputs, [target]: slice } })));
    }
  };

  const runTask = useCallback((prompt: string) => {
    clearTimers();
    setApproval(null);
    setTimeline([]); setNetwork([]); setLogs([]);
    setTokens(0);
    setBrowser(INITIAL_BROWSER);
    setRunning(true);
    msg("user", prompt);

    schedule(500, () => { setStatus("thinking"); startTicker(); });
    schedule(1200, () => msg("agent", "On it — opening blixen.tours and walking the booking flow end to end. Watch the browser."));
    schedule(1900, () => {
      setStatus("executing");
      patch({ overlay: "Launching Chromium · attaching session" });
      tl("plan", "Plan created", "6 steps · explore → sign in → checkout → verify", "info");
    });
    schedule(2600, () => {
      patch({ url: "https://blixen.tours", page: "loading", overlay: "browser.navigate → blixen.tours", tabs: [{ id: "tab-1", title: "Loading…" }] });
      tl("navigate", "Navigate", "https://blixen.tours");
      net("GET", "blixen.tours", 200, 182);
    });
    schedule(3400, () => {
      patch({ page: "home", title: "Blixen Tours — Nordic adventures", tabs: [{ id: "tab-1", title: "Blixen Tours" }] });
      net("GET", "/api/tours", 200, 96);
      net("GET", "/assets/hero.avif", 200, 141);
      log("log", "[app] hydration complete (34 modules)");
    });
    schedule(4100, () => {
      patch({ overlay: "browser.inspect → scanning page" });
      tl("inspect", "Inspect page", "14 interactive elements · 1 form · 0 console errors", "info");
    });
    schedule(4900, () => msg("agent", "Page loaded. I see the booking funnel — signing in with the workspace demo account."));
    schedule(5600, () => {
      patch({ highlight: "nav-signin", highlightLabel: 'button "Sign in"', cursorTarget: "nav-signin", overlay: 'browser.click → "Sign in"' });
    });
    schedule(6800, () => {
      patch({ clickPulse: { target: "nav-signin", key: nid() }, highlight: null, highlightLabel: null });
      tl("click", "Click", 'button "Sign in"');
      tl("screenshot", "Screenshot", "login-form.png saved to session", "info");
    });
    schedule(7300, () => {
      patch({ page: "login", url: "https://blixen.tours/login", tabs: [{ id: "tab-1", title: "Sign in — Blixen" }], overlay: "Login form detected — 2 fields" });
      log("log", "[router] navigation → /login");
    });
    schedule(8100, () => msg("agent", "Typing credentials. Secrets come from the workspace vault and are redacted from the trace."));
    schedule(8700, () => {
      patch({ highlight: "login-email", highlightLabel: 'input[type="email"]', cursorTarget: "login-email", overlay: "browser.type → email" });
    });
    schedule(9300, () => typeInto(0, "login-email", "demo@blixen.tours"));
    schedule(10400, () => {
      tl("type", "Type", "email → demo@blixen.tours");
      patch({ highlight: "login-password", highlightLabel: 'input[type="password"]', cursorTarget: "login-password", overlay: "browser.type → password (redacted)" });
    });
    schedule(11000, () => typeInto(0, "login-password", "••••••••••"));
    schedule(11800, () => {
      tl("type", "Type", "password → •••••••••• (redacted)");
      patch({ highlight: "login-submit", highlightLabel: 'button "Sign in"', cursorTarget: "login-submit", overlay: 'browser.click → "Sign in"' });
    });
    schedule(12900, () => {
      patch({ clickPulse: { target: "login-submit", key: nid() }, highlight: null, highlightLabel: null });
      net("POST", "/api/auth/login", 200, 212);
      tl("click", "Click", 'button "Sign in" → 200');
    });
    schedule(13500, () => {
      patch({ page: "checkout", url: "https://blixen.tours/checkout", tabs: [{ id: "tab-1", title: "Checkout — Blixen" }], overlay: "Checkout reached — verifying summary" });
      log("log", "[checkout] 1 item · Lofoten Night Sky · €348.00");
      net("GET", "/api/cart", 200, 64);
    });
    schedule(14500, () => {
      net("POST", "/api/analytics", 403, 88);
      log("error", "POST /api/analytics → 403 (blocked by CSP connect-src)");
      tl("network", "Request failed", "POST /api/analytics → 403", "warn");
    });
    schedule(15200, () => msg("agent", "One anomaly: the analytics beacon is 403-blocked by CSP. Non-blocking — I've noted it as a finding candidate."));
    schedule(16000, () => {
      setStatus("waiting");
      setApproval({
        title: "Submit payment?",
        desc: "The agent wants to click “Pay €348.00” on blixen.tours using card •• 4242.",
        action: 'browser.click → button "Pay €348.00"',
        risk: "high",
      });
      patch({ overlay: "Waiting for your approval…", highlight: "pay-submit", highlightLabel: 'button "Pay €348.00"' });
      tl("approval", "Approval required", "browser.click → payment submit", "warn");
    });
  }, []);

  const approve = useCallback(() => {
    if (!approval) return;
    setApproval(null);
    msg("system", "You approved · payment step");
    setStatus("executing");
    schedule(300, () => patch({ overlay: 'browser.click → "Pay €348.00"', cursorTarget: "pay-submit" }));
    schedule(1300, () => {
      patch({ clickPulse: { target: "pay-submit", key: nid() }, highlight: null, highlightLabel: null });
      net("POST", "/api/payments", 200, 342);
      tl("click", "Click", 'button "Pay €348.00" → 200');
    });
    schedule(2100, () => {
      patch({ page: "confirm", url: "https://blixen.tours/confirmation", tabs: [{ id: "tab-1", title: "Booking confirmed" }], overlay: "Asserting outcome…" });
    });
    schedule(2900, () => {
      tl("assert", "Assert", "Booking confirmed · ref BLX-90413");
      tl("screenshot", "Screenshot", "confirmation.png saved to session", "info");
      log("log", "[checkout] order BLX-90413 confirmed");
      patch({ overlay: null, cursorTarget: null });
    });
    schedule(3700, () => {
      msg("agent", "Booking flow complete. 14 elements inspected, 7 requests (1 blocked by CSP), trace + 3 screenshots saved to this session. Want me to open a finding for the analytics 403?");
      finish("completed");
    });
  }, [approval]);

  const deny = useCallback(() => {
    if (!approval) return;
    setApproval(null);
    msg("system", "You denied · payment step");
    msg("agent", "Understood — stopped before payment. The trace up to checkout is saved to this session.");
    finish("completed");
  }, [approval]);

  const stopAgent = useCallback(() => {
    clearTimers();
    setApproval(null);
    msg("system", "Agent stopped by user");
    setStatus("stopped");
    setRunning(false);
    patch({ overlay: null, cursorTarget: null, highlight: null, highlightLabel: null });
  }, []);

  return (
    <Ctx.Provider value={{
      status, messages, timeline, network, logs, approval, browser, tokens, running,
      sessionId: "ses-0142", runTask, approve, deny, stopAgent,
    }}>
      {children}
    </Ctx.Provider>
  );
}

"use client";

import { create } from "zustand";
import { getDataSource } from "@/lib/api";
import type { Unsubscribe } from "@/lib/api/contract";
import type {
  AgentEvent,
  AgentStatus,
  AgentTaskInput,
  ApprovalRequest,
  BrowserState,
  ChatMessage,
  ConsoleEntry,
  DomNode,
  Finding,
  NetworkEntry,
  PlanCard,
  StuckPrompt,
  TimelineStep,
} from "@/lib/api/types";
import { INITIAL_BROWSER_STATE } from "@/lib/fixtures/browser";

/**
 * LIVE AGENT SESSION — the port of the prototype AgentProvider.
 *
 * The prototype drove the UI from a wall of setTimeout calls inside a React
 * context. Here the *adapter* owns the choreography (the mock replays a
 * scripted timeline, http streams SSE, tauri forwards an IPC channel) and this
 * store only folds `AgentEvent`s into state. That is also why nothing is
 * persisted: a session belongs to a running task, and a reload has no task.
 */

/** Ring-buffer ceiling for the two firehose lists — a long run must not grow forever. */
const MAX_ENTRIES = 200;

export interface AgentState {
  status: AgentStatus;
  taskId: string | null;
  messages: ChatMessage[];
  plan: PlanCard | null;
  timeline: TimelineStep[];
  network: NetworkEntry[];
  logs: ConsoleEntry[];
  approval: ApprovalRequest | null;
  stuck: StuckPrompt | null;
  browser: BrowserState;
  domTree: DomNode | null;
  /** Findings opened during *this* run; the Findings inbox still owns the catalog. */
  findings: Finding[];
  tokens: number;
  running: boolean;
  selectedStepId: number | null;
  summary: string | null;
  error: string | null;

  applyEvent: (event: AgentEvent) => void;
  startTask: (input: AgentTaskInput) => Promise<void>;
  stopTask: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  resolveApproval: (decision: "approve" | "reject") => Promise<void>;
  resolveStuck: (choice: StuckPrompt["choices"][number]) => Promise<void>;
  selectStep: (id: number | null) => void;
  setBrowserPatch: (patch: Partial<BrowserState>) => void;
  takeControl: (on: boolean) => void;
  reset: () => void;
}

const DEFAULTS = {
  status: "idle" as AgentStatus,
  taskId: null,
  messages: [] as ChatMessage[],
  plan: null,
  timeline: [] as TimelineStep[],
  network: [] as NetworkEntry[],
  logs: [] as ConsoleEntry[],
  approval: null,
  stuck: null,
  browser: INITIAL_BROWSER_STATE,
  domTree: null,
  findings: [] as Finding[],
  tokens: 0,
  running: false,
  selectedStepId: null,
  summary: null,
  error: null,
};

/**
 * Event-stream teardown. Deliberately module-level: a function is not
 * serialisable, so keeping it in state would poison persist and devtools, and
 * nothing renders from it.
 */
let unsubscribe: Unsubscribe | null = null;

const detach = () => {
  unsubscribe?.();
  unsubscribe = null;
};

const clock = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

/** Local chat ids continue from whatever the stream last used, so keys never collide. */
const say = (messages: ChatMessage[], from: ChatMessage["from"], text: string): ChatMessage[] => [
  ...messages,
  { id: (messages.at(-1)?.id ?? 0) + 1, from, text, ts: clock() },
];

/** Overlays and cursors are mid-action decorations; they must not outlive the run. */
const IDLE_BROWSER_PATCH = {
  overlay: null,
  cursor: null,
  highlight: null,
  ripple: null,
  typing: null,
} satisfies Partial<BrowserState>;

const TERMINAL: AgentStatus[] = ["completed", "stopped", "error"];

export const useAgentStore = create<AgentState>()((set, get) => ({
  ...DEFAULTS,

  applyEvent: (event) =>
    set((s) => {
      switch (event.type) {
        case "status":
          return { status: event.status, running: !TERMINAL.includes(event.status) };
        case "message":
          return { messages: [...s.messages, event.message] };
        case "plan":
          return { plan: event.plan };
        case "step":
          return { timeline: [...s.timeline, event.step] };
        case "browser":
          return { browser: { ...s.browser, ...event.patch } };
        case "network":
          return { network: [...s.network, event.entry].slice(-MAX_ENTRIES) };
        case "console":
          return { logs: [...s.logs, event.entry].slice(-MAX_ENTRIES) };
        case "dom":
          return { domTree: event.tree };
        case "approval":
          // A pending gate is the one thing that can interrupt "executing".
          return { approval: event.request, status: event.request ? "waiting" : s.status };
        case "stuck":
          return { stuck: event.prompt, status: event.prompt ? "waiting" : s.status };
        case "tokens":
          return { tokens: event.total };
        case "finding":
          return {
            findings: s.findings.some((f) => f.id === event.finding.id)
              ? s.findings.map((f) => (f.id === event.finding.id ? event.finding : f))
              : [...s.findings, event.finding],
          };
        case "done":
          return {
            status: event.status,
            running: false,
            summary: event.summary,
            error: event.status === "error" ? event.summary : null,
            approval: null,
            stuck: null,
            browser: { ...s.browser, ...IDLE_BROWSER_PATCH },
          };
      }
    }),

  startTask: async (input) => {
    detach();
    // Keep the transcript, drop the previous run evidence — as the prototype did.
    set((s) => ({
      ...DEFAULTS,
      messages: say(s.messages, "user", input.prompt),
      status: "thinking",
      running: true,
    }));

    try {
      const source = getDataSource();
      const handle = await source.startAgentTask(input);
      set({ taskId: handle.taskId });
      unsubscribe = source.subscribeAgentEvents(handle.taskId, (event) => get().applyEvent(event));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Could not start the agent task.";
      set((s) => ({
        status: "error",
        running: false,
        error: detail,
        messages: say(s.messages, "system", `Task failed to start — ${detail}`),
      }));
    }
  },

  stopTask: async () => {
    const { taskId, running } = get();
    detach();
    set((s) => ({
      status: "stopped",
      running: false,
      approval: null,
      stuck: null,
      messages: running ? say(s.messages, "system", "Agent stopped by user") : s.messages,
      browser: { ...s.browser, ...IDLE_BROWSER_PATCH },
    }));
    if (!taskId) return;
    try {
      await getDataSource().stopAgentTask(taskId);
    } catch (cause) {
      // The local session is already stopped; a failed backend stop is a note, not a crash.
      const detail = cause instanceof Error ? cause.message : "unknown error";
      set((s) => ({
        messages: say(s.messages, "system", `Backend did not confirm the stop — ${detail}`),
      }));
    }
  },

  /**
   * One composer, two meanings: idle starts a task, a live run gets a steer.
   * The contract has no mid-task message channel, so a steer stays in the
   * transcript until an adapter grows one.
   */
  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!get().running) {
      await get().startTask({ prompt: trimmed });
      return;
    }
    set((s) => ({ messages: say(s.messages, "user", trimmed) }));
  },

  resolveApproval: async (decision) => {
    const { approval, taskId } = get();
    if (!approval) return;
    const approved = decision === "approve";
    set((s) => ({
      approval: null,
      status: approved ? "executing" : s.status,
      messages: say(s.messages, "system", `You ${approved ? "approved" : "denied"} · ${approval.title}`),
      browser: approved ? s.browser : { ...s.browser, ...IDLE_BROWSER_PATCH },
    }));
    if (!taskId) return;
    try {
      await getDataSource().resolveApproval(taskId, approval.id, decision);
    } catch (cause) {
      set((s) => ({
        error: cause instanceof Error ? cause.message : "Approval could not be delivered.",
        messages: say(s.messages, "system", "Approval could not be delivered to the agent."),
      }));
    }
  },

  resolveStuck: async (choice) => {
    if (!get().stuck) return;
    set((s) => ({ stuck: null, messages: say(s.messages, "system", `Stuck resolved · ${choice}`) }));
    if (choice === "stop") {
      await get().stopTask();
      return;
    }
    if (choice === "take-control") {
      get().takeControl(true);
      return;
    }
    set({ status: "executing" });
  },

  selectStep: (selectedStepId) => set({ selectedStepId }),

  setBrowserPatch: (patch) => set((s) => ({ browser: { ...s.browser, ...patch } })),

  takeControl: (on) =>
    set((s) => ({
      browser: { ...s.browser, takeover: on, ...(on ? IDLE_BROWSER_PATCH : {}) },
      status: on ? "waiting" : s.running ? "executing" : s.status,
      messages: say(
        s.messages,
        "system",
        on ? "You took control of the browser" : "Control handed back to the agent",
      ),
    })),

  reset: () => {
    detach();
    set({ ...DEFAULTS });
  },
}));

/* --- narrow selectors ------------------------------------------------------ */
export const useAgentStatus = () => useAgentStore((s) => s.status);
export const useAgentTaskId = () => useAgentStore((s) => s.taskId);
export const useAgentMessages = () => useAgentStore((s) => s.messages);
export const useAgentPlan = () => useAgentStore((s) => s.plan);
export const useAgentTimeline = () => useAgentStore((s) => s.timeline);
export const useAgentBrowser = () => useAgentStore((s) => s.browser);
export const useAgentApproval = () => useAgentStore((s) => s.approval);
export const useAgentStuck = () => useAgentStore((s) => s.stuck);
export const useAgentTokens = () => useAgentStore((s) => s.tokens);
export const useAgentRunning = () => useAgentStore((s) => s.running);
export const useAgentNetwork = () => useAgentStore((s) => s.network);
export const useAgentLogs = () => useAgentStore((s) => s.logs);
export const useAgentDomTree = () => useAgentStore((s) => s.domTree);
export const useAgentFindings = () => useAgentStore((s) => s.findings);
export const useAgentSummary = () => useAgentStore((s) => s.summary);
export const useAgentError = () => useAgentStore((s) => s.error);
export const useSelectedStepId = () => useAgentStore((s) => s.selectedStepId);
/** The scrubbed-to step itself — undefined when nothing is selected. */
export const useSelectedStep = () =>
  useAgentStore((s) => s.timeline.find((step) => step.id === s.selectedStepId));

/** Non-reactive read for shortcut handlers, adapters and tests. */
export const readAgent = () => useAgentStore.getState();

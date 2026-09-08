"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Accessibility,
  AlertTriangle,
  ArrowDown,
  Bot,
  Bug,
  Check,
  ChevronDown,
  Compass,
  FileCode2,
  FlaskConical,
  Hand,
  ListTree,
  Minus,
  MousePointer2,
  RotateCcw,
  SendHorizonal,
  ShieldAlert,
  SkipForward,
  Square,
  Unlink,
  UserRound,
  Workflow,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AgentStatusPill,
  CodeBlock,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  ErrorState,
  SeverityBadge,
} from "@/components/shared";
import {
  Badge,
  Button,
  Progress,
  Spinner,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui";
import { routes } from "@/config/nav";
import { QUICK_ACTIONS } from "@/lib/fixtures/browser";
import { cn, formatCompact, formatDuration } from "@/lib/utils";
import {
  readAgent,
  useAgentApproval,
  useAgentError,
  useAgentFindings,
  useAgentMessages,
  useAgentPlan,
  useAgentRunning,
  useAgentStatus,
  useAgentStore,
  useAgentStuck,
  useAgentSummary,
  useAgentTokens,
} from "@/store/agentStore";
import { useUiStore } from "@/store/uiStore";
import type {
  ApprovalRequest,
  ChatMessage,
  PlanCard,
  PlanStage,
  StuckPrompt,
  ToolActivity,
} from "@/lib/api/types";

/**
 * THE CHAT PANE.
 *
 * Two product rules drive the shape of this file:
 *
 * 1. **No chain-of-thought, ever.** The transcript renders the plan, the tool
 *    activity and the closing summary. Whatever reasoning produced them is not
 *    a surface — there is deliberately no branch here that could render it.
 * 2. **An approval genuinely halts the agent**, so it has to genuinely halt the
 *    pane: the transcript dims behind a scrim and the composer locks until the
 *    gate is resolved. A card the user can scroll past is a card they approve
 *    by accident.
 */

/* ==========================================================================
   Small shared bits
   ======================================================================== */

/**
 * Quick-action icons mapped by name — lucide's `icons` barrel would pull the
 * whole set into the bundle for the sake of eight chips.
 */
const ACTION_ICONS: Record<string, LucideIcon> = {
  Compass,
  FlaskConical,
  Workflow,
  Bug,
  Wrench,
  Accessibility,
  FileCode2,
  Unlink,
};

const RISK_VARIANT = { high: "error", medium: "warning", low: "info" } as const;

type StuckChoice = StuckPrompt["choices"][number];
type RememberScope = NonNullable<ApprovalRequest["rememberScope"]>;

const STUCK_LABELS: Record<StuckChoice, string> = {
  retry: "Retry step",
  skip: "Skip step",
  "take-control": "Take control",
  "provide-selector": "Provide selector",
  stop: "Stop task",
};

const STUCK_ICONS: Record<StuckChoice, LucideIcon> = {
  retry: RotateCcw,
  skip: SkipForward,
  "take-control": Hand,
  "provide-selector": MousePointer2,
  stop: Square,
};

const STAGE_TONE: Record<PlanStage["state"], string> = {
  pending: "border-border bg-elevated text-subtle-foreground",
  active: "border-executing/50 bg-executing/15 text-executing",
  done: "border-success/40 bg-success/15 text-success",
  failed: "border-error/50 bg-error/15 text-error",
  skipped: "border-border bg-muted text-muted-foreground",
};

/** Timestamps are ISO in fixtures and a local clock string in the store. */
function clockLabel(ts: string): string {
  const parsed = Date.parse(ts);
  if (Number.isNaN(parsed)) return ts;
  return new Date(parsed).toLocaleTimeString("en-GB", { hour12: false });
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

/* ==========================================================================
   Streamed agent text
   ======================================================================== */

const REVEAL_MS = 16;
const REVEAL_CHARS = 3;

interface StreamedTextProps {
  text: string;
  animate: boolean;
  /** Fired on each reveal so the transcript can keep itself pinned to the bottom. */
  onReveal?: () => void;
}

const StreamedText = memo(function StreamedText({ text, animate, onReveal }: StreamedTextProps) {
  const [shown, setShown] = useState(() => (animate ? 0 : text.length));

  useEffect(() => {
    if (!animate) {
      setShown(text.length);
      return;
    }
    let cursor = 0;
    setShown(0);
    const timer = window.setInterval(() => {
      cursor = Math.min(text.length, cursor + REVEAL_CHARS);
      setShown(cursor);
      onReveal?.();
      if (cursor >= text.length) window.clearInterval(timer);
    }, REVEAL_MS);
    return () => window.clearInterval(timer);
  }, [text, animate, onReveal]);

  const visible = animate ? text.slice(0, shown) : text;
  return (
    <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
      {visible}
      {animate && shown < text.length ? (
        <span aria-hidden className="ml-0.5 inline-block h-3 w-1 translate-y-0.5 bg-primary" />
      ) : null}
    </p>
  );
});

/* ==========================================================================
   PlanCard
   ======================================================================== */

export interface PlanBlockProps {
  plan: PlanCard;
  tokens: number;
}

const PlanBlock = memo(function PlanBlock({ plan, tokens }: PlanBlockProps) {
  const done = plan.stages.filter((s) => s.state === "done").length;
  const used = plan.budgetTokens > 0 ? (tokens / plan.budgetTokens) * 100 : 0;

  return (
    <section data-testid="chat-plan-card" aria-label="Agent plan" className="surface-card p-3">
      <header className="mb-2 flex items-start gap-2">
        <span className="mt-px grid size-5 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-planning/15 text-planning">
          <ListTree className="size-3" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-mono">Plan</p>
          <p className="mt-1 text-xs font-medium leading-snug text-foreground">{plan.goal}</p>
        </div>
        <Badge variant="outline" size="xs" className="shrink-0 tabular-nums">
          {done}/{plan.stages.length}
        </Badge>
      </header>

      <ol className="ml-2 space-y-1.5 border-l border-border/70 pl-4">
        {plan.stages.map((stage) => (
          <li
            key={stage.id}
            className="relative"
            data-testid={`chat-plan-stage-${stage.id}`}
            data-state={stage.state}
          >
            <span
              aria-hidden
              className={cn(
                "absolute -left-[22px] top-0.5 grid size-3.5 place-items-center rounded-full border",
                STAGE_TONE[stage.state],
              )}
            >
              {stage.state === "done" ? <Check className="size-2.5" /> : null}
              {stage.state === "failed" ? <X className="size-2.5" /> : null}
              {stage.state === "skipped" ? <Minus className="size-2.5" /> : null}
              {stage.state === "active" ? <Spinner className="size-2" /> : null}
            </span>
            <p
              className={cn(
                "text-[11.5px] leading-snug",
                stage.state === "active" && "font-medium text-foreground",
                stage.state === "done" && "text-foreground/80",
                stage.state === "failed" && "font-medium text-error",
                stage.state === "pending" && "text-subtle-foreground",
                stage.state === "skipped" && "text-muted-foreground line-through",
              )}
            >
              {stage.label}
            </p>
            {stage.detail ? (
              <p className="text-code text-[10.5px] text-subtle-foreground">{stage.detail}</p>
            ) : null}
          </li>
        ))}
      </ol>

      <footer className="mt-3 border-t border-border/60 pt-2">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
          <span>Token budget</span>
          <span>
            {formatCompact(tokens)} / {formatCompact(plan.budgetTokens)}
          </span>
        </div>
        <Progress
          value={used}
          tone={used > 100 ? "error" : used > 80 ? "warning" : "primary"}
          aria-label="Plan token budget used"
        />
      </footer>
    </section>
  );
});

/* ==========================================================================
   ToolActivityRow
   ======================================================================== */

export interface ToolActivityRowProps {
  activity: ToolActivity;
}

const ToolActivityRow = memo(function ToolActivityRow({ activity }: ToolActivityRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="surface-inset overflow-hidden"
      data-testid={`chat-tool-row-${activity.id}`}
      data-ok={activity.ok}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={`chat-tool-toggle-${activity.id}`}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted/60"
      >
        <span
          aria-hidden
          className={cn("size-1.5 shrink-0 rounded-full", activity.ok ? "bg-success" : "bg-error")}
        />
        <span className="text-code shrink-0 text-[11px] font-semibold text-foreground">
          {activity.tool}
        </span>
        <span className="text-code min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
          {activity.argsSummary}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-subtle-foreground">
          {formatDuration(activity.durationMs)}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-3 shrink-0 text-subtle-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <span className="sr-only">{activity.ok ? "succeeded" : "failed"}</span>
      </button>
      {open ? (
        <div className="border-t border-border/60 p-2">
          <CodeBlock
            code={activity.resultSummary}
            filename={`${activity.tool} · ${activity.ok ? "ok" : "failed"}`}
            maxHeight={180}
          />
        </div>
      ) : null}
    </div>
  );
});

/* ==========================================================================
   ApprovalDialogCard
   ======================================================================== */

const SCOPES: { value: RememberScope; label: string; hint: string }[] = [
  { value: "step", label: "This step", hint: "Ask me again next time" },
  { value: "session", label: "Session", hint: "Allowed until this task ends" },
  { value: "project", label: "Project", hint: "Saved for the whole workspace" },
];

export interface ApprovalDialogCardProps {
  approval: ApprovalRequest;
  /** A gate already settled — rendered read-only in the transcript. */
  resolved?: boolean;
  onResolve?: (decision: "approve" | "reject") => void;
}

const ApprovalDialogCard = memo(function ApprovalDialogCard({
  approval,
  resolved = false,
  onResolve,
}: ApprovalDialogCardProps) {
  const [scope, setScope] = useState<RememberScope>(approval.rememberScope ?? "step");
  const active = SCOPES.find((s) => s.value === scope);

  return (
    <section
      role={resolved ? undefined : "alertdialog"}
      aria-modal={resolved ? undefined : true}
      aria-labelledby={`approval-title-${approval.id}`}
      data-testid="approval-card"
      data-resolved={resolved || undefined}
      className={cn(
        "surface-card border-waiting/50 p-3",
        !resolved && "glow-primary shadow-2xl",
        resolved && "opacity-70",
      )}
    >
      <header className="mb-2 flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-waiting/15 text-waiting">
          <ShieldAlert className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="label-mono text-waiting">Approval required</p>
          <h3
            id={`approval-title-${approval.id}`}
            className="truncate text-xs font-semibold text-foreground"
          >
            {approval.title}
          </h3>
        </div>
        <Badge variant={RISK_VARIANT[approval.risk]} size="xs">
          {approval.risk} risk
        </Badge>
      </header>

      <p className="mb-2 text-[11.5px] leading-relaxed text-foreground/80">{approval.desc}</p>

      <dl className="mb-2 space-y-1">
        <div className="flex items-baseline gap-2">
          <dt className="label-mono w-14 shrink-0">Action</dt>
          <dd className="text-code min-w-0 flex-1 truncate text-[11px] text-accent">
            {approval.action}
          </dd>
        </div>
        {approval.target ? (
          <div className="flex items-baseline gap-2">
            <dt className="label-mono w-14 shrink-0">Target</dt>
            <dd className="text-code min-w-0 flex-1 break-words text-[11px] text-foreground/80">
              {approval.target}
            </dd>
          </div>
        ) : null}
      </dl>

      {approval.payloadPreview ? (
        <div className="mb-2">
          <p className="label-mono mb-1">Payload · redacted</p>
          <CodeBlock code={approval.payloadPreview} language="json" maxHeight={148} />
        </div>
      ) : null}

      {approval.payloadHash ? (
        <div
          className="surface-inset mb-2 flex items-center gap-1.5 px-2 py-1"
          data-testid="approval-payload-hash"
        >
          <span className="label-mono shrink-0">Hash</span>
          <code className="text-code min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
            {approval.payloadHash.slice(0, 22)}…
          </code>
          <CopyButton value={approval.payloadHash} testId="approval-payload-hash-copy" />
        </div>
      ) : null}

      {approval.reason ? (
        <div className="mb-3 rounded-[var(--radius-md)] border border-waiting/30 bg-waiting/10 p-2">
          <p className="label-mono mb-1 text-waiting">Why you are being asked</p>
          <p className="text-[11px] leading-relaxed text-foreground/80">{approval.reason}</p>
        </div>
      ) : null}

      <div className="mb-2.5">
        <p className="label-mono mb-1">Remember this decision for</p>
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(next: string) => {
            if (next) setScope(next as RememberScope);
          }}
          disabled={resolved}
          aria-label="Remember this decision for"
          data-testid="approval-remember-scope"
          className="w-full"
        >
          {SCOPES.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              data-testid={`approval-remember-scope-${option.value}`}
              className="min-w-0 flex-1 px-1 text-[11px]"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {active ? <p className="mt-1 text-[10px] text-subtle-foreground">{active.hint}</p> : null}
      </div>

      <div className="flex gap-2">
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          disabled={resolved}
          onClick={() => onResolve?.("approve")}
          data-testid="approval-approve-btn"
        >
          <Check className="size-3.5" aria-hidden /> Approve
        </Button>
        <Button
          variant="outline"
          size="md"
          className="flex-1"
          disabled={resolved}
          onClick={() => onResolve?.("reject")}
          data-testid="approval-reject-btn"
        >
          <X className="size-3.5" aria-hidden /> Reject
        </Button>
      </div>
    </section>
  );
});

/* ==========================================================================
   StuckCard
   ======================================================================== */

export interface StuckCardProps {
  stuck: StuckPrompt;
  resolved?: boolean;
  onChoose?: (choice: StuckChoice) => void;
}

const StuckCard = memo(function StuckCard({ stuck, resolved = false, onChoose }: StuckCardProps) {
  return (
    <section
      data-testid="stuck-card"
      data-resolved={resolved || undefined}
      aria-label="The agent is stuck"
      className={cn("surface-card border-accent/45 p-3", resolved && "opacity-70")}
    >
      <header className="mb-2 flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-accent/15 text-accent">
          <AlertTriangle className="size-3.5" aria-hidden />
        </span>
        <p className="label-mono text-accent">Agent is stuck</p>
      </header>
      <p className="mb-2.5 text-[11.5px] leading-relaxed text-foreground/85">{stuck.reason}</p>
      <div className="flex flex-wrap gap-1.5">
        {stuck.choices.map((choice) => {
          const Icon = STUCK_ICONS[choice];
          return (
            <Button
              key={choice}
              variant={choice === "retry" ? "primary" : choice === "stop" ? "outline" : "default"}
              size="sm"
              disabled={resolved}
              onClick={() => onChoose?.(choice)}
              data-testid={`stuck-choice-${choice}`}
            >
              <Icon className="size-3" aria-hidden /> {STUCK_LABELS[choice]}
            </Button>
          );
        })}
      </div>
    </section>
  );
});

/* ==========================================================================
   Message row
   ======================================================================== */

interface MessageRowProps {
  message: ChatMessage;
  animate: boolean;
  onReveal?: () => void;
}

const MessageRow = memo(function MessageRow({ message, animate, onReveal }: MessageRowProps) {
  const { card, cardKind } = message;

  return (
    <div data-testid={`chat-message-${message.id}`} data-from={message.from} className="space-y-1.5">
      {message.from === "user" ? (
        <div className="ml-6 rounded-[var(--radius-lg)] rounded-br-sm border border-primary/30 bg-primary/10 px-2.5 py-1.5">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {message.text}
          </p>
          <p className="mt-1 text-right font-mono text-[9.5px] tabular-nums text-muted-foreground">
            <UserRound className="mr-1 inline size-2.5" aria-hidden />
            {clockLabel(message.ts)}
          </p>
        </div>
      ) : null}

      {message.from === "agent" ? (
        <div className="flex gap-2">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-executing/15 text-executing">
            <Bot className="size-3" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <StreamedText text={message.text} animate={animate} onReveal={onReveal} />
            <p className="mt-0.5 font-mono text-[9.5px] tabular-nums text-subtle-foreground">
              {clockLabel(message.ts)}
            </p>
          </div>
        </div>
      ) : null}

      {message.from === "system" ? (
        <div className="flex items-center gap-2 py-0.5">
          <span aria-hidden className="h-px flex-1 bg-border/70" />
          <span className="text-code shrink-0 text-[10px] text-subtle-foreground">
            {message.text}
          </span>
          <span aria-hidden className="h-px flex-1 bg-border/70" />
        </div>
      ) : null}

      {card && cardKind === "plan" ? <PlanBlock plan={card as PlanCard} tokens={0} /> : null}
      {card && cardKind === "tool" ? <ToolActivityRow activity={card as ToolActivity} /> : null}
      {card && cardKind === "approval" ? (
        <ApprovalDialogCard approval={card as ApprovalRequest} resolved />
      ) : null}
      {card && cardKind === "stuck" ? <StuckCard stuck={card as StuckPrompt} resolved /> : null}
    </div>
  );
});

/* ==========================================================================
   Quick actions
   ======================================================================== */

interface QuickActionsProps {
  disabled: boolean;
  onPick: (slug: string, prompt: string) => void;
}

const QuickActions = memo(function QuickActions({ disabled, onPick }: QuickActionsProps) {
  return (
    <div className="shrink-0 border-b border-border/70 p-2" data-testid="chat-quick-actions">
      <p className="label-mono mb-1.5 flex items-center gap-1">
        <Zap className="size-2.5 text-primary" aria-hidden /> Quick actions
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {QUICK_ACTIONS.map((action) => {
          const Icon = ACTION_ICONS[action.icon] ?? Zap;
          return (
            <button
              key={action.slug}
              type="button"
              disabled={disabled}
              title={action.prompt}
              onClick={() => onPick(action.slug, action.prompt)}
              data-testid={`chat-quick-action-${action.slug}`}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-elevated px-2 py-1.5",
                "text-left text-[10.5px] font-medium text-muted-foreground transition-colors",
                "hover:border-primary/45 hover:text-foreground",
                "disabled:pointer-events-none disabled:opacity-40",
              )}
            >
              <Icon className="size-3 shrink-0 text-primary/80" aria-hidden />
              <span className="min-w-0 truncate">{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
});

/* ==========================================================================
   ChatPanel
   ======================================================================== */

export function ChatPanel() {
  const messages = useAgentMessages();
  const status = useAgentStatus();
  const plan = useAgentPlan();
  const approval = useAgentApproval();
  const stuck = useAgentStuck();
  const tokens = useAgentTokens();
  const running = useAgentRunning();
  const summary = useAgentSummary();
  const error = useAgentError();
  const findings = useAgentFindings();

  const startTask = useAgentStore((s) => s.startTask);
  const stopTask = useAgentStore((s) => s.stopTask);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const resolveApproval = useAgentStore((s) => s.resolveApproval);
  const resolveStuck = useAgentStore((s) => s.resolveStuck);
  const openCockpit = useUiStore((s) => s.openCockpit);

  const reducedMotion = useReducedMotion();
  const [draft, setDraft] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Mirror of `atBottom` the scroll effects read without re-subscribing. */
  const atBottomRef = useRef(true);

  /* --- auto-scroll that yields to the reader ----------------------------- */

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    atBottomRef.current = bottom;
    setAtBottom((prev) => (prev === bottom ? prev : bottom));
  }, []);

  const stick = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = true;
    setAtBottom(true);
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);

  // Every agent event that grows the transcript re-pins it. If the user has
  // scrolled up to read, `stick` is a no-op until they come back down.
  useEffect(stick, [messages, plan, approval, stuck, summary, status, stick]);

  /* --- where the plan block sits in the transcript ----------------------- */

  const [planAnchorId, setPlanAnchorId] = useState<number | null>(null);
  const planId = plan?.id ?? null;
  useEffect(() => {
    // Anchored once per plan id: later stage updates refresh the card in place
    // rather than walking it down the transcript.
    setPlanAnchorId(planId ? (readAgent().messages.at(-1)?.id ?? null) : null);
  }, [planId]);

  /* --- actions ----------------------------------------------------------- */

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    void sendMessage(text);
  }, [draft, sendMessage]);

  const onQuickAction = useCallback(
    (slug: string, prompt: string) => void startTask({ prompt, mode: slug }),
    [startTask],
  );

  const retry = useCallback(() => {
    const lastPrompt = [...readAgent().messages].reverse().find((m) => m.from === "user");
    if (lastPrompt) void startTask({ prompt: lastPrompt.text });
  }, [startTask]);

  const onApprovalResolve = useCallback(
    (decision: "approve" | "reject") => void resolveApproval(decision),
    [resolveApproval],
  );

  const onStuckChoice = useCallback(
    (choice: StuckChoice) => void resolveStuck(choice),
    [resolveStuck],
  );

  const busy = status === "thinking" || status === "planning" || status === "executing";
  const gated = approval !== null;
  const last = messages.at(-1);
  /** Only the newest agent line is still arriving; the rest is history. */
  const animateId = !reducedMotion && running && last?.from === "agent" ? last.id : undefined;
  const overBudget = plan !== null && tokens > plan.budgetTokens;

  return (
    <div
      className="flex h-full min-w-0 flex-col overflow-hidden bg-card"
      data-testid="chat-panel"
      data-gated={gated || undefined}
    >
      {/* ---- header ---- */}
      <header className="flex shrink-0 items-center gap-2 border-b border-border/70 px-2.5 py-2">
        <h2 className="shrink-0 font-display text-[13px] font-semibold text-foreground">Agent</h2>
        <AgentStatusPill status={status} pendingApprovals={approval ? 1 : 0} />

        <div className="ml-auto w-20 shrink-0" data-testid="chat-token-meter">
          <div className="flex items-baseline justify-between gap-1 font-mono text-[9.5px] tabular-nums text-muted-foreground">
            <span>{formatCompact(tokens)}</span>
            <span>{plan ? `/ ${formatCompact(plan.budgetTokens)}` : "tok"}</span>
          </div>
          <Progress
            value={plan && plan.budgetTokens > 0 ? (tokens / plan.budgetTokens) * 100 : 0}
            tone={overBudget ? "error" : "primary"}
            aria-label="Tokens used against the plan budget"
            className="mt-0.5"
          />
        </div>

        {overBudget ? (
          <Link
            href={routes.settings({ tab: "agent" })}
            data-testid="chat-budget-exceeded-link"
            className="shrink-0 font-mono text-[9.5px] text-error underline-offset-2 hover:underline"
          >
            over budget
          </Link>
        ) : null}

        {running ? (
          <Button
            variant="outline"
            size="xs"
            onClick={() => setConfirmStop(true)}
            data-testid="chat-stop-button"
            className="shrink-0 border-error/40 text-error hover:bg-error/10"
          >
            <Square className="size-2.5" aria-hidden /> Stop
          </Button>
        ) : null}
      </header>

      <QuickActions disabled={running} onPick={onQuickAction} />

      {/* ---- body: transcript, then the blocking cards ---- */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          data-testid="chat-messages"
          className="cv-auto min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden p-2.5"
        >
          {error ? <ErrorState error={error} onRetry={retry} testId="chat-error-state" /> : null}

          {messages.length === 0 && !error ? (
            <EmptyState
              icon={Bot}
              title="Ask me to test, explore or fix anything"
              description="Pick a quick action above, or describe the flow you want checked. I plan first, then drive the browser step by step."
              testId="chat-empty-state"
            />
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className="space-y-2.5">
              <MessageRow message={message} animate={message.id === animateId} onReveal={stick} />
              {plan && message.id === planAnchorId ? (
                <PlanBlock plan={plan} tokens={tokens} />
              ) : null}
            </div>
          ))}

          {plan && planAnchorId === null ? <PlanBlock plan={plan} tokens={tokens} /> : null}

          {busy ? (
            <div className="flex gap-2" data-testid="chat-thinking-indicator">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-executing/15 text-executing">
                <Bot className="size-3" aria-hidden />
              </span>
              <span className="surface-inset flex items-center gap-1 px-2.5 py-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="size-1 animate-pulse rounded-full bg-executing"
                    style={{ animationDelay: `${i * 180}ms` }}
                  />
                ))}
                <span className="sr-only">Agent is working</span>
              </span>
            </div>
          ) : null}

          {summary ? (
            <section className="surface-card p-3" data-testid="chat-summary-card">
              <p className="label-mono mb-1.5 flex items-center gap-1">
                <Check className="size-3 text-success" aria-hidden /> Task summary
              </p>
              <p className="text-[11.5px] leading-relaxed text-foreground/85">{summary}</p>

              {findings.length > 0 ? (
                <div className="mt-2.5 border-t border-border/60 pt-2">
                  <p className="label-mono mb-1.5">Findings opened</p>
                  <ul className="space-y-1">
                    {findings.map((finding) => (
                      <li key={finding.id}>
                        <Link
                          href={routes.finding(finding.id)}
                          onClick={() => openCockpit(finding.id)}
                          data-testid={`chat-summary-finding-${finding.id}`}
                          className="surface-inset flex items-center gap-1.5 px-2 py-1 transition-colors hover:border-primary/45"
                        >
                          <SeverityBadge severity={finding.severity} size="xs" showLabel={false} />
                          <span className="text-code shrink-0 text-[10.5px] text-primary">
                            {finding.id}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11px] text-foreground/80">
                            {finding.title}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Button variant="ghost" size="xs" asChild data-testid="chat-summary-findings-link">
                  <Link href={routes.findings()}>All findings</Link>
                </Button>
                <Button variant="ghost" size="xs" asChild data-testid="chat-summary-scripts-link">
                  <Link href={routes.scripts()}>Save as spec</Link>
                </Button>
                <Button variant="ghost" size="xs" asChild data-testid="chat-summary-runs-link">
                  <Link href={routes.runs()}>Runs</Link>
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        {!atBottom ? (
          <button
            type="button"
            onClick={jumpToLatest}
            data-testid="chat-scroll-to-latest"
            aria-label="Jump to the latest message"
            className={cn(
              "absolute bottom-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1",
              "rounded-full border border-border bg-popover px-2.5 py-1 shadow-xl",
              "font-mono text-[10px] text-foreground transition-colors hover:border-primary/50",
            )}
          >
            <ArrowDown className="size-3" aria-hidden /> Latest
          </button>
        ) : null}

        {/* The agent is genuinely halted, so the transcript is too. */}
        {gated ? (
          <div
            aria-hidden
            data-testid="chat-approval-scrim"
            className="absolute inset-0 z-10 bg-background/75 backdrop-blur-[2px]"
          />
        ) : null}

        {stuck ? (
          <div className="relative z-20 shrink-0 border-t border-border/70 bg-card p-2.5">
            <StuckCard stuck={stuck} onChoose={onStuckChoice} />
          </div>
        ) : null}

        {approval ? (
          <div className="relative z-20 max-h-[75%] shrink-0 overflow-y-auto border-t border-waiting/40 bg-card p-2.5">
            <ApprovalDialogCard approval={approval} onResolve={onApprovalResolve} />
          </div>
        ) : null}
      </div>

      {/* ---- composer ---- */}
      <div className="shrink-0 border-t border-border/70 p-2.5">
        <div
          className={cn(
            "flex items-end gap-2 rounded-[var(--radius-lg)] border border-input bg-elevated px-2 py-1.5",
            "transition-colors focus-within:border-ring",
            gated && "opacity-50",
          )}
        >
          <Textarea
            ref={inputRef}
            rows={1}
            value={draft}
            disabled={gated}
            aria-label="Message the agent"
            placeholder={
              gated ? "Resolve the approval to continue…" : "Ask the agent to test, explore or fix…"
            }
            data-testid="chat-input"
            onChange={(e) => {
              setDraft(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="max-h-[120px] resize-none border-0 bg-transparent p-0 text-xs"
          />
          <Button
            variant="primary"
            size="icon-sm"
            onClick={send}
            disabled={gated || draft.trim().length === 0}
            aria-label="Send message"
            data-testid="chat-input-send-button"
          >
            <SendHorizonal className="size-3.5" aria-hidden />
          </Button>
        </div>
        <p className="mt-1.5 px-0.5 font-mono text-[9.5px] text-subtle-foreground">
          Enter sends · Shift+Enter newline{running ? " · steering a live run" : ""}
        </p>
      </div>

      <ConfirmDialog
        open={confirmStop}
        onOpenChange={setConfirmStop}
        title="Stop this task?"
        description="The agent halts where it is. The transcript, timeline and evidence collected so far are kept."
        confirmLabel="Stop task"
        destructive
        onConfirm={() => void stopTask()}
        testId="chat-stop-confirm"
      />
    </div>
  );
}

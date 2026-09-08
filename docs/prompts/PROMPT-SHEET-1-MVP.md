# PROMPT SHEET 1 — MVP (P0 vertical slice)

**Product:** Companion — desktop-first AI QA agent (Tauri/Rust shell · React/TS UI · TS agent runtime · Playwright · Claude CLI · SQLite)
**Source of truth:** `companion_full_functionality_master_sheet.xlsx` (P0 rows) · `DECISIONS.md` · `CONSTRAINTS.md`
**Target:** the README "Recommended vertical slice":
> Choose project → validate install → load Claude context → open embedded browser → ask "test this" → agent plans → browser actions visible → finding/evidence → human approval → code patch → targeted test → retest → report.

## How to use this sheet

1. Run prompts **in order**, one per Claude Code session (or one per `/clear`). Each is one logical change (Field Guide habit 12).
2. Every prompt starts with **PLAN FIRST** — Claude must explain before it writes (habit 11). Do not approve the plan until you can restate it yourself (habit 15).
3. Every prompt ends with the same **CLOSE-OUT** block: update `HANDOVER.md`, append to `DECISIONS.md`, run `TEST_CHECKLIST.md`, write the 5-line handoff (habits 1, 2, 8, 13).
4. Read every diff (habit 10). Never accept a summary.
5. Record which model/version did the work in the decision entry (habit 14).

### Shared preamble (paste at the top of EVERY prompt)

```
You are working inside the Companion repo. Before doing anything:
1. Read HANDOVER.md, CONSTRAINTS.md, ARCHITECTURE.md, FLOW.md and the last 5 entries of DECISIONS.md.
2. Read the relevant P0 rows in docs/master-sheet/*.csv for this task.
3. PLAN FIRST: write a short plan (files to touch, new modules, risks, how you will verify). STOP and wait for my approval before writing code.
4. One logical change only. If the task is bigger than one change, propose the split and stop.
5. Comment non-obvious logic with intent (what this is for, what calls it, what it assumes).
6. Never touch anything listed as off-limits in CONSTRAINTS.md. No new dependencies without listing them in the plan.
```

### Shared close-out (paste at the bottom of EVERY prompt)

```
CLOSE-OUT (mandatory):
- Update HANDOVER.md: done / in progress / broken / avoid.
- Append a DECISIONS.md entry for every non-trivial choice (ID, context, decision, alternatives, consequences, evidence, model+version).
- Update FLOW.md if execution path changed; ARCHITECTURE.md if module shape changed.
- Run everything in TEST_CHECKLIST.md and paste the real command output (not a summary).
- Write ROLLBACK notes for this change (commit to revert to, files to restore, what to re-check).
- End with a 5-line handoff: what we did / what's left / what to watch out for / next prompt ID / model used.
```

---

## PHASE 0 — Governance scaffolding (do this before any code)

### P0.1 — Create the documentation system

**Goal:** Field Guide's 9 files exist before the first line of code.

```
<preamble>

Create the governance file set at repo root. Do not write application code.

Files:
- CLAUDE.md — project instructions for Claude Code: read HANDOVER.md first; obey CONSTRAINTS.md; plan-first; one change per request; log to DECISIONS.md; run TEST_CHECKLIST.md before claiming done; never expose secrets; never run active security tests without an authorization file.
- HANDOVER.md — sections: Where we are / Done / In progress / Broken / Avoid / Next prompt.
- DECISIONS.md — use the template in docs/DECISIONS-TEMPLATE.md (I will provide it). Import the seed decisions from the DECISIONS.md I hand you.
- ARCHITECTURE.md — modules, processes, data flow (shell ↔ runtime ↔ browser ↔ Claude CLI ↔ storage). Shape only, no implementation detail.
- FLOW.md — "how a chat message becomes a browser action becomes a finding" as a numbered call path; keep a "currently modifying" marker.
- CONSTRAINTS.md — hard rules (see list below).
- TEST_CHECKLIST.md — exact commands + expected output for: typecheck, lint, unit, runtime integration, Tauri dev boot, e2e smoke.
- ROLLBACK.md — per-change revert recipe format.
- docs/BUG-TEMPLATE.md and docs/FEATURE-TEMPLATE.md — found/scoped, tried, worked, didn't, verified.
- docs/master-sheet/ — I will drop the xlsx export as CSVs; reference them by sheet name.

CONSTRAINTS.md must include at minimum:
- Runtime is TypeScript; shell is Rust/Tauri; do not move browser automation into Rust.
- Playwright is the only browser engine. No Puppeteer, no Selenium.
- Claude CLI is the P0 model provider behind a ModelProvider interface; never embed API keys in the repo or SQLite.
- All tool calls go through the Tool Router (permission check → log → execute → event). No direct Playwright calls from the agent loop.
- Every event is typed in packages/protocol and validated with zod at the boundary.
- Secrets are redacted before hitting logs, events, UI, or model context.
- Domain allowlist and filesystem allowlist are enforced in the router, not in the UI.
- Active security testing requires .companion/authorization.json signed by the user; passive-only otherwise.
- No chain-of-thought is rendered to the UI; only status/summary/tool activity.
- Git push, payment, login, destructive actions always require approval.

<close-out>
```

**Done when:** all files exist, `CLAUDE.md` is under 80 lines, and you can explain each constraint in your own words.

---

## PHASE 1 — Skeleton & contracts

### P1.1 — Monorepo scaffold

```
<preamble>

Scaffold the monorepo. Plan first.

Layout (pnpm workspaces + turborepo):
- apps/desktop      — Tauri 2 shell (Rust) + React 18/TS/Vite frontend. Tailwind + shadcn/ui.
- apps/runtime      — Node/TS agent runtime (long-lived sidecar process spawned by Tauri; talks over local WebSocket).
- packages/protocol — shared zod schemas + TS types for events, tools, entities. Single source of truth.
- packages/ui-kit   — design tokens, primitives, layout components. Copy UI-DESIGN-SPEC.md here as DESIGN.md and generate tokens.css from §1. Add the ESLint rule requiring data-testid on interactive elements (D-UI-004).
- packages/detectors — empty for now (Bug Intelligence lands in Sheet 2).
- tooling/          — eslint, tsconfig, prettier, vitest configs.

Requirements:
- `pnpm dev` boots Tauri, Vite and the runtime sidecar together with one command.
- Runtime is spawned by Tauri with an explicit cwd and filtered env (allowlist PATH, HOME, and COMPANION_* only).
- Health endpoint: runtime answers `{"ok":true,"version":...}` over WS; Tauri shows a red/green dot in the title bar.
- Add TEST_CHECKLIST entries for `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm dev` boot check.

Log the decision: "sidecar over WS vs Tauri IPC commands" with rationale (runtime must survive UI reloads, be attachable from a web build later).

<close-out>
```

### P1.2 — Typed protocol: events, tools, entities

```
<preamble>

Implement packages/protocol from the "Event & Protocol" and "Agent Tooling" sheets.

Events (zod discriminated union on `type`), every event has: id, sessionId, runId, ts, status, payload (redacted-safe):
plan.created, task.started, task.progress, task.waiting, task.stuck, task.completed, task.failed,
browser.connected, browser.navigated, browser.tab.created, browser.tab.closed,
browser.action.started, browser.action.completed, browser.action.failed,
browser.screenshot.created, browser.trace.updated, browser.console.error, browser.network.failed,
scan.started, scan.progress, scan.completed, scan.failed,
finding.detected, finding.confirmed, finding.duplicate, finding.false_positive,
test.generated, test.started, test.passed, test.failed, test.flaky,
code.file.read, code.patch.proposed, code.patch.approved, code.patch.applied, code.test.started, code.test.completed,
approval.required, approval.granted, approval.denied, human.takeover, human.released,
token.usage, context.compacted, checkpoint.created, run.completed, run.failed.

Tools: a ToolSpec registry type {name, inputSchema, outputSchema, permission: 'read'|'write'|'sensitive', cancellable, idempotencyKey?}. Declare specs (no implementations yet) for browser.*, filesystem.*, shell.run, git.*, test.*, scan.*, finding.*, session.*, human.ask, human.approve.

Entities: Workspace, Project, EnvironmentProfile, Session, Run, Test, TestResult, Finding, Evidence, Artifact, Approval, Checkpoint.

Add exhaustive unit tests: every event parses a valid sample and rejects a payload containing a string matching the secret regex set (Bearer tokens, cookies, AWS keys, `password=`).

<close-out>
```

### P1.3 — Local storage: SQLite + artifacts + event store

```
<preamble>

Implement apps/runtime/src/storage.

- SQLite via better-sqlite3 with migrations (drizzle or plain SQL files, your call — log it).
- Tables for every entity in packages/protocol + an append-only `events` table + `audit_log` (approvals link to action payload hash).
- Artifact store: content-addressed files under <workspace>/.companion/artifacts/<sha256[0:2]>/<sha256>; SQLite only stores metadata.
- Event store must be able to rebuild a session timeline: write `rebuildTimeline(sessionId)` and test it against a 1,000-event fixture.
- Checkpoint API: `saveCheckpoint(sessionId, state)`, `loadLatestCheckpoint(sessionId)`.
- Retention stub: `pruneArtifacts({olderThanDays, keepPinned})`, no scheduler yet.
- Crash safety: WAL mode, transactions around every multi-write.

Tests: kill -9 the runtime mid-write in an integration test and prove no partial entity exists on restart.

<close-out>
```

---

## PHASE 2 — Browser you can see

### P2.1 — BrowserProvider + local Chromium

```
<preamble>

Implement apps/runtime/src/browser with a BrowserProvider interface and a LocalPlaywrightProvider.

Interface: launch(profile), newContext(opts), pages(), close(), on(event). Profiles: persistent (per project+environment under .companion/profiles/) and clean/incognito. Viewport presets: desktop 1440×900, tablet 834×1194, mobile 390×844.

Every Playwright action is wrapped so it emits browser.action.started/completed/failed with: selector, role/name if resolvable, bounding box, duration, screenshot artifact id (on completion or failure). Typed text is redacted if the target is type=password or matches secret regex.

Always-on evidence from context creation: tracing (screenshots+snapshots), console listener → browser.console.error, response listener → browser.network.failed for status ≥ 400 and requestfailed.

Add `browser.navigate/back/forward/reload/tabs/new_tab/close_tab` tool implementations wired to the ToolSpecs from P1.2 (router lands in P3.1; for now export functions).

Log the decision: Playwright persistent context vs storageState files.

<close-out>
```

### P2.2 — Embedded live browser view

```
<preamble>

Make the real browser visible inside the desktop app. Plan two options and recommend one before coding:
(a) CDP Page.startScreencast frames streamed over WS to a <canvas> in the UI, with input events forwarded back;
(b) Tauri child WebView positioned over a pane and controlled via CDP.
Default to (a) unless you can show (b) works cross-platform in Tauri 2. Log the decision with measured frame rate and CPU on a 1440×900 page.

UI requirements (Desktop UI sheet, P0): implement exactly the layout, tokens and LiveBrowserFrame contract in UI-DESIGN-SPEC.md §1–§3 (36px titlebar, 24px statusbar, 56→180px nav rail, chat 320–400 / browser flex-1 / inspector 320–420, 140px scrubber). Resizable panes persist sizes; browser never unmounts when the agent works. The browser is REAL (screencast), not the brief's "simulated" mock.

Overlay layer on the browser view: highlight the element the agent is about to act on, a cursor marker for click/type/scroll, and an action label ("Clicking Checkout"). Overlay is driven purely by browser.action.* events.

Controls: URL bar, back/forward/reload, tab strip, viewport preset switch, "Take control" toggle (emits human.takeover / human.released; while taken over the agent receives no browser tool permission).

<close-out>
```

### P2.3 — Console & network recording panels

```
<preamble>

Build the Inspector's Console and Network tabs, fed only from events/storage (no direct Playwright access from the UI).

Console: live stream with level filter, source location, timestamp, session/step correlation. Errors are stored as evidence artifacts.
Network: request list with method, URL (query values redacted per secret rules), status, type, size, timing; failed/4xx/5xx highlighted; click → headers/body preview (bodies stored only when under 256KB and content-type is text/json).
HAR: `recordHar` enabled per run when the environment profile says so; HAR saved as artifact and linked to the run.

Also add `browser.get_console` and `browser.get_network` tools returning compact, size-capped summaries for the model (max 50 entries, bodies elided).

<close-out>
```

---

## PHASE 3 — Tools, policy, and the model

### P3.1 — Tool Router with permissions

```
<preamble>

Implement apps/runtime/src/tools/router.ts.

Pipeline for every call: validate input (zod) → resolve permission → policy check (domain allowlist, filesystem allowlist, sensitive-action approval, tool-call budget, per-tool timeout) → emit started → execute with AbortSignal → validate output → emit completed/failed → append audit_log.

Policy source: .companion/policy.json per workspace (allowedDomains[], allowedPaths[], approvals: {gitPush:'always', codeWrite:'strict'|'auto', login:'always', payment:'always', destructive:'always'}, budgets: {toolCalls, timeMs, parallelism}).

Sensitive tools block until human.approve resolves; the approval record stores the exact payload hash.

Implement filesystem.list/read/search/write/patch/diff, shell.run (cwd forced to project root, env filtered, output streamed and size-capped), git.status/diff/log/branch.

Idempotency: retrying a call with the same idempotencyKey returns the stored result instead of re-executing.

Tests: out-of-allowlist path write is blocked; out-of-allowlist navigation is blocked; kill switch cancels an in-flight shell.run within 500ms.

<close-out>
```

### P3.2 — Claude CLI ModelProvider

```
<preamble>

Implement ModelProvider interface and ClaudeCliProvider.

Discovery/setup: locate the claude CLI, read version, check auth state without ever printing tokens; expose in a Setup screen as installed/authenticated/model-reachable.

Execution: spawn claude in the project root with filtered env, non-interactive JSON/stream output, capture the session id, stream text deltas and tool-use blocks to the UI as task.progress and tool activity events. Persist Claude session id ↔ Companion session id mapping; resume when supported.

Context loader: CLAUDE.md (root + nested), .claude/skills discovery (list only, load on demand), project profile (framework, package manager, test runner detected from package.json / pyproject / playwright.config), git branch/commit. Respect .companionignore + .gitignore for exclusions; secrets never enter context.

Token management: parse usage from provider output when available; emit token.usage; enforce per-task budget from policy; warn at 80%, stop and ask at 100%. Context budget estimate before each send; compaction hook (summary preserved: plan, findings, pinned items).

Log decisions: CLI vs API SDK for P0; how session resume is handled; what compaction keeps.

<close-out>
```

### P3.3 — Agent loop (observe → act → observe)

```
<preamble>

Implement apps/runtime/src/agent/loop.ts. No LangGraph yet (Sheet 2 introduces it); keep this loop small and replaceable.

Loop:
1. Build observation: current URL, title, compact accessibility tree (browser.get_accessibility_tree, capped), last N console errors, last N failed requests, last screenshot artifact id, plan state.
2. Ask model for ONE next step (tool call) or a final report. Never let the model queue many blind actions.
3. Route the tool call. On result, re-observe.
4. Emit plan.created once, task.progress each step, checkpoint.created after each successful step.

Guards: loop detection (same tool+args 3× or no DOM change 5 steps → task.stuck → human.ask with choices retry/skip/take control/provide selector/stop); tool-call, time and token budgets; hallucination guard — a "bug found" claim must reference at least one evidence artifact id or it is rejected and the model is told why.

Pause/resume/stop: session.pause freezes before the next tool call; stop cancels in-flight work via AbortSignal; resume re-observes before acting.

<close-out>
```

### P3.4 — Chat, status header, timeline, approvals UI

```
<preamble>

Build the P0 UI for the agent (Progress/Timeline and Human-in-the-Loop sheets). Follow UI-DESIGN-SPEC.md: AgentStatusPill, ChatPanel (PlanCard, ToolActivityRow, ApprovalDialogCard, StuckCard, QuickActionChips), ExecutionScrubber, data-testid registry §5, motion rules §6. No thought-process cards (D-UI-005).

Header: status (thinking/planning/executing/waiting/stuck/completed/error), elapsed, step timer, token usage + budget bar, kill switch (always enabled, always visible).
Chat: messages, streamed assistant summary (no chain-of-thought), inline approval cards with Approve/Reject/Remember-for-{step,session,project}, inline stuck cards with the suggested-choice buttons.
Timeline (bottom): plan stages expandable; every browser action, tool call, scan, finding, test, code event as a row with timestamp, outcome, artifact chips; failed steps stay expanded; completed collapse.
Current-step pin: one line, e.g. "Investigating 500 from /api/checkout".
Approval queue: side drawer listing all pending approvals across sessions.

Desktop notifications on approval.required, task.stuck, run.completed/failed; deep-link to the session.

<close-out>
```

---

## PHASE 4 — First findings, first tests, first fix

### P4.1 — Finding pipeline v0 (deterministic network/console detectors)

```
<preamble>

Introduce the Finding lifecycle with the smallest useful detectors. Implement in packages/detectors:

Detector interface (this exact shape will be reused by every Sheet-2 detector):
{ id, category, subcategory, mode: 'deterministic'|'ai'|'hybrid', priority, run(ctx): AsyncIterable<CandidateFinding> }
CandidateFinding: { rule, title, severity, confidence, evidence: EvidenceRef[], location, reproduction?: Step[], fingerprintInputs }

Detectors now: network.5xx, network.4xx (ignore 401/403 on auth endpoints when policy says expected), network.failed_request, console.uncaught_error, console.unhandled_rejection.

Pipeline: candidate → evidence bundle (screenshot, console slice, network entry, trace pointer, DOM snapshot) → classify → fingerprint (stable hash of rule+normalized URL/route+normalized message) → dedupe across runs → finding.detected. AI is only used to write the "Why" explanation, with facts and inference in separate fields.

Findings view: inbox filtered by severity/category/status; detail with Why (facts vs inference), Evidence bundle, Reproduce (replays steps in the live browser), Fix (placeholder until P4.3).

<close-out>
```

### P4.2 — Test management v0: import, generate, run, results

```
<preamble>

Implement Test Suites / Test Cases / Test Runs (Test Management sheet, P0 rows).

Import: `test.discover` finds Playwright specs (and lists Jest/Vitest/Pytest for later); each spec/test title becomes a Test entity linked to its file.
Generate: "Watch me" records manual interactions in the live browser (via Playwright's recorder/codegen APIs) and produces an editable .spec.ts using role-based locators; also `test.generate` from a finished agent session's action log. Generated tests carry a header comment linking session id and finding ids.
Run: `test.run` executes via `npx playwright test` with a JSON reporter + tracing on; progress streamed as test.started/passed/failed; results, traces, screenshots, videos become artifacts.
Results table: status, duration, attempts (retries separate from first attempt), evidence chips, AI insight (grounded: quotes the error, the failing locator, the last network failure), link to finding.
"Open trace" launches Playwright trace viewer on the artifact.

Quality gate stub: run marked failed if any P0 test fails.

<close-out>
```

### P4.3 — Fix loop: patch preview → apply → targeted test → retest

```
<preamble>

Close the finding lifecycle (Claude Code – Code Intelligence sheet).

From a Finding, "Propose fix": model gets finding + evidence + relevant source (git grep on route/handler/component names) and returns a unified diff via filesystem.patch.
Patch preview UI: per-file, per-hunk approve/reject; nothing is written without code.patch.approved when policy is 'strict'.
Apply: write files, record code.patch.applied with before/after hashes for undo.
Targeted test: model names the related tests; run only those; attach result to the patch.
Retest: replay the finding's reproduction; finding moves to verified/fixed only when replay produces no candidate and the targeted test passes.
Regression: optional "run suite" button after retest; result attached to the fix.
Undo: revert the patch from stored before-hashes; never overwrite user edits made since (detect via hash mismatch and ask).

<close-out>
```

---

## PHASE 5 — Setup, acceptance, release

### P5.1 — Setup wizard, diagnostics, self-test

```
<preamble>

Implement the Installation & Setup sheet P0 rows.

Checks: OS, Node, Rust/Tauri prerequisites, Git, package manager, Chromium/Playwright browsers (install with progress+retry), Claude CLI installed/authenticated/model reachable, project folder permissions, OS keychain availability, sandbox policy created with safe defaults (allowedDomains empty until user adds; allowedPaths = project root only).
"Run diagnostics" produces a sanitized report artifact.
Self-test: open a bundled local test page, click a button, type into a field, capture a screenshot, assert the event stream — proves browser + agent + UI pipeline end to end.
Ready state is shown only when every P0 check passes.

<close-out>
```

### P5.2 — MVP acceptance run

```
<preamble>

Execute the End-to-End Acceptance sheet against a sample repo (use the bundled sample Next.js todo app with 3 seeded bugs: a 500 on /api/todos POST with empty title, a console error on filter change, a button with no click handler).

Walk each acceptance row and record evidence: setup wizard → open project → "test this website" → live browser actions visible → finding with evidence → forced stuck (block the domain mid-run) → human-in-loop question → approve fix → diff + targeted test → retest verified → regression run → close/reopen app and resume → out-of-scope navigation blocked.

Write docs/acceptance/MVP-<date>.md with a row-by-row pass/fail and artifact links. Anything failing gets a docs/BUG-*.md using the template. Do not fix during this run.

<close-out>
```

### P5.3 — Freeze the MVP

```
<preamble>

Prepare the MVP tag.

- ROLLBACK.md: full recipe to return to this tag.
- HANDOVER.md: reset "In progress" to empty; "Next" points to PROMPT-SHEET-2 phase A.
- DECISIONS.md: add a "MVP freeze" entry listing every open question deferred to Sheet 2 and the model/version that built each phase.
- Tauri bundling for the current OS; document unsigned-build caveats.
- Update TEST_CHECKLIST.md so a fresh clone can reproduce green in under 15 minutes.

<close-out>
```

---

## Exit criteria for Sheet 1

- Every P0 row in README, Master Functionality, Desktop UI, AI & Token, Claude Code, Browser, Progress, Human-in-Loop, Installation, Security/Privacy, Storage, Engineering and End-to-End Acceptance sheets is Done or has a BUG file.
- A new engineer (or new Claude session) can read HANDOVER.md + FLOW.md and continue without re-explanation.
- Zero blind Allows: every approval in the audit log has a payload hash and a human decision.

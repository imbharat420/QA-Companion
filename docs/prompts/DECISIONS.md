# DECISIONS.md — Companion

> Code shows *what* changed. This file shows *why*. Every meaningful decision the AI or a human makes while building Companion is logged here, with the evidence that justified it and the model/version that reasoned it (Field Guide habits 2 and 14).

## How to log a decision

- One entry per decision. ID format `D-<area>-<nnn>` (areas: ARCH, RUNTIME, BROWSER, AI, SEC, DATA, TEST, DETECT, UI, INTEG, PROC).
- Status: `Proposed` → `Accepted` → (`Superseded by D-…` | `Deprecated`). Never delete; supersede.
- **Evidence** must point at something checkable: a benchmark output, a test, a doc URL, a master-sheet row, an acceptance artifact. "Seemed better" is not evidence.
- **Decided by** records the model + version (e.g. `Claude Fable 5.1 via Claude Code 2.x`) or the human. Behaviour shifts between versions; we need to know who reasoned what when we debug it later.
- **Revisit when** names the trigger that should reopen the question.
- Tag `user-visible` when the changelog should mention it.

### Template

```
### D-AREA-000 — <short title>
Status: Proposed | Accepted | Superseded by D-… | Deprecated
Date: YYYY-MM-DD
Decided by: <human | model + version>
Prompt: <PROMPT-SHEET id, e.g. P3.2>
Context: <the problem and constraints, 2–4 lines>
Decision: <what we are doing, 1–3 lines>
Alternatives considered: <A — why not; B — why not>
Consequences: <what gets easier, what gets harder, what we now owe>
Evidence: <link/command/output/row id>
Revisit when: <trigger>
Tags: <arch | perf | security | user-visible | …>
```

---

## Index

| ID | Title | Status |
|---|---|---|
| D-ARCH-001 | Desktop shell is Rust/Tauri; runtime is TypeScript | Accepted |
| D-ARCH-002 | Runtime is a sidecar process over local WebSocket, not Tauri IPC commands | Accepted |
| D-ARCH-003 | Single typed protocol package with zod validation at every boundary | Accepted |
| D-ARCH-004 | Provider interfaces: BrowserProvider / ModelProvider / StorageProvider | Accepted |
| D-ARCH-005 | Local-first; cloud sync is opt-in and P2 | Accepted |
| D-BROWSER-001 | Playwright is the only browser engine | Accepted |
| D-BROWSER-002 | Live view via CDP screencast into the UI (default), not screenshot polling | Proposed |
| D-BROWSER-003 | Persistent browser profiles per project+environment; clean profile for reproducibility | Accepted |
| D-BROWSER-004 | Always-on evidence: tracing, console, network listeners from context creation | Accepted |
| D-BROWSER-005 | Browserless/remote CDP is an optional provider, not the default | Accepted |
| D-AI-001 | Claude CLI is the P0 ModelProvider; Anthropic API provider added for parallel work later | Accepted |
| D-AI-002 | Agent loop is observe → act → observe, one tool call per step | Accepted |
| D-AI-003 | No chain-of-thought in the UI; status, summaries and tool activity only | Accepted |
| D-AI-004 | Evidence-required claims: a "bug found" without an artifact id is rejected | Accepted |
| D-AI-005 | Budgets (tokens, tool calls, time, parallelism) are policy, enforced in the router/loop | Accepted |
| D-AI-006 | LangGraph.js replaces the hand-rolled loop in Sheet 2; runtime stays TypeScript | Proposed |
| D-AI-007 | Parallel QA via LangGraph Send/map-reduce; subagents return structured findings only | Proposed |
| D-AI-008 | Claude skills (.claude/skills) are the extension mechanism; trust list gates them | Accepted |
| D-AI-009 | Compaction preserves plan, open findings, decisions, pinned items, evidence ids | Accepted |
| D-SEC-001 | All tool calls pass through the Tool Router: validate → permission → policy → execute → audit | Accepted |
| D-SEC-002 | Domain and filesystem allowlists are enforced in the runtime, never only in the UI | Accepted |
| D-SEC-003 | Security testing is passive by default; active requires a signed authorization file | Accepted |
| D-SEC-004 | Use established scanners (axe, Lighthouse, semgrep, ZAP baseline, npm/pip audit) over custom probes | Accepted |
| D-SEC-005 | Secrets live in the OS keychain; SQLite never stores raw credentials; redaction before log/event/context | Accepted |
| D-SEC-006 | Approvals are per-action with payload hash; "remember" is scoped to step/session/project | Accepted |
| D-SEC-007 | Kill switch must work while the agent is stuck; tested, not assumed | Accepted |
| D-DATA-001 | SQLite (WAL) for metadata + append-only event store; content-addressed artifact files | Accepted |
| D-DATA-002 | Checkpoint after every successful step; crash resumes from latest checkpoint | Accepted |
| D-DETECT-001 | One Detector interface for all 11 Bug Intelligence categories | Accepted |
| D-DETECT-002 | Deterministic → hybrid → AI execution order; AI never re-finds deterministic results | Accepted |
| D-DETECT-003 | Findings are deduplicated by stable fingerprint; Bug Graph stores relations | Accepted |
| D-DETECT-004 | Lighthouse runs against the Playwright Chromium via CDP, results merged into our categories | Proposed |
| D-TEST-001 | Adopt Playwright Test Agents conventions (specs/, seed.spec.ts, planner/generator/healer) | Proposed |
| D-TEST-002 | Flakiness is judged across runs/branches, not from per-run retry flags | Accepted |
| D-TEST-003 | Healer never silently skips: unfixable → Finding | Accepted |
| D-UI-001 | Layout: chat left, live browser center, inspector right, timeline bottom; panes persist | Accepted |
| D-UI-002 | UI is event-sourced from the protocol stream; no direct Playwright access from React | Accepted |
| D-UI-003 | Adopt the Aether design brief as the design system (tokens, layout metrics, motion) | Accepted |
| D-UI-004 | Mandatory kebab-case data-testid on every interactive element; lint-enforced | Accepted |
| D-UI-005 | Agent status colors are single-source tokens; UI shows plan/activity, never thought cards | Accepted |
| D-UI-006 | Product name "Aether" vs repo name "Companion" | Proposed |
| D-INTEG-001 | Companion exposes an MCP server and consumes external MCP tools through the router | Proposed |
| D-PROC-001 | Governance files before code; plan-first; one change per prompt; read every diff | Accepted |
| D-PROC-002 | Master sheet is the requirements source; P0 = Sheet 1, P1/P2 = Sheet 2 | Accepted |

---

## Entries

### D-ARCH-001 — Desktop shell is Rust/Tauri; runtime is TypeScript
Status: Accepted · Date: 2026-09-07 · Decided by: human (design thread) + Claude Fable 5.1 (this log) · Prompt: P1.1
Context: Product must feel native on desktop and be performance-oriented, but browser automation maturity lives in the Node ecosystem (Playwright, axe, Lighthouse, LangGraph.js).
Decision: Tauri 2 (Rust) owns windowing, menus, notifications, process supervision, keychain access. All agent/browser/test logic is TypeScript in a runtime process.
Alternatives: All-Rust (chromiumoxide etc.) — immature automation, would sacrifice Playwright tracing/codegen/agents. Electron — heavier, no Rust shell benefits.
Consequences: Two languages in the repo; IPC boundary must be typed (→ D-ARCH-003). Web version becomes cheap (→ Sheet 2 Phase R).
Evidence: master sheet README "Core runtime"; ChatGPT design thread §1, §20, §23.
Revisit when: Rust browser automation reaches Playwright parity for tracing + accessibility snapshots.

### D-ARCH-002 — Runtime is a sidecar over local WebSocket
Status: Accepted · Date: 2026-09-07 · Decided by: Claude Fable 5.1 · Prompt: P1.1
Context: Long-running agent work must survive UI reloads/crashes; the same runtime should serve a future web UI; Tauri IPC commands are request/response oriented.
Decision: Tauri spawns `apps/runtime` with explicit cwd and filtered env; UI talks to it over a loopback WS carrying protocol events; Tauri also monitors its health.
Alternatives: Tauri commands + events only — ties runtime lifetime to the window and blocks the web build. Separate daemon installed as a service — heavier ops, unnecessary for local-first.
Consequences: Need auth token on the loopback socket; need reconnect logic in UI; runtime must not assume a UI is attached.
Evidence: Engineering sheet "Cancellation", "Backpressure"; P1.1 health check.
Revisit when: Tauri gains first-class long-lived sidecar streaming primitives that remove the need for a socket.

### D-ARCH-003 — Single typed protocol with zod at every boundary
Status: Accepted · Prompt: P1.2
Context: UI, runtime, storage, MCP server and integrations all consume the same events; malformed model output must fail safely.
Decision: `packages/protocol` is the only place types are declared; every inbound tool output and every outbound event is parsed with zod; schemas include a secret-pattern refusal test.
Alternatives: Protobuf/JSON-schema codegen — extra toolchain for no consumer outside TS today.
Consequences: Schema changes are explicit and reviewed; runtime rejects hallucinated tool payloads.
Evidence: Event & Protocol sheet (P0); Engineering sheet "Schema validation".
Revisit when: A non-TS consumer (e.g. Rust) needs the schemas natively.

### D-ARCH-004 — Provider interfaces
Status: Accepted · Prompt: P2.1 / P3.2 / P1.3
Decision: `BrowserProvider` (local Playwright, remote CDP), `ModelProvider` (Claude CLI, Anthropic API, others), `StorageProvider` (SQLite local, optional sync later) are interfaces; UI never sees implementations.
Consequences: Swappable without UI changes; adds one indirection layer per subsystem.
Evidence: Engineering sheet "Provider interfaces" (P1); AI & Token sheet "Provider abstraction".

### D-ARCH-005 — Local-first; cloud is opt-in P2
Status: Accepted
Decision: All data, artifacts and credentials stay on the machine by default. Cloud sync interface is designed in Sheet 2 Phase Q but not implemented until a workspace opts in.
Consequences: Privacy story is simple; collaboration arrives later via LAN web UI first.
Evidence: Storage sheet "Optional cloud sync" P2; design thread §18.

### D-BROWSER-001 — Playwright is the only engine
Status: Accepted · Prompt: P2.1
Context: Need tracing, codegen, role-based locators, aria snapshots, network interception, multi-browser, and the official Test Agents.
Decision: Playwright everywhere (agent actions, detectors, test execution). No Puppeteer/Selenium code paths.
Alternatives: Puppeteer — Chromium-only, no test runner. Selenium — slower, weaker evidence tooling.
Evidence: Browser sheet "Playwright runtime" P0; playwright.dev/docs/test-agents.
Revisit when: never expected; log if a detector needs a capability Playwright cannot expose.

### D-BROWSER-002 — Live view via CDP screencast (default)
Status: Proposed · Prompt: P2.2
Context: The visible browser is the killer feature; users must see every click as it happens. Screenshot polling is laggy and expensive.
Decision (proposed): `Page.startScreencast` frames → WS → `<canvas>`; input events forwarded back; overlay driven by action events. Fallback: Tauri child WebView + CDP if cross-platform tests pass.
Evidence required to accept: measured FPS and CPU at 1440×900 for both options (P2.2 records them here).
Revisit when: Tauri child-webview embedding is stable on all three OSes.

### D-BROWSER-003 — Persistent profiles per project+environment
Status: Accepted · Prompt: P2.1
Decision: `launchPersistentContext` under `.companion/profiles/<project>/<env>`; a clean/incognito context is one click away for reproducibility. Profiles never cross projects (isolation).
Alternatives: `storageState` JSON files — simpler, but loses service workers/IndexedDB and complicates "take control" sessions.
Evidence: Browser sheet "Persistent profile", Security sheet "Browser isolation" (both P0).

### D-BROWSER-004 — Always-on evidence
Status: Accepted · Prompt: P2.1 / P2.3
Decision: Tracing (screenshots + snapshots), console listener, response/requestfailed listeners, and optional HAR start at context creation. Evidence is cheap; missing evidence is unrecoverable.
Consequences: Disk usage → retention policy (Phase Q); trace size capped per run.
Evidence: Browser sheet "Trace" P0, "HAR" P2; Finding lifecycle "Evidence collection" P0.

### D-BROWSER-005 — Remote browser is optional
Status: Accepted
Decision: Local Chromium is the default for privacy and dev loop; Browserless/CDP provider (Sheet 2 Phase N) must be indistinguishable in the UI.
Evidence: Browser sheet "Local Chromium" P0, "Remote browser" P1.

### D-AI-001 — Claude CLI is the P0 ModelProvider
Status: Accepted · Prompt: P3.2
Context: Users already have Claude Code auth, CLAUDE.md, skills and sessions; we want project-scoped reasoning without storing API keys.
Decision: Spawn the CLI in the project root, stream output, persist session ids, reuse CLAUDE.md/skills. Add `AnthropicApiProvider` in Sheet 2 (I.4) for parallel detector subagents where CLI process-per-subagent is too heavy.
Alternatives: API SDK only — needs key management and loses the user's Claude Code context; both from day one — doubles P0 scope.
Consequences: Dependent on CLI output format stability → wrap parsing in one module with fixture tests.
Evidence: Claude Code sheet P0 rows; AI & Token sheet "Claude CLI integration".
Revisit when: CLI output format changes or an SDK gains equivalent project-context features.

### D-AI-002 — Observe → act → observe, one tool call per step
Status: Accepted · Prompt: P3.3
Decision: The model returns at most one tool call per turn; the loop re-observes before the next. Never execute a batch of blind actions.
Alternatives: Plan-and-execute batches — faster but produces untraceable failures; the master sheet's reliability principle forbids it.
Evidence: README "Reliability principle"; design thread §14.

### D-AI-003 — No chain-of-thought in the UI
Status: Accepted
Decision: UI renders status, current step, streamed summary, tool activity, findings. Private reasoning is never persisted or shown.
Evidence: AI & Token sheet "Live AI stream"; Progress sheet "AI summary".

### D-AI-004 — Evidence-required claims
Status: Accepted · Prompt: P3.3 / P4.1
Decision: Any `finding.create` or "completed" claim must cite ≥1 artifact id that exists; otherwise the router rejects it and returns the reason to the model.
Consequences: Fewer hallucinated bugs; slightly more tool calls to capture evidence.
Evidence: AI & Token sheet "Hallucination guard" P0.

### D-AI-005 — Budgets are policy, enforced centrally
Status: Accepted · Prompt: P3.1 / P3.2
Decision: Token (task/session/workspace), tool-call, time and parallelism budgets live in `.companion/policy.json` and are enforced by the router and loop; exceeding → pause and ask, never silent stop.
Evidence: AI & Token sheet budget rows (P0/P1).

### D-AI-006 — LangGraph.js in Sheet 2
Status: Proposed · Prompt: I.1
Context: Need checkpointed graphs, interrupts for human-in-the-loop, fan-out for parallel QA, and pluggable models — without a second language runtime.
Decision (proposed): `@langchain/langgraph` with a custom SqliteSaver over our checkpoint table; interrupts map to `human.ask`/`human.approve`.
Alternatives: Python CrewAI/Deep Agents — strong, but forces a second runtime and protocol bridge; custom state machine — we already have it (P3.3) and it will not scale to map-reduce + interrupts cleanly.
Evidence required to accept: I.1 migration keeps all P3.3 guard tests green; I.2 records parallel speedup/token cost.
Revisit when: LangGraph.js checkpointer/interrupt APIs change materially, or a TS-native alternative offers better observability.

### D-AI-007 — Parallel QA subagents return structured findings only
Status: Proposed · Prompt: I.2
Decision: Each category subagent has isolated context and browser context; reducer merges CandidateFindings; transcripts are never merged. Parallelism capped by policy.
Evidence required: 20-page sample timing/token table.

### D-AI-008 — Claude skills are the extension mechanism
Status: Accepted · Prompt: P3.2 / E.2
Decision: `.claude/skills` (project) + optional global registry; skills declare permissions and authorization needs; untrusted skills disabled. Security skills are read-only or authorization-gated.
Evidence: AI & Token sheet "Claude skills" P0; Security sheet "Skill trust" P1.

### D-AI-009 — Compaction keeps the state that matters
Status: Accepted · Prompt: P3.2 / I.4
Decision: Structured summary (plan, open findings, decisions, pinned items) + evidence ids survive; raw tool output does not. Verified by a test that a compacted session can still reproduce a finding.
Evidence: AI & Token sheet "Context compaction", "Context pinning".

### D-SEC-001 — Everything goes through the Tool Router
Status: Accepted · Prompt: P3.1
Decision: validate → permission → policy (allowlists, approvals, budgets, timeouts) → execute with AbortSignal → validate output → audit. The agent loop and detectors have no direct Playwright/fs/shell access.
Consequences: One place to reason about safety; some overhead per call.
Evidence: Agent Tooling sheet (all P0 rows share "permission checked, logged, cancellable").

### D-SEC-002 — Allowlists enforced in the runtime
Status: Accepted
Decision: Domain and filesystem allowlists are checked in the router; UI only displays them. Out-of-scope → block or approval per policy.
Evidence: Security sheet "Domain allowlist", "Filesystem allowlist" P0; Acceptance row "Safety".

### D-SEC-003 — Passive by default; active security needs signed authorization
Status: Accepted · Prompt: E.1–E.3
Context: Companion tests the user's own apps, but active probing of the wrong target is harmful and possibly illegal. Consent must be explicit, scoped and auditable.
Decision: Passive detectors run on any allowlisted target. Active (DAST, mutation of state, auth probing) requires `.companion/authorization.json` (scope, methods, rate limit, expiry, owner signature) plus an approval card showing target/methods/limits. Findings from active scans are tagged and only count toward gates when authorization existed.
Evidence: Human-in-Loop sheet "Active security testing" P0; Security sheet "Security authorization" P0; Test Management "Security gate".
Revisit when: never removed; may add org-level authorization policies.

### D-SEC-004 — Established scanners over custom probes
Status: Accepted · Prompt: E.1 / E.2 / B.1 / C.1
Decision: axe-core (a11y), Lighthouse (perf/SEO/best-practice), semgrep (SAST indicators), OWASP ZAP baseline in Docker (authorized DAST), npm/pnpm/pip audit + OSV (dependencies). Companion adds correlation, evidence, reproduction and fixes — not new attack payloads.
Consequences: Fewer false claims of exploitability; dependency on scanner output formats (wrap each in an adapter with fixture tests).

### D-SEC-005 — Secrets in the keychain, redacted everywhere else
Status: Accepted · Prompt: P1.2 / P3.1 / P.1
Decision: Credentials via OS keychain (Tauri stronghold or keytar — decide at P.1 with evidence). Redaction runs before events, logs, UI, model context. Property-based tests generate secrets and assert none leak.
Evidence: Installation sheet "Secret storage"; Security sheet "Credential redaction", "OS keychain" P0.

### D-SEC-006 — Approvals are per-action with payload hash
Status: Accepted · Prompt: P3.1 / P3.4
Decision: `approval.granted` stores the hash of the exact action payload; "remember this decision" requires an explicit scope (step/session/project) and appears in Settings.
Evidence: Security sheet "Approval audit" P0; Human-in-Loop "Remember decision" P1.

### D-SEC-007 — Kill switch is tested while stuck
Status: Accepted
Decision: Kill switch cancels agent, browser actions and child processes within 500 ms even when the loop is stuck; covered by an integration test that deliberately wedges a tool.
Evidence: Human-in-Loop "Kill switch" P0; P3.1 test requirement.

### D-DATA-001 — SQLite + append-only events + content-addressed artifacts
Status: Accepted · Prompt: P1.3
Decision: better-sqlite3 in WAL mode; entities + `events` (append-only) + `audit_log`; artifacts under `.companion/artifacts/<sha>` with metadata in SQLite; FTS5 for search in Phase Q.
Alternatives: Postgres/embedded server — overkill locally; JSON files — no transactions.
Evidence: Storage sheet P0 rows; P1.3 crash test.

### D-DATA-002 — Checkpoint after every successful step
Status: Accepted · Prompt: P3.3
Decision: Agent state + browser state pointer saved after each successful tool result; app restart resumes from the latest checkpoint and re-observes before acting.
Evidence: AI & Token "Checkpointing" P0; Acceptance "Resume".

### D-DETECT-001 — One Detector interface
Status: Accepted · Prompt: P4.1 / A.1
Decision: `{id, category, subcategory, mode, priority, cost, requiresAuthorization, run(ctx) → AsyncIterable<CandidateFinding>}` for all 11 categories. Findings carry rule, severity, confidence, evidence refs, location, reproduction, fingerprint inputs.
Evidence: Bug Intelligence sheet acceptance ("Finding includes rule, severity, confidence, reproduction and evidence"); design thread §3.

### D-DETECT-002 — Deterministic → hybrid → AI
Status: Accepted · Prompt: A.1
Decision: Cheap deterministic checks run first and feed their results to AI detectors, which only interpret, reproduce and judge. AI output must reference element ids/boxes/artifact ids.
Consequences: Lower token spend; AI findings are auditable.
Evidence: README "Reliability principle"; design thread §6.

### D-DETECT-003 — Fingerprint dedupe + Bug Graph
Status: Accepted · Prompt: P4.1 / A.2
Decision: Fingerprint = stable hash of rule + normalized route/URL + normalized message/node; relations (duplicate_of, caused_by, correlates_with, links to tests/runs/commits/files) in an edge table.
Evidence: Finding lifecycle "Deduplication", "History"; design thread §10.

### D-DETECT-004 — Lighthouse via the Playwright Chromium CDP port
Status: Proposed · Prompt: C.1
Decision (proposed): Run Lighthouse against the same Chromium (same auth/profile) instead of a fresh Chrome; store LHR as artifact; map audits into our perf/seo/a11y categories.
Evidence required: run on a logged-in page succeeds; per-viewport results stable within ±5% across 3 runs.
Alternatives: `playwright-lighthouse` wrapper — evaluate at C.1 and log.

### D-TEST-001 — Adopt Playwright Test Agents conventions
Status: Proposed · Prompt: J.1
Decision (proposed): Use `npx playwright init-agents` output (specs/*.md, tests/seed.spec.ts, generated tests with spec/seed headers) as the on-disk format for planned/generated tests so users can also drive them from Claude Code/VS Code directly. Companion wraps planner/generator/healer with UI, evidence and approval.
Evidence: playwright.dev/docs/test-agents (fetched 2026-09-07).
Revisit when: agent definitions change format on Playwright upgrade (they must be regenerated per Playwright's own guidance — add to TEST_CHECKLIST).

### D-TEST-002 — Flakiness judged across runs
Status: Accepted · Prompt: J.2
Decision: A test is flaky when outcomes alternate on the same commit/environment or flip more than a threshold across N runs; per-run retry flags are only a hint.
Evidence: Test Management "Flaky detection" P1; TestDino docs describe the same distinction.

### D-TEST-003 — Healer never silently skips
Status: Accepted · Prompt: J.1
Decision: If the healer concludes the feature is broken, it opens a Finding with evidence instead of skipping the test. Max 3 heal attempts.
Evidence: Playwright healer semantics ("passing test, or skipped if functionality is broken") adapted to our evidence principle.

### D-UI-001 — Four-pane layout with persistence
Status: Accepted · Prompt: P2.2 / P3.4
Decision: Chat (left) · live browser (center) · inspector (right) · timeline (bottom); resizable, sizes persisted per workspace; focus modes and multi-window later.
Evidence: Desktop UI sheet P0 rows; design thread §27.

### D-UI-002 — UI is event-sourced
Status: Accepted
Decision: React consumes protocol events and storage queries only; no Playwright, fs or shell access from the UI process.
Consequences: Web version reuses the UI unchanged; timeline replay is free.
Evidence: Progress sheet "Event replay"; D-ARCH-002.

### D-UI-003 — Adopt the Aether design brief as the design system
Status: Accepted · Date: 2026-09-07 · Decided by: human (brief) + Claude Fable 5.1 (reconciliation) · Prompt: P2.2 / P3.4 / O.1
Context: A complete dark IDE-style brief ("Aether AI Browser Companion") was supplied: tokens, typography, 36/24 px chrome, 56→180 px rail, 3-pane + 140 px scrubber, motion rules, five page views.
Decision: Adopt tokens, typography, layout metrics, motion and status semantics verbatim into `packages/ui-kit` (see UI-DESIGN-SPEC.md §1–§6). Reject/adjust five items that conflict with existing decisions: simulated browser → real embedded browser; thought cards → plan/activity cards; model names + API-key fields in Settings → runtime-populated providers + keychain status; remote avatar URLs → bundled SVGs; 6-item nav is MVP only.
Alternatives: Start from shadcn defaults — generic; design in-repo from scratch — slower and the brief is already coherent.
Consequences: Light theme becomes a token swap later; contrast test over token pairs is mandatory; the brief's "simulated" wording must not leak into product requirements.
Evidence: UI-DESIGN-SPEC.md §0 reconciliation table; D-BROWSER-002, D-AI-003, D-AI-001, D-SEC-005.
Revisit when: user research (Sheet 2 O.1) contradicts density/contrast choices.
Tags: ui, user-visible

### D-UI-004 — Mandatory data-testid, lint-enforced
Status: Accepted · Prompt: P1.1 / P2.2
Decision: Every interactive element and status indicator carries a kebab-case `data-testid` from the registry in UI-DESIGN-SPEC.md §5; an ESLint rule fails builds without it; Companion's own e2e suite uses the registry.
Consequences: Slight authoring overhead; dogfooding — the QA tool is itself reliably testable.
Evidence: brief "testing_and_accessibility"; TEST_CHECKLIST e2e smoke.

### D-UI-005 — Status tokens are single-source; no thought cards
Status: Accepted · Prompt: P3.4
Decision: thinking/planning/executing/waiting/success/error colors exist only as tokens consumed by AgentStatusPill, timeline and header. Chat renders PlanCard / ToolActivityRow / streamed summary; the brief's "thought process cards" are not implemented.
Evidence: D-AI-003; UI-DESIGN-SPEC.md §3.

### D-UI-006 — Product name "Aether" vs repo "Companion"
Status: Proposed
Decision (proposed): Keep code, packages, `.companion/` config dir and docs as Companion; treat "Aether" as the brand name shown in the titlebar/about screen if confirmed. Renaming the config directory later would break workspaces, so decide before P5.3 (MVP freeze).
Revisit when: user confirms branding.

### D-INTEG-001 — MCP server + MCP client through the router
Status: Proposed · Prompt: L.1 / L.2
Decision (proposed): Expose Companion's run/finding/test tools as an MCP server (stdio + local HTTP) so IDE agents can use it; consume external MCP tools (Playwright MCP, TestDino MCP, GitHub, Jira/Linear) with each call permission-gated, logged and budgeted like internal tools.
Evidence: Integrations sheet "MCP server" P1, "MCP client" P2; TestDino MCP as the reference for agent-callable test history.

### D-PROC-001 — Governance before code
Status: Accepted · Prompt: P0.1
Decision: HANDOVER, DECISIONS, ARCHITECTURE, FLOW, CONSTRAINTS, TEST_CHECKLIST, ROLLBACK and BUG/FEATURE templates exist before the scaffold. Every prompt: plan first, one change, read the diff, run the checklist, log decisions, write the 5-line handoff, record the model version.
Evidence: AI Collaboration Field Guide habits 1–15.

### D-PROC-002 — Master sheet is the requirements source
Status: Accepted
Decision: `companion_full_functionality_master_sheet.xlsx` (exported to `docs/master-sheet/*.csv`) defines scope; P0 → PROMPT-SHEET-1, P1/P2 → PROMPT-SHEET-2. Rows are marked Done/Deferred with a decision id. Product ideas from the design thread enter only via a decision entry.
Evidence: README sheet "P0/P1/P2" definitions; 492 functional rows.

---

## Open questions (convert to decisions when evidence exists)

- OQ-1 Screencast vs child WebView for the live view (→ D-BROWSER-002, P2.2).
- OQ-2 drizzle vs raw SQL migrations (→ P1.3).
- OQ-3 keytar vs Tauri stronghold for keychain (→ P.1).
- OQ-4 LanguageTool bundled vs optional download for grammar (→ G.2).
- OQ-5 How CI runs authenticate to import into the desktop app (→ M.1).
- OQ-6 Whether the web version allows approvals from non-owner sessions (→ R.1; default no).

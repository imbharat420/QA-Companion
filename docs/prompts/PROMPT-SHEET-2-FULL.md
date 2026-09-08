# PROMPT SHEET 2 — MVP → FULL FUNCTIONALITY

**Prereq:** Sheet 1 exit criteria met; MVP tag exists.
**Source of truth:** master sheet P1/P2 rows · Bug Intelligence taxonomy (11 categories) · `DECISIONS.md`
**Rules:** same preamble/close-out as Sheet 1. Phases are ordered so each one only depends on earlier ones. Inside a phase, prompts are one logical change each.

Reference behaviours we are matching or exceeding:
- Playwright Test Agents — planner (explores → Markdown plan), generator (plan → spec files, verifies locators live), healer (replays failure → patches locator/wait/data → reruns until pass or guardrail).
- TestDino — persistent run history across branches/PRs/environments, flaky detection across runs, error grouping by root cause, MCP server so agents can query test history, manual + automated cases in one suite structure, quality gates as PR checks.
- BrowserStack Test Companion — chat-driven: generate test cases from PRD/URL, write scripts for any framework, debug failures from reports, WCAG scan with code remediation, reusable "skills" as playbooks.

---

## PHASE A — Bug Intelligence framework (everything else plugs into this)

### A.1 — Detector registry & scan orchestration

```
<preamble>

Turn the P4.1 Detector interface into a registry that the whole product runs on.

- packages/detectors/registry.ts: register(detector), list({category, mode, priority}), plan(scanRequest) → ordered detector set. Categories exactly: accessibility, functional, uiux, performance, network, api, security, visual, seo, content, edge.
- ScanContext given to every detector: page handle (read-only proxy through the router), evidence recorder, network/console buffers, project profile, environment profile, policy, budget, AbortSignal, a `ai()` helper that is metered and returns {facts, inference, confidence}.
- Execution order: deterministic → hybrid → ai. AI detectors receive the deterministic results so they don't re-find the same things.
- scan.* tools (scan.accessibility … scan.edge) become thin wrappers: scan.<category> = run all detectors in that category.
- Each detector declares `cost: 'cheap'|'medium'|'expensive'` and `requiresAuthorization: boolean` (true for active security only).
- Timeline shows one row per category with started/running/completed and finding count.

Tests: registry ordering, budget cut-off mid-category, AbortSignal propagates to every detector.

<close-out>
```

### A.2 — Evidence bundle & Bug Graph

```
<preamble>

Every finding must open everything. Implement:

EvidenceBundle: screenshot(s), video segment (if recording), trace pointer + step index, DOM snapshot, accessibility snapshot, console slice, network slice, source pointer(s) (file:line with confidence), diff (if fixed).
Bug Graph (SQLite edge table): finding ↔ finding (duplicate_of, caused_by, correlates_with), finding ↔ test, finding ↔ run, finding ↔ commit, finding ↔ source file. Correlation job after each scan: same fingerprint across pages → merge; same network failure under several UI findings → caused_by; findings only present after commit X → correlates_with commit.
Finding detail redesign: Why (facts | inference), Evidence (all tabs), Reproduce, Related (graph neighbours), Fix, History (first/last seen per run/branch/commit).

<close-out>
```

### A.3 — Automatic discovery crawler

```
<preamble>

Add `scan.discover`: BFS crawl within allowedDomains from the start URL and from sitemap.xml; collect routes, forms, buttons/links with roles, auth-gated pages (detect redirects to login), API endpoints seen in traffic. Depth/pages/time caps from policy. Output a SiteMap entity used by every category scan and by the planner agent. Respect robots.txt only for reporting (this is our own authorized target) — log this decision.

<close-out>
```

---

## PHASE B — Accessibility

### B.1 — Deterministic a11y detectors (axe-core)

```
<preamble>

Add @axe-core/playwright. Detectors: a11y.wcag (tag set configurable: wcag2a, wcag2aa, wcag21aa, wcag22aa, best-practice), a11y.aria, a11y.labels_names, a11y.forms, a11y.landmarks_headings, a11y.contrast, a11y.target_size. Each axe violation → CandidateFinding with rule id, impact→severity map, WCAG success criteria, node targets, help URL, and a screenshot with the node highlighted. Run per page in the SiteMap and per viewport preset.

<close-out>
```

### B.2 — Keyboard, focus and screen-reader-tree detectors (hybrid)

```
<preamble>

Detectors: a11y.keyboard (Tab through the page: record focus order, trapped focus, unreachable interactive elements, missing visible focus ring via computed outline/box-shadow), a11y.focus_order (compare DOM order vs tab order vs visual position), a11y.sr_tree (accessibility tree: elements with role but no name, duplicated names, decorative images with names, live regions missing). AI step (hybrid): given the tree of a dialog/menu, judge whether the announced experience matches the visual one; must cite node ids.

Dedicated Accessibility view: WCAG level filter, trend per run, "fix" button feeding the P4.3 patch loop with axe's remediation hints.

<close-out>
```

---

## PHASE C — Performance (Lighthouse + real-user vitals)

### C.1 — Lighthouse runner

```
<preamble>

Integrate Lighthouse against the running Playwright Chromium over CDP (remote-debugging port from the provider) so audits run in the same profile/auth state. Categories: performance, accessibility, best-practices, seo (we merge these into our own categories rather than showing a separate Lighthouse UI). Store the full LHR JSON as an artifact; map audits → detectors perf.lcp, perf.cls, perf.inp/tbt, perf.long_tasks, perf.render_blocking, perf.image, perf.caching, perf.js_execution, perf.resource_timing with thresholds from the environment profile. Run per viewport preset (mobile emulation on for mobile). Trend chart per run in a Performance view.

<close-out>
```

### C.2 — In-flow vitals and memory

```
<preamble>

Lighthouse measures page load; we also need vitals during agent flows. Inject web-vitals (attribution build) at context init; collect LCP/CLS/INP/long-task entries per navigation and per interaction and attach them to browser.action.completed. Detector perf.memory: CDP Performance.getMetrics + HeapProfiler sampling before/after a repeated action sequence (open/close modal ×20) to flag growth. Everything is a CandidateFinding with the timeline segment as evidence.

<close-out>
```

---

## PHASE D — Network & API

### D.1 — Network detectors beyond 4xx/5xx

```
<preamble>

Detectors: network.cors (console CORS errors + preflight failures correlated), network.timeouts (> profile threshold), network.redirect_loops, network.mixed_content, network.slow_requests (p95 per endpoint), network.websocket_failures, network.third_party_failures (domains outside allowedDomains). Use HAR + response listeners; each finding lists the affected page(s) and the UI action that triggered it.

<close-out>
```

### D.2 — API intelligence

```
<preamble>

Build packages/detectors/api.
- Endpoint discovery from traffic → OpenAPI stub (paths, methods, observed schemas via quicktype-style inference).
- If the project has an OpenAPI/Swagger file, load it; detectors api.schema (response vs schema), api.contract_drift (observed vs documented), api.status_codes, api.error_handling (error bodies leak stack traces / are non-JSON), api.validation (send boundary/empty/invalid bodies to non-destructive endpoints — GET always; POST/PUT/DELETE only when the environment profile is marked disposable), api.pagination, api.idempotency (repeat safe requests, compare), api.rate_limit_behavior (respect 429; never exceed policy rate limit), api.auth/api.authz (call authenticated endpoints without/with a lower-privilege session from the environment profile; report unexpected 200s).
- API test entity: request, assertions, auth policy; runnable from Test Runs.
- API view: discovered endpoints, schemas, results.

<close-out>
```

---

## PHASE E — Security (passive by default, active by authorization)

Position: Companion is a QA tool for the user's own applications. Passive checks run on any authorized target. Active checks run only with `.companion/authorization.json` (target scope, methods, rate limits, expiry, signed by the workspace owner) and always show target/methods/limits before execution (Human-in-Loop sheet). We use established scanners rather than hand-rolled attack code.

### E.1 — Passive security detectors

```
<preamble>

Detectors (no requests beyond normal browsing): sec.headers (CSP, HSTS, X-Content-Type-Options, X-Frame-Options/frame-ancestors, Referrer-Policy, Permissions-Policy — graded, with recommended values), sec.cookie_flags (Secure/HttpOnly/SameSite on session cookies), sec.cors_policy (wildcard with credentials, reflected origin), sec.sensitive_data_exposure (PII/secret patterns in responses, verbose errors, source maps in prod), sec.secrets_in_client (JS bundles scanned with secret regex set + entropy), sec.csrf_indicators (state-changing forms without tokens/SameSite protection), sec.auth_weaknesses (login over http, autocomplete on password, no rate-limit headers), sec.mixed_content.
Repository-side: sec.dependencies via `npm audit --json`/`pnpm audit`/`pip-audit` plus OSV; findings link to the lockfile line.
Security view: passive/active policy visible; every finding tagged with the standard it maps to (OWASP ASVS / Top 10 id).

<close-out>
```

### E.2 — Security skills for Claude (.claude/skills/security-*)

```
<preamble>

Create Claude skills the agent loads on demand (skill = SKILL.md + scripts). Skills must be read-only or explicitly gated:
- security-review-headers: explains each header finding and drafts the exact framework config change (Next/Express/Nginx/Vercel) for the P4.3 patch loop.
- security-review-auth-flow: given the recorded login flow + cookies, produces a checklist-based assessment (session fixation indicators, logout invalidation, remember-me scope) using only observed evidence.
- security-dependency-triage: reads audit output, ranks by reachability (is the vulnerable function imported? grep), proposes upgrade patches, runs targeted tests.
- security-sast: runs semgrep with the community ruleset for the detected language on the repo; maps results to sec.injection / sec.xss candidates as "code-level indicators" (never claims exploitability without evidence).
- security-authorized-dast (requiresAuthorization): runs OWASP ZAP baseline scan in Docker against the authorized target with the authorization file's rate limit; imports the ZAP report as findings. Refuses to start without a valid, unexpired authorization file and an approval card that shows scope.

Each SKILL.md declares permissions, inputs, outputs and whether it needs authorization. The Skill trust UI (Security sheet) shows source and permissions; untrusted skills are disabled.

<close-out>
```

### E.3 — Security quality gate

```
<preamble>

Add a security gate to Test Runs: fail on configurable severities; active-scan findings are only counted if the run had authorization. Gate results feed PR checks in Phase Q.

<close-out>
```

---

## PHASE F — Visual

### F.1 — Baselines and diffs

```
<preamble>

Visual test entity: target (page or component locator), viewport, mask selectors, threshold. Capture via Playwright screenshots with animations disabled and fonts loaded; compare with pixelmatch (pixel) + a structural diff (DOM/layout box comparison) so we can say "moved" vs "changed". Detectors: visual.regression, visual.pixel_difference, visual.structural_difference, visual.layout_shift (CLS attribution), visual.responsive_screenshots (viewport matrix), visual.component_snapshots, visual.font_rendering, visual.missing_assets (broken images, 404 fonts).
Visual view: baseline vs actual vs diff slider, approve new baseline (versioned, tied to branch), mask editor.

<close-out>
```

---

## PHASE G — SEO & Content

### G.1 — SEO detectors

```
<preamble>

Deterministic: seo.metadata (title/description length, duplicates across SiteMap), seo.canonical (missing/self-referencing/conflicting), seo.robots (meta robots + robots.txt vs sitemap contradictions), seo.sitemap (missing, unreachable, stale, URLs 404), seo.structured_data (JSON-LD parse + schema.org type validation), seo.open_graph/twitter cards, seo.heading_structure (single h1, skipped levels), seo.indexability (noindex on important pages, blocked resources), seo.broken_links (internal + external HEAD checks with rate limit), seo.duplicate_content (shingled text similarity across pages). Merge Lighthouse SEO audits from C.1.

<close-out>
```

### G.2 — Content detectors

```
<preamble>

content.spelling (cspell with project dictionary at .companion/dictionary.txt), content.grammar (LanguageTool local server, optional), content.placeholder_text (lorem ipsum, TODO, {{unresolved}}), content.missing_content (empty headings/alt/buttons), content.broken_links (shares G.1 crawler), content.inconsistent_labels (same action, different labels across pages — AI, cite nodes), content.content_overflow (text clipped by overflow:hidden — computed style + scrollWidth), content.localization_gaps (untranslated keys, mixed languages via language detection).

<close-out>
```

---

## PHASE H — UI/UX, Functional, Edge cases

### H.1 — UI/UX detectors (hybrid)

```
<preamble>

Deterministic passes via page.evaluate over all visible elements: uiux.overflow (scrollWidth > clientWidth, horizontal page scroll), uiux.clipping, uiux.misalignment (siblings in a flex/grid row with baseline/left deltas > tolerance), uiux.zindex (elements overlapping interactive elements; elementFromPoint mismatch), uiux.modal_dropdown (open state without focus trap/escape/backdrop; dropdown off-viewport), uiux.sticky_fixed (covering content at every viewport), uiux.touch_targets (< 44px on mobile preset), uiux.responsive (rerun at each viewport preset), uiux.typography (font-size < 12px, line-length > 90ch), uiux.theme (prefers-color-scheme dark: contrast + invisible elements).
AI pass: screenshot + element list → "does this look broken?" with strict output schema; only accepted when it references an element id already flagged or a bounding box.

<close-out>
```

### H.2 — Functional exploration detectors

```
<preamble>

Using the SiteMap: functional.broken_buttons (click every button/link: no navigation, no network, no DOM mutation, no console → candidate), functional.broken_forms (submit with valid sample data from profile; check error/success feedback and request), functional.state_bugs (perform action, reload, compare persisted state), functional.navigation (dead routes, back-button mismatches, breadcrumbs), functional.authentication (login/logout/expired session redirects using environment profile creds via keychain), functional.authorization_flows (lower-privilege session visiting privileged routes), functional.session_expiry, functional.error_states, functional.loading_states (skeletons that never resolve), functional.empty_states. All actions are through the router (approval on payment/destructive).

<close-out>
```

### H.3 — Edge-case & resilience detectors

```
<preamble>

edge.empty / null / unicode (RTL, emoji, combining marks, zero-width) / huge_input / invalid_input / boundary_values via fast-check generators seeded per run (seed stored on the finding for replay); edge.repeated_clicks (double-submit), edge.slow_network and edge.offline (Playwright route throttling / context.setOffline), edge.race_conditions (fire two dependent actions without waiting; compare final state to sequential run). Only on disposable environments unless the target action is read-only.

<close-out>
```

---

## PHASE I — AI orchestration: LangGraph, parallel QA, research

### I.1 — Replace the P3.3 loop with a LangGraph.js graph

```
<preamble>

Introduce @langchain/langgraph (JS). Plan first and log the decision (LangGraph.js vs custom state machine vs Python CrewAI — we stay TS for one runtime, one protocol).

Graph: intake → context_load → plan → (branch) {explore, scan, test, fix, research} → correlate → report. Checkpointer: implement a SqliteSaver over our checkpoint table so graph state and Companion checkpoints are one thing. Interrupts: human.ask / human.approve are LangGraph interrupt nodes; resume continues the graph.
ModelProvider plugs in as a LangChain chat model wrapper around ClaudeCliProvider (and later the Anthropic API provider).
Keep the P3.3 guards as graph-level middleware: budgets, loop detection, evidence requirement.
Streaming: every node transition emits task.progress; token.usage from provider callbacks.

<close-out>
```

### I.2 — Parallel QA subagents (map-reduce)

```
<preamble>

Use Send()/map-reduce to fan out: one subagent per Bug Intelligence category (or per page group for big sites), each with isolated context, its own browser context, and a hard budget. Subagents return structured CandidateFindings only — never raw transcripts. Reducer runs correlation (A.2) and dedupe. Parallelism budget from policy caps concurrent browsers. UI: a lane per subagent in the timeline with live counts. Test with a 20-page SiteMap: total time and token spend vs sequential must be recorded in DECISIONS.md.

<close-out>
```

### I.3 — Research & Deep Scan agents

```
<preamble>

research agent: given a finding, gathers framework docs and changelogs (web tool, metered, domain-allowlisted), similar historical findings from our Bug Graph, and the git blame of the suspected source; outputs a "likely root cause" with citations. Deep Scan mode: risk-based — SiteMap pages ranked by traffic hints (nav depth, forms, auth, payment keywords) and recent git churn; expensive detectors only on the top N. Agent modes exposed in UI: Explore / Scan / Test / Fix / Deep Scan / Research, each with a budget preset.

<close-out>
```

### I.4 — Long-context intelligence & memory

```
<preamble>

Project memory (local): .companion/memory/ with facts the agent learned (selectors that work, login flow, flaky areas, naming conventions), written only through a `memory.write` tool with human-visible entries and a review UI. Pinning: files/findings/messages pinned survive compaction. Compaction strategy: structured summary (plan, open findings, decisions, pinned) + evidence ids; verify with a test that a compacted session can still reproduce a finding. Provider abstraction: add AnthropicApiProvider so heavy parallel work can use the API while Claude CLI remains the coding provider; model selection and fallback are policy-controlled and visible before execution.

<close-out>
```

---

## PHASE J — Playwright Test Agents, healing, flakiness

### J.1 — Planner / Generator / Healer integration

```
<preamble>

Run `npx playwright init-agents` with the Claude Code loop option in the target project when the user opts in (check `--help` for the exact flag); adopt its conventions: specs/*.md plans, tests/seed.spec.ts, generated tests that reference spec + seed in header comments.
Companion wrappers: "Plan tests for <flow>" → planner runs against the live browser and SiteMap, plan saved as a Test Case group (manual-readable) → "Generate" → generator produces specs and verifies locators live → import into Test Cases → run. Healer: on test.failed, offer "Heal" which replays, inspects, proposes a patch (locator/wait/data) through the P4.3 patch preview, reruns; guardrail max 3 attempts; if the healer believes the feature is broken, it opens a Finding instead of skipping silently.

<close-out>
```

### J.2 — Flaky detection & error grouping

```
<preamble>

Across-run flakiness: per test, pass/fail history per branch/environment; flaky = alternating outcomes on the same commit or > threshold flips in N runs (not just retry flags). Error grouping: normalize error message + top frames + failing locator → group id; group view shows affected tests/runs and a single AI insight per group. Run comparison view: two runs → new failures, fixed, still failing, new/fixed findings, perf deltas.

<close-out>
```

---

## PHASE K — Script library & reuse

### K.1 — Reusable scripts, snippets, page objects

```
<preamble>

Script Library entity: {name, kind: 'test'|'step'|'page-object'|'fixture'|'api'|'skill', language, params schema, tags, version, source session/finding, usage count}. Sources: generated tests, Watch-me recordings, steps the agent repeated successfully, user uploads. Extraction: the agent proposes turning a repeated 3+ step sequence into a parametrized step (e.g. login(user)), shown as a diff. Reuse: chat can reference @script:name; generator prefers library page objects over raw locators. Versioning: every edit is a version with diff; runs record which version they used. UI: searchable library with preview, params form, "run now", "insert into test".

<close-out>
```

### K.2 — Manual test cases, releases, test-management parity

```
<preamble>

Manual test case entity (steps, expected results, priority, tags, owner) in the same suite tree as automated tests. Manual run mode: step-by-step checklist with the live browser alongside; each step can be marked pass/fail with an automatic screenshot; "automate this case" hands it to the generator. Releases: group runs and cases per release with a readiness score from quality gates. Analytics view: pass rate, duration, flaky count, finding trends by category across branches/environments.

<close-out>
```

---

## PHASE L — MCP: expose Companion, consume the world

### L.1 — Companion MCP server

```
<preamble>

Expose an MCP server (stdio + local HTTP) so Claude Code / Cursor / other agents can use Companion as a tool: tools for list_runs, get_run, get_failures, get_flaky_tests, get_findings, get_finding_evidence, create_manual_test_case, trigger_run, get_site_map, get_quality_gate_status. Every tool is permission-scoped by workspace policy and logged in audit_log. Secrets and raw evidence bodies are never returned; artifact ids are.

<close-out>
```

### L.2 — MCP client for external testing tools

```
<preamble>

Add an MCP client with a connector registry in Settings: Playwright MCP (browser tools when a user wants Playwright's own agent tools), TestDino MCP (import run history/flaky data if the team also uses TestDino), GitHub MCP (PRs, checks), Jira/Linear MCP (create/link issues from findings with evidence attachments). External tool calls go through our router (permission-gated, logged, budgeted). UI: connector status, enabled tools, last call.

<close-out>
```

---

## PHASE M — Integrations & CI

```
<preamble>  (M.1)

GitHub: repo connection, map runs to branch/commit/PR, publish a status check from quality gates (tests, a11y, security, perf thresholds), PR comment with top findings and evidence links. CI: a `companion ci` CLI that runs configured scans/tests headlessly and emits our run schema; the desktop app imports CI runs so history spans local + CI. Slack: notifications for completion/failure/approval with no evidence bodies by default. Generic CI ingestion via JSON.

<close-out>
```

---

## PHASE N — Remote browsers & matrices

```
<preamble>  (N.1)

Add RemoteCdpProvider (Browserless or any CDP endpoint) behind BrowserProvider; the embedded view, overlay, evidence and events must be indistinguishable from local. Multi-browser: Chromium/Firefox/WebKit projects for test runs; viewport/locale/timezone/geolocation/permission matrices from environment profiles; run metadata shows all of it.

<close-out>
```

---

## PHASE O — UI: best possible desktop experience

### O.1 — Design system & navigation

```
<preamble>

packages/ui-kit already holds the Aether tokens (UI-DESIGN-SPEC.md). Now formalize: light theme as a token swap, density modes, primitives audit against the contrast test, and Storybook fed by protocol fixtures. Left nav: Projects, Test Suites, Test Cases, Test Runs, Findings, Accessibility, Security, Performance, Visual, API, Script Library, Settings. Command palette (⌘K) for every action/page/tool; global search across projects/sessions/tests/findings/files; keyboard shortcuts for run/stop/approve/browser controls; focus modes for chat/browser/findings; multi-window for run/trace/terminal.

<close-out>
```

### O.2 — Failure cockpit & inspector

```
<preamble>

Failure cockpit (FailureCockpitDrawer contract in UI-DESIGN-SPEC.md §3): one screen for a failed test or finding — timeline scrubber synced to screenshot/video, trace step list, console + network at that instant, DOM/a11y snapshot, source pointer with blame, AI insight (facts vs inference), actions (Heal / Propose fix / Reproduce / Create issue / Mark false positive). Inspector: DOM tree, accessibility tree, computed styles, selector generator ranking candidates by stability, element highlight sync with the live browser.

<close-out>
```

---

## PHASE P — Security, privacy, isolation hardening

```
<preamble>  (P.1)

Audit every path: credential redaction in events/logs/context (property-based tests with generated secrets); OS keychain for all credentials (keytar or Tauri stronghold — log decision); browser profile isolation per project/environment; child-process env filtering; append-only audit log with hash chain; approval records with payload hash; per-tool and per-task timeouts; rate limiting per target domain; kill switch tested while agent is deliberately stuck; skill trust list; diagnostic bundle export with redaction proof. Produce docs/SECURITY.md describing the threat model.

<close-out>
```

---

## PHASE Q — Observability, storage, recovery

```
<preamble>  (Q.1)

Structured logs with correlation ids; log levels; agent/browser/storage health panels; resource usage during runs; agent throughput metrics; full-text search (SQLite FTS5) across findings/tests/sessions; retention policies with scheduler and pinning; workspace export/import (no secrets unless selected); crash recovery test suite (kill during scan, during patch apply, during test run). Optional cloud sync stays P2: design the interface, do not implement.

<close-out>
```

---

## PHASE R — Web version & collaboration (P2)

```
<preamble>  (R.1)

Because the runtime already speaks WS, add apps/web: same React UI served by the runtime with auth (local token), read-only by default; live browser view via the same screencast; approvals allowed only for authenticated owners. Session export/clone, shareable run links on LAN. Collaboration (comments on findings, assignment) behind a feature flag.

<close-out>
```

---

## PHASE S — Release engineering

```
<preamble>  (S.1)

Signed builds for macOS/Windows/Linux, auto-updater, telemetry off by default, first-run privacy screen, versioned migration tests from MVP tag → current, changelog generated from DECISIONS.md entries tagged `user-visible`. Final acceptance: re-run the End-to-End Acceptance sheet plus one scenario per Bug Intelligence category on the sample app with seeded bugs for each category; publish docs/acceptance/FULL-<date>.md.

<close-out>
```

---

## Coverage map: taxonomy → phase

| Bug Intelligence branch | Deterministic | Hybrid/AI | Phase |
|---|---|---|---|
| Accessibility (WCAG, ARIA, keyboard, screen reader, contrast) | axe-core, tab traversal, computed styles | tree vs visual judgment | B |
| Functional (buttons, forms, state, navigation, auth) | crawler actions + network/DOM/console deltas | intent judgment | H.2 |
| UI/UX (overflow, misalignment, responsive, z-index, modal) | evaluate() geometry passes | screenshot review | H.1 |
| Performance (LCP, CLS, INP, long tasks, memory) | Lighthouse, web-vitals, CDP metrics | explanation | C |
| Network (4xx, 5xx, CORS, timeouts, failed) | listeners + HAR | correlation | P4.1, D.1 |
| API (schema, validation, auth, error handling) | OpenAPI inference/validation | contract reasoning | D.2 |
| Security (XSS, injection, secrets, headers, deps) | headers/cookies/secret scan/audit/semgrep; ZAP with authorization | skills | E |
| Visual (regression, pixel, layout shift, responsive) | pixelmatch + structural diff | — | F |
| SEO (metadata, canonical, sitemap, structured data) | crawler + JSON-LD validation + Lighthouse SEO | — | G.1 |
| Content (spelling, grammar, missing, broken links) | cspell/LanguageTool/crawler | label consistency | G.2 |
| Edge cases (empty, null, unicode, huge, invalid, race) | fast-check + throttling/offline | — | H.3 |

## Exit criteria for Sheet 2

- Every master-sheet row is Done, or Deferred with a DECISIONS.md entry saying why.
- Every detector has: unit test with a seeded-bug fixture page, a false-positive test, and a documented evidence bundle.
- Parallel scan of the 20-page sample completes within the parallelism/token budgets recorded in I.2.
- Active security cannot be started without an authorization file — proven by a test and by the acceptance run.
- A fresh clone follows TEST_CHECKLIST.md to green; HANDOVER.md is empty of "In progress".

# UI-DESIGN-SPEC.md — Companion workbench (from the "Aether AI Browser Companion" brief)

**Status:** adopted as the design source for P2.2, P3.4 (Sheet 1) and O.1, O.2 (Sheet 2). Lives at `packages/ui-kit/DESIGN.md` once the repo exists.
**Working name:** "Aether" is the product/brand name candidate; the repo, packages and docs keep "Companion" until D-UI-006 is accepted.

## 0. Reconciliation with CONSTRAINTS.md / DECISIONS.md

The brief was written for a mock-up tool. Five items are adjusted before they become product requirements:

| Brief says | Product does | Why |
|---|---|---|
| "Live *Simulated* Browser… rendered interactive target website… fake address bar" | **Real** embedded browser (CDP screencast, D-BROWSER-002). The URL bar, tabs and viewport toggle are real controls that emit `browser.*` tools. | The visible real browser is the killer feature. "Simulated" is acceptable only in the static prototype. |
| "thought process cards" / "agent thought logs" | **Plan & activity cards**: plan stages, current step, tool activity, streamed *summary*. No chain-of-thought is rendered or stored. | D-AI-003, CONSTRAINTS "No chain-of-thought". |
| Settings: "agent model (Claude 3.7 / GPT-4o)", "API keys" | Settings: **Provider** (Claude CLI ✓ / Anthropic API / others) with model list populated *from the provider at runtime*; **Credentials** panel shows keychain status only, never a key field in SQLite/UI text. | D-AI-001, D-SEC-005. Hard-coded model names go stale. |
| Unsplash avatar URLs | Local SVG avatars bundled in ui-kit. | Desktop app must not fetch remote images; privacy + offline. |
| Left nav: 6 items | MVP nav = brief's 6 items. Sheet 2 O.1 adds Accessibility, Security, Performance, Visual, API, Script Library. | Matches P0 vs P1 split in the master sheet. |

Everything else in the brief (tokens, typography, layout metrics, motion, status semantics, `data-testid` convention) is adopted verbatim.

---

## 1. Design tokens (`packages/ui-kit/tokens.css`)

```css
:root[data-theme="dark"] {
  /* surfaces */
  --bg-base: #0B0D13;
  --bg-surface: #12151E;
  --bg-surface-elevated: #1A1E2B;
  --bg-surface-hover: #24293B;
  /* borders */
  --border-default: rgba(255,255,255,0.08);
  --border-strong: rgba(255,255,255,0.16);
  --border-accent: rgba(0,242,254,0.30);
  /* text */
  --text-primary: #F3F4F6;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;
  /* brand */
  --brand-primary: #00F2FE;
  --brand-primary-glow: rgba(0,242,254,0.25);
  --brand-secondary: #6366F1;
  /* agent status — the ONLY place these semantics are defined */
  --status-thinking: #8B5CF6;
  --status-planning: #6366F1;
  --status-executing: #06B6D4;
  --status-waiting: #F59E0B;   /* approval required / stuck */
  --status-success: #10B981;
  --status-error: #EF4444;
  /* type */
  --font-sans: "Geist Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", "Geist Mono", monospace;
  /* chrome metrics */
  --titlebar-h: 36px;
  --statusbar-h: 24px;
  --nav-rail-w: 56px;
  --nav-rail-w-expanded: 180px;
  --timeline-h: 140px;
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px;
}
```

Light theme is a P2 item; every component must consume tokens, never hex literals, so it is a token swap later.

### Tailwind mapping
Extend the theme with the tokens above (`bg-base`, `bg-surface`, `border-default`, `text-primary`, `status-executing`…). Only core utilities + these extensions. Density: labels `text-xs`, secondary `text-[11px]`, code `font-mono text-[11px] tracking-tight text-cyan-300`.

### Typography hierarchy
| Role | Classes |
|---|---|
| Window/section title | `text-xs font-semibold tracking-wide uppercase text-muted` |
| H1 | `text-2xl font-bold tracking-tight text-primary` |
| H2 | `text-xl font-semibold tracking-tight text-primary` |
| H3 | `text-base font-medium text-primary` |
| Body | `text-xs text-primary leading-relaxed` |
| Body small | `text-[11px] text-secondary leading-normal` |
| Code | `font-mono text-[11px] tracking-tight text-cyan-300` |

Contrast: every text/surface pair must pass WCAG AA (APCA Lc ≥ 60 for body) on `#0B0D13` and `#12151E`; add a unit test that walks the token pairs.

---

## 2. Layout architecture

```
┌──────────────────────────────── titlebar 36px ────────────────────────────────┐
│ ●●●  [Project ▾]        [● Executing · Clicking "Checkout"]   12.4k tok ▮▮▮▯  ⌘K │
├──────┬───────────────────────┬───────────────────────────┬────────────────────┤
│ nav  │ Chat & Command        │ Live Browser (flex-1)     │ Inspector          │
│ rail │ 320–400px             │ url bar · tabs · viewport │ 320–420px          │
│ 56/  │ prompt · stream ·     │ overlay: cursor, target   │ DOM · A11y ·       │
│ 180  │ plan cards · approvals│ box, step banner          │ Network · Console ·│
│      │ quick-action chips    │                           │ Selectors          │
│      ├───────────────────────┴───────────────────────────┴────────────────────┤
│      │ Execution scrubber 140px — steps sync-linked to browser & inspector    │
├──────┴────────────────────────────────────────────────────────────────────────┤
│ statusbar 24px:  main ⎇  · ping 12ms · Chromium/Playwright · sess_7f3a          │
└───────────────────────────────────────────────────────────────────────────────┘
```

- Panes are resizable with drag handles (hover highlight, active state); sizes persist per workspace (D-UI-001).
- The browser pane never unmounts while the agent runs; focus modes expand one pane without losing state.
- Nav rail items (MVP): Workspace/Projects, Agent Live Workbench, Test Suites, Test Runs, Findings Inbox, Settings.

---

## 3. Component contracts (props are protocol types, not ad-hoc)

### `AgentStatusPill`
Input: `task.*`/`approval.required` events. States → token + motion:
- thinking → `--status-thinking`, soft pulse
- planning → `--status-planning`, pulse
- executing → `--status-executing`, active ring; label = current step pin
- waiting (approval/stuck) → `--status-waiting`, badge with count of pending approvals
- completed → `--status-success`, check; error → `--status-error`
`data-testid="agent-status-pill"`, `data-state="executing"`.

### `LiveBrowserFrame`
Props: `screencast` stream, `tabs`, `activeUrl`, `viewportPreset`, `takeover: boolean`, `overlay: {cursor, targetBox, stepLabel}` derived from `browser.action.*` events.
Chrome: back/forward/reload, SSL indicator, editable URL bar (Enter → `browser.navigate`), tab strip (`browser.tabs/new_tab/close_tab`), viewport toggle (desktop/tablet/mobile presets), "Take control" toggle (`human.takeover`/`human.released`).
Overlay: laser cursor with spring transition to target center; 300 ms ripple ring on click; target bounding box with `--border-accent`; typing overlay renders characters as `browser.type` progresses (masked when the target is a password/secret field); step banner shows the action label.

### `ChatPanel`
Message list with streamed Markdown summary (typewriter, smooth auto-scroll, pause-on-user-scroll); `PlanCard` (stages with state), `ToolActivityRow` (tool name, redacted args summary, result summary, duration), `ApprovalDialogCard`, `StuckCard` (choices: retry / skip / take control / provide selector / stop), `QuickActionChips`.
Quick actions (MVP): Explore website · Regression Test · Accessibility Audit · Find Broken Links · Generate Playwright Spec · Fix Failing Step. Each chip maps to a graph mode + preset budget.

### `ApprovalDialogCard`
Shows: action type, target (URL/file/command), redacted payload preview, payload hash (short), why approval is needed, scope selector for "remember" (step/session/project). Buttons: Approve / Reject. Blocks until resolved; renders in chat and in the approval drawer.

### `InspectorPanel`
Tabs: DOM Tree (live, node select → highlight in browser), Accessibility Tree (role/name/state), Network Waterfall (method/URL/status/type/size/timing, 4xx/5xx red, redacted query values), Console (level filter, source, timestamp), Selectors (candidate locators ranked by stability, copy button). Content is event-sourced (D-UI-002).

### `ExecutionScrubber`
Horizontal timeline of steps (Navigate/Click/Type/Assert/Screenshot/Scan/Finding/Test/Code). Selecting a step scrubs the browser screenshot, console/network slices and inspector to that instant. Failed steps stay expanded; completed collapse. Artifact chips open evidence.

### `FailureCockpitDrawer`
Opened from Findings / Test Runs: screenshot diff (baseline/actual/diff slider), DOM mutation diff, console + network at the failing instant, AI diagnosis split into **Facts** and **Inference** with confidence, actions: Reproduce · Propose fix · Heal · Create issue · Mark false positive. "Apply Auto-Fix" is only enabled after a patch preview exists and policy allows.

---

## 4. Page views

| page_id | Title | MVP content | Prompt |
|---|---|---|---|
| workbench | Agent Live Workbench | 3-pane + scrubber, everything above | P2.2, P3.4 |
| test_suites | Test Suites & Specs | suite tree, spec table (file, title, tags, last result), "Generate spec", assertions editor (P1) | P4.2 |
| test_runs | Test Runs & Analytics | run list, pass/fail trend, duration, flaky panel (Sheet 2 J.2), run detail → cockpit | P4.2, J.2 |
| findings | Findings & Bug Intelligence | inbox filtered by severity/category/status, detail with Why/Evidence/Reproduce/Fix, cockpit drawer | P4.1, A.2, O.2 |
| settings | Companion Settings | Provider (runtime-populated models), Credentials (keychain status), Browser (viewport presets, throttling profiles), Policy (allowlists, approvals, budgets), Integrations/webhooks (Sheet 2) | P5.1, P.1 |

Mock data: the prototype and Storybook use fixtures generated from the protocol schemas (`packages/protocol/fixtures`) so every screen is populated and the fixtures double as test data.

---

## 5. `data-testid` registry (kebab-case, mandatory on every interactive element and status indicator)

Naming: `<area>-<element>[-<action>]`. Examples, which are the canonical ids for these elements:

```
titlebar-project-switcher, titlebar-token-counter, titlebar-command-launcher
agent-status-pill
nav-rail-workspace, nav-rail-workbench, nav-rail-test-suites, nav-rail-test-runs, nav-rail-findings, nav-rail-settings
chat-input, chat-input-send-button, chat-quick-action-<slug>, chat-plan-card, chat-tool-activity-row
approval-approve-btn, approval-reject-btn, approval-remember-scope
stuck-choice-retry, stuck-choice-skip, stuck-choice-take-control, stuck-choice-provide-selector, stuck-choice-stop
live-browser-url-bar, live-browser-back, live-browser-forward, live-browser-reload, live-browser-tab-<n>, live-browser-new-tab
live-browser-viewport-toggle, live-browser-take-control, live-browser-overlay-cursor, live-browser-overlay-target, live-browser-step-banner
inspector-tab-dom, inspector-tab-a11y, inspector-tab-network, inspector-tab-console, inspector-tab-selectors
timeline-scrubber, timeline-step-<id>
cockpit-drawer, cockpit-apply-fix-btn, cockpit-reproduce-btn, cockpit-heal-btn, cockpit-false-positive-btn
statusbar-git-branch, statusbar-ping, statusbar-engine-badge, statusbar-session-id
kill-switch
```

Enforce with an ESLint rule (custom or `jsx-a11y`-style) that fails on `<button>`, `<input>`, `<a>`, `[role=tab]` without `data-testid`. Companion dogfoods this: its own e2e suite uses these ids.

---

## 6. Motion

- Cursor: CSS spring (translate x/y), ~250–350 ms; click → 300 ms ripple ring.
- Typing: per-character overlay in the target field, throttled to ≤ 60 chars/s; masked for secrets.
- Streaming text: typewriter on incoming Markdown; auto-scroll pauses when the user scrolls up.
- Pane drag: immediate; hover highlight on handle; `prefers-reduced-motion` disables spring/ripple/typewriter.

---

## 7. Prototype prompt (paste into your design tool or Claude Code when you want the static mock)

```
Build a static, high-fidelity React + Tailwind prototype of the Companion workbench using UI-DESIGN-SPEC.md as the only design source.
- Implement tokens exactly (section 1), the 3-pane + scrubber layout (section 2), and every component in section 3 with mocked event data from packages/protocol/fixtures.
- The browser pane is a MOCK in this prototype (screenshot image + overlay); label it "prototype" in the code and do not wire real automation.
- Include all five page views with populated mock data; dark theme only; density text-xs; font-mono for code/DOM.
- Every interactive element carries the data-testid from section 5.
- Show the agent lifecycle end to end: thinking → planning → executing (cursor moves, target box, typing overlay, step banner) → approval card → completed, driven by a fixture event script with a play/pause control.
- No chain-of-thought text anywhere; plan/tool-activity/summary only. Settings shows Provider + keychain status, not API-key fields.
```

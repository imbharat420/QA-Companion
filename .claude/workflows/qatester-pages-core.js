export const meta = {
  name: 'qatester-pages-core',
  description: 'Build the workbench panes and the five core pages (projects, suites/cases, runs, findings, settings)',
  phases: [
    { title: 'Panes', detail: 'chat + timeline, browser + inspector' },
    { title: 'Pages', detail: 'workbench assembly, projects, suites/cases, runs, findings, settings' },
  ],
}

const R = 'D:/vibe/qatester'

const PRE = `
PROJECT: "Aether QA Companion" — Next.js 15 App Router (static export) + Tauri v2 desktop app
for autonomous browser QA. Repo root ${R}. Windows; use forward slashes in imports.

READ THESE FIRST, IN THIS ORDER. They are already written and AUTHORITATIVE — if any instruction
below conflicts with them, they win.
  ${R}/docs/BUILD-RULES.md          <- the conventions. Non-negotiable. Read it fully.
  ${R}/docs/BUILD-CONTRACT.md       <- the page-by-page spec from the design references.
                                       Find YOUR page's section and follow it.
  ${R}/src/app/globals.css          <- the token system
  ${R}/src/config/nav.ts            <- routes + typed link builders
  ${R}/src/lib/api/types.ts         <- the domain model
  ${R}/src/lib/queries.ts           <- the ONLY way a page reads data
  ${R}/src/components/ui/index.ts   <- the primitive kit (read the files you use)
  ${R}/src/components/shared/index.ts <- PageHeader, FilterBar, StatTile, DataTable, EmptyState,
                                         ErrorState, LoadingState, CodeBlock, DiffViewer,
                                         ImageDiffSlider, SeverityBadge, StatusBadge, ScoreRing,
                                         TreeView, ResizableSplit, FailureCockpit, ConfirmDialog…
  ${R}/src/components/charts/index.ts <- ChartCard, TrendLineChart, AreaTrendChart,
                                         BarSeriesChart, DonutChart, Sparkline, WaterfallChart,
                                         GaugeChart
  ${R}/src/lib/fixtures/index.ts     <- what data actually exists (read the relevant fixture file
                                        so your columns show real fields, not invented ones)

DO NOT create or modify anything outside the files you are told you own. Other agents are
working in this tree at the same time. In particular: never touch globals.css, nav.ts, types.ts,
contract.ts, queries.ts, or any file under components/ui, components/shared or components/charts.

BUILD REAL PAGES, NOT STUBS. Every page must:
  * render its full layout with real data from the query hooks,
  * implement every filter, tab, sort and action its contract section lists,
  * handle loading (LoadingState / Skeleton), error (ErrorState with retry) and
    empty (EmptyState with a useful next action) states,
  * put filter + selected-detail state in SEARCH PARAMS (see BUILD-RULES §2) so views are
    linkable and Back works, mirroring into the filtersStore where the store already has a bag
    for that page,
  * cross-link to the other pages through \`routes.*\` — this app is judged on its linking, so
    every id you render that belongs to another page is a link to it,
  * carry data-testid on every interactive element,
  * be responsive down to 1120px wide (the Tauri window minimum) without horizontal page scroll;
    wide tables scroll inside their own overflow-x container.

If a hook, component or fixture export you expect is missing or named differently, READ THE FILE
and adapt to what is actually there. Never invent an import.

When you finish your files, run:
  cd ${R} && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "<your file paths>"
and fix every error in YOUR files. Ignore errors in files you do not own. Iterate until your
files are clean. Do not report done until they are.
`.trim()

phase('Panes')

const panes = await parallel([
  () => agent(`${PRE}

TASK — THE CHAT PANEL AND THE EXECUTION SCRUBBER.

You own EXACTLY:
  src/components/workbench/ChatPanel.tsx
  src/components/workbench/Timeline.tsx

Port and modernise from the prototype — READ BOTH IN FULL FIRST:
  ${R}/legacy/src/components/workbench/ChatPanel.tsx
  ${R}/legacy/src/components/workbench/Timeline.tsx
  ${R}/legacy/src/lib/agentContext.tsx   (for the behaviour they relied on)
The prototype used a React context; state now lives in \`@/store/agentStore\` — read it and use
its narrow selector hooks (useAgentMessages, useAgentStatus, useAgentTimeline, useAgentApproval,
useAgentTokens, useAgentRunning, useSelectedStep, plus the actions via
\`useAgentStore(s => s.action)\`).

ChatPanel — exports \`ChatPanel\`. Left pane of the workbench, 320-400px:
  * Header: "Agent" title, AgentStatusPill, a token meter, and a Stop button while running.
  * Message list: user / agent / system messages, agent text streamed with a typewriter effect
    that AUTO-SCROLLS but PAUSES when the user scrolls up (track scroll position; resume when
    they scroll back to the bottom). Respect reduced motion — no typewriter then.
  * Structured cards rendered inline from ChatMessage.card / cardKind:
      - PlanCard: the goal plus stages with per-stage state (pending/active/done/failed/skipped),
        a connecting rail, and the token budget.
      - ToolActivityRow: tool name, redacted args summary, result summary, duration, ok/fail.
      - ApprovalDialogCard: THE IMPORTANT ONE. action type, target, redacted payload preview,
        short payload hash, why approval is needed, a remember-scope selector
        (step / session / project), and Approve / Reject buttons wired to
        \`resolveApproval\`. data-testids: approval-approve-btn, approval-reject-btn,
        approval-remember-scope. It must visually block — the pane dims behind it — because the
        agent is genuinely halted.
      - StuckCard: the reason plus choice buttons (retry / skip / take control / provide selector
        / stop) wired to \`resolveStuck\`, data-testids stuck-choice-<choice>.
  * Quick-action chips from \`QUICK_ACTIONS\` (fixtures/browser.ts), each calling
    \`startTask({ prompt, mode: slug })\`. data-testid \`chat-quick-action-<slug>\`.
  * Composer: a growing textarea (Enter sends, Shift+Enter newlines), a send button, and a
    disabled state while the agent is waiting on an approval.
    data-testids: chat-input, chat-input-send-button.
  * NEVER render chain-of-thought. Plan, tool activity and summary only — this is a product
    requirement, not a style preference.

Timeline — exports \`Timeline\`. Bottom pane, 150px (var(--timeline-h)):
  * A horizontal scrubber of TimelineStep chips in order, each with a kind icon, label and
    status colour. Failed steps stay expanded; completed ones are compact.
  * Selecting a chip calls \`selectStep(id)\`; the selected chip is visually locked. This is what
    scrubs the browser pane and inspector to that instant, so the selection must be obvious.
  * Keyboard: left/right arrows move between steps when the scrubber has focus; Home/End jump.
    role="listbox" with role="option" chips and aria-selected.
  * A play/pause control that steps the selection forward at a readable cadence, so the run can
    be watched back.
  * Auto-scroll to the newest step while the agent is running, unless the user has selected one.
  * Artifact chips (screenshot / finding) on steps that have them; a finding chip links to
    \`routes.finding(id)\` AND opens the cockpit via \`useUiStore(s => s.openCockpit)\`.
  * data-testids: timeline-scrubber, timeline-step-<id>.

Both components are memoized where it matters and must not re-render the whole pane on every
agent event — subscribe narrowly.

Return a JSON summary of the components and their props.`,
    { label: 'panes:chat-timeline', phase: 'Panes' }),

  () => agent(`${PRE}

TASK — THE LIVE BROWSER PANE AND THE DEVTOOLS INSPECTOR.

You own EXACTLY:
  src/components/workbench/BrowserPane.tsx
  src/components/workbench/InspectorPane.tsx

Port and modernise from the prototype — READ BOTH IN FULL FIRST:
  ${R}/legacy/src/components/workbench/BrowserPane.tsx
  ${R}/legacy/src/components/workbench/InspectorPane.tsx
State now lives in \`@/store/agentStore\` (useAgentBrowser, useAgentNetwork, useAgentLogs,
useAgentDomTree, useSelectedStep) and UI state in \`@/store/uiStore\`
(activeInspectorTab / setInspectorTab).
The target website component already exists and must be REUSED, not rewritten:
  ${R}/src/components/workbench/FakeSite.tsx  — exports \`FakeSite\` and type \`RegFn\`.

BrowserPane — exports \`BrowserPane\`. Centre pane, flex-1:
  * Real browser chrome: back / forward / reload, an SSL indicator, an EDITABLE url bar (Enter
    navigates), a tab strip with new-tab and close-tab, and a viewport toggle
    (desktop / tablet / mobile) that actually resizes the rendered frame.
    data-testids: live-browser-back, live-browser-forward, live-browser-reload,
    live-browser-url-bar, live-browser-tab-<n>, live-browser-new-tab,
    live-browser-viewport-toggle.
  * A "Take control" toggle (data-testid live-browser-take-control) that flips
    \`browser.takeover\`; while on, the agent overlay is suppressed and the site is interactive.
  * The viewport renders \`<FakeSite page={...} inputs={...} reg={reg} />\`. Implement \`reg\` as a
    ref-collecting callback that stores each element by id in a ref map — that map is how the
    overlay converts a selector into real on-screen coordinates. Measure with
    getBoundingClientRect against the pane's own rect, and re-measure on resize via a
    ResizeObserver.
  * THE AGENT OVERLAY, absolutely positioned above the site, pointer-events-none:
      - a laser cursor that springs to the target centre (~250-350ms, CSS transform transition —
        do NOT animate top/left, and do not run a JS animation loop),
      - a 300ms ripple ring on click (the \`ripple\` browser-state field, keyed so repeats retrigger),
      - a target bounding box on \`highlight\`,
      - a typing overlay that renders characters as \`typing\` progresses, MASKED with dots when
        the field is a password/card/cvv field,
      - a step banner showing the current action label (data-testid live-browser-step-banner).
    All of it disabled under prefers-reduced-motion and while takeover is on.
  * When a timeline step is selected (scrubbing), show that step's captured state with a clear
    "viewing step N of M" affordance and a button to return to live.
  * The pane must never unmount while the agent runs.

InspectorPane — exports \`InspectorPane\`. Right pane, 320-420px, five tabs
(data-testids inspector-tab-dom / -a11y / -network / -console / -selectors):
  * DOM Tree — a real tree from \`useAgentDomTree\` (DomNode), expand/collapse, monospace,
    attribute syntax colouring via tokens; selecting a node highlights it in the browser pane
    (write the selector into the agent store's browser.highlight).
  * Accessibility Tree — role / name / state rows from the A11Y_TREES fixture for the current page.
  * Network — a waterfall table (method, URL, status, type, size, timing bar). 4xx/5xx rows in
    the destructive tone; query values redacted. Filter by status class and by type.
  * Console — level filter (all/log/info/warn/error), source and timestamp, monospace,
    auto-scroll with the same pause-on-user-scroll behaviour as the chat.
  * Selectors — candidate locators from \`useSelectorCandidates\`, ranked by stability with a
    visible score bar, strategy badge, uniqueness flag and a CopyButton per row.
  * All five tabs are event-sourced from the store, and when a timeline step is selected they
    show the slice captured at that instant rather than live data.
  * Network and console lists can grow long — use the shared DataTable (it virtualises) or
    @tanstack/react-virtual directly.

Return a JSON summary of the components and their props.`,
    { label: 'panes:browser-inspector', phase: 'Panes' }),
])

phase('Pages')

const pages = await parallel([
  () => agent(`${PRE}

TASK — THE WORKBENCH PAGE (assemble the panes).

You own EXACTLY:
  src/app/workbench/page.tsx
  src/components/workbench/index.ts

The four panes now exist in src/components/workbench/ — READ THEM and their prop signatures:
ChatPanel, BrowserPane, InspectorPane, Timeline (plus FakeSite, already there).

Build the workbench per BUILD-CONTRACT.md's workbench section and UI-DESIGN-SPEC §2:

  ┌ chat 320-400px ┬ live browser flex-1 ┬ inspector 320-420px ┐
  │                │                     │                     │
  ├────────────────┴─────────────────────┴─────────────────────┤
  │ execution scrubber 150px                                    │
  └─────────────────────────────────────────────────────────────┘

  * Use \`ResizableSplit\` from @/components/shared for both axes (horizontal for the three
    panes, vertical for content-vs-timeline), with storageKey "workbench.h" / "workbench.v" so
    sizes persist per user.
  * Load the three panes with \`next/dynamic\` (ssr: false) so the route's first paint isn't
    blocked by the heaviest components — but keep them mounted once loaded.
  * Honour \`useUiStore(s => s.focusMode)\`: "chat" | "browser" | "inspector" expands that pane to
    fill and collapses the others WITHOUT unmounting them (so agent state survives); "none"
    restores the saved sizes. Add a focus-mode control in a small pane toolbar.
  * Honour \`useUiStore(s => s.timelineCollapsed)\` with a toggle.
  * Read \`?task=\` and \`?step=\` search params on mount: \`step\` selects that timeline step.
  * If no agent task has ever run this session, show an inviting empty state INSIDE the chat
    pane (the quick-action chips are the call to action) rather than an empty-page state —
    the browser and inspector still render their blank-page chrome.
  * The page fills the shell exactly: h-full, no page-level scrolling; each pane scrolls itself.

index.ts re-exports ChatPanel, BrowserPane, InspectorPane, Timeline, FakeSite and RegFn.

Return a JSON summary.`,
    { label: 'page:workbench', phase: 'Pages' }),

  () => agent(`${PRE}

TASK — THE PROJECTS PAGE (route "/", the app's landing screen).

You own EXACTLY:
  src/app/page.tsx
  src/components/projects/ProjectSidebar.tsx
  src/components/projects/ProjectCard.tsx
  src/components/projects/ProjectDetail.tsx
  src/components/projects/UploadDropzone.tsx
  src/components/projects/index.ts

The design references for THIS page are specific — BUILD-CONTRACT.md's projects section is built
from ${R}/docs/design/project-ui.webp, project-states.webp, upload-projects.webp and home.png.
Follow it. The shape it describes:

  * A LEFT SIDEBAR (~240px) inside the page (distinct from the app nav rail): an "All projects"
    header with total count, then quick views (Recent, Starred, Uploaded, Archived) with counts,
    then a "Projects" section listing each workspace with a coloured dot and its test count and a
    "+" to add, then folder groups (from WORKSPACE_FOLDERS), then the drag-n-drop upload zone at
    the bottom. Use \`TreeView\` from @/components/shared where the structure is a tree.
  * A MAIN AREA: a large page title, a prominent search field, filter chips
    (Framework / Category / Owner / Last modified) and a grid/list view toggle, then the
    workspace cards — grouped by folder when \`groupByFolder\` is on, otherwise a flat grid.
  * ProjectCard: thumbnail band, name, framework badge, description, and a metric strip
    (sessions, tests, health). \`thumbnail\` values are strings like "gradient:chart-1" — render
    them as token-driven CSS gradients via a small helper (do NOT fetch remote images; this is a
    desktop app). A star toggle wired to \`useToggleProjectStar\`. The whole card opens the
    project (\`routes.project(id)\`), and its metric numbers deep-link:
    tests -> routes.suites({projectId}), sessions -> routes.workbench(),
    health -> routes.findings({projectId}).
    Render the WORKSPACE_STATES variants: ready / indexing / uploading / error / offline —
    indexing shows a progress shimmer, error shows a retry, offline dims the card.
  * ProjectDetail: when \`?project=<id>\` is set, show the project detail in place of the grid —
    header with name / path / branch / framework, the dev and test commands in CodeBlocks with
    copy buttons, a health ScoreRing, StatTiles for tests / sessions / open findings / pass rate,
    a recent-runs list linking to routes.run(id), a top-findings list linking to
    routes.finding(id), and a primary "Open workbench" action. A back affordance clears the param.
  * UploadDropzone: a real drag-and-drop target (dragover/dragleave/drop with a visible active
    state), a file-picker fallback button, and the \`uploadQueue\` from projectsStore rendered as
    per-item progress rows. In Tauri, use @tauri-apps/plugin-dialog's \`open\` for the picker;
    guard for the browser and fall back to a hidden <input type="file">. Dropped items enqueue
    via \`enqueueUpload\` and advance through \`updateUpload\` — drive the progress with a timer so
    the flow is demonstrable, and mark them done.
  * Sort control (recent / name / health / tests) bound to projectsStore.sortBy.
  * The page is scrollable and responsive; the sidebar collapses under 1280px into a toggle.

src/app/page.tsx default-exports the page component (Next requirement) and is the ONLY default
export you write.

Return a JSON summary.`,
    { label: 'page:projects', phase: 'Pages' }),

  () => agent(`${PRE}

TASK — TEST SUITES AND TEST CASES (two routes).

You own EXACTLY:
  src/app/suites/page.tsx
  src/app/cases/page.tsx
  src/components/testing/SuiteTree.tsx
  src/components/testing/CaseDetail.tsx
  src/components/testing/index.ts

Read the fixtures so your columns are real: ${R}/src/lib/fixtures/suites.ts and cases.ts.

/suites — Test Suites & Specs, per BUILD-CONTRACT.md:
  * PageHeader with the suite count, a "Generate spec" primary action and a "Run all" action.
  * StatGrid across the top: total suites, total cases, aggregate pass rate, failing suites.
  * A two-column body: SuiteTree on the left (suites grouped by status, each showing case count
    and pass rate, selecting one sets \`?suite=<id>\`), and on the right a DataTable of the
    selected suite's specs — columns: Suite / File / Cases / Pass rate (with a Progress bar) /
    Last run / Status (StatusBadge) / actions.
  * Row actions: Run (useStartRun, then router.push(routes.run(newRun.id))), View cases
    (routes.cases({suiteId})), Open in workbench.
  * Filter by status (all/passing/failing/flaky) and search by name or file.
  * Clicking a suite's case count navigates to /cases?suite=<id> — that link is the point.

/cases — Test Cases:
  * PageHeader; FilterBar with search, suite filter (populated from useSuites), tag filter,
    status filter — all mirrored into filtersStore.cases and the URL.
  * DataTable of cases — columns: Title / Suite (link to routes.suites) / File / Status /
    Duration (formatDuration) / Flake rate (a small bar) / Owner / Tags / Last run.
    Rows are clickable and set \`?case=<id>\`.
  * CaseDetail renders in a right-side Drawer when \`?case=\` is set: the case title and tags,
    the ordered steps[] as a numbered list with each step's \`code\` in a CodeBlock, the
    assertions[] as a table (kind / target / expected / soft), a "generated by agent" badge
    where applicable, and actions: Run this case, Open in workbench, Copy as Playwright spec,
    View suite.
  * Cases whose \`generatedBy\` is "agent" get a visible provenance marker — users need to know
    what a human wrote versus what the agent generated.

Both pages: real loading / error / empty states, and the case list virtualises (26 fixtures now,
but a real project has thousands — use DataTable and pass virtualize when rows exceed 100).

Return a JSON summary.`,
    { label: 'page:suites-cases', phase: 'Pages' }),

  () => agent(`${PRE}

TASK — TEST RUNS AND ANALYTICS (list + detail on one route).

You own EXACTLY:
  src/app/runs/page.tsx
  src/components/runs/RunDetail.tsx
  src/components/runs/FlakyPanel.tsx
  src/components/runs/index.ts

Read ${R}/src/lib/fixtures/runs.ts (RUNS, TREND, FLAKY_TESTS) and port the analytics ideas from
the prototype ${R}/legacy/src/pages/TestRuns.tsx — READ IT.

/runs, list view (no \`?run=\` param):
  * PageHeader with a "New run" primary action.
  * StatGrid: pass rate (with delta), total tests, avg duration, flaky count — each StatTile
    carrying a sparkline from TREND.
  * A ChartCard with the pass/fail trend (AreaTrendChart or TrendLineChart over TREND, stacked
    percentages, x = run id). Charts load via next/dynamic.
  * FilterBar: search, status filter, branch filter — mirrored to filtersStore.runs and the URL.
  * DataTable of runs — columns: Run (id + name) / Branch / Trigger / When / Duration /
    Passed / Failed / Flaky / Skipped / Status. Passed/Failed cells are coloured and the failed
    count links to routes.findings({runId}). Clicking a row sets \`?run=<id>\`.
  * FlakyPanel below: the FLAKY_TESTS list with flake rate bars, runs affected, last failure and
    suspected cause; each row links to routes.cases({caseId}) where the fixture has one.

/runs?run=<id>, detail view — RunDetail replaces the list (with a back affordance that clears
the param):
  * Header: run id + name, branch, commit message and author, trigger, engine, started-at,
    duration, and an overall StatusBadge. Actions: Re-run, Open in workbench, View findings.
  * A result summary bar (passed / failed / flaky / skipped as a single proportional stacked bar
    plus counts).
  * "Failure analysis": the run's \`groups\` (RunGroup) as cards — title, count, description,
    coloured by \`tone\`. This is the root-cause grouping and should read as the most important
    block on the page.
  * The \`specs\` list: each file as a collapsible section listing its tests with status icons.
    A failed test row opens the failure cockpit via \`useUiStore(s => s.openCockpit)\` on the
    matching finding when one exists, and otherwise links to routes.findings({runId}).
  * A DonutChart of the pass/fail/flaky/skipped split.
  * Deep link both ways: this view is reachable from the runs table, the command palette, the
    findings page and the project detail, so the back affordance must always work.

Return a JSON summary.`,
    { label: 'page:runs', phase: 'Pages' }),

  () => agent(`${PRE}

TASK — FINDINGS & BUG INTELLIGENCE (the inbox, plus detail).

You own EXACTLY:
  src/app/findings/page.tsx
  src/components/findings/FindingRow.tsx
  src/components/findings/FindingDetail.tsx
  src/components/findings/index.ts

Read ${R}/src/lib/fixtures/findings.ts and port the ideas from the prototype
${R}/legacy/src/pages/Findings.tsx — READ IT. The shared \`FailureCockpit\` drawer already exists
in @/components/shared and is mounted app-wide by AppShell; open it with
\`useUiStore(s => s.openCockpit)(findingId)\` rather than building another drawer.

/findings, inbox:
  * PageHeader with counts.
  * StatGrid by severity — critical / high / medium / low tiles, each clickable to set the
    severity filter (this is the fastest triage path, so make it obvious they filter).
  * FilterBar: search, severity, status, category — mirrored to filtersStore.findings and the URL.
    Honour an incoming \`?run=<id>\` param as a run filter, with a visible "filtered to run #558"
    chip that can be cleared, because Test Runs links here that way.
  * The inbox list uses FindingRow (React.memo): severity stripe down the left edge,
    SeverityBadge, title, category badge, a confidence meter, status badge, the affected URL
    (truncateMiddle) and related-test count. Rows are keyboard-accessible.
    data-testid \`findings-row-<id>\`.
  * Row click sets \`?finding=<id>\`; a separate "Open cockpit" action on the row opens the
    FailureCockpit drawer. Both paths must work — the param for linkable detail, the drawer for
    fast triage.
  * Bulk selection with checkboxes and a bulk status action (confirm / mark false positive) via
    useUpdateFindingStatus. Use ConfirmDialog for the destructive one.
  * Sort by severity, confidence or detection time.
  * Virtualise the list (it is the one list guaranteed to grow).

/findings?finding=<id> — FindingDetail, a full detail view beside or in place of the list:
  * Header: SeverityBadge, title, id, status control (a Select wired to useUpdateFindingStatus
    with the optimistic path), confidence meter.
  * "What we saw" — expected vs actual side by side, the affected URL as an external link and
    the element selector in a CodeBlock with a copy button.
  * "Diagnosis" — Facts and Inference in two clearly separated panels. Never blend them; that
    separation is a product requirement. Include the confidence and the \`rca\` prose.
  * "Evidence" — the evidence[] items as chips that open the cockpit's evidence tab.
  * "Proposed fix" — DiffViewer over \`finding.fix\`, with an "Apply fix" button wired to
    useApplyFindingFix, disabled when there is no diff, and a success toast on completion.
  * Cross-links: the originating run (routes.run), suite (routes.suites), case
    (routes.cases({caseId})), project — every id that belongs to another page is a link.

Return a JSON summary.`,
    { label: 'page:findings', phase: 'Pages' }),

  () => agent(`${PRE}

TASK — THE SETTINGS PAGE, INCLUDING THE ONE-CLICK API SWITCH.

You own EXACTLY:
  src/app/settings/page.tsx
  src/components/settings/ApiSourcePanel.tsx
  src/components/settings/SettingsSection.tsx
  src/components/settings/index.ts

Read ${R}/src/store/settingsStore.ts IN FULL — it already holds every field, every action and
the ApiMode type. Your job is the UI over it; do not add state that belongs in the store, and do
not modify the store.
Also read ${R}/src/lib/api/index.ts to understand getDataSource / getDataSourceFor /
resetDataSourceCache, and ${R}/docs/BUILD-RULES.md §3 for how the switch works end to end.

Layout: a tabbed settings page (Tabs from @/components/ui), tab driven by \`?tab=\` so
\`routes.settings({tab:"api"})\` deep-links — the status bar links here that way.
Tabs: API Source · Agent · Browser · Policy · Appearance · About.

ApiSourcePanel is the headline. It must make switching genuinely one click:
  * A segmented / radio-card control over the three modes from \`API_MODES\`
    (mock / http / tauri), each card showing the label, the hint and a live availability
    indicator. data-testid \`settings-api-mode-<mode>\` and \`settings-api-mode-select\`.
  * Selecting a mode calls \`setApiMode(mode)\` immediately — no separate Save button. Show a
    toast confirming the switch and that cached data was dropped (AppProviders does the
    dropping; you just report it).
  * The Tauri card is disabled with an explanation when \`isTauri()\` is false (import the guard
    from @/lib/api/tauri) — running in a browser, there is no Rust backend to talk to.
  * When http is selected, reveal: base URL input (bound to setHttpBaseUrl), a headers
    key/value editor (add / remove rows, bound to patchApi), timeout and retries number inputs.
  * A "Test connection" button that calls \`getDataSourceFor(mode).health()\` for the pending
    mode and renders ok / latency / detail — success and failure both clearly styled.
    data-testid \`settings-api-test-connection\`.
  * A small "what this changes" explainer: which adapter serves which resources, and that every
    page follows the switch with no reload.

Other tabs, all bound to the existing store actions with proper Labels and help text:
  * Agent: provider Select, model input, max tokens / max steps / temperature (Slider),
    the approvalRequired list as removable chips plus an add field, and the
    autoApproveReadOnly Switch. Per the product brief this page shows PROVIDER and keychain
    STATUS — it must never render an API-key text field.
  * Browser: engine ToggleGroup, headless Switch, viewport ToggleGroup, throttle Select,
    default timeout.
  * Policy: allowedDomains / blockedDomains list editors, maxCrawlDepth, maxPagesPerScan,
    respectRobotsTxt Switch, redactSecrets Switch (with a warning when turned off).
  * Appearance: density ToggleGroup, reduceMotion Switch, showAmbientEffects Switch, and the
    theme toggle (write \`document.documentElement.dataset.theme\` and persist to
    localStorage key "aether.theme" — the same key TitleBar uses, so they stay in sync).
  * About: app name and version, the resolved data source, the Tauri/browser runtime, and links
    out to the docs. Plus a "Reset all settings" ConfirmDialog wired to \`reset()\`.

SettingsSection is a small reusable row/section wrapper (label + description + control, aligned
in a grid) so the six tabs look like one page rather than six.

Return a JSON summary.`,
    { label: 'page:settings', phase: 'Pages' }),
])

return {
  panes: panes.map((r, i) => (r ? 'ok' : `FAILED#${i}`)),
  pages: pages.map((r, i) => (r ? 'ok' : `FAILED#${i}`)),
  results: [...panes, ...pages].filter(Boolean),
}

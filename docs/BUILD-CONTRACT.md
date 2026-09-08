# BUILD-CONTRACT.md

The page-by-page spec: what each of the 13 routes renders, from which hook, linking where.
`BUILD-RULES.md` governs conventions (routing, data access, state, styling, testids) and is not
repeated. `src/lib/api/types.ts` owns the field names, `src/config/nav.ts` the routes and link
builders, `src/lib/fixtures/` the values — every field below exists in `types.ts` and is populated.
Detail views are search params (`/runs?run=%23558`), never `[id]` segments.

Reference shapes come from TestDino (SaaS test reporting), BrowserStack Test Companion (VS Code QA
panel), a token-usage monitor and a Canva-style project browser, mined for information architecture,
columns and widget vocabulary only. Ours is dark, dense and lime-accented. Columns the references
showed that we hold no data for are listed under **Dropped from the references**.

| Route            | Nav label      | Purpose                                                                |
| ---------------- | -------------- | ---------------------------------------------------------------------- |
| `/`              | Projects       | Browse, star, upload and open workspaces; the app's entry surface.     |
| `/workbench`     | Workbench      | Live agent: chat, plan, browser, inspector, execution scrubber.        |
| `/suites`        | Test Suites    | Suite tree and spec catalog for the active project.                    |
| `/cases`         | Test Cases     | Individual cases with steps, assertions and locator provenance.        |
| `/runs`          | Test Runs      | Run history, pass-rate trend, per-spec breakdown, flake analysis.      |
| `/findings`      | Findings       | Bug-intelligence inbox, split diagnosis, failure cockpit, patch apply. |
| `/accessibility` | Accessibility  | axe-core violations by rule, WCAG level and impact, with score trend.  |
| `/security`      | Security       | Header checklist plus scan issues by category, CVSS and CWE.           |
| `/performance`   | Performance    | Core Web Vitals against budget, resource waterfall, opportunities.     |
| `/visual`        | Visual         | Baseline vs actual vs diff, viewport matrix, baseline approval.        |
| `/api-intel`     | API            | Discovered endpoints, schema drift, contract detector issues.          |
| `/scripts`       | Script Library | Reusable tests, steps, page objects, fixtures and skills, versioned.   |
| `/settings`      | Settings       | Data source, agent, browser, policy, appearance — the API switch.      |

## `/` — Projects

### Purpose

The launcher: pick a workspace, see its health, jump from it into any quality surface. Also the one
place that uploads and imports a project.

### Layout

Shape follows the Canva "All projects" browse grid crossed with its dark files-and-projects sidebar.

- **Folder sidebar** 264px, own scroll, hidden under 1100px (collapses into the Folder select):
  `All projects` header with total; `TreeView` of `WORKSPACE_FOLDERS` (colour dot from `colorToken`,
  `name`, right-aligned `count`); hairline; `Starred` row; hairline; upload dropzone pinned bottom,
  dashed and recessed (`surface-inset`), "Drag a project folder here", click opens the picker.
- **Main column** fills the rest, single scroll, 24px padding: `PageHeader` → `StatGrid` →
  `FilterBar` → section `Recent` (3 cards) → section `All projects` (grid or table per view mode).
- **Detail** `?project=ws-001` opens a right `Drawer` 460px; the grid stays mounted behind it.
- Card grid `repeat(auto-fill, minmax(240px, 1fr))`, 20px gutters, left-aligned and wrapping (it does
  not stretch). Card = 4:3 thumbnail from `thumbnail` (`gradient:chart-1` → a local token gradient,
  never a network fetch) with a small `ScoreRing` for `health` inset bottom-right; `name`;
  `framework · branch`; footer `tests` tests · `sessions` sessions · `lastActive`. Star toggle and
  kebab fade in top-right on hover, checkbox top-left.

### Widgets

1. `PageHeader` — "Projects" / "Browse, upload and open workspaces"; actions `New project`
   (primary), `Import folder`, grid/list toggle.
2. `StatGrid` ×4 `StatTile` from `useDashboardSummary()`: Pass rate (`passRate`), Total tests
   (`totalTests`), Open findings (`openFindings`), Running runs (`runningRuns`). One bordered card
   split by vertical rules — shape follows the TestDino test-cases KPI strip.
3. `FilterBar`; project card grid (default) or `DataTable` (list mode), same rows in the same order.
4. Upload dropzone with determinate progress from `projectsStore.uploadQueue` (`name`, `progress`,
   `state`).
5. `Drawer` — `ScoreRing` (`health`), `description`, `CodeBlock` + `CopyButton` for `devCommand` and
   `testCommand`, `path`, `gitUrl`, `owner`, `StatusBadge` for `WORKSPACE_STATES[id]`, four link
   buttons.
6. `EmptyState` / `ErrorState` / `LoadingState`. No `Sparkline`: `Workspace` holds no history series.

### Table columns (list mode)

| Header      | Field                         | Link                                 |
| ----------- | ----------------------------- | ------------------------------------ |
| Project     | `name` + `path` (muted)       | `routes.project(w.id)`               |
| Framework   | `framework`                   | —                                    |
| Branch      | `branch`                      | —                                    |
| Health      | `health` via `ScoreRing` sm   | —                                    |
| Tests       | `tests`                       | `routes.suites({ projectId: w.id })` |
| Sessions    | `sessions`                    | `routes.workbench()`                 |
| Last active | `lastActive`                  | —                                    |
| Owner       | `owner.avatar` + `owner.name` | —                                    |
| State       | `WORKSPACE_STATES[w.id]`      | —                                    |
| ★           | `starred`                     | toggle, `useToggleProjectStar()`     |

### Filters, tabs and actions

Search "Search projects, paths and frameworks" (`name`, `path`, `framework`) · `Category` select
(All + the 5 distinct `category` values) · `Folder` select (All + `WORKSPACE_FOLDERS.name`, mirrors
the sidebar) · `Sort` select Recent / Name / Health / Tests (`projectsStore.sortBy`) · view toggle
grid | list (`projectsStore.viewMode`) · `New project` → dialog (name, path, framework) →
`useCreateProject()` · `Import folder` → native picker → upload queue · star →
`useToggleProjectStar()`, optimistic · card click `router.push(routes.project(id))`, double-click
goes straight to `routes.workbench()` · kebab: Open workbench, Open suites, Open runs, Copy path,
Star.

### Data

`useProjects()`, `useProjectFolders()`, `useDashboardSummary()`, `useToggleProjectStar()`,
`useCreateProject()`. Fixtures: `fixtures/workspaces.ts` (`WORKSPACES` ×5, `WORKSPACE_FOLDERS` ×3 —
Local 2 / GitHub 1 / Uploads 2, `WORKSPACE_STATES`).

### Cross-links

Outbound: card or row title → `routes.project(id)` · drawer `Open workbench` →
`routes.workbench()` · drawer `Suites` → `routes.suites({ projectId })` · drawer `Runs` →
`routes.runs()` · drawer `Findings` and the Open-findings tile → `routes.findings()` · Running-runs
tile → `routes.runs({ status: "running" })` · `ErrorState` → `routes.settings({ tab: "data" })`.

Inbound: nav rail · `TitleBar` project switcher · breadcrumb root on every page · `/workbench`
project chip.

### States

- Loading — real section headers, 6 card skeletons (4:3 block + 70% title bar + 45% meta bar),
  sidebar rows as dot + two bars; skeletons block clicks.
- Empty — "No workspaces yet" / "Import a folder or drop one below", primary `Import folder`, the
  dropzone in focus. Filtered: `No projects match "<query>"` + `Clear filters`, sidebar and
  `StatGrid` stay live.
- Error — `ApiError` message, `Retry`, `Check data source` → `routes.settings({ tab: "data" })`.
- Per-card from `WORKSPACE_STATES`: `indexing` a spinner in the meta line, `uploading` a determinate
  ring + "Uploading… N%", `error` a `SeverityBadge` + `Retry`, `offline` 50% opacity, inert.

## `/workbench` — Agent Live Workbench

### Purpose

Watch and steer one agent task: what it plans, what it does in the browser, what it observes, what
it needs approved.

### Layout

Follows `UI-DESIGN-SPEC.md` §2. `ResizableSplit` horizontally, three panes, sizes persisted in
`uiStore.paneSizes["workbench"]`.

- **Chat** 320–400px (default 360): quick-action chip row, transcript (fills), stuck card, approval
  card, composer.
- **Live Browser** flex-1, never unmounts while the task runs: 32px chrome (back, forward, reload,
  SSL dot, editable URL bar, viewport toggle, `Take control`), 28px tab strip from `browser.tabs`,
  viewport frame with the overlay (laser cursor, target box, ripple, typing text, step banner from
  `browser.overlay`).
- **Inspector** 320–420px (default 380): a `Tabs` header over one scroll body.
- **Execution scrubber** 140px spanning all three panes, collapsible via `uiStore.timelineCollapsed`.
- Assistant turns render as an activity timeline with a left connector rail and one icon per row —
  shape follows the Claude-in-Chrome side panel, not a bubble list. Tool rows collapse to one line
  and expand into a labelled `CodeBlock`.

### Widgets

1. `AgentStatusPill` in `TitleBar`, `data-state` from `agentStore.status`; the waiting state badges
   the pending-approval count. Beside it the token meter, fed by the `tokens` event against
   `PlanCard.budgetTokens`.
2. Quick-action chips — 8 rows from `QUICK_ACTIONS` (`slug`, `label`, `icon`); click sends `prompt`
   via `startTask({ prompt, mode: slug })`.
3. Transcript — `ChatMessage` rows by `from`; `cardKind` picks the attached card: `plan` → `goal`,
   `budgetTokens` meter, `stages` as a `PlanStage` list (pending/active/done/failed/skipped);
   `tool` → `ToolActivity` (`tool`, `argsSummary`, `resultSummary`, `formatDuration(durationMs)`,
   ok/fail dot, expands to a `CodeBlock`); `approval` → `title`, `desc`, `action`, `risk`, `target`,
   `CodeBlock` of `payloadPreview`, `payloadHash` + `CopyButton`, `reason`, remember-scope select
   (`rememberScope`), Approve / Reject; `stuck` → `reason` + one button per entry in `choices`.
4. Composer — textarea, attach, mode chip, send; `Stop` replaces send while `running`.
5. Live browser frame + overlay.
6. Inspector `Tabs` — DOM (`TreeView` over `DomNode`), A11y (`A11yNode` role/name rows), Network
   (`DataTable`), Console (`ConsoleEntry` rows + level filter), Selectors (`DataTable` +
   `CopyButton`).
7. Scrubber — one chip per `TimelineStep` (`kind`, `label`, `status`); the selected step scrubs the
   browser to `screenshotSrc` and slices network/console to that instant. Failed steps stay
   expanded, `ok` steps collapse, a step with `findingId` gets a `SeverityBadge` chip.
8. `ConfirmDialog` on `Stop task` and `Take control`. `EmptyState` in the transcript before the
   first task; `ErrorState` in the chat pane when `agentStore.error` is set.

### Table columns

**Network pane**: Method (`NetworkEntry.method`) · URL (`url` via `truncateMiddle`) · Status
(`status`, 4xx/5xx in `text-critical`) · Type (`type`) · Size (`sizeBytes` via `formatBytes`) · Time
(`ms`) · Start (`startMs`). No cell links.

**Selectors pane**: Selector (`SelectorCandidate.selector`, mono, `CopyButton` per row) · Strategy
(`strategy`) · Stability (`stability`, 0–100 bar) · Unique (`unique`).

### Filters, tabs and actions

Inspector tabs `DOM | A11y | Network | Console | Selectors` (`uiStore.activeInspectorTab`) · console
level filter All / log / info / warn / error / debug (`ConsoleEntry.level`) · viewport toggle
Desktop | Tablet | Mobile → `browser.viewport` · `Take control` toggles `browser.takeover`, hiding
the overlay and pausing the agent · `Stop` → `stopTask()` behind `ConfirmDialog` · Approve / Reject →
`resolveApproval(decision)` · stuck choices retry / skip / take-control / provide-selector / stop ·
params `?task=` selects the task and `?step=12` preselects a timeline step
(`routes.workbench({ taskId, stepId })`).

### Data

The live panes read `agentStore` through narrow selectors, never queries — the store is fed only by
`applyEvent(AgentEvent)`. Queries: `useDomTree(page)` and `useSelectorCandidates(page, target)` for
the inspector before a live `dom` event arrives, `useProjects()` for the project chip. Fixtures:
`fixtures/agentScript.ts` (`AGENT_SCRIPT` 89 events, `CHAT_SEED`, approval `apr-0142-payment`, plan
`plan-0142` with 5 stages on a 20,000-token budget) and `fixtures/browser.ts` (`DOM_TREES`,
`A11Y_TREES`, `SELECTOR_CANDIDATES` for 11 targets, `QUICK_ACTIONS`, `INITIAL_BROWSER_STATE`).

### Cross-links

Outbound: timeline step with `findingId` and the finding card in chat → `routes.finding(id)` ·
`Save as spec` → `routes.scripts({ scriptId })` · project chip → `routes.project(id)` · selector row
`Use in case` → `routes.cases({ caseId })` · budget notice →
`routes.settings({ tab: "agent" })`.

Inbound: nav rail (badge `pendingApprovals`) · `/` drawer `Open workbench` and card double-click ·
`/findings` cockpit `Reproduce` → `routes.workbench({ taskId })` · `/runs` detail `Re-run with
agent` · `/cases` drawer `Run in workbench` · every page's agent action (`Generate spec`,
`Re-run audit`, `Re-scan`, `Re-measure`, `Re-capture`, `Re-discover`).

### States

- Loading — all three panes render their chrome; transcript shows `CHAT_SEED` only, scrubber one
  "waiting for first step" row.
- Empty (`status: "idle"`) — "Ask me to test, explore or fix anything" with the 8 quick-action chips
  beneath, browser on `about:blank` from `INITIAL_BROWSER_STATE`, inspector tabs empty with per-tab
  copy.
- Error — `ErrorState` inline in the chat pane with `agentStore.error` + `Retry task`; the timeline
  freezes at the last step rather than clearing.

## `/suites` — Test Suites

### Purpose

The spec catalog: which suites exist for the active project, how each is trending, and the way into
its cases.

### Layout

- **Suite tree** 280px, own scroll: project row (`name` from `useProject`) then one `TreeView` child
  per suite — status dot, `name`, right-aligned `cases`. Selecting a row filters the right column and
  is the only selection state here (suites have no `DETAIL_PARAMS` entry).
- **Main column**: `PageHeader` → `StatGrid` → 2-up `ChartCard` row → `FilterBar` → `DataTable`.
- The table is the primary surface, the tree is navigation. Shape follows the TestDino test-cases
  suite grouping, flattened — one row is one suite, since `/cases` does the grouping.

### Widgets

1. `PageHeader` — "Test Suites" / "Suite tree and spec catalog"; actions `Run all` (primary),
   `Generate spec`, `Sync`.
2. `StatGrid` ×4 — Suites (6), Cases (51, the sum of `Suite.cases`), Passing (3), Failing (2). All
   are `SUITES` tallies.
3. `ChartCard` + `BarSeriesChart` — one bar per `Suite.passRate`, budget line at 100.
4. `ChartCard` + `DonutChart` — suites by `status` (passing 3 / failing 2 / flaky 1).
5. `FilterBar`, `DataTable`, `TreeView`, `StatusBadge`, `EmptyState` / `ErrorState` /
   `LoadingState`. No per-row `Sparkline`: `Suite` carries no history array, so `passRate` renders
   as a numeral plus a bar.

### Table columns

| Header    | Field                              | Link                              |
| --------- | ---------------------------------- | --------------------------------- |
| Suite     | `name`                             | `routes.cases({ suiteId: s.id })` |
| File      | `file` (mono)                      | —                                 |
| Cases     | `cases`                            | `routes.cases({ suiteId: s.id })` |
| Pass rate | `passRate` (`formatPercent` + bar) | —                                 |
| Status    | `status` via `StatusBadge`         | `routes.runs({ suiteId: s.id })`  |
| Last run  | `lastRun`                          | `routes.runs({ suiteId: s.id })`  |
| Tags      | `tags` as chips                    | each → `routes.cases({ tag })`    |

### Filters, tabs and actions

Search "Search suites and spec files" (`name`, `file`) · `Status` select All / Passing / Failing /
Flaky (`SuiteStatus`) · `Tag` select All + the distinct `Suite.tags` (auth, smoke, critical-path,
checkout, payments, stripe, routing, search, filters, api, a11y, wcag-2.2, axe, visual, baselines,
nightly) · `Run all` → `useStartRun({ projectId })`; a row kebab runs
`useStartRun({ suiteId })` then pushes `routes.run(run.id)` · `Generate spec` →
`routes.workbench()` with the `generate-playwright-spec` action preselected · row click →
`routes.cases({ suiteId })` · param `?project=ws-001` (`routes.suites({ projectId })`) scopes both
columns.

### Data

`useSuites({ projectId })`, `useProject(projectId)`, `useStartRun()`. Fixtures:
`fixtures/suites.ts` (`SUITES` ×6, all `projectId: "ws-001"`) plus `fixtures/cases.ts` for the tree's
per-suite counts.

### Cross-links

Outbound: Suite and Cases cells → `routes.cases({ suiteId })` · tag chip →
`routes.cases({ tag })` · Status and Last-run cells → `routes.runs({ suiteId })` · project row →
`routes.project(id)` · `Generate spec` → `routes.workbench()` · kebab `Run suite` →
`routes.run(id)`.

Inbound: nav rail · `/` drawer `Suites` and Tests cell → `routes.suites({ projectId })` · `/cases`
breadcrumb `Suites`.

### States

- Loading — tree rows and `StatGrid` tiles as skeletons, 6 skeleton table rows.
- Empty — "No suites in this project", action `Generate spec` → `routes.workbench()`; filtered-empty
  swaps the action for `Clear filters`.
- Error — `ErrorState` + `Retry`; the tree keeps cached rows at 50% opacity.

## `/cases` — Test Cases

### Purpose

Every case with its steps, assertions and locator, so a broken test can be read and re-anchored
without opening the repo.

### Layout

- Single scrolling column: `PageHeader` → `StatGrid` → `FilterBar` → optional bulk-selection bar →
  grouped `DataTable`.
- Rows group by `suiteId` under collapsible headers (chevron, suite `name`, right-aligned "`n`
  cases", suite pass rate) — shape follows the TestDino test-cases suite accordion.
- `?case=tc-checkout-02` opens a right `Drawer` 560px with its own `Tabs`; the list stays mounted.

### Widgets

1. `PageHeader` — "Test Cases" / "Individual cases, steps and assertions"; actions `Run selected`
   (primary, disabled on an empty selection), `New case`, import/export icon.
2. `StatGrid` ×4 — Total (26), Passed (11), Failed (11), Flaky (4): tallies of `CASES[].status`.
3. Bulk-selection bar, on checked rows: "`n` cases selected", `Run`, `Add tag`, `Clear`. Shape
   follows the TestDino bulk bar; bulk delete is dropped (no delete method on `DataSource`).
4. Grouped `DataTable` with a row checkbox and per-row kebab.
5. `Drawer` `Tabs`: **Steps** — one row per `TestStep` (`index`, `action` badge, `target` mono,
   `value` masked when it begins with `•`, `code` in a `CodeBlock` + `CopyButton`); **Assertions** —
   `DataTable`; **Locator** — `primaryLocator` in a `CodeBlock` + `CopyButton` and
   `Open in inspector`; **Flake** — the matching `FLAKY_TESTS` entry (`flakeRate`, `runsAffected`,
   `lastFailure`, `suspectedCause`) or an `EmptyState`. No per-case run history: we hold none.
6. `StatusBadge`, `EmptyState` / `ErrorState` / `LoadingState`.

### Table columns

| Header   | Field                                             | Link                             |
| -------- | ------------------------------------------------- | -------------------------------- |
| Case     | `id` (mono) + `title`                             | `routes.cases({ caseId: c.id })` |
| Suite    | `suiteId` → suite `name`                          | `routes.cases({ suiteId })`      |
| File     | `file` (mono)                                     | —                                |
| Status   | `status` via `StatusBadge`                        | —                                |
| Duration | `durationMs` via `formatDuration`                 | —                                |
| Flake    | `flakeRate` via `formatPercent`                   | `routes.runs()` flake anchor     |
| Owner    | `owner`                                           | —                                |
| Tags     | `tags` as chips                                   | each → `routes.cases({ tag })`   |
| Source   | `generatedBy` (`agent` \| `recording` \| `human`) | agent rows → `routes.workbench()` |

### Drawer sub-tables

**Assertions**: Kind (`Assertion.kind`) · Target (`target`, mono) · Expected (`expected`) · Soft
(`soft`, badge). **Steps** is a list, not a table.

### Filters, tabs and actions

Search "Search test cases" (`title`, `file`, `primaryLocator`) · `Suite` select All + the 6 `SUITES`
names, also set by `?suite=st-2` · `Status` select All / Passed / Failed / Flaky / Skipped / Running
/ Pending (`TestStatus`) · `Tag` select All + distinct `TestCase.tags`, also set by
`?tag=critical-path` · `Source` select All / Agent / Recording / Human (`generatedBy`; rows without
the field read Human) · `Group by suite` switch, on by default · `Run selected` →
`useStartRun({ caseIds })` then `router.push(routes.run(run.id))` · row click →
`routes.cases({ caseId })`, opening the drawer · row hover → `usePrefetchOnHover()` warms
`qk.cases.detail(id)`.

### Data

`useCases({ suiteId, tag, status, search })`, `useCase(caseId)`, `useSuites()`, `useFlakyTests()`,
`useStartRun()`. Fixtures: `fixtures/cases.ts` (`CASES` ×26 across the 6 suites, `steps` and
`assertions` populated on every row) and `fixtures/runs.ts` (`FLAKY_TESTS` ×6, whose ids are case
ids).

### Cross-links

Outbound: Case cell → `routes.cases({ caseId })` · Suite cell → `routes.cases({ suiteId })` · tag
chip → `routes.cases({ tag })` · Source `agent` and drawer `Run in workbench` →
`routes.workbench()` · drawer `Open failing run` → `routes.run(runId)` · drawer `Related findings` →
`routes.findings()` · Flake cell → `routes.runs()`.

Inbound: nav rail · `/suites` Suite, Cases and tag cells · `/runs` spec test row and flake row →
`routes.cases({ caseId })` · `/findings` drawer `caseId` chip · `/scripts` provenance link ·
`/accessibility` `Related suite` · `/visual` `Related case`.

### States

- Loading — group headers render for real, 8 skeleton rows in the first group.
- Empty — "No cases in this suite", action `Generate spec` → `routes.workbench()`; filtered:
  `No cases match "<query>"` + `Clear filters`.
- Error — `ErrorState` + `Retry`. Unknown `?case=` id — `EmptyState` in the drawer, "Case not found
  in this data source", with a `Clear` action that strips the param.

## `/runs` — Test Runs

### Purpose

Run history with its trend, and per run the failure taxonomy plus a searchable spec-by-spec
breakdown.

### Layout

One route, two modes. Shape follows the TestDino test-runs-list and test-run-detail screens.

**List mode** (no `?run=`), single scrolling column: (1) `PageHeader`; (2) `StatGrid` 4-up;
(3) 2-up equal chart row — `ChartCard`/`AreaTrendChart` for the pass-rate trend and
`ChartCard`/`BarSeriesChart` for the per-run outcome stack; (4) `FilterBar`, search left at ~30%
width with four selects right-aligned; (5) meta row, left "`n` total", right a clock glyph and
"Last updated <relative>"; (6) `DataTable`, 5 columns, two-line ~58px rows; (7) `ChartCard`
"Flaky tests" wrapping a 6-row `DataTable`.

**Detail mode** (`?run=%23558`) replaces regions 2–7 in place, keeping the header and a
`← All runs` link: (1) run header — `name` + muted `id`, then one meta chip line: `StatusBadge`
(`status`), `branch`, `trigger`, `engine`, `author`, clock + `formatRelative(startedAt)`, stopwatch +
`duration`; (2) `Tabs` Summary | Specs | Flaky; (3) Summary — `StatGrid` of Passed / Failed / Flaky /
Skipped, then a `minmax(280px, 1fr)` card grid of `groups`, one card per `RunGroup` with `title`, a
32px `count`, a divider and `desc`, tinted by `tone`; (4) Specs — a status chip row with counts, then
one collapsible group per `RunSpec.file` holding its `tests` rows; (5) Flaky — the `FLAKY_TESTS`
table, unfiltered.

### Widgets

`PageHeader`, `StatGrid`/`StatTile`, `FilterBar`, `ChartCard`, `AreaTrendChart`, `BarSeriesChart`,
`DataTable`, `Tabs`, `StatusBadge`, `SeverityBadge` (on failure-group cards), `Sparkline` (in the
Flake rate cell), `ConfirmDialog` (on `Re-run`), `EmptyState` / `ErrorState` / `LoadingState`.
List-mode `StatGrid` from `useDashboardSummary()`: Pass rate (`passRate`), Running (`runningRuns`),
Avg duration (`avgDurationMs` via `formatDuration`), Total tests (`totalTests`).

### Table columns

**Run list** — 5 columns, adapted from the TestDino run table:

| Header  | Field                                                                           | Link                         |
| ------- | ------------------------------------------------------------------------------- | ---------------------------- |
| Run     | `id` + `StatusBadge(status)` line 1; `duration` line 2; `trigger` line 3        | `routes.run(r.id)`           |
| Commit  | `commitMessage` line 1; `author` + `formatRelative(startedAt)` \| `when` line 2 | `routes.run(r.id)`           |
| Branch  | `branch` (carries the sha, e.g. `main · 91ac2f`)                                | —                            |
| Results | `passed` / `failed` / `flaky` / `skipped` count pills + "Total: n" caption       | `routes.findings({ runId })` |
| Cause   | `groups[0].title` + `groups[0].count`, `+n` overflow chip                       | `routes.findings({ runId })` |

The reference's `Branch & Environment` column carried an env pill and its `AI Insights` column an
AI-derived cause; we hold no `environment` field so Branch stands alone, and `RunGroup.title` stands
in for the cause (populated on `#558` only — the other four runs render an em dash).

**Spec test rows** (Specs tab): Status (`RunSpec.tests[].status` icon) · Test (`tests[].name`) →
`routes.cases({ caseId })` when a `CASES` title matches, otherwise unlinked. The group header is
`RunSpec.file`.

**Flaky tests**: Test (`FlakyTest.title` → `routes.cases({ caseId: f.id })`) · File (`file`, mono) ·
Flake rate (`flakeRate` via `formatPercent` + `Sparkline`) · Runs affected (`runsAffected`) · Last
failure (`lastFailure` via `formatRelative`) · Suspected cause (`suspectedCause`, clamped to 2
lines).

### Filters, tabs and actions

Search "Search commits or run number" (`id`, `name`, `commitMessage`, `author`) · `Status` select
All / Passed / Failed / Flaky / Running, also set by `routes.runs({ status })` · `Branch` select All
+ distinct `branch` · `Trigger` select All / Manual / CI / Schedule / Agent (`TestRun.trigger`) ·
`Suite` select All + `SUITES` names, also set by `routes.runs({ suiteId })` · detail `Tabs`
Summary | Specs | Flaky, held in a `tab` param beside `run` · Specs status chips All | Passed |
Failed | Flaky | Skipped with counts and a right-aligned "Showing `n` tests in `m` spec files" ·
`Collapse all` / `Expand all` on the accordion · `Re-run` →
`useStartRun({ suiteId, projectId })` behind `ConfirmDialog`, then pushes the new run · row click →
`routes.run(id)`, hover prefetches `qk.runs.detail(id)`.

### Data

`useRuns({ status, branch, suiteId, search })`, `useRun(runId)`, `useRunTrend()`, `useFlakyTests()`,
`useStartRun()`, `useDashboardSummary()`. Fixtures: `fixtures/runs.ts` (`RUNS` ×5 — `#558`…`#554`;
`TREND` ×7 points `#552`…`#558`; `FLAKY_TESTS` ×6). `groups` and `specs` exist on `#558` only.

### Cross-links

Outbound: Run and Commit cells → `routes.run(id)` · Results and Cause cells →
`routes.findings({ runId })` · spec test row and flake row → `routes.cases({ caseId })` · header
branch chip → `routes.project(projectId)` · detail `Findings from this run` →
`routes.findings({ runId })` · detail `Visual diffs` → `routes.visual()` · detail `Accessibility`
(on `#555`, the Accessibility Sweep) → `routes.accessibility()` · detail `Performance` →
`routes.performance()` · `Re-run with agent` → `routes.workbench()`.

Inbound: nav rail (badge `runningRuns`) · `/` Running-runs tile and drawer `Runs` · `/suites` Status
and Last-run cells → `routes.runs({ suiteId })` · `/findings` drawer `runId` chip · `/visual` Run
column · `/cases` drawer `Open failing run` · `/accessibility` and `/performance` trend points ·
`/api-intel` drawer `Related run` · `/scripts` `sourceRef` starting `#`.

### States

- Loading — header and chart frames render, 5 skeleton rows, `AreaTrendChart` axes with a shimmer
  band.
- Empty — "No runs yet", action `Run all suites` (`useStartRun`). Detail Specs on a run with no
  `specs` — "No per-spec breakdown was uploaded for this run", Summary tab as the action.
- Error — `ErrorState` + `Retry`; the trend chart keeps cached data. Unknown `?run=` id —
  "Run not found in this data source" + `← All runs`.

## `/findings` — Findings & Bug Intelligence

### Purpose

The triage inbox: every defect the agent opened, with facts kept separate from inference, its
evidence, and a proposed patch that can be applied from here.

### Layout

`ResizableSplit`, ratio persisted in `uiStore.paneSizes["findings"]`.

- **Left** 58%: `PageHeader` → `StatGrid` → 2-up chart row → `FilterBar` → `DataTable`.
- **Right** 42%, only when `?finding=BUG-1842`: the detail as an inline pane, not a modal, so the
  list stays keyboard-navigable for rapid triage. Below 1280px it becomes a `Drawer`.
- **`FailureCockpit`** is a separate full-height `Drawer` opened from the detail pane's
  `Open cockpit`, driven by `uiStore.cockpitFindingId`: the timeline scrubber synced to evidence,
  console and network at the failing instant, the DOM snapshot, and the actions row.

### Widgets

1. `PageHeader` — "Findings" / "Bug intelligence inbox and failure cockpit"; actions `Rescan`
   (→ `routes.workbench()` on the `find-bugs` action), `Export`.
2. `StatGrid` ×4 — Open (`openFindings`), Critical (`criticalFindings`), Confirmed (rows with
   `status: "confirmed"`, 4 in fixtures), Avg confidence (mean `confidence`).
3. `ChartCard` + `DonutChart` — by `severity` (critical 1 / high 5 / medium 6 / low 2).
4. `ChartCard` + `BarSeriesChart` — by `category` (functional, security, accessibility,
   api-contract, visual, console-error, performance, broken-link, form-validation).
5. `FilterBar`, virtualised `DataTable`, `SeverityBadge`, `StatusBadge`.
6. Detail `Tabs`: **Diagnosis** — `ScoreRing` for `confidence`, `rca` prose, then two explicitly
   separate lists, **Facts** (`facts`) and **Inference** (`inferences`), never blended;
   **Evidence** — one row per `Evidence` (`kind` badge, `label`, `capturedAt`), `screenshot` rows
   painting the `src` gradient placeholder while `dom`/`console`/`network`/`har`/`trace`/`video` rows
   open in the cockpit; **Fix** — `DiffViewer` over `fix`, `commit` chip + `CopyButton`, `Apply fix`
   (primary); **Context** — `url`, `element`, `expected` vs `actual` side by side, `relatedTests`,
   and the four cross-link chips.
7. `FailureCockpit` — `ImageDiffSlider` when a screenshot pair exists, `DiffViewer` for the DOM
   mutation, `CodeBlock` for the console slice, a network `DataTable`, and the action row
   `Reproduce` · `Propose fix` · `Apply fix` · `Create issue` · `Mark false positive`. `Apply fix`
   stays disabled until `fix` is non-empty.
8. `ConfirmDialog` on `Apply fix` and `Mark false positive`. `EmptyState` / `ErrorState` /
   `LoadingState`.

### Table columns

| Header     | Field                             | Link                                 |
| ---------- | --------------------------------- | ------------------------------------ |
| ID         | `id` (mono)                       | `routes.finding(f.id)`               |
| Title      | `title`                           | `routes.finding(f.id)`               |
| Severity   | `severity` via `SeverityBadge`    | `routes.findings({ severity })`      |
| Category   | `category`                        | `routes.findings({ category })`      |
| Confidence | `confidence` (mono % + bar)       | —                                    |
| Status     | `status` via `StatusBadge`        | `routes.findings({ status })`        |
| Page       | `url` via `truncateMiddle`        | —                                    |
| Run        | `runId`                           | `routes.run(f.runId)`                |
| Tests      | `relatedTests`                    | `routes.cases({ caseId: f.caseId })` |
| Detected   | `detectedAt` via `formatRelative` | —                                    |

### Filters, tabs and actions

Search "Search findings, elements and URLs" (`title`, `url`, `element`, `id`) · `Severity` select
All / Critical / High / Medium / Low, mirrors `?severity=` · `Status` select All / New / Confirmed /
Fixed / False positive / Won't fix (`FindingStatus`), mirrors `?status=` · `Category` select All +
the 9 distinct values, mirrors `?category=` · `Run` select All + `RUNS` ids, mirrors `?run=` ·
Sort Severity / Confidence / Detected / Title in both directions
(`filtersStore.findings.sortBy`, `sortDir`) · status actions `Confirm`, `Mark fixed`,
`False positive`, `Won't fix`, each `useUpdateFindingStatus()` and optimistic so the row recolours
on keypress · keyboard triage `j`/`k` move, `c` confirm, `f` fixed, `x` false positive, `Enter`
opens the cockpit · `Apply fix` → `useApplyFindingFix(id)`, showing the returned `commit` and
`detail`.

### Data

`useFindings({ severity, status, category, runId, search })`, `useFinding(findingId)`,
`useUpdateFindingStatus()`, `useApplyFindingFix()`, `useDashboardSummary()`. Fixtures:
`fixtures/findings.ts` (`FINDINGS` ×14, every row carrying `facts`, `inferences`, `evidence`, `fix`
and the four cross-link ids) plus `fixtures/agentScript.ts` (the run-local `BUG-1842` copy the
cockpit merges in).

### Cross-links

Outbound: ID and Title → `routes.finding(id)` · Severity, Category and Status cells → the matching
`routes.findings({ … })` filter · Run cell and `runId` chip → `routes.run(id)` · `suiteId` chip →
`routes.cases({ suiteId })` · `caseId` chip and Tests cell → `routes.cases({ caseId })` ·
`projectId` chip → `routes.project(id)` · cockpit `Reproduce` →
`routes.workbench({ taskId })` · Fix tab `Save as script` → `routes.scripts({ scriptId })` ·
`accessibility` rows → `routes.accessibility({ level: "A" })` · `security` rows →
`routes.security()` · `api-contract` rows → `routes.apiIntel({ endpointId })` · `visual` rows →
`routes.visual({ baselineId })` · `performance` rows → `routes.performance()`.

Inbound: nav rail (badge `openFindings`) · `/` Open-findings tile and drawer `Findings` · `/runs`
Results and Cause cells → `routes.findings({ runId })` · `/accessibility`, `/security`, `/api-intel`
and `/visual` row action `Open finding` · `/performance` opportunity and metric tiles ·
`/workbench` timeline step with `findingId` · `/scripts` `sourceRef` deep link · `/settings` policy
helper.

### States

- Loading — `StatGrid` and chart frames render, 10 skeleton rows; the detail pane shows a skeleton
  `ScoreRing` and two skeleton lists.
- Empty — "No findings — nothing broken was detected", action `Run a scan` → `routes.workbench()`.
  Filtered: `No findings match these filters` + `Clear filters`, with the `StatGrid` staying on the
  unfiltered rollup so the user can see what they excluded.
- Error — `ErrorState` + `Retry`. Unknown `?finding=` id — `EmptyState` in the detail pane,
  "Finding not found in this data source".

## `/accessibility` — Accessibility

### Purpose

The axe-core sweep as a working surface: which rules are violated, at what WCAG level and impact,
and the remediation hint that feeds the patch loop.

### Layout

Single scrolling column. Shape follows the TestDino run-detail's stat-cards-over-table rhythm, with
the score hero borrowed from the token monitor's oversized-numeral hero.

1. `PageHeader`.
2. Hero row — a `ScoreRing` card (~280px) for `A11ySummary.score`, then `StatGrid` ×3 filling the
   rest.
3. 2-up chart row — `ChartCard`/`TrendLineChart` (score per run) and `ChartCard`/`DonutChart`
   (violations by impact).
4. `ChartCard`/`BarSeriesChart` — violations by WCAG level, full width, short.
5. `FilterBar`, then a `DataTable` grouped by `category` when `Group by category` is on.
6. Detail `Drawer` 560px. Accessibility has **no** `DETAIL_PARAMS` entry, so the selected row is
   local state; only `?level=` is linkable (`routes.accessibility({ level })`).

### Widgets

1. `PageHeader` — "Accessibility" / "WCAG violations, keyboard traversal and contrast audit";
   actions `Re-run audit` (→ `routes.workbench()` on `accessibility-audit`), `Export`.
2. `ScoreRing` — `score` 68, captioned with `violations` / `passes` / `incomplete`.
3. `StatGrid` ×3 — Violations (18), Passes (214), Incomplete (6).
4. `ChartCard` + `TrendLineChart` — `A11ySummary.trend`, 7 points `#552`…`#558`, dipping at `#555`
   and `#558`.
5. `ChartCard` + `DonutChart` — `byImpact` (critical 5 / high 9 / medium 2 / low 2);
   `ChartCard` + `BarSeriesChart` — `byLevel` (A 15 / AA 3 / AAA 0).
6. `FilterBar`, `DataTable`, `SeverityBadge`, `StatusBadge`, `CodeBlock`, `CopyButton`.
7. `Drawer` — `description`, `selector` (mono + `CopyButton`), the offending node as a `CodeBlock`
   from `html`, `remediation` prose, `criteria` chips, `nodeCount`, and the actions `Fix with agent`,
   `Open finding`, `Copy selector`.
8. `EmptyState` / `ErrorState` / `LoadingState`.

### Table columns

| Header   | Field                              | Link                              |
| -------- | ---------------------------------- | --------------------------------- |
| Rule     | `ruleId` (mono)                    | opens the drawer                  |
| Issue    | `title`                            | opens the drawer                  |
| Impact   | `impact` via `SeverityBadge`       | filters by impact                 |
| Level    | `wcagLevel`                        | `routes.accessibility({ level })` |
| Criteria | `criteria` as chips (e.g. `4.1.2`) | —                                 |
| Nodes    | `nodeCount`                        | —                                 |
| Category | `category`                         | filters by category               |
| Page     | `url` via `truncateMiddle`         | —                                 |
| Status   | `status` via `StatusBadge`         | —                                 |

### Filters, tabs and actions

Search "Search rules, selectors and pages" (`ruleId`, `title`, `selector`) · `Level` select All / A /
AA / AAA (`WcagLevel`), the only URL-bound filter here · `Impact` select All / Critical / High /
Medium / Low · `Category` select All / aria (4) / structure (6) / keyboard (3) / forms (2) / media
(2) / contrast (1) · `Group by category` switch, on by default · `Fix with agent` →
`routes.workbench()` with a prompt seeded from `remediation` · `Open finding` — `A11Y-42` and
`A11Y-58` exist in `FINDINGS` and link to `routes.finding(id)`; other rows disable the action with
"No finding opened for this rule yet" · row click opens the `Drawer` (local selection, no param).

### Data

`useA11yIssues({ level, impact, category, search })`, `useA11ySummary()`. Fixtures:
`fixtures/accessibility.ts` — `A11Y_ISSUES` ×18 on real axe rule ids (`button-name`, `image-alt`,
`label`, `color-contrast`, `heading-order`, `region`, `tabindex`, `html-has-lang`, `frame-title`,
`listitem`, `td-headers-attr`, `autocomplete-valid`, `link-name`, `meta-viewport`,
`aria-required-children`, `scrollable-region-focusable`, `focus-order-semantics`,
`duplicate-id-aria`) and `A11Y_SUMMARY`.

### Cross-links

Outbound: Level cell → `routes.accessibility({ level })` · `Open finding` →
`routes.finding("A11Y-42" | "A11Y-58")` · `Fix with agent` → `routes.workbench()` · trend point →
`routes.run(runId)` · `Related suite` (st-5, Accessibility Audit) →
`routes.cases({ suiteId: "st-5" })`.

Inbound: nav rail (badge `a11yViolations`) · `/findings` rows whose `category` is `accessibility` ·
`/runs` detail on `#555` → `routes.accessibility()` · `/scripts` `skill.a11y-audit` · command
palette.

### States

- Loading — hero `ScoreRing` as a shimmer circle, chart frames with axes, 10 skeleton rows.
- Empty — "No accessibility audit has run yet", action `Re-run audit`. Filtered:
  `No violations at this level` + `Clear filters`, hero keeping the real score.
- Error — `ErrorState` + `Retry`; summary and list fail independently, so a failed list still shows
  the score.

## `/security` — Security

### Purpose

The passive scan: the response-header checklist plus every issue found, ranked by severity with its
CVSS score, CWE id and remediation.

### Layout

Single scrolling column: (1) `PageHeader`; (2) hero row — a `ScoreRing` card (~280px) for
`SecuritySummary.score` 54 then `StatGrid` ×3; (3) `ChartCard`/`BarSeriesChart` of issues by
category, full width and short; (4) the header checklist card, a full-width `DataTable` of the 8
`SecurityHeaderCheck` rows with present rows on one line and absent rows expanded to show
`expected`; (5) `FilterBar`; (6) `DataTable` of `SecurityIssue`; (7) detail `Drawer` 560px on local
selection — `routes.security()` takes no options, so there is no `DETAIL_PARAMS` entry.

### Widgets

`PageHeader` (actions `Re-scan`, `Export`), `ScoreRing`, `StatGrid` ×3 — Critical
(`bySeverity.critical` 3), Scanned URLs (`scannedUrls` 47), Last scan (`lastScan` via
`formatRelative`) — `ChartCard` holding `BarSeriesChart` (by category) with a `DonutChart` toggle
(by severity), `FilterBar`, two `DataTable`s, `SeverityBadge`, `StatusBadge`, `CodeBlock` (the
`evidence` request/response snippet), `CopyButton`, `Drawer`, `EmptyState` / `ErrorState` /
`LoadingState`.

### Table columns

**Issues**

| Header   | Field                              | Link                                                  |
| -------- | ---------------------------------- | ----------------------------------------------------- |
| ID       | `id` (mono)                        | opens the drawer                                      |
| Title    | `title`                            | opens the drawer                                      |
| Category | `category`                         | filters by category                                   |
| Severity | `severity` via `SeverityBadge`     | filters by severity                                   |
| CVSS     | `cvss` (mono, em dash when absent) | —                                                     |
| CWE      | `cwe` (e.g. `CWE-347`)             | —                                                     |
| Endpoint | `url` via `truncateMiddle`         | `routes.apiIntel({ endpointId })` when a path matches |
| Status   | `status` via `StatusBadge`         | —                                                     |
| Detected | `detectedAt` via `formatRelative`  | —                                                     |

**Header checklist**: Header (`header`, mono) · Present (`present`, check or cross) · Value
(`value`, mono, "not set" when absent) · Expected (`expected`, mono, wraps) · Severity (`severity`
via `SeverityBadge`). No cell links.

### Filters, tabs and actions

Search "Search issues, endpoints and CWE ids" (`title`, `url`, `cwe`, `evidence`) · `Category`
select All + the 7 `byCategory` values (headers 3, auth 3, injection 2, secrets 2, transport 2,
authz 1, deps 1) · `Severity` select All / Critical / High / Medium / Low (fixture spread
3 / 4 / 5 / 2) · `Only missing headers` switch, filtering the checklist to `present: false` (5 of
8) · `Re-scan` → `routes.workbench()` seeded with a passive-scan prompt · drawer `Open finding` —
`SEC-19` and `SEC-24` exist in `FINDINGS` and link to `routes.finding(id)`, the rest disable it ·
row click opens the `Drawer`.

### Data

`useSecurityIssues({ category, severity, search })`, `useSecuritySummary()`. Fixtures:
`fixtures/security.ts` (`SECURITY_ISSUES` ×14 with real CWE ids and CVSS 3.1 base scores,
`HEADER_CHECKS` ×8, `SECURITY_SUMMARY`).

### Cross-links

Outbound: `Open finding` → `routes.finding("SEC-19" | "SEC-24")` · Endpoint cell →
`routes.apiIntel({ endpointId })` when the `url` path matches a discovered endpoint
(`/api/orders/…`, `/api/availability`, `/api/users/me`) · `Re-scan` → `routes.workbench()` · drawer
`Related run` → `routes.run("#554")` · drawer `Policy` → `routes.settings({ tab: "policy" })`.

Inbound: nav rail (badge `securityIssues`) · `/findings` rows whose `category` is `security` ·
`/api-intel` `api.auth` and `api.authz` issue cards → `routes.security()` · command palette.

### States

- Loading — hero shimmer, checklist as 8 skeleton rows, issues as 10.
- Empty — "No security scan has run yet", action `Re-scan`; the checklist still renders its
  expectations with every row "not checked". Filtered: `No issues in this category` +
  `Clear filters`.
- Error — `ErrorState` + `Retry`; summary and list fail independently.

## `/performance` — Performance

### Purpose

Core Web Vitals against their budgets on both devices, the resource waterfall behind them, and the
ranked opportunities.

### Layout

Single scrolling column, device-scoped: (1) `PageHeader` with a device `Tabs` control
(Desktop | Mobile) in its action slot; (2) hero row — a `GaugeChart` card (~300px) for
`PerfSummary.score` then the metric strip, `StatGrid` ×8 at
`repeat(auto-fit, minmax(180px, 1fr))`, one tile per `PerfMetric`; (3)
`ChartCard`/`TrendLineChart` of the selected metric's `history` (7 points), full width, switched by
clicking a tile; (4) `ChartCard`/`WaterfallChart` of the 22 `ResourceEntry` rows placed by
`startMs`/`durationMs` with blocking rows tinted, full width ~320px tall; (5) the opportunities
card, 5 rows of `title`, right-aligned `formatDuration(savingsMs)` and `detail` beneath, sorted by
`savingsMs` descending; (6) `FilterBar` scoped to the resource table, then the resource `DataTable`.
`routes.performance()` takes no params, so metric selection and the resource filter are local state.

### Widgets

`PageHeader`, `Tabs` (device), `GaugeChart`, `StatGrid`/`StatTile` (each tile: `label`, `value` with
`unit`, a budget bar against `budget`, `delta` with direction, and a `Sparkline` of `history`),
`ChartCard`, `TrendLineChart`, `WaterfallChart`, `BarSeriesChart` (opportunities by `savingsMs`),
`FilterBar`, `DataTable`, `StatusBadge` (`rating`: good / needs-improvement / poor), `EmptyState` /
`ErrorState` / `LoadingState`. Desktop reads score 74 with LCP 2980ms, CLS 0.21, INP 168ms, FCP
1420ms, TTFB 640ms, TBT 310ms, SI 3180ms, TTI 4120ms; Mobile reads 46 from `PERF_SUMMARY_MOBILE`.
`rating` is always the fixture's own value, never recomputed in the component.

### Table columns

| Header   | Field                             | Link |
| -------- | --------------------------------- | ---- |
| Resource | `url` via `truncateMiddle`        | —    |
| Type     | `type`                            | —    |
| Size     | `sizeBytes` via `formatBytes`     | —    |
| Transfer | `transferBytes` via `formatBytes` | —    |
| Start    | `startMs`                         | —    |
| Duration | `durationMs` via `formatDuration` | —    |
| Blocking | `blocking` (badge when true)      | —    |
| Cached   | `cached` (badge when true)        | —    |

### Filters, tabs and actions

Device `Tabs` Desktop | Mobile, which is the `getPerfSummary({ device })` argument rather than a
client filter · `Type` select All + the 8 `ResourceEntry.type` values present (document 1, script 6,
stylesheet 1, image 6, font 3, xhr 3, media 1, other 1) · `Only blocking` and `Only uncached`
switches · `Sort` select Duration / Size / Start · metric tile click selects that metric's `history`
for the trend chart · `Re-measure` → `routes.workbench()` · waterfall bar click scrolls to and
highlights the matching resource row.

### Data

`usePerfSummary({ device })`. Fixtures: `fixtures/performance.ts` (`PERF_SUMMARY` desktop,
`PERF_SUMMARY_MOBILE`, `RESOURCE_ENTRIES` ×22 shared by both, `OPPORTUNITIES` ×5 — AVIF hero with
srcset 1840ms, defer analytics 610ms, reserve media dimensions 480ms, preconnect to js.stripe.com
320ms, cache fonts 210ms).

### Cross-links

Outbound: the `Reserve dimensions for the hero and card media` opportunity →
`routes.finding("VIS-77")` (the CLS 0.21 shift) · the LCP tile → `routes.finding("PERF-33")` · trend
point → `routes.run(runId)` · `Re-measure` → `routes.workbench()` · throttle hint →
`routes.settings({ tab: "browser" })`.

Inbound: nav rail · `/findings` rows whose `category` is `performance` · `/runs` detail
`Performance` → `routes.performance()` · command palette.

### States

- Loading — `GaugeChart` as a shimmer arc, 8 skeleton tiles, waterfall frame with axes only.
- Empty — "No performance trace for this device", action `Re-measure`; the other device tab stays
  selectable.
- Error — `ErrorState` + `Retry`.

## `/visual` — Visual

### Purpose

Baseline versus actual: which screenshots changed, whether they moved or repainted, and approving a
new baseline.

### Layout

One route, two modes. Shape follows the TestDino visual-diff viewer.

**List mode** (no `?baseline=`): `PageHeader` → `StatGrid` 4-up →
`ChartCard`/`BarSeriesChart` of `byViewport` (changed vs total, 3 groups) → `FilterBar` →
`DataTable` grouped by `name` so one screen's viewports sit together.

**Detail mode** (`?baseline=vis-001`) replaces those regions, keeping the header and a
`← All baselines` link: (1) baseline header — `name`, `target`, `viewport.label` +
`width`×`height`, `branch`, `StatusBadge(status)`, `changeKind` chip,
`formatPercent(diffPercent)`, `formatCompact(pixelsChanged)` px, `threshold`; (2) a centred
segmented `Tabs` of 5 modes `Diff | Actual | Expected | Side by side | Slider`; (3) the compare
stage — `ImageDiffSlider` in Slider mode (draggable vertical divider, circular handle, `Expected`
bottom-left and `Actual` bottom-right edge labels), one pane in Diff/Actual/Expected from
`diffSrc`/`actualSrc`/`baselineSrc`, two panes in Side by side; (4) the masks card listing
`maskSelectors`, each mono with a `CopyButton`; (5) actions `Approve baseline` (primary),
`Open run`, `Open finding`.

### Widgets

`PageHeader` (actions `Re-capture`, `Approve all changed`), `StatGrid`/`StatTile` from
`VisualSummary` — Total 16, Changed 7, Pending 3, Approved 4 — `ChartCard`, `BarSeriesChart`,
`FilterBar`, `DataTable`, `Tabs`, `ImageDiffSlider`, `StatusBadge`, `CopyButton`, `ConfirmDialog`
(on `Approve all changed`), `EmptyState` / `ErrorState` / `LoadingState`. Image sources are
`gradient:<chart-token>` recipes painted locally — the desktop build never fetches a screenshot.

### Table columns

| Header    | Field                                                     | Link                                  |
| --------- | --------------------------------------------------------- | ------------------------------------- |
| Baseline  | `name`                                                    | `routes.visual({ baselineId: v.id })` |
| Target    | `target` via `truncateMiddle`                             | —                                     |
| Viewport  | `viewport.label` + `width`×`height`                       | filters by viewport                   |
| Branch    | `branch`                                                  | —                                     |
| Status    | `status` via `StatusBadge` (approved/pending/changed/new) | filters by status                     |
| Diff      | `diffPercent` via `formatPercent`                         | —                                     |
| Pixels    | `pixelsChanged` via `formatCompact`                       | —                                     |
| Change    | `changeKind` (none/moved/changed/added/removed)           | —                                     |
| Threshold | `threshold`                                               | —                                     |
| Run       | `runId`                                                   | `routes.run(v.runId)`                 |
| Updated   | `updatedAt` via `formatRelative`                          | —                                     |

### Filters, tabs and actions

Search "Search baselines and targets" (`name`, `target`) · `Status` select All / Changed (7) /
Pending (3) / Approved (4) / New (2) · `Viewport` select All / Desktop 1440×900 / Tablet 834×1112 /
Mobile 390×844, the three `byViewport` labels · `Change kind` select All / None / Moved / Changed /
Added / Removed — `moved` exists to separate a layout shift from a repaint, so it is a first-class
filter, not a column-only value · view-mode `Tabs` held in a `mode` param beside `baseline` ·
`Approve baseline` → `useApproveBaseline(id)`, flipping the row to `approved` and re-rolling
`visualDiffs` · `Approve all changed` → the same mutation over every `status: "changed"` row behind a
`ConfirmDialog` naming the count · row click → `routes.visual({ baselineId })`.

### Data

`useVisualBaselines({ status, viewport, search })`, `useVisualSummary()`, `useApproveBaseline()`.
Fixtures: `fixtures/visual.ts` (`VISUAL_BASELINES` ×16 over Home hero, Tours grid, Tour detail,
Checkout payment form, Checkout order summary, Cart line items and more; `VISUAL_SUMMARY`).

### Cross-links

Outbound: Baseline cell → `routes.visual({ baselineId })` · Run cell → `routes.run(id)` ·
`Open finding` on `vis-001` → `routes.finding("VIS-77")` · `Related case` →
`routes.cases({ suiteId: "st-6" })` · `Re-capture` → `routes.workbench()` · threshold hint →
`routes.settings({ tab: "browser" })`.

Inbound: nav rail (badge `visualDiffs`) · `/findings` rows whose `category` is `visual` ·
`/runs` detail `Visual diffs` → `routes.visual()` · `/scripts` `skill.visual-sweep` · command
palette.

### States

- Loading — `StatGrid` shimmer, 8 skeleton rows; detail mode shows the compare stage as one
  shimmering 16:10 block with the mode tabs already interactive.
- Empty — "No baselines captured yet", action `Re-capture`. Filtered:
  `No baselines match these filters` + `Clear filters`.
- Error — `ErrorState` + `Retry`. Unknown `?baseline=` id — "Baseline not found in this data source"
  + `← All baselines`.

## `/api-intel` — API

### Purpose

Every endpoint the proxy observed, what its traffic says versus what the spec claims, and the
contract-detector issues attached to each.

### Layout

Single scrolling column plus a detail drawer: (1) `PageHeader`; (2) `StatGrid` 4-up; (3) 2-up chart
row — `ChartCard`/`DonutChart` (issues by severity) and `ChartCard`/`BarSeriesChart` (p95 latency
for the ten busiest endpoints); (4) `FilterBar`; (5) virtualised `DataTable`; (6)
`?endpoint=api-12` opens a right `Drawer` 620px with `Tabs`.

### Widgets

1. `PageHeader` — "API" / "Discovered endpoints, schema drift and contract tests"; actions
   `Re-discover`, `Export OpenAPI stub`; `specSource` (`openapi/blixen-tours.v3.yaml`) as a mono
   chip in the subtitle row.
2. `StatGrid` ×4 — Endpoints (20), Documented (14), Undocumented (6), Schema drift (`driftCount` 4).
3. `ChartCard` + `DonutChart` — `bySeverity` (critical 4 / high 7 / medium 7 / low 3);
   `ChartCard` + `BarSeriesChart` — `p95Ms` per endpoint with `p50Ms` as a second series.
4. `FilterBar`, `DataTable`, `SeverityBadge`, `StatusBadge`, `CodeBlock`, `CopyButton`, `Drawer`,
   `Tabs`.
5. `Drawer` `Tabs`: **Overview** — `method` + `path`, `discoveredVia`, `authRequired`,
   `observedStatuses` as status chips, `callCount`, `p50Ms`, `p95Ms`, `errorRate`, `lastSeen`,
   `tags`; **Request** and **Response** — a schema `DataTable` each, drift rows highlighted;
   **Issues** — one card per `ApiIssue` (`detector` mono, `SeverityBadge(severity)`, `summary`,
   `detail`).
6. `EmptyState` / `ErrorState` / `LoadingState`.

### Table columns

| Header    | Field                                                     | Link                                    |
| --------- | --------------------------------------------------------- | --------------------------------------- |
| Method    | `method` as a coloured badge                              | filters by method                       |
| Path      | `path` (mono)                                             | `routes.apiIntel({ endpointId: e.id })` |
| Source    | `discoveredVia` (traffic / openapi / manual)              | filters by source                       |
| Auth      | `authRequired` (lock badge)                               | —                                       |
| Statuses  | `observedStatuses` as chips, 4xx/5xx tinted               | —                                       |
| Calls     | `callCount` via `formatCompact`                           | —                                       |
| p50       | `p50Ms`                                                   | —                                       |
| p95       | `p95Ms`                                                   | —                                       |
| Errors    | `errorRate` via `formatPercent`                           | —                                       |
| Issues    | `issues.length` + `SeverityBadge` of the worst `severity` | opens the drawer on Issues              |
| Last seen | `lastSeen` via `formatRelative`                           | —                                       |

**Schema sub-table** (Request and Response): Field (`ApiSchemaField.name`, mono) · Type (`type`,
mono) · Required (`required`) · Drift (`drift`: missing / extra / type-changed / nullability) ·
Documented (`documentedType`, em dash when the spec agreed).

### Filters, tabs and actions

Search "Search paths, tags and detectors" (`path`, `tags`, `issues[].summary`) · `Method` select All
/ GET / POST / PUT / PATCH / DELETE / HEAD / OPTIONS (`HttpMethod`) · `Has issues` switch, mapping
to the `hasIssues` field on `ApiFilter` · `Source` select All / Traffic / OpenAPI / Manual
(`discoveredVia`; Traffic and Manual together are the 6 undocumented endpoints) · `Only drift`
switch for rows with any schema entry carrying `drift` · Sort Calls / p95 / Error rate / Path ·
`Re-discover` → `routes.workbench()` seeded with a traffic-discovery prompt · row click →
`routes.apiIntel({ endpointId })`.

### Data

`useApiEndpoints({ method, hasIssues, search })`, `useApiSummary()`. Fixtures:
`fixtures/apiIntel.ts` (`API_ENDPOINTS` ×20 over the Blixen booking surface — `/api/tours`,
`/api/availability`, `/api/cart/items`, `/api/checkout`, `/api/payments`, `/api/payments/:id/refund`
and more — carrying 21 `ApiIssue` entries across the 10 real detectors `api.schema`,
`api.contract_drift`, `api.status_codes`, `api.error_handling`, `api.validation`, `api.auth`,
`api.authz`, `api.pagination`, `api.idempotency`, `api.rate_limit_behavior`; plus `API_SUMMARY`).

### Cross-links

Outbound: Path cell → `routes.apiIntel({ endpointId })` · the `API-54` and `API-61` issue cards →
`routes.finding(id)` · `api.auth` and `api.authz` cards → `routes.security()` · drawer
`Contract test` → `routes.scripts({ scriptId: "sc-012" })` (`contract.payments`) and `sc-013`
(`contract.availability`) · drawer `Related run` → `routes.run("#558")` · `Re-discover` →
`routes.workbench()` · empty-state `Data source` → `routes.settings({ tab: "data" })`.

Inbound: nav rail · `/findings` rows whose `category` is `api-contract` · `/security` Endpoint cell
→ `routes.apiIntel({ endpointId })` · `/scripts` `api`-kind rows whose `sourceRef` is an `API-*`
id · command palette.

### States

- Loading — `StatGrid` shimmer, chart frames with axes, 12 skeleton rows.
- Empty — "No endpoints discovered yet" / "Run a session with the proxy attached, or point at an
  OpenAPI file", actions `Re-discover` and `Data source`. Filtered:
  `No endpoints match these filters` + `Clear filters`.
- Error — `ErrorState` + `Retry`. Unknown `?endpoint=` id — `EmptyState` inside the drawer.

## `/scripts` — Script Library

### Purpose

The reusable assets the agent has accumulated — tests, steps, page objects, fixtures, API contracts
and skills — with their provenance and version history.

### Layout

- **Kind tree** 240px, own scroll: a `TreeView` row per `ScriptKind` with its count — test 3, step 3,
  page-object 3, fixture 2, api 2, skill 2 — then a `Tags` group of the distinct `tags`.
- **Main column**: `PageHeader` → `StatGrid` → `FilterBar` → `DataTable`.
- **Detail** (`?script=sc-001`): the main column becomes a `ResizableSplit` — the list shrinks to
  ~40% and the script panel takes the rest with its own `Tabs`. Under 1280px the panel is a
  `Drawer`. The panel's copyable code card borrows the TestDino integrations command block.

### Widgets

1. `PageHeader` — "Script Library" / "Reusable steps, page objects, fixtures and skills"; actions
   `New script` (primary), `Import`.
2. `StatGrid` ×4 — Assets (15), Total uses (the sum of `usageCount`, 3,886), Shared steps (the 3
   `step` entries), Agent-generated (rows with `sourceKind: "generated"`).
3. `FilterBar`, `DataTable`, `TreeView`, `StatusBadge`.
4. Script panel `Tabs`: **Code** — `CodeBlock` over `code` with `language` syntax and a
   `CopyButton`, the panel header showing `name`, a `kind` badge, a `v<version>` chip and
   `usageCount`; **Params** — `DataTable`; **Versions** — one row per `ScriptVersion` (`version`,
   `createdAt`, `author`, `note`) expanding into a `DiffViewer` over `diff`; **Provenance** — a
   `sourceKind` badge and `sourceRef` as a deep link.
5. `ConfirmDialog` on `Save` when the script has a newer server version. `EmptyState` /
   `ErrorState` / `LoadingState`.

### Table columns

| Header      | Field                              | Link                                 |
| ----------- | ---------------------------------- | ------------------------------------ |
| Name        | `name` (mono)                      | `routes.scripts({ scriptId: s.id })` |
| Kind        | `kind` via `StatusBadge`           | filters by kind                      |
| Language    | `language`                         | —                                    |
| Description | `description` (clamped to 2 lines) | —                                    |
| Params      | `params.length`                    | opens the Params tab                 |
| Tags        | `tags` as chips                    | filters by tag                       |
| Version     | `version` (`v4`)                   | opens the Versions tab               |
| Uses        | `usageCount` via `formatCompact`   | —                                    |
| Source      | `sourceKind` + `sourceRef`         | see Cross-links                      |
| Updated     | `updatedAt` via `formatRelative`   | —                                    |

**Params sub-table**: Name (`ScriptParam.name`, mono) · Type (`type`: string / number / boolean /
secret, with `secret` rendered masked) · Required (`required`) · Default (`default`) · Description
(`description`).

### Filters, tabs and actions

Search "Search scripts, tags and code" (`name`, `description`, `tags`, `code`) · `Kind` select All /
Test / Step / Page object / Fixture / API / Skill (`ScriptKind`) · `Tag` select All + the distinct
`tags` (checkout, smoke, money, cart, regression, auth, security, expected-failure, step, shared,
stripe, catalog, page-object, fixture, api, contract, a11y, skill, agent, visual) · `Source` select
All / Generated / Recording / Extracted / Upload (`sourceKind`) · Sort Uses / Updated / Name /
Version · `Insert into spec` copies `code` and pushes `routes.cases()` · `Save` →
`useSaveScript(script)` after an inline edit in the Code tab · `New script` → a dialog collecting
`name`, `kind`, `language`, then `useSaveScript` · row click → `routes.scripts({ scriptId })`,
hover prefetches `qk.scripts.detail(id)`.

### Data

`useScripts({ kind, tag, search })`, `useScript(scriptId)`, `useSaveScript()`. Fixtures:
`fixtures/scripts.ts` (`SCRIPTS` ×15 with runnable `code`, populated `params`, and `versions`
carrying unified diffs — `checkout.happy-path` v4 / 218 uses / `sourceRef: "BUG-1842"`,
`login(user)` v5 / 612 uses / `sourceRef: "rec-2026-08-19-0942"`, `authedPage` v4 / 521 uses,
`skill.a11y-audit` v5 / 349 uses).

### Cross-links

Outbound: Name cell → `routes.scripts({ scriptId })` · `sourceRef` starting `BUG`/`SEC`/`API` →
`routes.finding(ref)` · starting `#` → `routes.run(ref)` · starting `rec-` →
`routes.workbench({ taskId: ref })` · `Insert into spec` → `routes.cases()` · `api`-kind rows →
`routes.apiIntel({ endpointId })` · `skill.a11y-audit` → `routes.accessibility()` ·
`skill.visual-sweep` → `routes.visual()`.

Inbound: nav rail · `/findings` Fix tab `Save as script` · `/api-intel` drawer `Contract test` ·
`/workbench` `Save as spec` · command palette.

### States

- Loading — tree rows as skeletons, 10 skeleton table rows; the code panel shows a shimmering
  `CodeBlock` frame with its line gutter drawn.
- Empty — "No scripts yet" / "Generate one from a session, or import a folder of specs", actions
  `New script` and `Generate spec` → `routes.workbench()`. Filtered:
  `No scripts match these filters` + `Clear filters`.
- Error — `ErrorState` + `Retry`. Unknown `?script=` id — `EmptyState` in the panel, "Script not
  found in this data source".

## `/settings` — Settings

### Purpose

Where the data source, the agent, the browser, the policy and the appearance are configured — the
one-click API switch lives here.

### Layout

Shape follows the Test Companion settings surface: a left section rail with an active left-accent
bar, a right pane that scrolls.

- **Section rail** 220px: one 44px row per tab, icon + label, active row filled with a left accent
  bar. Order: Data source · Agent · Browser · Policy · Appearance · About.
- **Pane** fills the rest, max-width 760px, own scroll, 24px padding: a pane header repeating the
  section icon and title, then stacked field groups of label, control, helper line.
- The active section is `?tab=data` (`routes.settings({ tab })`), so a link can land on one.
- A sticky footer inside the pane holds `Reset section` (ghost) and, on Data source, the
  `Test connection` result line.

### Widgets

`PageHeader`, `Tabs` rendered as the vertical rail, `StatGrid` (About only), `CodeBlock`,
`CopyButton`, `StatusBadge`, `ConfirmDialog`, `EmptyState` (unknown `?tab=`), `ErrorState` (a failed
probe), `LoadingState` (a probe in flight). Field controls come from `components/ui`: `Select`,
`Input`, `Switch`, `Slider`, `RadioGroup`, `Checkbox`, `Textarea`.

### Sections and controls

- **Data source** — the `API_MODES` list as three `RadioGroup` cards (`label` + `hint`): Mock
  fixtures, REST API, Tauri IPC. Then `Base URL` (`api.httpBaseUrl`), `Headers` as key/value rows
  (`api.httpHeaders`), `Timeout` (`api.timeoutMs`), `Retries` (`api.retries`). Actions
  `Test connection` and `Apply`; switching mode goes through a `ConfirmDialog` ("This clears the
  query cache and refetches every screen") then `setApiMode(mode)`, and the `apiRevision` bump does
  the rest.
- **Agent** — `provider` select (claude-cli / anthropic-api / openai / local), `model`,
  `maxTokensPerTask`, `maxStepsPerTask`, `temperature` `Slider`, `approvalRequired` as removable
  chips (seeded `payment.submit`, `data.delete`, `auth.credentials`, `file.write`),
  `autoApproveReadOnly` `Switch`.
- **Browser** — `engine` (chromium / firefox / webkit), `headless` `Switch`, `viewport` (desktop /
  tablet / mobile), `throttle` (none / fast-3g / slow-3g), `defaultTimeoutMs`.
- **Policy** — `allowedDomains` and `blockedDomains` as chip lists, `maxCrawlDepth`,
  `maxPagesPerScan`, `respectRobotsTxt` `Switch`, `redactSecrets` `Switch` with a helper making
  clear that turning it off lets raw values reach the transcript.
- **Appearance** — `density` (comfortable / compact), `reduceMotion` `Switch`,
  `showAmbientEffects` `Switch`.
- **About** — a small `StatGrid`: active adapter (`DataSource.id` + `label`), last probe latency,
  app version; plus `Reset all settings` behind a `ConfirmDialog`.

### Table columns

None. The Headers editor is a two-column key/value grid (`Header`, `Value`, plus a remove button per
row) and the domain chip lists are not tables.

### Data

Settings is the one page that does not read `@/lib/queries`: its state is `useSettingsStore` and its
writes are the `patch*` actions. `Test connection` is the single documented exception to "pages never
touch an adapter" — it calls `getDataSourceFor(mode).health()` because it must probe a source that
is not live yet, exactly as the comments in `api/contract.ts` and `api/index.ts` describe, and
renders the returned `ok`, `latencyMs` and `detail` as a `StatusBadge` plus one line.

### Cross-links

Outbound: `Test connection` failure → a link back to the page the user came from · Policy helper
`See findings redaction` → `routes.findings()` · Agent helper `Budget in the workbench` →
`routes.workbench()`.

Inbound: nav rail (shortcut `g ,`) · every page's `ErrorState` `Check data source` →
`routes.settings({ tab: "data" })` · `/api-intel` empty state `Data source` · `/performance` and
`/visual` hints → `routes.settings({ tab: "browser" })` · `/security` drawer `Policy` →
`routes.settings({ tab: "policy" })` · `StatusBar` adapter chip · command palette.

### States

- Loading — none for the form (zustand is synchronous); `Test connection` shows a spinner in its
  result line only.
- Empty — not applicable, every field has a default from `DEFAULTS`; an unknown `?tab=` falls back
  to `data` and replaces the param.
- Error — a failed probe renders `ErrorState` under the button with the `ApiError` message and a
  `Retry`; the mode is not switched until a probe succeeds or the user overrides via
  `ConfirmDialog`.

---

## Linking graph

Adjacency list of outbound targets, nav rail excluded (the rail reaches all 13 from everywhere).

```
/               → /workbench, /suites, /runs, /findings, /settings
/workbench      → /findings, /scripts, /, /cases, /settings
/suites         → /cases, /runs, /, /workbench
/cases          → /cases (suite/tag/case), /runs, /workbench, /findings
/runs           → /findings, /cases, /visual, /accessibility, /performance, /, /workbench
/findings       → /runs, /cases, /, /workbench, /scripts, /accessibility, /security,
                  /api-intel, /visual, /performance
/accessibility  → /findings, /workbench, /runs, /cases
/security       → /findings, /api-intel, /workbench, /runs, /settings
/performance    → /findings, /runs, /workbench, /settings
/visual         → /runs, /findings, /cases, /workbench, /settings
/api-intel      → /findings, /security, /scripts, /runs, /workbench, /settings
/scripts        → /findings, /runs, /workbench, /cases, /api-intel, /accessibility, /visual
/settings       → /findings, /workbench
```

Inbound sources per route; the nav rail counts as one, and every route clears two.

| Route            | Inbound sources                                                                                                                                      | Count |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `/`              | rail, TitleBar project switcher, breadcrumb root, `/workbench`, `/suites`, `/runs`, `/findings`                                                       | 7     |
| `/workbench`     | rail, `/`, `/findings`, `/runs`, `/cases`, `/suites`, `/accessibility`, `/security`, `/performance`, `/visual`, `/api-intel`, `/scripts`, `/settings` | 13    |
| `/suites`        | rail, `/`, `/cases` breadcrumb                                                                                                                       | 3     |
| `/cases`         | rail, `/suites`, `/runs`, `/findings`, `/scripts`, `/accessibility`, `/visual`, `/workbench`                                                          | 8     |
| `/runs`          | rail, `/`, `/suites`, `/findings`, `/visual`, `/cases`, `/accessibility`, `/performance`, `/api-intel`, `/scripts`                                    | 10    |
| `/findings`      | rail, `/`, `/runs`, `/accessibility`, `/security`, `/api-intel`, `/visual`, `/performance`, `/workbench`, `/scripts`, `/settings`                     | 11    |
| `/accessibility` | rail, `/findings`, `/runs`, `/scripts`, command palette                                                                                              | 5     |
| `/security`      | rail, `/findings`, `/api-intel`, command palette                                                                                                     | 4     |
| `/performance`   | rail, `/findings`, `/runs`, command palette                                                                                                          | 4     |
| `/visual`        | rail, `/findings`, `/runs`, `/scripts`, command palette                                                                                              | 5     |
| `/api-intel`     | rail, `/findings`, `/security`, `/scripts`, command palette                                                                                          | 5     |
| `/scripts`       | rail, `/findings`, `/api-intel`, `/workbench`, command palette                                                                                       | 5     |
| `/settings`      | rail, every `ErrorState`, `/performance`, `/visual`, `/security`, `/api-intel`, StatusBar adapter chip                                                | 7     |

Every route has at least two inbound sources and at least four outbound targets, so no page is a
dead end and the graph is connected in both directions.

---

## Detail-view params

Matches `DETAIL_PARAMS` in `src/config/nav.ts` one-for-one. Routes with no entry there have no
URL-addressable detail and use local selection instead.

| Page         | Param      | Opens                                             | Builder                           | Example                      |
| ------------ | ---------- | ------------------------------------------------- | --------------------------------- | ---------------------------- |
| `/`          | `project`  | Project drawer (health, commands, links)          | `routes.project(id)`              | `/?project=ws-001`           |
| `/runs`      | `run`      | Run detail in place of the list                   | `routes.run(id)`                  | `/runs?run=%23558`           |
| `/findings`  | `finding`  | Finding detail pane; the cockpit opens from it    | `routes.finding(id)`              | `/findings?finding=BUG-1842` |
| `/cases`     | `case`     | Case drawer (steps, assertions, locator, flake)   | `routes.cases({ caseId })`        | `/cases?case=tc-checkout-02` |
| `/scripts`   | `script`   | Script panel (code, params, versions, provenance) | `routes.scripts({ scriptId })`    | `/scripts?script=sc-001`     |
| `/visual`    | `baseline` | Compare stage with the 5 view modes               | `routes.visual({ baselineId })`   | `/visual?baseline=vis-001`   |
| `/api-intel` | `endpoint` | Endpoint drawer (schemas, issues, traffic)        | `routes.apiIntel({ endpointId })` | `/api-intel?endpoint=api-12` |

Filter and scope params, which are not detail views:

| Page             | Params                                  | Builder                                                  |
| ---------------- | --------------------------------------- | -------------------------------------------------------- |
| `/workbench`     | `task`, `step`                          | `routes.workbench({ taskId, stepId })`                   |
| `/suites`        | `project`                               | `routes.suites({ projectId })`                           |
| `/cases`         | `suite`, `tag`                          | `routes.cases({ suiteId, tag })`                         |
| `/runs`          | `status`, `suite`, `tab`                | `routes.runs({ status, suiteId })`                       |
| `/findings`      | `severity`, `status`, `category`, `run` | `routes.findings({ severity, status, category, runId })` |
| `/accessibility` | `level`                                 | `routes.accessibility({ level })`                        |
| `/visual`        | `mode`                                  | alongside `baseline`                                     |
| `/settings`      | `tab`                                   | `routes.settings({ tab })`                               |

`/security` and `/performance` take no params at all (`routes.security()`, `routes.performance()`):
their row selection and device/metric choices are component state and their drawers are not
linkable. `/accessibility` and `/security` deliberately have drawers without params because
`DETAIL_PARAMS` gives them none — do not invent `?issue=`.

---

## Dropped from the references

Columns and widgets the recon transcribed that we hold no data for, listed so nobody re-adds them
hunting for a field that does not exist.

- **Environment** — TestDino's `Branch & Environment` column, its `PROD`/`DEV`/`MAIN`/`QA`/`STAGE`
  pills, the branch-mapping table, the quality gates (`Pass %`, `Flaky`, `Tags`). `TestRun` has
  `branch` only.
- **AI cause with confidence** — the `15 UI Change` / `UI Change (77%)` pills. Stand-in:
  `RunGroup.title` + `count` in the Cause column, `Finding.confidence` on findings.
- **Attempts and retries** — `Run` / `Retry #1` chips, the `Retries` column, the `Attempts` tile.
- **Per-case run history** — the 7-column `Executed At / Run # / Status / Duration / Retries / Run
  Location / Actions` table and the `Stability %` card. Stand-in: the `FLAKY_TESTS` entry
  (`flakeRate`, `runsAffected`, `lastFailure`, `suspectedCause`) in the case drawer.
- **Case classification** — `Type`, `Priority`, `Severity`, `Layer`, `Behavior`, `Automation`,
  Active/Draft/Deprecated, `Preconditions`, `Postconditions`, Gherkin steps. Stand-in:
  `TestCase.tags` + `generatedBy`.
- **Failure sub-taxonomy** — `Assertion Failures / Element Not Found / Timeout Issues / Network
  Issues / Other Failures` plus the flaky and skipped breakdowns. Stand-in: `TestRun.groups`.
- **Video and CI build links** — the video player, `HTML Report`, `Trace #1`, `Build #582`.
  `Evidence.kind` labels `video` and `trace` rows, but there is no playable asset or build URL.
- **Cost, rate and quota** — the `$1.3994` cost lines, `148.3K tok/min`, `75% left` /
  `Reset 1h 7m`, the contribution heatmap, the Models / Devices / Sessions breakdowns, session
  UUIDs. Only the raw token total survives, as the `TitleBar` meter against `PlanCard.budgetTokens`.
- **Browse-shell extras** — `Shared with you`, `Available offline`, `Manage links`, `Trash`,
  source-app icons, brand badges, the help FAB. Stand-in: `WORKSPACE_FOLDERS`, `Workspace.owner`.
- **Integrations and device settings** — GitHub / Jira / Linear / Asana cards, MCP and CLI install
  cards, BrowserStack / Zephyr Scale / Xray / Azure / TestRail connectors, the Percy token flow,
  Android/iOS session overrides, biometric and passcode bypass, Appium logs, app profiling,
  orientation. `SettingsState` has no integration fields, and `BrowserSettings` covers engine,
  headless, viewport, throttle and timeout only.
- **Bulk destructive actions** — bulk delete on cases, delete run, `Disconnect`. `DataSource` has no
  delete method, so the bulk bar offers `Run`, `Add tag` and `Clear` only.

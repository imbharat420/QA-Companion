# Aether QA Companion

A desktop-first AI QA engineering companion: an autonomous agent paired with a live browser
execution window, a DevTools inspector, and an actionable failure cockpit.

**Next.js 15 (App Router, static export) + Tauri v2 (Rust)**, styled from the
[Nexus Analytics](docs/design/nexus-analytics-dashboard-2-DESIGN.md) template crossed with the
[minimal design system](https://github.com/holger1411/minimal-design-system-skill) token model.

---

## Quick start

```bash
npm install

npm run dev          # browser at http://localhost:3000 (mock data, no Rust needed)
npm run desktop:dev  # the real desktop app (Tauri window + Rust backend)

npm run typecheck    # tsc --noEmit
npm run build        # static export to ./out
npm run desktop:build # packaged installers (msi/nsis/dmg/appimage/deb)
```

Requires Node 20+ and, for the desktop targets, a Rust toolchain (1.77+).

---

## Layout

```
├── src/
│   ├── app/                    one route per nav item + the root layout and tokens
│   ├── components/
│   │   ├── ui/                 design-system primitives (Radix + cva, token-only)
│   │   ├── chrome/             AppShell, TitleBar, NavRail, StatusBar, CommandPalette
│   │   ├── shared/             cross-page composites (DataTable, StatTile, FailureCockpit…)
│   │   ├── charts/             recharts wrappers that read CSS tokens
│   │   ├── workbench/          the three-pane live agent workbench
│   │   └── providers/          query client, tooltips, toasts, the api-switch effect
│   ├── store/                  zustand slices + narrow selector hooks
│   ├── lib/
│   │   ├── api/                types, DataSource contract, mock | http | tauri adapters
│   │   ├── fixtures/           the sample dataset the mock adapter serves
│   │   └── queries.ts          TanStack Query keys, hooks and mutations
│   └── config/nav.ts           single source of navigation truth
├── src-tauri/                  Rust: models, state, JSON store, commands/*
├── docs/
│   ├── BUILD-RULES.md          the conventions every file follows
│   ├── BUILD-CONTRACT.md       the page-by-page spec derived from the design references
│   └── design/                 the visual source of truth
└── legacy/                     the original Vite prototype, kept as a porting reference
```

---

## The three things this app is built around

### 1. One-click API change

Where the app reads its data is a single setting. Nothing else changes.

```
page → hook in @/lib/queries → getDataSource() → mock | http | tauri adapter
```

| Mode    | Source                          | Use                                   |
| ------- | ------------------------------- | ------------------------------------- |
| `mock`  | in-process fixtures             | default — offline, instant, testable  |
| `http`  | any REST backend                | a real server implementing the contract |
| `tauri` | Rust commands over Tauri IPC    | the bundled desktop backend           |

Switch it in **Settings → API Source**, or in code:

```ts
useSettingsStore.getState().setApiMode("http");
```

What happens next is automatic:

1. The store bumps `apiRevision`.
2. `AppProviders` clears the TanStack Query cache and refetches active queries.
3. `getDataSource()` resolves (and memoises) the adapter for the new mode.
4. Every query key is namespaced by mode, so two sources can never share a cache entry.
5. `useAdapterQuery` subscribes to the mode itself, so all ~30 read hooks re-key —
   including in components that never otherwise watch settings, such as the nav-rail
   badges. Without that, a badge would keep showing mock counts under a REST source.

Verified end to end: switching to `http` with no backend running clears every badge
and count, and switching back restores them.

No reload, no per-page wiring. Adding a page requires no work to keep the switch working; adding
a resource means one method on `DataSource` and three small adapter implementations.

Adding a **fourth** backend is one file — implement `DataSource` from
[`src/lib/api/contract.ts`](src/lib/api/contract.ts) and register it in
[`src/lib/api/index.ts`](src/lib/api/index.ts).

### 2. State management

Three stores, each with one job, and no overlap between them:

| Kind                                     | Lives in                    | Rule                                    |
| ---------------------------------------- | --------------------------- | --------------------------------------- |
| Remote data                              | TanStack Query              | never mirrored into zustand             |
| Session/client state                     | zustand slices (`src/store`)| persisted where a user would expect it  |
| View state (filters, selected detail)    | URL search params           | so every view is linkable               |

Components subscribe through **narrow selectors**, never the whole store — that is the
performance contract, not a style preference:

```ts
const status = useAgentStatus();                 // ✅ one field
const stop = useAgentStore((s) => s.stopTask);   // ✅ one action
const all = useAgentStore();                     // ❌ re-renders on every agent event
```

The agent store is fed exclusively by `applyEvent(event: AgentEvent)` — one total switch over a
discriminated union, so adding an event type is a compile error until it is handled. The same
event stream drives the mock replay, the SSE transport and the Rust `agent://event` channel.

### 3. Linking

Every page is reachable from the nav rail, the ⌘K palette, and at least one contextual link.
No href is ever hardcoded — they all come from typed builders in
[`src/config/nav.ts`](src/config/nav.ts):

```ts
<Link href={routes.finding(finding.id)}>…</Link>
<Link href={routes.run(run.id)}>…</Link>
```

Detail views are **search params, not dynamic segments** (`/runs?run=558`). A static export only
resolves a `[id]` segment for ids enumerated at build time, and ids come from whichever adapter
is live — so params are the only form that works for every id under every backend. Back still
closes a detail view.

The full adjacency list is in [`docs/BUILD-CONTRACT.md`](docs/BUILD-CONTRACT.md).

---

## Pages

| Route            | What it does                                                          |
| ---------------- | --------------------------------------------------------------------- |
| `/`              | Projects — browse, upload and open workspaces                         |
| `/workbench`     | Live agent workbench: chat, browser, inspector, execution scrubber    |
| `/suites`        | Test suites and specs                                                 |
| `/cases`         | Test cases with steps and assertions                                  |
| `/runs`          | Run history, pass-rate trend, flake analysis, run detail              |
| `/findings`      | Bug intelligence inbox and the failure cockpit                        |
| `/accessibility` | WCAG violations, per-rule remediation, score trend                    |
| `/security`      | Headers, secrets, auth and injection surface                          |
| `/performance`   | Core Web Vitals against budgets, resource waterfall                   |
| `/visual`        | Baseline vs actual diffing, responsive matrix, mask editor            |
| `/api-intel`     | Discovered endpoints, inferred schemas, contract drift                |
| `/scripts`       | Reusable steps, page objects, fixtures and skills                     |
| `/settings`      | Provider, browser, policy, appearance — and the API source switch     |

---

## Design system

Tokens live in [`src/app/globals.css`](src/app/globals.css) and are the source of truth.
**No component contains a hex colour** — that is what keeps light mode a pure token swap.

- Semantic HSL triples in the shadcn convention (`--primary: 86 48% 48%`), mapped into Tailwind
  v4 via `@theme inline` so theme switching needs no class regeneration.
- Dark-first. The page field is mid-grey and cards are **darker** — recessed bento panels, the
  Nexus signature. That inversion is deliberate.
- `primary` is lime `#83B740`, `accent` is orange `#E69223`, 14px radius on cards and controls.
- Inter for display, DM Sans for body, JetBrains Mono for labels, code and metrics — all
  self-hosted by `next/font`, so the desktop bundle never reaches the network.
- Dedicated token sets for agent lifecycle status and finding severity, so those semantics are
  defined once instead of re-picked per screen.

Two files are deliberately exempt from the no-colour rule:
`components/charts/*` (recharts needs colour strings, so it reads `hsl(var(--chart-n))`) and
`components/workbench/FakeSite.tsx` (it simulates someone else's website and must not look like
our product).

---

## Performance

- Static export; route-level code splitting, plus `next/dynamic` for charts, workbench panes,
  the command palette and the failure cockpit.
- `React.memo` on every list row, with stable callbacks and no inline literals in their props.
- `DataTable` virtualises past 100 rows via `@tanstack/react-virtual`.
- Narrow zustand selectors, so an agent event doesn't re-render a page.
- Real `staleTime` on queries; 2 minutes on summaries and trends.
- One rollup query feeds every nav badge, not one query per badge.
- `content-visibility` on long stacked sections; `optimizePackageImports` for the icon and chart
  barrels.

---

## Testing hooks

Every interactive element and status indicator carries a `data-testid`, shaped
`<area>-<element>[-<action>]`:

```
nav-rail-findings      titlebar-project-switcher    agent-status-pill
findings-row-BUG-1842  settings-api-mode-select     cockpit-apply-fix-btn
timeline-step-12       live-browser-url-bar         kill-switch
```

The app dogfoods this — its own e2e suite selects on these ids.

---

## Conventions

See [`docs/BUILD-RULES.md`](docs/BUILD-RULES.md) for the full set. The short version: named
exports only (Next pages excepted), TypeScript strict with no `any`, tokens not hexes, a
`data-testid` on everything interactive, accessibility is not optional, and comments explain the
why rather than the what.

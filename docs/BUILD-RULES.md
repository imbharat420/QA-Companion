# BUILD-RULES.md

The conventions every file in this codebase follows. Read this before writing code here.

Companion documents:

- `docs/BUILD-CONTRACT.md` — the page-by-page spec derived from the design references.
- `docs/design/nexus-analytics-dashboard-2-DESIGN.md` — the visual source of truth.
- `docs/prompts/UI-DESIGN-SPEC.md` — the original product/UX brief.

---

## 1. Architecture

Next.js 15 App Router, **static export** (`output: 'export'`), wrapped by a Tauri v2 Rust shell.

```
src/app/                  one route per nav item — no dynamic segments (see §2)
src/components/ui/        design-system primitives (Radix + cva + tokens)
src/components/chrome/    AppShell, TitleBar, NavRail, StatusBar, CommandPalette
src/components/shared/    cross-page composites (PageHeader, DataTable, FailureCockpit, …)
src/components/charts/    recharts wrappers that read CSS tokens
src/components/workbench/ the three-pane live agent workbench
src/components/providers/ AppProviders (query client, tooltips, toasts, api-switch effect)
src/store/                zustand slices + narrow selector hooks
src/lib/api/              types, DataSource contract, mock | http | tauri adapters, registry
src/lib/fixtures/         the sample dataset the mock adapter serves
src/lib/queries.ts        TanStack Query keys, hooks and mutations
src/config/nav.ts         SINGLE SOURCE OF NAVIGATION TRUTH
src-tauri/src/            Rust: models, state, store, error, commands/*
```

**Authoritative files.** These define the contracts everything else obeys. If a spec, a
comment or an instruction disagrees with them, they win:

| File                        | Owns                                                |
| --------------------------- | --------------------------------------------------- |
| `src/lib/api/types.ts`      | the domain model                                    |
| `src/lib/api/contract.ts`   | the `DataSource` interface, `ApiError`, `paginate`  |
| `src/lib/api/index.ts`      | the adapter registry (the one-click API switch)     |
| `src/config/nav.ts`         | pages, groups, badges, shortcuts, route builders    |
| `src/app/globals.css`       | every colour, radius, font and metric in the app    |
| `src/store/settingsStore.ts`| settings shape + the selector-hook convention       |

## 2. Routing

Detail views are **search params, not dynamic segments**: `/runs?run=558`, not `/runs/558`.

A static export only resolves a `[id]` segment for ids enumerated at build time by
`generateStaticParams`. Ids come from whichever adapter is live — fixtures, a REST backend or
the Rust store — so build-time enumeration cannot cover them, and an unknown id would 404 in
the shipped desktop app. Params work for every id under every adapter, and the back button
still behaves.

Never hardcode an href. Every link goes through a builder in `routes` (`@/config/nav`):

```ts
import { routes } from "@/config/nav";
<Link href={routes.finding(finding.id)}>…</Link>
```

Pages read their params with `useSearchParams()` and write them with `router.replace` (filters,
so they don't spam history) or `router.push` (opening a detail view, so Back closes it).

## 3. Data access

```
page → hook in @/lib/queries → getDataSource() → mock | http | tauri adapter
```

Pages never call `getDataSource()` and never import an adapter. That indirection is what makes
the data source swappable at runtime.

**The one-click API switch**, end to end:

1. Settings writes `useSettingsStore.getState().setApiMode("http")`.
2. The store bumps `apiRevision`.
3. `AppProviders` sees the bump, clears the TanStack Query cache and refetches active queries.
4. `getDataSource()` resolves — and memoises — the adapter for the new mode.
5. Every query key is namespaced by mode, so two sources can never share a cache entry.

No reload, no per-page wiring, nothing to change when a page is added.

## 4. State

- **Server/remote state** → TanStack Query. Never mirror a query result into zustand.
- **Client/session state** → zustand slices in `src/store/`.
- **URL state** (filters, selected detail, active tab) → search params, so views are linkable.

Components subscribe through **narrow selectors**, never the whole store:

```ts
const status = useAgentStatus();                    // ✅ one field
const stop = useAgentStore((s) => s.stopTask);      // ✅ one action
const everything = useAgentStore();                 // ❌ re-renders on every event
```

The agent store is fed exclusively by `applyEvent(event: AgentEvent)` — one total switch over
the discriminated union. Adding an event type is a compile error until it is handled.

## 5. Styling

`src/app/globals.css` is the source of truth. **Never write a hex colour, `rgb()` or a raw
`hsl()` literal in a component.** Use token utilities (`bg-card`, `text-muted-foreground`,
`border-border`, `text-critical`, `text-executing`, …). The two deliberate exceptions:

- `src/components/charts/*` — recharts needs colour strings, so it uses `hsl(var(--chart-1))`.
- `src/components/workbench/FakeSite.tsx` — it simulates someone else's website and must not
  look like our product.

Design language, from the Nexus template crossed with the minimal-design-system skill:

- Dark-first. The page field is **mid-grey** (`bg-background`) and cards are **darker**
  (`bg-card`). That inversion is the Nexus signature — recessed bento panels. Do not "fix" it.
- `primary` is lime, `accent` is orange. Radius 14px on cards and controls, pill on badges.
- `font-display` (Inter) for headings, `font-sans` (DM Sans) for body, `font-mono`
  (JetBrains Mono) for labels, code and metrics.
- Dense operational UI: 13px body, 11px labels.
- Reach for the existing utilities before inventing CSS: `.surface-card`, `.surface-inset`,
  `.label-mono`, `.text-code`, `.glow-primary`, `.bg-grid`, `.cv-auto`, `.no-drag`,
  `.drag-region`.
- Light mode is a pure token swap. It must keep working — that is why hex literals are banned.

## 6. Performance

- Route-level code splitting is automatic; add `next/dynamic` for charts, the workbench panes,
  the command palette and the failure cockpit.
- `React.memo` every list-row component, and never pass an inline object/array literal to a
  memoized component — it defeats the memo.
- `useCallback` for handlers handed to memoized children; stable `key`s always.
- Any list that can exceed 100 rows goes through `@tanstack/react-virtual` (`DataTable` already
  does this — use `DataTable` rather than hand-rolling a table).
- Query hooks carry a real `staleTime`; summaries and trends get 2 minutes.
- `.cv-auto` (`content-visibility`) on long stacked sections.
- One rollup query (`useDashboardSummary`) feeds every nav badge — not one query per badge.

## 7. Accessibility

Not optional, and not something to simplify away:

- `aria-label` on every icon-only control.
- Keep focus-visible rings — the global `:focus-visible` rule handles them; don't remove
  outlines.
- Semantic landmarks (`header`, `nav`, `main`, `footer`), correct heading order.
- Interactive rows are real buttons, or carry `role="button"`, `tabIndex={0}` and
  Enter/Space handling.
- 44px minimum target for primary actions (`size="lg"` is `h-11`).
- `aria-hidden` on decorative icons and SVG.
- `prefers-reduced-motion` is honoured globally; charts also read
  `document.documentElement.dataset.reduceMotion`.

## 8. Testability

Every interactive element and status indicator carries a `data-testid`, kebab-case, shaped
`<area>-<element>[-<action>]`:

```
nav-rail-findings          titlebar-project-switcher      agent-status-pill
findings-row-BUG-1842      settings-api-mode-select       cockpit-apply-fix-btn
timeline-step-12           live-browser-url-bar           kill-switch
```

The app dogfoods this: its own e2e suite selects on these ids.

## 9. Code conventions

- **Named exports only.** The single exception is Next.js `page.tsx` / `layout.tsx`, which must
  default-export.
- `"use client"` on any file using hooks, events or browser APIs.
- TypeScript strict. No `any` — use `unknown` and narrow. No non-null `!` unless provably safe.
- Import order: react → next → third-party → `@/components` → `@/lib` / `@/store` / `@/config`
  → relative → types.
- `cn()` from `@/lib/utils` for class composition. Never build class strings by concatenation.
- Formatters live in `@/lib/utils` (`formatDuration`, `formatBytes`, `formatCompact`,
  `formatPercent`, `formatRelative`, `truncateMiddle`) — don't re-implement them per page.
- Comment the **why**, not the what. No banner comments on trivial functions.
- No `TODO`, no placeholder bodies, no dead flexibility. If a thing isn't needed, don't build it.

## 10. Rust

- Every command is `#[tauri::command] async fn`, takes `State<'_, AppState>`, returns
  `AppResult<T>`.
- Command names are snake_case and mirror the `DataSource` method names one-for-one.
- `models.rs` mirrors `src/lib/api/types.ts` with `#[serde(rename_all = "camelCase")]`, so the
  JSON crossing the IPC boundary needs no translation layer.
- No `unwrap()` / `expect()` in command paths.
- Never hold a `parking_lot` guard across an `.await`.
- Agent events are emitted on the `agent://event` channel.

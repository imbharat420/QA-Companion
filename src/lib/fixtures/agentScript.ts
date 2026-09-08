import type {
  AgentEvent,
  ApprovalRequest,
  ChatMessage,
  Finding,
  PlanCard,
  PlanStage,
} from "@/lib/api/types";
import { DOM_TREES } from "./browser";

/**
 * THE SCRIPTED AGENT RUN.
 *
 * The mock adapter replays `AGENT_SCRIPT` one event per `AGENT_SCRIPT_STEP_DELAY_MS`,
 * and every Workbench surface — chat, plan card, execution scrubber, browser
 * viewport, network/console panes, token meter — is driven purely by this array.
 * Story: book the Lofoten Night Sky tour, hit the payment approval gate, then
 * fail the confirmation assertion and open BUG-1842.
 *
 * The adapter halts on `status: "waiting"` until `resolveApproval()` is called,
 * then resumes from the next event.
 */

export const AGENT_SCRIPT_STEP_DELAY_MS = 420;

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/**
 * Fixed replay clock. A fixture has to be byte-identical on every load, so the
 * timestamp comes from the event's ordinal rather than a real clock: event N
 * lands N cadence ticks after 10:00:00Z on the demo date.
 */
const at = (ordinal: number): string => {
  const ms = ordinal * AGENT_SCRIPT_STEP_DELAY_MS;
  return `2026-09-07T10:${pad(Math.floor(ms / 60_000), 2)}:${pad(Math.floor(ms / 1000) % 60, 2)}.${pad(ms % 1000, 3)}Z`;
};

/* --------------------------------------------------------------------------
   Cards referenced by the script
   ------------------------------------------------------------------------ */

const PLAN_STAGES: Omit<PlanStage, "state">[] = [
  { id: "stage-explore", label: "Map the booking funnel", detail: "crawl nav + collect interactive elements" },
  { id: "stage-search", label: "Find the Lofoten Night Sky tour", detail: "search box → tour card" },
  {
    id: "stage-checkout",
    label: "Fill payment details",
    detail: "cardholder, card, expiry, CVV from the workspace vault",
  },
  { id: "stage-pay", label: "Submit payment", detail: "approval-gated · irreversible" },
  { id: "stage-verify", label: "Assert confirmation", detail: "/confirmation + booking reference + screenshot" },
];

/** One card, three snapshots — the panel re-renders stage state as the run moves. */
const plan = (states: PlanStage["state"][]): PlanCard => ({
  id: "plan-0142",
  goal: "Book the Lofoten Night Sky tour end to end and verify the confirmation reference",
  budgetTokens: 20_000,
  stages: PLAN_STAGES.map((stage, i) => ({ ...stage, state: states[i] })),
});

const PAYMENT_APPROVAL: ApprovalRequest = {
  id: "apr-0142-payment",
  title: "Submit payment?",
  desc: 'The agent wants to click "Pay €348.00" on blixen-tours using the vault card •• 4242.',
  action: "payment.submit",
  risk: "high",
  target: 'button "Pay €348.00" · form#payment',
  payloadPreview: [
    "POST /api/payments",
    "{",
    '  "amount": 34800,',
    '  "currency": "EUR",',
    '  "cardToken": "tok_vault_ws001_4242",',
    '  "cvv": "***",',
    '  "idempotencyKey": "blx-90413-a1"',
    "}",
  ].join("\n"),
  payloadHash: "sha256:9f2c41ab7d6e0b53c8a17f4d2e9b6058c31da74e",
  reason:
    "Irreversible side effect: the staging gateway authorises a real test card and fires an orders webhook. No dry-run endpoint is exposed, so the charge cannot be rolled back from here.",
  rememberScope: "step",
};

/**
 * The agent's own copy of the finding it opens. `id` matches the curated record
 * in `fixtures/findings.ts` so the timeline row deep-links to the detail page;
 * this version carries the per-run evidence that page merges in.
 */
const BUG_1842: Finding = {
  id: "BUG-1842",
  title: "Checkout submit button unresponsive",
  category: "Functional",
  severity: "high",
  confidence: 94,
  status: "new",
  url: "https://blixen.tours/checkout",
  element: 'button "Pay €348.00"',
  expected: "click → POST /api/payments → 200 → redirect to /confirmation",
  actual: "click → POST /api/payments → 200 → no state transition, form still mounted",
  rca: 'The locator changed in commit 91ac2f. The spec targets button[data-testid="submit"] but the component now renders button.primary without the test id, so the click lands on the form wrapper and the submit handler never runs.',
  fix: "- await page.click('[data-testid=\"submit\"]')\n+ await page.getByRole('button', {\n+   name: 'Pay €348.00'\n+ }).click()",
  commit: "91ac2f",
  relatedTests: 7,
  runId: "run-2291",
  suiteId: "suite-checkout",
  caseId: "case-checkout-pay",
  projectId: "ws-001",
  detectedAt: at(72),
  facts: [
    "POST /api/payments returned 200 in 342ms.",
    "The URL stayed on /checkout for 5000ms after the click.",
    "GET /api/orders/latest returned 404 — no order row was created.",
    'The rendered submit is <button class="primary"> with no data-testid attribute.',
  ],
  inferences: [
    "The 200 comes from the gateway pre-auth, not from an order being persisted.",
    "The click is absorbed by form#payment because the spec's locator resolves to zero nodes.",
    "Restoring the test id — or switching the locator to getByRole — fixes all 7 related specs.",
  ],
  evidence: [
    {
      id: "ev-1842-shot",
      kind: "screenshot",
      label: "checkout-stuck.png",
      src: "/mock/shots/checkout-stuck.png",
      capturedAt: at(79),
    },
    { id: "ev-1842-dom", kind: "dom", label: "form#payment outerHTML", capturedAt: at(80) },
    { id: "ev-1842-net", kind: "network", label: "payments.har (8 requests)", src: "/mock/har/run-2291.har", capturedAt: at(80) },
    { id: "ev-1842-console", kind: "console", label: "6 console entries · 2 errors", capturedAt: at(80) },
  ],
};

/* --------------------------------------------------------------------------
   The script — 89 events. `at(n)` mirrors the array index, so the timeline is
   monotonic by construction.
   ------------------------------------------------------------------------ */

export const AGENT_SCRIPT: AgentEvent[] = [
  { type: "status", status: "thinking", ts: at(0) },
  { type: "tokens", total: 210 },
  {
    type: "message",
    message: {
      id: 2,
      from: "agent",
      ts: at(2),
      text: "On it — I'll book the Lofoten Night Sky tour on blixen-tours end to end and verify the confirmation. Watch the browser.",
    },
  },
  { type: "status", status: "planning", ts: at(3) },
  { type: "plan", plan: plan(["active", "pending", "pending", "pending", "pending"]) },
  {
    type: "step",
    step: {
      id: 1,
      ts: at(5),
      kind: "plan",
      label: "Plan created",
      detail: "5 stages · 1 approval gate · budget 20k tokens",
      status: "info",
    },
  },
  { type: "tokens", total: 780 },
  { type: "status", status: "executing", ts: at(7) },
  {
    type: "browser",
    patch: {
      url: "https://blixen.tours",
      page: "loading",
      title: "Loading…",
      loading: true,
      overlay: "browser.navigate → blixen.tours",
      tabs: [{ id: "tab-1", title: "Loading…", url: "https://blixen.tours" }],
    },
  },
  {
    type: "step",
    step: { id: 2, ts: at(9), kind: "navigate", label: "Navigate", detail: "https://blixen.tours", status: "ok", durationMs: 182 },
  },
  {
    type: "network",
    entry: { id: 1, method: "GET", url: "https://blixen.tours/", status: 200, ms: 182, type: "document", sizeBytes: 18_432, startMs: 0 },
  },
  { type: "tokens", total: 1420 },
  {
    type: "browser",
    patch: {
      page: "home",
      title: "Blixen Tours — Nordic adventures",
      loading: false,
      overlay: null,
      tabs: [{ id: "tab-1", title: "Blixen Tours", url: "https://blixen.tours" }],
    },
  },
  { type: "dom", page: "home", tree: DOM_TREES.home },
  {
    type: "network",
    entry: { id: 2, method: "GET", url: "/api/tours", status: 200, ms: 96, type: "xhr", sizeBytes: 7_204, startMs: 210 },
  },
  {
    type: "network",
    entry: { id: 3, method: "GET", url: "/assets/hero.avif", status: 200, ms: 141, type: "image", sizeBytes: 214_880, startMs: 232 },
  },
  { type: "console", entry: { id: 1, level: "log", text: "[app] hydration complete (34 modules)", ts: at(16), source: "app.js:1204" } },
  {
    type: "console",
    entry: { id: 2, level: "warn", text: "[img] /assets/hero.avif has no intrinsic size — layout shift risk", ts: at(17), source: "hero.tsx:22" },
  },
  {
    type: "step",
    step: {
      id: 3,
      ts: at(18),
      kind: "inspect",
      label: "Inspect page",
      detail: "14 interactive elements · 1 form · 12 a11y nodes",
      status: "info",
    },
  },
  { type: "tokens", total: 2130 },
  {
    type: "message",
    message: {
      id: 20,
      from: "agent",
      ts: at(20),
      text: "Funnel mapped: Tours → tour detail → checkout. Starting from the Tours nav link.",
    },
  },
  { type: "browser", patch: { overlay: 'browser.click → link "Tours"', cursor: { x: 38, y: 7 }, highlight: "nav-tours" } },
  { type: "browser", patch: { ripple: { x: 38, y: 7, key: 1 }, highlight: null } },
  {
    type: "step",
    step: { id: 4, ts: at(23), kind: "click", label: "Click", detail: 'link "Tours" → /tours', status: "ok", durationMs: 96 },
  },
  { type: "browser", patch: { url: "https://blixen.tours/tours", overlay: null, cursor: null, ripple: null } },
  { type: "tokens", total: 2900 },
  { type: "browser", patch: { overlay: "browser.type → search tours", cursor: { x: 46, y: 41 }, highlight: "home-search" } },
  {
    type: "browser",
    patch: { typing: { field: "home-search", text: "lofoten night sky" }, inputs: { "home-search": "lofoten night sky" } },
  },
  {
    type: "step",
    step: { id: 5, ts: at(28), kind: "type", label: "Type", detail: 'searchbox "Search tours" → "lofoten night sky"', status: "ok" },
  },
  {
    type: "browser",
    patch: { typing: null, overlay: 'browser.click → button "Search"', cursor: { x: 63, y: 41 }, highlight: "home-go" },
  },
  { type: "browser", patch: { ripple: { x: 63, y: 41, key: 2 }, highlight: null } },
  {
    type: "step",
    step: { id: 6, ts: at(31), kind: "click", label: "Click", detail: 'button "Search" → 1 result', status: "ok", durationMs: 74 },
  },
  {
    type: "network",
    entry: { id: 4, method: "GET", url: "/api/search?q=lofoten+night+sky", status: 200, ms: 74, type: "xhr", sizeBytes: 1_842, startMs: 2_680 },
  },
  { type: "tokens", total: 3740 },
  { type: "plan", plan: plan(["done", "done", "active", "pending", "pending"]) },
  {
    type: "browser",
    patch: {
      overlay: 'browser.click → article "Lofoten Night Sky"',
      cursor: { x: 24, y: 66 },
      highlight: "tour-lofoten",
      ripple: null,
    },
  },
  { type: "browser", patch: { ripple: { x: 24, y: 66, key: 3 }, highlight: null } },
  {
    type: "step",
    step: {
      id: 7,
      ts: at(37),
      kind: "click",
      label: "Click",
      detail: 'article "Lofoten Night Sky" → /checkout',
      status: "ok",
      durationMs: 118,
    },
  },
  {
    type: "browser",
    patch: {
      url: "https://blixen.tours/checkout",
      page: "checkout",
      title: "Checkout — Blixen",
      overlay: "Checkout reached — verifying summary",
      cursor: null,
      ripple: null,
      tabs: [{ id: "tab-1", title: "Checkout — Blixen", url: "https://blixen.tours/checkout" }],
    },
  },
  { type: "dom", page: "checkout", tree: DOM_TREES.checkout },
  { type: "network", entry: { id: 5, method: "GET", url: "/api/cart", status: 200, ms: 64, type: "xhr", sizeBytes: 912, startMs: 3_410 } },
  {
    type: "console",
    entry: { id: 3, level: "log", text: "[checkout] 1 item · Lofoten Night Sky · €348.00", ts: at(41), source: "checkout.tsx:88" },
  },
  {
    type: "step",
    step: {
      id: 8,
      ts: at(42),
      kind: "navigate",
      label: "Navigate",
      detail: "https://blixen.tours/checkout · total €348.00 matches the tour price",
      status: "ok",
    },
  },
  { type: "network", entry: { id: 6, method: "POST", url: "/api/analytics", status: 403, ms: 88, type: "xhr", sizeBytes: 0, startMs: 3_620 } },
  {
    type: "console",
    entry: { id: 4, level: "error", text: "POST /api/analytics → 403 (blocked by CSP connect-src)", ts: at(44), source: "beacon.js:14" },
  },
  {
    type: "step",
    step: {
      id: 9,
      ts: at(45),
      kind: "network",
      label: "Request blocked",
      detail: "POST /api/analytics → 403 · CSP connect-src",
      status: "warn",
    },
  },
  { type: "tokens", total: 4650 },
  {
    type: "message",
    message: {
      id: 47,
      from: "agent",
      ts: at(47),
      text: "One anomaly on the way in: the analytics beacon is 403-blocked by CSP. Non-blocking, so I've kept it as a finding candidate. Filling the card form now — the details come from the workspace vault and stay masked in the trace.",
    },
  },
  {
    type: "browser",
    patch: {
      overlay: "browser.type → cardholder",
      cursor: { x: 34, y: 38 },
      highlight: "checkout-name",
      typing: { field: "checkout-name", text: "Ada Lovelace" },
      inputs: { "checkout-name": "Ada Lovelace" },
    },
  },
  {
    type: "step",
    step: { id: 10, ts: at(49), kind: "type", label: "Type", detail: 'textbox "Cardholder name" → "Ada Lovelace"', status: "ok" },
  },
  {
    type: "browser",
    patch: { typing: null, overlay: "browser.type → card number (masked)", cursor: { x: 34, y: 47 }, highlight: "checkout-card" },
  },
  // The card and CVV frames carry bullets, never digits: the typing overlay gets
  // screen-recorded in demos, so the fixture itself must never hold a PAN.
  { type: "browser", patch: { typing: { field: "checkout-card", text: "•••• •••• ••" } } },
  {
    type: "browser",
    patch: {
      typing: { field: "checkout-card", text: "•••• •••• •••• ••••" },
      inputs: { "checkout-name": "Ada Lovelace", "checkout-card": "•••• •••• •••• ••••" },
    },
  },
  {
    type: "step",
    step: { id: 11, ts: at(53), kind: "type", label: "Type", detail: 'textbox "Card number" → •••• •••• •••• •••• (masked)', status: "ok" },
  },
  {
    type: "browser",
    patch: {
      typing: { field: "checkout-expiry", text: "09/28" },
      overlay: "browser.type → expiry",
      cursor: { x: 22, y: 56 },
      highlight: "checkout-expiry",
      inputs: { "checkout-name": "Ada Lovelace", "checkout-card": "•••• •••• •••• ••••", "checkout-expiry": "09/28" },
    },
  },
  { type: "step", step: { id: 12, ts: at(55), kind: "type", label: "Type", detail: 'textbox "Expiry" → 09/28', status: "ok" } },
  {
    type: "browser",
    patch: {
      typing: { field: "checkout-cvv", text: "•••" },
      overlay: "browser.type → CVV (masked)",
      cursor: { x: 44, y: 56 },
      highlight: "checkout-cvv",
      inputs: {
        "checkout-name": "Ada Lovelace",
        "checkout-card": "•••• •••• •••• ••••",
        "checkout-expiry": "09/28",
        "checkout-cvv": "•••",
      },
    },
  },
  {
    type: "step",
    step: { id: 13, ts: at(57), kind: "type", label: "Type", detail: "unnamed textbox (cvv) → ••• (masked)", status: "ok" },
  },
  { type: "tokens", total: 5630 },
  {
    type: "browser",
    patch: { typing: null, overlay: "Waiting for your approval…", cursor: { x: 34, y: 72 }, highlight: "pay-submit" },
  },
  { type: "approval", request: PAYMENT_APPROVAL },
  {
    type: "step",
    step: {
      id: 14,
      ts: at(61),
      kind: "approval",
      label: "Approval required",
      detail: "payment.submit → POST /api/payments · risk high",
      status: "warn",
    },
  },
  { type: "status", status: "waiting", ts: at(62) },
  // Everything below replays only after resolveApproval().
  { type: "approval", request: null },
  { type: "status", status: "executing", ts: at(64) },
  {
    type: "message",
    message: { id: 65, from: "system", ts: at(65), text: "Approved · payment.submit — allowed once, for this step only." },
  },
  { type: "browser", patch: { overlay: 'browser.click → button "Pay €348.00"', cursor: { x: 34, y: 72 }, highlight: "pay-submit" } },
  { type: "browser", patch: { ripple: { x: 34, y: 72, key: 4 }, highlight: null, overlay: "Submitting payment…" } },
  {
    type: "step",
    step: {
      id: 15,
      ts: at(68),
      kind: "click",
      label: "Click",
      detail: 'button "Pay €348.00" → POST /api/payments 200',
      status: "ok",
      durationMs: 342,
    },
  },
  {
    type: "network",
    entry: { id: 7, method: "POST", url: "/api/payments", status: 200, ms: 342, type: "xhr", sizeBytes: 486, startMs: 5_120 },
  },
  { type: "tokens", total: 6690 },
  {
    type: "console",
    entry: {
      id: 5,
      level: "warn",
      text: "[checkout] no route change 2000ms after submit — payment form still mounted",
      ts: at(71),
      source: "checkout.tsx:214",
    },
  },
  {
    type: "step",
    step: {
      id: 16,
      ts: at(72),
      kind: "assert",
      label: "Assert booking confirmed",
      detail: "expected url /confirmation + booking ref · still on /checkout after 5000ms",
      status: "fail",
      durationMs: 5_000,
      findingId: "BUG-1842",
    },
  },
  {
    type: "network",
    entry: { id: 8, method: "GET", url: "/api/orders/latest", status: 404, ms: 61, type: "xhr", sizeBytes: 74, startMs: 10_480 },
  },
  {
    type: "console",
    entry: { id: 6, level: "error", text: "[checkout] GET /api/orders/latest → 404 · no order was created", ts: at(74), source: "checkout.tsx:231" },
  },
  { type: "tokens", total: 7830 },
  {
    type: "message",
    message: {
      id: 76,
      from: "agent",
      ts: at(76),
      text: "Assertion failed. The payment POST returned 200 but the app never left /checkout, and /api/orders/latest is a 404 — so nothing was persisted. Opening a finding.",
    },
  },
  { type: "finding", finding: BUG_1842 },
  {
    type: "step",
    step: {
      id: 17,
      ts: at(78),
      kind: "finding",
      label: "Finding opened",
      detail: "BUG-1842 · Checkout submit button unresponsive · high",
      status: "warn",
      findingId: "BUG-1842",
    },
  },
  {
    type: "step",
    step: {
      id: 18,
      ts: at(79),
      kind: "screenshot",
      label: "Screenshot",
      detail: "checkout-stuck.png · full page · 1440×900",
      status: "info",
      screenshotSrc: "/mock/shots/checkout-stuck.png",
    },
  },
  {
    type: "step",
    step: {
      id: 19,
      ts: at(80),
      kind: "inspect",
      label: "Re-resolve locator",
      detail: '[data-testid="checkout-pay"] → 0 nodes · button.primary → 1 node',
      status: "warn",
    },
  },
  { type: "tokens", total: 9060 },
  { type: "plan", plan: plan(["done", "done", "done", "done", "failed"]) },
  {
    type: "browser",
    patch: { overlay: null, cursor: null, highlight: null, typing: null, ripple: null, loading: false },
  },
  {
    type: "message",
    message: {
      id: 84,
      from: "agent",
      ts: at(84),
      text: "Run complete. Four stages passed, the confirmation assertion failed. 19 steps, 8 requests (1 CSP-blocked, 1 404), 6 console entries and 1 screenshot are attached to this session. I opened BUG-1842 with a proposed locator patch that also fixes the 7 related specs — want me to apply it and re-run the checkout suite?",
    },
  },
  { type: "tokens", total: 10_600 },
  { type: "tokens", total: 12_400 },
  { type: "status", status: "completed", ts: at(87) },
  {
    type: "done",
    status: "completed",
    summary:
      "Booking flow walked end to end on blixen-tours. Payment submitted after approval, but the confirmation assertion failed: POST /api/payments returned 200 with no state transition and no order persisted. 1 finding opened (BUG-1842, high, 94% confidence) with a locator patch covering 7 related tests. 12,400 tokens of a 20,000 budget.",
  },
];

/** What the chat panel shows before the first prompt is sent. */
export const CHAT_SEED: ChatMessage[] = [
  {
    id: 0,
    from: "system",
    ts: "2026-09-07T09:59:58.000Z",
    text: "Session ses-0142 · Chromium 128 attached · source: mock adapter",
  },
  {
    id: 1,
    from: "agent",
    ts: "2026-09-07T09:59:59.000Z",
    text: "Workspace blixen-tours loaded — .claude context indexed, 384 tests on main · 91ac2f, Chromium ready. Ask me to test, explore or fix anything.",
  },
];

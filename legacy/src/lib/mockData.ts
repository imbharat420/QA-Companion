export interface Workspace {
  id: string;
  name: string;
  path: string;
  framework: string;
  branch: string;
  sessions: number;
  tests: number;
  lastActive: string;
  health: number;
  description: string;
  devCommand: string;
  testCommand: string;
  gitUrl?: string;
  category: string;
  thumbnail: string;
  starred?: boolean;
  owner: {
    name: string;
    avatar: string;
  };
  folder?: string;
}

export const WORKSPACES: Workspace[] = [
  {
    id: "ws-001",
    name: "blixen-tours",
    path: "~/projects/blixen-tours",
    framework: "Next.js 15",
    branch: "main · 91ac2f",
    sessions: 14,
    tests: 384,
    lastActive: "2 min ago",
    health: 98,
    description: "Full-stack luxury Nordic expedition booking platform with SSR tour catalogs, Stripe payment gateway, and Playwright E2E suites.",
    devCommand: "npm run dev -- -p 3000",
    testCommand: "npx playwright test e2e/checkout.spec.ts --headed",
    gitUrl: "https://github.com/blixen/tours-web",
    category: "Web Application",
    starred: true,
    thumbnail: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
    owner: { name: "Bharat (You)", avatar: "B" },
    folder: "Local Workspaces",
  },
  {
    id: "ws-002",
    name: "ecommerce-agent",
    path: "~/projects/ecommerce-agent",
    framework: "Remix",
    branch: "feat/cart-v2 · b21d9a",
    sessions: 32,
    tests: 511,
    lastActive: "1 day ago",
    health: 87,
    description: "Autonomous e-commerce cart and multi-vendor checkout orchestrator with real-time inventory checking and API contract validation.",
    devCommand: "pnpm run dev",
    testCommand: "npx playwright test e2e/cart.spec.ts",
    gitUrl: "https://github.com/agent-corp/ecommerce-agent",
    category: "E-Commerce",
    starred: false,
    thumbnail: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=600&q=80",
    owner: { name: "Bharat (You)", avatar: "B" },
    folder: "GitHub Repositories",
  },
  {
    id: "ws-003",
    name: "photoshop-clone",
    path: "~/projects/photoshop-clone",
    framework: "Vite + React",
    branch: "main · 8fe10c",
    sessions: 6,
    tests: 92,
    lastActive: "4 days ago",
    health: 74,
    description: "High-performance WebGL-accelerated canvas graphics editor for layer masks, image filtering, and visual regression testing.",
    devCommand: "vite --port 5173",
    testCommand: "npm run test:visual-regression",
    gitUrl: "https://github.com/design-lab/canvas-editor",
    category: "Design Tool",
    starred: true,
    thumbnail: "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=600&q=80",
    owner: { name: "Bharat (You)", avatar: "B" },
    folder: "Local Workspaces",
  },
  {
    id: "ws-004",
    name: "EarthFund",
    path: "~/projects/earthfund",
    framework: "Next.js 14",
    branch: "main · e7410c",
    sessions: 19,
    tests: 245,
    lastActive: "5 hours ago",
    health: 94,
    description: "Decentralized climate initiative treasury and grants allocation portal with smart contract verification and accessibility audit.",
    devCommand: "npm run dev",
    testCommand: "npx playwright test tests/grants.spec.ts",
    gitUrl: "https://github.com/earthfund/dao-platform",
    category: "Web3 / Grants",
    starred: false,
    thumbnail: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
    owner: { name: "Bharat (You)", avatar: "B" },
    folder: "Uploads",
  },
  {
    id: "ws-005",
    name: "Stack Design System",
    path: "~/projects/stack-ds",
    framework: "React 19 + Tailwind",
    branch: "main · a19d3f",
    sessions: 41,
    tests: 618,
    lastActive: "30 min ago",
    health: 99,
    description: "Enterprise accessible component library and cyber-tactical token system with automated Storybook visual regression testing.",
    devCommand: "pnpm storybook --port 6006",
    testCommand: "npm run test:components",
    gitUrl: "https://github.com/stack-org/design-system",
    category: "Design System",
    starred: true,
    thumbnail: "https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=600&q=80",
    owner: { name: "Design Team", avatar: "D" },
    folder: "Uploads",
  },
];

export interface Suite {
  id: string;
  name: string;
  file: string;
  cases: number;
  passRate: number;
  lastRun: string;
  status: "passing" | "failing" | "flaky";
}

export const SUITES: Suite[] = [
  { id: "st-1", name: "Authentication", file: "auth.spec.ts", cases: 8, passRate: 100, lastRun: "12 min ago", status: "passing" },
  { id: "st-2", name: "Checkout & Payments", file: "checkout.spec.ts", cases: 12, passRate: 58, lastRun: "12 min ago", status: "failing" },
  { id: "st-3", name: "Navigation & Routing", file: "navigation.spec.ts", cases: 6, passRate: 83, lastRun: "1 h ago", status: "flaky" },
  { id: "st-4", name: "Search & Filters", file: "search.spec.ts", cases: 5, passRate: 100, lastRun: "3 h ago", status: "passing" },
  { id: "st-5", name: "Accessibility Audit", file: "a11y.spec.ts", cases: 9, passRate: 78, lastRun: "1 day ago", status: "failing" },
  { id: "st-6", name: "Visual Regression", file: "visual.spec.ts", cases: 11, passRate: 91, lastRun: "1 day ago", status: "passing" },
];

export interface RunGroup {
  title: string;
  count: number;
  desc: string;
  tone: "cyan" | "amber" | "red";
}

export interface RunSpec {
  file: string;
  tests: { name: string; status: "passed" | "failed" | "flaky" | "skipped" }[];
}

export interface TestRun {
  id: string;
  name: string;
  branch: string;
  when: string;
  duration: string;
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  groups: RunGroup[];
  specs: RunSpec[];
}

export const RUNS: TestRun[] = [
  {
    id: "#558",
    name: "Checkout Regression",
    branch: "main · 91ac2f",
    when: "12 min ago",
    duration: "4m 12s",
    passed: 34,
    failed: 15,
    flaky: 0,
    skipped: 0,
    groups: [
      { title: "UI Change", count: 9, desc: "Checkout button locator changed in commit 91ac2f", tone: "cyan" },
      { title: "API Contract", count: 4, desc: "POST /api/payments response shape changed", tone: "amber" },
      { title: "Environment", count: 2, desc: "staging auth token expired mid-run", tone: "red" },
    ],
    specs: [
      {
        file: "checkout.spec.ts",
        tests: [
          { name: "guest can add tour to cart", status: "passed" },
          { name: "payment with valid card", status: "failed" },
          { name: "order confirmation renders", status: "failed" },
        ],
      },
      {
        file: "navigation.spec.ts",
        tests: [
          { name: "navbar links resolve", status: "failed" },
          { name: "contact form submits", status: "failed" },
          { name: "password change flow", status: "passed" },
        ],
      },
      {
        file: "cart.spec.ts",
        tests: [
          { name: "add item", status: "passed" },
          { name: "remove item", status: "failed" },
        ],
      },
    ],
  },
  {
    id: "#557",
    name: "Nightly Full Suite",
    branch: "main · 8fe10c",
    when: "9 h ago",
    duration: "18m 44s",
    passed: 341,
    failed: 6,
    flaky: 3,
    skipped: 2,
    groups: [],
    specs: [],
  },
  {
    id: "#556",
    name: "PR #184 Impact Run",
    branch: "feat/cart-v2 · b21d9a",
    when: "1 day ago",
    duration: "6m 03s",
    passed: 57,
    failed: 3,
    flaky: 1,
    skipped: 0,
    groups: [],
    specs: [],
  },
  {
    id: "#555",
    name: "Accessibility Sweep",
    branch: "main · 8fe10c",
    when: "1 day ago",
    duration: "3m 37s",
    passed: 71,
    failed: 8,
    flaky: 0,
    skipped: 0,
    groups: [],
    specs: [],
  },
  {
    id: "#554",
    name: "Nightly Full Suite",
    branch: "main · 77c4e1",
    when: "2 days ago",
    duration: "17m 58s",
    passed: 348,
    failed: 2,
    flaky: 2,
    skipped: 2,
    groups: [],
    specs: [],
  },
];

export const TREND = [
  { run: "#552", pass: 94, fail: 6 },
  { run: "#553", pass: 96, fail: 4 },
  { run: "#554", pass: 97, fail: 3 },
  { run: "#555", pass: 90, fail: 10 },
  { run: "#556", pass: 93, fail: 7 },
  { run: "#557", pass: 97, fail: 3 },
  { run: "#558", pass: 69, fail: 31 },
];

export type Severity = "critical" | "high" | "medium" | "low";

export interface Finding {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  confidence: number;
  status: "new" | "confirmed" | "fixed";
  url: string;
  element: string;
  expected: string;
  actual: string;
  rca: string;
  fix: string;
  commit: string;
  relatedTests: number;
}

export const FINDINGS: Finding[] = [
  {
    id: "BUG-1842",
    title: "Checkout submit button unresponsive",
    category: "Functional",
    severity: "high",
    confidence: 94,
    status: "new",
    url: "/checkout",
    element: 'button "Pay €348.00"',
    expected: "click → POST /api/payments → 200",
    actual: "click → no state transition",
    rca: "The locator changed in commit 91ac2f. The test targets button[data-testid=\"submit\"] but the component now renders button.primary without the test id.",
    fix: "- await page.click('[data-testid=\"submit\"]')\n+ await page.getByRole('button', {\n+   name: 'Pay €348.00'\n+ }).click()",
    commit: "91ac2f",
    relatedTests: 7,
  },
  {
    id: "SEC-19",
    title: "IDOR on /api/orders/{id} — any user can read any order",
    category: "Security",
    severity: "critical",
    confidence: 97,
    status: "confirmed",
    url: "/api/orders/8841",
    element: "GET /api/orders/{id}",
    expected: "403 for foreign order ids",
    actual: "200 with full order payload",
    rca: "The orders handler checks authentication but never verifies ownership. Sequential ids allow trivial enumeration of all orders.",
    fix: "- const order = await db.orders.find(id)\n+ const order = await db.orders.find({ id, userId: session.user.id })\n+ if (!order) throw new ForbiddenError()",
    commit: "77c4e1",
    relatedTests: 2,
  },
  {
    id: "A11Y-42",
    title: "Icon button missing accessible name",
    category: "Accessibility",
    severity: "high",
    confidence: 99,
    status: "new",
    url: "/",
    element: 'button.icon-button (cart)',
    expected: "accessible name announced by screen readers",
    actual: 'no accessible name — announced as "button"',
    rca: "The cart button renders only an SVG icon. WCAG 2.4.6 / 4.1.2 require a name so screen-reader users can identify its purpose.",
    fix: '- <button class="icon-button"><CartIcon /></button>\n+ <button class="icon-button" aria-label="Open cart">\n+   <CartIcon aria-hidden />\n+ </button>',
    commit: "8fe10c",
    relatedTests: 3,
  },
  {
    id: "API-54",
    title: "Payment schema mismatch — amount sent as string",
    category: "API",
    severity: "high",
    confidence: 91,
    status: "new",
    url: "/api/payments",
    element: "POST /api/payments",
    expected: "{ amount: 34800 } (integer, cents)",
    actual: '{ amount: "348.00" } (string)',
    rca: "The checkout form serializes the display value instead of the normalized cents integer after the currency-input refactor.",
    fix: "- amount: values.total\n+ amount: Math.round(parseFloat(values.total) * 100)",
    commit: "b21d9a",
    relatedTests: 4,
  },
  {
    id: "VIS-77",
    title: "Hero layout shift on 1440px viewport (CLS 0.21)",
    category: "Visual",
    severity: "medium",
    confidence: 88,
    status: "new",
    url: "/",
    element: "section.hero img",
    expected: "no layout shift after paint",
    actual: "hero image pushes content 184px on load",
    rca: "The hero image has no width/height reservation, so the browser reflows when it finishes downloading.",
    fix: '+ <img src="/hero.avif" width={1600} height={900}\n+   class="aspect-video object-cover" />',
    commit: "8fe10c",
    relatedTests: 1,
  },
  {
    id: "NET-108",
    title: "POST /api/analytics blocked by CSP (403)",
    category: "Network",
    severity: "medium",
    confidence: 96,
    status: "confirmed",
    url: "/checkout",
    element: "analytics beacon",
    expected: "beacon delivered",
    actual: "403 — connect-src directive blocks the endpoint",
    rca: "The new CSP header deployed in 91ac2f omits analytics.blixen.tours from connect-src.",
    fix: "+ connect-src 'self' https://analytics.blixen.tours",
    commit: "91ac2f",
    relatedTests: 0,
  },
  {
    id: "PERF-33",
    title: "LCP 3.8s on /tours — unoptimized hero image",
    category: "Performance",
    severity: "low",
    confidence: 85,
    status: "new",
    url: "/tours",
    element: "img.hero-4k.jpg (3.1 MB)",
    expected: "LCP < 2.5s",
    actual: "LCP 3.8s on 4G throttle",
    rca: "A 3.1 MB JPEG is served to all viewports. No responsive srcset or modern format is used.",
    fix: '+ <Image src={hero} sizes="100vw" priority placeholder="blur" />',
    commit: "77c4e1",
    relatedTests: 1,
  },
  {
    id: "EDGE-12",
    title: "Unicode names break confirmation layout",
    category: "Edge Case",
    severity: "low",
    confidence: 82,
    status: "new",
    url: "/confirmation",
    element: ".booking-name",
    expected: "name wraps gracefully",
    actual: '"Björk Guðmundsdóttir-Ævarsdóttir" overflows the card',
    rca: "The confirmation card uses a fixed-width flex row with no overflow wrapping for long unbroken strings.",
    fix: '+ className="break-words [overflow-wrap:anywhere]"',
    commit: "8fe10c",
    relatedTests: 1,
  },
];

export interface DomNode {
  tag: string;
  attrs?: string;
  id?: string;
  children?: DomNode[];
}

export const DOM_TREES: Record<string, DomNode> = {
  blank: { tag: "html", attrs: 'lang="en"', children: [{ tag: "body", children: [] }] },
  loading: { tag: "html", attrs: 'lang="en"', children: [{ tag: "body", children: [{ tag: "div", attrs: 'id="splash"' }] }] },
  home: {
    tag: "html",
    attrs: 'lang="en"',
    children: [
      {
        tag: "body",
        children: [
          {
            tag: "header",
            attrs: 'class="site-nav"',
            children: [
              { tag: "a", attrs: 'class="logo"', children: [] },
              { tag: "nav", children: [{ tag: "a", attrs: 'href="/tours"' }, { tag: "a", attrs: 'href="/about"' }] },
              { tag: "button", attrs: 'class="btn-dark"', id: "nav-signin" },
            ],
          },
          {
            tag: "main",
            children: [
              {
                tag: "section",
                attrs: 'class="hero"',
                children: [
                  { tag: "h1", children: [] },
                  { tag: "input", attrs: 'type="search"', id: "home-search" },
                  { tag: "button", attrs: 'class="btn-primary"', id: "home-go" },
                ],
              },
              {
                tag: "section",
                attrs: 'class="tours"',
                children: [
                  { tag: "article", attrs: 'data-tour="lofoten"' },
                  { tag: "article", attrs: 'data-tour="fjords"' },
                  { tag: "article", attrs: 'data-tour="aurora"' },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  login: {
    tag: "html",
    attrs: 'lang="en"',
    children: [
      {
        tag: "body",
        children: [
          {
            tag: "main",
            attrs: 'class="auth"',
            children: [
              {
                tag: "form",
                attrs: 'id="login"',
                children: [
                  { tag: "label", attrs: 'for="email"' },
                  { tag: "input", attrs: 'type="email" name="email"', id: "login-email" },
                  { tag: "label", attrs: 'for="password"' },
                  { tag: "input", attrs: 'type="password" name="password"', id: "login-password" },
                  { tag: "button", attrs: 'type="submit" class="btn-dark"', id: "login-submit" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  checkout: {
    tag: "html",
    attrs: 'lang="en"',
    children: [
      {
        tag: "body",
        children: [
          {
            tag: "main",
            attrs: 'class="checkout"',
            children: [
              { tag: "section", attrs: 'class="summary"' },
              {
                tag: "form",
                attrs: 'id="payment"',
                children: [
                  { tag: "input", attrs: 'name="card" value="4242 …4242"' },
                  { tag: "button", attrs: 'class="primary"', id: "pay-submit" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  confirm: {
    tag: "html",
    attrs: 'lang="en"',
    children: [
      {
        tag: "body",
        children: [
          {
            tag: "main",
            attrs: 'class="confirm"',
            children: [
              { tag: "h1", children: [] },
              { tag: "code", attrs: 'class="ref"', children: [] },
            ],
          },
        ],
      },
    ],
  },
};

export const A11Y_TREES: Record<string, { role: string; name: string }[]> = {
  blank: [],
  loading: [{ role: "document", name: "Loading" }],
  home: [
    { role: "banner", name: "" },
    { role: "navigation", name: "Primary" },
    { role: "link", name: "Blixen Tours" },
    { role: "link", name: "Tours" },
    { role: "link", name: "About" },
    { role: "button", name: "Sign in" },
    { role: "heading", name: "Nordic light, guided." },
    { role: "searchbox", name: "Search tours" },
    { role: "button", name: "Search" },
    { role: "article", name: "Lofoten Night Sky" },
    { role: "article", name: "Geiranger Fjords" },
  ],
  login: [
    { role: "main", name: "" },
    { role: "form", name: "Sign in" },
    { role: "textbox", name: "Email" },
    { role: "textbox", name: "Password" },
    { role: "button", name: "Sign in" },
  ],
  checkout: [
    { role: "main", name: "" },
    { role: "region", name: "Order summary" },
    { role: "form", name: "Payment" },
    { role: "textbox", name: "Card number" },
    { role: "button", name: "Pay €348.00" },
  ],
  confirm: [
    { role: "main", name: "" },
    { role: "status", name: "Booking confirmed" },
    { role: "heading", name: "Booking confirmed" },
    { role: "code", name: "BLX-90413" },
  ],
};

export const QUICK_ACTIONS = [
  "Explore website",
  "Test this website",
  "Automate booking flow",
  "Find bugs",
  "Fix failing test",
  "Accessibility audit",
];

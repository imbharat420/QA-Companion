import type {
  A11yNode,
  BrowserState,
  DomNode,
  PageId,
  SelectorCandidate,
} from "@/lib/api/types";

/**
 * BROWSER / INSPECTOR FIXTURES — the fake site the agent drives.
 *
 * Ported from the prototype's mockData. The site is "Blixen Tours" (workspace
 * ws-001) and the DOM node `id`s here are the contract between three layers:
 * the rendered mock page, `BrowserState.highlight` / `typing.field` / `inputs`
 * keys, and `SELECTOR_CANDIDATES`. They are bare ids, not CSS selectors, so a
 * highlight lookup stays an equality check.
 */

export const DOM_TREES: Record<PageId, DomNode> = {
  blank: { tag: "html", attrs: 'lang="en"', children: [{ tag: "body", children: [] }] },
  loading: {
    tag: "html",
    attrs: 'lang="en"',
    children: [{ tag: "body", children: [{ tag: "div", attrs: 'id="splash"' }] }],
  },
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
              {
                tag: "nav",
                children: [
                  { tag: "a", attrs: 'href="/tours"', id: "nav-tours" },
                  { tag: "a", attrs: 'href="/about"', id: "nav-about" },
                ],
              },
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
                  { tag: "article", attrs: 'data-tour="lofoten"', id: "tour-lofoten" },
                  { tag: "article", attrs: 'data-tour="fjords"', id: "tour-fjords" },
                  { tag: "article", attrs: 'data-tour="aurora"', id: "tour-aurora" },
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
              {
                tag: "section",
                attrs: 'class="summary"',
                children: [
                  { tag: "h2", children: [] },
                  { tag: "ul", children: [{ tag: "li", attrs: 'data-sku="lofoten-night-sky"' }] },
                  { tag: "p", attrs: 'class="total"', children: [] },
                ],
              },
              {
                tag: "form",
                attrs: 'id="payment"',
                children: [
                  { tag: "input", attrs: 'name="cardholder"', id: "checkout-name" },
                  { tag: "input", attrs: 'name="card" inputmode="numeric"', id: "checkout-card" },
                  { tag: "input", attrs: 'name="expiry" placeholder="MM/YY"', id: "checkout-expiry" },
                  { tag: "input", attrs: 'name="cvv" autocomplete="cc-csc"', id: "checkout-cvv" },
                  // No data-testid on the submit: it was dropped in 91ac2f, which is
                  // the whole substance of BUG-1842.
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

export const A11Y_TREES: Record<PageId, A11yNode[]> = {
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
    { role: "article", name: "Aurora Base Camp" },
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
    { role: "textbox", name: "Cardholder name" },
    { role: "textbox", name: "Card number" },
    { role: "textbox", name: "Expiry" },
    // Deliberately nameless — the CVV input is the a11y half of the checkout defects.
    { role: "textbox", name: "" },
    { role: "button", name: "Pay €348.00" },
  ],
  confirm: [
    { role: "main", name: "" },
    { role: "status", name: "Booking confirmed" },
    { role: "heading", name: "Booking confirmed" },
    { role: "code", name: "BLX-90413" },
  ],
};

/**
 * Ranked locator suggestions, keyed by DOM node id. Ordered by `stability`
 * descending: a test id survives a refactor, an xpath survives nothing.
 */
export const SELECTOR_CANDIDATES: Record<string, SelectorCandidate[]> = {
  "pay-submit": [
    // High as a *strategy*, not unique here: the attribute is gone from the
    // component since 91ac2f, so the old spec's locator resolves to zero nodes.
    { selector: '[data-testid="checkout-pay"]', strategy: "testid", stability: 97, unique: false },
    { selector: 'getByRole("button", { name: "Pay €348.00" })', strategy: "role", stability: 84, unique: true },
    { selector: 'getByText("Pay €348.00")', strategy: "text", stability: 61, unique: true },
    { selector: "form#payment button.primary", strategy: "css", stability: 42, unique: true },
    { selector: '//form[@id="payment"]/button[1]', strategy: "xpath", stability: 18, unique: true },
  ],
  "checkout-card": [
    { selector: '[data-testid="card-number"]', strategy: "testid", stability: 96, unique: true },
    { selector: 'getByLabel("Card number")', strategy: "label", stability: 88, unique: true },
    { selector: 'getByRole("textbox", { name: "Card number" })', strategy: "role", stability: 82, unique: true },
    { selector: 'input[name="card"]', strategy: "css", stability: 66, unique: true },
    { selector: '//*[@id="payment"]/input[2]', strategy: "xpath", stability: 14, unique: true },
  ],
  "checkout-cvv": [
    { selector: '[data-testid="card-cvv"]', strategy: "testid", stability: 95, unique: true },
    { selector: 'input[autocomplete="cc-csc"]', strategy: "css", stability: 71, unique: true },
    { selector: 'input[name="cvv"]', strategy: "css", stability: 64, unique: true },
    // The node has no accessible name, so role+name cannot address it at all.
    { selector: 'getByRole("textbox", { name: "CVV" })', strategy: "role", stability: 35, unique: false },
    { selector: '//*[@id="payment"]/input[4]', strategy: "xpath", stability: 12, unique: true },
  ],
  "checkout-expiry": [
    { selector: '[data-testid="card-expiry"]', strategy: "testid", stability: 95, unique: true },
    { selector: 'getByPlaceholder("MM/YY")', strategy: "label", stability: 74, unique: true },
    { selector: 'input[name="expiry"]', strategy: "css", stability: 65, unique: true },
    { selector: '//*[@id="payment"]/input[3]', strategy: "xpath", stability: 12, unique: true },
  ],
  "login-email": [
    { selector: '[data-testid="login-email"]', strategy: "testid", stability: 98, unique: true },
    { selector: 'getByLabel("Email")', strategy: "label", stability: 90, unique: true },
    { selector: 'getByRole("textbox", { name: "Email" })', strategy: "role", stability: 85, unique: true },
    { selector: 'input[type="email"]', strategy: "css", stability: 68, unique: true },
    { selector: '//form[@id="login"]/input[1]', strategy: "xpath", stability: 20, unique: true },
  ],
  "login-password": [
    { selector: '[data-testid="login-password"]', strategy: "testid", stability: 98, unique: true },
    { selector: 'getByLabel("Password")', strategy: "label", stability: 89, unique: true },
    { selector: 'input[type="password"]', strategy: "css", stability: 72, unique: true },
    { selector: 'form#login input[name="password"]', strategy: "css", stability: 58, unique: true },
    { selector: '//form[@id="login"]/input[2]', strategy: "xpath", stability: 20, unique: true },
  ],
  "login-submit": [
    { selector: '[data-testid="login-submit"]', strategy: "testid", stability: 97, unique: true },
    { selector: 'getByRole("button", { name: "Sign in" })', strategy: "role", stability: 79, unique: false },
    { selector: 'form#login button[type="submit"]', strategy: "css", stability: 62, unique: true },
    { selector: 'getByText("Sign in")', strategy: "text", stability: 48, unique: false },
    { selector: '//form[@id="login"]/button', strategy: "xpath", stability: 22, unique: true },
  ],
  "nav-signin": [
    { selector: '[data-testid="nav-signin"]', strategy: "testid", stability: 96, unique: true },
    {
      selector: 'getByRole("banner").getByRole("button", { name: "Sign in" })',
      strategy: "role",
      stability: 81,
      unique: true,
    },
    { selector: "header.site-nav button.btn-dark", strategy: "css", stability: 55, unique: true },
    { selector: 'getByText("Sign in")', strategy: "text", stability: 44, unique: false },
    { selector: "//header/button", strategy: "xpath", stability: 16, unique: true },
  ],
  "nav-tours": [
    { selector: '[data-testid="nav-tours"]', strategy: "testid", stability: 96, unique: true },
    { selector: 'getByRole("link", { name: "Tours" })', strategy: "role", stability: 87, unique: true },
    { selector: 'a[href="/tours"]', strategy: "css", stability: 76, unique: true },
    { selector: 'getByText("Tours")', strategy: "text", stability: 39, unique: false },
    { selector: "//nav/a[1]", strategy: "xpath", stability: 11, unique: true },
  ],
  "home-search": [
    { selector: '[data-testid="home-search"]', strategy: "testid", stability: 97, unique: true },
    { selector: 'getByRole("searchbox", { name: "Search tours" })', strategy: "role", stability: 86, unique: true },
    { selector: 'getByLabel("Search tours")', strategy: "label", stability: 83, unique: true },
    { selector: 'input[type="search"]', strategy: "css", stability: 70, unique: true },
    { selector: '//section[@class="hero"]/input', strategy: "xpath", stability: 15, unique: true },
  ],
  "tour-lofoten": [
    { selector: '[data-testid="tour-card-lofoten"]', strategy: "testid", stability: 95, unique: true },
    { selector: 'getByRole("article", { name: "Lofoten Night Sky" })', strategy: "role", stability: 80, unique: true },
    { selector: '[data-tour="lofoten"]', strategy: "css", stability: 77, unique: true },
    { selector: 'getByText("Lofoten Night Sky")', strategy: "text", stability: 52, unique: false },
    { selector: '//section[@class="tours"]/article[1]', strategy: "xpath", stability: 9, unique: true },
  ],
};

/** Prompt chips above the composer. `icon` is a lucide-react export name. */
export const QUICK_ACTIONS: { slug: string; label: string; prompt: string; icon: string }[] = [
  {
    slug: "explore-website",
    label: "Explore website",
    prompt: "Open the site, map every reachable page and list the interactive elements you find.",
    icon: "Compass",
  },
  {
    slug: "test-website",
    label: "Test this website",
    prompt: "Run an exploratory pass over the whole site and report anything that looks broken.",
    icon: "FlaskConical",
  },
  {
    slug: "automate-booking-flow",
    label: "Automate booking flow",
    prompt: "Book the Lofoten Night Sky tour end to end and verify the confirmation reference.",
    icon: "Workflow",
  },
  {
    slug: "find-bugs",
    label: "Find bugs",
    prompt: "Hunt for functional defects in the checkout funnel and open a finding for each one.",
    icon: "Bug",
  },
  {
    slug: "fix-failing-test",
    label: "Fix failing test",
    prompt: "Diagnose the failing checkout spec, propose a patch and re-run it.",
    icon: "Wrench",
  },
  {
    slug: "accessibility-audit",
    label: "Accessibility audit",
    prompt: "Audit every page against WCAG 2.2 AA and group the violations by rule.",
    icon: "Accessibility",
  },
  {
    slug: "generate-playwright-spec",
    label: "Generate Playwright Spec",
    prompt: "Turn the booking flow you just walked into a Playwright spec with stable locators.",
    icon: "FileCode2",
  },
  {
    slug: "find-broken-links",
    label: "Find Broken Links",
    prompt: "Crawl every internal link and asset and report anything that does not return 2xx.",
    icon: "Unlink",
  },
];

export const INITIAL_BROWSER_STATE: BrowserState = {
  url: "about:blank",
  title: "New Tab",
  page: "blank",
  overlay: null,
  cursor: null,
  highlight: null,
  ripple: null,
  typing: null,
  inputs: {},
  tabs: [{ id: "tab-1", title: "New Tab", url: "about:blank" }],
  activeTab: "tab-1",
  viewport: "desktop",
  takeover: false,
  loading: false,
};

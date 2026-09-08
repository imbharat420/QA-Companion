import type { ScriptEntry } from "@/lib/api/types";

/**
 * SCRIPT LIBRARY FIXTURES — the reusable Playwright assets the agent has accumulated for
 * the Blixen Tours workspace.
 *
 * The `code` bodies are the artefacts the library hands back verbatim when a step is
 * inserted into a spec, so they are written as real, runnable TypeScript rather than a
 * sketch. Every `versions` diff is unified format against the file path in the entry, and
 * `sourceRef` points at the finding, run or recording the asset came out of.
 */
export const SCRIPTS: ScriptEntry[] = [
  {
    id: "sc-001",
    name: "checkout.happy-path",
    kind: "test",
    language: "typescript",
    description:
      "End-to-end Lofoten booking with a Stripe test card. Asserts the payment call, the confirmation status region and the booking reference format.",
    params: [
      {
        name: "baseUrl",
        type: "string",
        required: false,
        default: "https://blixen-tours.test",
        description: "Origin under test. Overridden per environment by playwright.config.ts.",
      },
      {
        name: "tourSlug",
        type: "string",
        required: false,
        default: "lofoten-night-sky",
        description: "Catalogue slug the booking is made against.",
      },
    ],
    tags: ["checkout", "smoke", "money"],
    version: 4,
    usageCount: 218,
    code: `import { expect, test } from "@playwright/test";
import { CheckoutPage } from "../pages/CheckoutPage";
import { login } from "../steps/login";

test.describe("checkout", () => {
  test("member completes a Lofoten booking with a test card", async ({ page }) => {
    await login(page, { email: "ada@blixen.test" });
    await page.goto("/tours/lofoten-night-sky");
    await page.getByTestId("tour-detail-book").click();

    const checkout = new CheckoutPage(page);
    await checkout.fillTraveller({ name: "Ada Lovelace", email: "ada@blixen.test" });
    await checkout.fillCard({ number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123" });

    const [payment] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().endsWith("/api/payments") && res.request().method() === "POST",
      ),
      checkout.pay(),
    ]);

    expect(payment.status()).toBe(200);
    await expect(page.getByRole("status", { name: "Booking confirmed" })).toBeVisible();
    await expect(page.getByTestId("confirm-reference")).toHaveText(/^BLX-\\d{5}$/);
  });
});`,
    sourceRef: "BUG-1842",
    sourceKind: "generated",
    versions: [
      {
        version: 4,
        createdAt: "2026-09-07T09:31:12Z",
        author: "Aether Agent",
        note: "Replace the test-id locator dropped in 91ac2f with a role locator (fix for BUG-1842).",
        diff: `--- a/e2e/checkout.spec.ts
+++ b/e2e/checkout.spec.ts
@@ -20,7 +20,7 @@
-      checkout.payViaTestId(),
+      checkout.pay(),
     ]);

     expect(payment.status()).toBe(200);`,
      },
      {
        version: 3,
        createdAt: "2026-09-04T11:48:03Z",
        author: "Bharat (You)",
        note: "Assert the payment response instead of only the confirmation heading.",
        diff: `--- a/e2e/checkout.spec.ts
+++ b/e2e/checkout.spec.ts
@@ -15,8 +15,14 @@
-    await checkout.pay();
-    await expect(page).toHaveURL(/confirmation/);
+    const [payment] = await Promise.all([
+      page.waitForResponse(
+        (res) => res.url().endsWith("/api/payments") && res.request().method() === "POST",
+      ),
+      checkout.pay(),
+    ]);
+
+    expect(payment.status()).toBe(200);`,
      },
      {
        version: 2,
        createdAt: "2026-08-28T16:02:44Z",
        author: "Aether Agent",
        note: "Extract the card entry into CheckoutPage so the mobile spec can reuse it.",
        diff: `--- a/e2e/checkout.spec.ts
+++ b/e2e/checkout.spec.ts
@@ -9,10 +9,8 @@
-    await page.fill('input[name="card"]', "4242424242424242");
-    await page.fill('input[name="expiry"]', "12/29");
-    await page.fill('input[name="cvc"]', "123");
+    await checkout.fillCard({ number: "4242 4242 4242 4242", expiry: "12/29", cvc: "123" });`,
      },
    ],
    updatedAt: "2026-09-07T09:31:12Z",
  },
  {
    id: "sc-002",
    name: "cart.persists-across-reload",
    kind: "test",
    language: "typescript",
    description:
      "Adds two departures to a guest cart, reloads, and asserts the cart id, line count and subtotal survive. Regression cover for the cart-v2 storage rewrite.",
    params: [
      {
        name: "travellers",
        type: "number",
        required: false,
        default: "2",
        description: "Travellers per line item. The API clamps this to 1–12.",
      },
    ],
    tags: ["cart", "regression"],
    version: 2,
    usageCount: 96,
    code: `import { expect, test } from "@playwright/test";
import { addTourToCart } from "../steps/addTourToCart";
import { TourListPage } from "../pages/TourListPage";

test("guest cart survives a reload", async ({ page }) => {
  const tours = new TourListPage(page);
  await tours.goto();

  await addTourToCart(page, { slug: "lofoten-night-sky", travellers: 2 });
  await addTourToCart(page, { slug: "geiranger-fjords", travellers: 2 });

  const cartId = await page.evaluate(() => window.localStorage.getItem("blx.cartId"));
  expect(cartId).toBeTruthy();

  const subtotalBefore = await page.getByTestId("cart-subtotal").innerText();

  await page.reload();
  await page.getByTestId("nav-cart-open").click();

  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  await expect(page.getByTestId("cart-subtotal")).toHaveText(subtotalBefore);
  expect(await page.evaluate(() => window.localStorage.getItem("blx.cartId"))).toBe(cartId);
});`,
    sourceRef: "#556",
    sourceKind: "generated",
    versions: [
      {
        version: 2,
        createdAt: "2026-09-06T14:31:20Z",
        author: "Aether Agent",
        note: "Compare the subtotal text captured before the reload rather than a hard-coded amount.",
        diff: `--- a/e2e/cart.spec.ts
+++ b/e2e/cart.spec.ts
@@ -18,7 +18,7 @@
-  await expect(page.getByTestId("cart-subtotal")).toHaveText("€696.00");
+  await expect(page.getByTestId("cart-subtotal")).toHaveText(subtotalBefore);`,
      },
    ],
    updatedAt: "2026-09-06T14:31:20Z",
  },
  {
    id: "sc-003",
    name: "auth.lockout-after-failed-attempts",
    kind: "test",
    language: "typescript",
    description:
      "Fires ten bad passwords at /api/auth/login and expects a 429 with Retry-After. Currently the expected failure that tracks SEC-23.",
    params: [
      {
        name: "attempts",
        type: "number",
        required: false,
        default: "10",
        description: "Failed attempts before the limiter is expected to trip.",
      },
      {
        name: "email",
        type: "string",
        required: true,
        description: "Account to hammer. Must exist so the timing path is the real one.",
      },
    ],
    tags: ["auth", "security", "expected-failure"],
    version: 1,
    usageCount: 41,
    code: `import { expect, test } from "@playwright/test";

// Tracks SEC-23. Marked as a known failure until the limiter ships, so the suite stays
// green while the assertion keeps documenting the intended behaviour.
test.fail("login is rate limited after ten failures", async ({ request }) => {
  const email = "ada@blixen.test";
  const statuses: number[] = [];

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const res = await request.post("/api/auth/login", {
      data: { email, password: "wrong-password-" + attempt },
    });
    statuses.push(res.status());
  }

  const limited = await request.post("/api/auth/login", {
    data: { email, password: "wrong-password-final" },
  });

  expect(statuses.every((status) => status === 401)).toBe(true);
  expect(limited.status()).toBe(429);
  expect(limited.headers()["retry-after"]).toBeDefined();
});`,
    sourceRef: "SEC-23",
    sourceKind: "generated",
    versions: [
      {
        version: 1,
        createdAt: "2026-09-07T09:24:02Z",
        author: "Aether Agent",
        note: "Initial capture from the security probe that found the missing limiter.",
        diff: `--- /dev/null
+++ b/e2e/auth-lockout.spec.ts
@@ -0,0 +1,22 @@
+import { expect, test } from "@playwright/test";
+
+test.fail("login is rate limited after ten failures", async ({ request }) => {
+  // …
+});`,
      },
    ],
    updatedAt: "2026-09-07T09:24:02Z",
  },
  {
    id: "sc-004",
    name: "login(user)",
    kind: "step",
    language: "typescript",
    description:
      "Signs a user in through the real form and waits for the session cookie. Falls back to the API route when the form is not the thing under test.",
    params: [
      { name: "email", type: "string", required: true, description: "Account email." },
      {
        name: "password",
        type: "secret",
        required: false,
        description: "Read from QA_PASSWORD when omitted — never inlined in a spec.",
      },
      {
        name: "viaApi",
        type: "boolean",
        required: false,
        default: "false",
        description: "Skip the form and post straight to /api/auth/login.",
      },
    ],
    tags: ["auth", "step", "shared"],
    version: 5,
    usageCount: 612,
    code: `import type { Page } from "@playwright/test";

export interface LoginUser {
  email: string;
  password?: string;
  viaApi?: boolean;
}

export async function login(page: Page, user: LoginUser): Promise<void> {
  const password = user.password ?? process.env.QA_PASSWORD;
  if (!password) throw new Error("login(): set QA_PASSWORD or pass a password");

  if (user.viaApi) {
    const res = await page.request.post("/api/auth/login", {
      data: { email: user.email, password, rememberMe: true },
    });
    if (!res.ok()) throw new Error("login(): API login failed with " + res.status());
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(password);

  await Promise.all([
    page.waitForResponse((res) => res.url().endsWith("/api/auth/login")),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);

  await page.waitForFunction(() => document.cookie.includes("blx_session="));
}`,
    sourceRef: "rec-2026-08-19-0942",
    sourceKind: "recording",
    versions: [
      {
        version: 5,
        createdAt: "2026-09-05T10:14:31Z",
        author: "Aether Agent",
        note: "Wait for the session cookie instead of a fixed timeout — removed the last flake in auth.spec.ts.",
        diff: `--- a/e2e/steps/login.ts
+++ b/e2e/steps/login.ts
@@ -28,5 +28,5 @@
-  await page.waitForTimeout(750);
+  await page.waitForFunction(() => document.cookie.includes("blx_session="));`,
      },
      {
        version: 4,
        createdAt: "2026-08-30T09:02:18Z",
        author: "Bharat (You)",
        note: "Refuse to run without a password rather than silently signing in as the fixture user.",
        diff: `--- a/e2e/steps/login.ts
+++ b/e2e/steps/login.ts
@@ -10,3 +10,4 @@
-  const password = user.password ?? "hunter2";
+  const password = user.password ?? process.env.QA_PASSWORD;
+  if (!password) throw new Error("login(): set QA_PASSWORD or pass a password");`,
      },
      {
        version: 3,
        createdAt: "2026-08-24T13:41:55Z",
        author: "Aether Agent",
        note: "Add the viaApi shortcut for specs that only need an authenticated session.",
        diff: `--- a/e2e/steps/login.ts
+++ b/e2e/steps/login.ts
@@ -12,0 +13,8 @@
+  if (user.viaApi) {
+    const res = await page.request.post("/api/auth/login", {
+      data: { email: user.email, password, rememberMe: true },
+    });
+    if (!res.ok()) throw new Error("login(): API login failed with " + res.status());
+    return;
+  }`,
      },
    ],
    updatedAt: "2026-09-05T10:14:31Z",
  },
  {
    id: "sc-005",
    name: "addTourToCart(page, options)",
    kind: "step",
    language: "typescript",
    description:
      "Opens a tour, picks the first bookable departure and adds it to the cart, waiting on POST /api/cart/items so the assertion never races the request.",
    params: [
      { name: "slug", type: "string", required: true, description: "Catalogue slug, e.g. lofoten-night-sky." },
      { name: "travellers", type: "number", required: false, default: "2", description: "1–12; the API rejects the rest." },
      {
        name: "departureIndex",
        type: "number",
        required: false,
        default: "0",
        description: "Which bookable departure chip to click.",
      },
    ],
    tags: ["cart", "step", "shared"],
    version: 3,
    usageCount: 287,
    code: `import { expect, type Page } from "@playwright/test";

export interface AddToCartOptions {
  slug: string;
  travellers?: number;
  departureIndex?: number;
}

export async function addTourToCart(page: Page, options: AddToCartOptions): Promise<string> {
  const { slug, travellers = 2, departureIndex = 0 } = options;

  await page.goto("/tours/" + slug);
  await page.getByTestId("tour-detail-departure").nth(departureIndex).click();
  await page.getByLabel("Travellers").fill(String(travellers));

  const [created] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/cart/items") && res.request().method() === "POST",
    ),
    page.getByTestId("tour-detail-add-to-cart").click(),
  ]);

  expect(created.status()).toBe(201);
  const body = (await created.json()) as { itemId: string };
  await expect(page.getByTestId("nav-cart-count")).toHaveText(/[1-9]/);
  return body.itemId;
}`,
    sourceRef: "rec-2026-08-21-1508",
    sourceKind: "recording",
    versions: [
      {
        version: 3,
        createdAt: "2026-09-06T14:18:09Z",
        author: "Aether Agent",
        note: "Return the created itemId so the seeded-cart fixture can patch and delete lines.",
        diff: `--- a/e2e/steps/addTourToCart.ts
+++ b/e2e/steps/addTourToCart.ts
@@ -22,4 +22,6 @@
   expect(created.status()).toBe(201);
+  const body = (await created.json()) as { itemId: string };
   await expect(page.getByTestId("nav-cart-count")).toHaveText(/[1-9]/);
+  return body.itemId;`,
      },
      {
        version: 2,
        createdAt: "2026-08-27T11:22:47Z",
        author: "Aether Agent",
        note: "Wait on the POST rather than the badge, which updates optimistically.",
        diff: `--- a/e2e/steps/addTourToCart.ts
+++ b/e2e/steps/addTourToCart.ts
@@ -14,4 +14,9 @@
-  await page.getByTestId("tour-detail-add-to-cart").click();
+  const [created] = await Promise.all([
+    page.waitForResponse(
+      (res) => res.url().includes("/api/cart/items") && res.request().method() === "POST",
+    ),
+    page.getByTestId("tour-detail-add-to-cart").click(),
+  ]);`,
      },
    ],
    updatedAt: "2026-09-06T14:18:09Z",
  },
  {
    id: "sc-006",
    name: "fillPaymentForm(page, card)",
    kind: "step",
    language: "typescript",
    description:
      "Fills the billing block and the two Stripe Elements iframes. Handles the frame-name change Stripe shipped in v3.28 and never logs the card number.",
    params: [
      { name: "number", type: "string", required: true, description: "Test card number; digits or spaced." },
      { name: "expiry", type: "string", required: true, description: "MM/YY." },
      { name: "cvc", type: "secret", required: true, description: "Three digits. Redacted from the trace." },
      { name: "postcode", type: "string", required: false, default: "0150", description: "Billing postal code." },
    ],
    tags: ["checkout", "step", "stripe"],
    version: 2,
    usageCount: 174,
    code: `import type { Page } from "@playwright/test";

export interface CardInput {
  number: string;
  expiry: string;
  cvc: string;
  postcode?: string;
}

export async function fillPaymentForm(page: Page, card: CardInput): Promise<void> {
  await page.getByLabel("Postal code").fill(card.postcode ?? "0150");

  // Stripe renders each field in its own iframe; the inner input has no label, so the
  // frame has to be addressed by src and the input by its name attribute.
  const cardFrame = page.frameLocator('iframe[src*="elements-inner-card"]');
  await cardFrame.locator('input[name="cardnumber"]').fill(card.number.replace(/\\s+/g, ""));
  await cardFrame.locator('input[name="exp-date"]').fill(card.expiry);

  const cvcFrame = page.frameLocator('iframe[src*="elements-inner-cvc"]');
  await cvcFrame.locator('input[name="cvc"]').fill(card.cvc);

  await page.getByTestId("checkout-terms-accept").check();
}`,
    sourceRef: "BUG-1842",
    sourceKind: "extracted",
    versions: [
      {
        version: 2,
        createdAt: "2026-09-02T15:47:12Z",
        author: "Bharat (You)",
        note: "Address the Stripe frames by src — the frame names became per-mount hashes in v3.28.",
        diff: `--- a/e2e/steps/fillPaymentForm.ts
+++ b/e2e/steps/fillPaymentForm.ts
@@ -13,4 +13,4 @@
-  const cardFrame = page.frameLocator('iframe[name="__privateStripeFrame4"]');
+  const cardFrame = page.frameLocator('iframe[src*="elements-inner-card"]');`,
      },
    ],
    updatedAt: "2026-09-02T15:47:12Z",
  },
  {
    id: "sc-007",
    name: "CheckoutPage",
    kind: "page-object",
    language: "typescript",
    description:
      "Page object for /checkout: traveller block, Stripe Elements, totals and the pay button. The pay locator is role-based so the 91ac2f restyle cannot break it again.",
    params: [
      {
        name: "cartId",
        type: "string",
        required: false,
        description: "Deep-link straight to a seeded cart instead of walking the catalogue.",
      },
    ],
    tags: ["checkout", "page-object", "shared"],
    version: 6,
    usageCount: 403,
    code: `import { expect, type Locator, type Page } from "@playwright/test";
import { fillPaymentForm, type CardInput } from "../steps/fillPaymentForm";

export class CheckoutPage {
  readonly total: Locator;
  readonly payButton: Locator;

  constructor(private readonly page: Page) {
    this.total = page.getByTestId("checkout-order-total");
    // Role locator, not the test id: 91ac2f dropped data-testid="submit" (BUG-1842).
    this.payButton = page.getByRole("button", { name: /^Pay/ });
  }

  async goto(cartId?: string): Promise<void> {
    await this.page.goto(cartId ? "/checkout?cart=" + cartId : "/checkout");
    await expect(this.page.getByRole("form", { name: "Payment" })).toBeVisible();
  }

  async fillTraveller(traveller: { name: string; email: string }): Promise<void> {
    await this.page.getByLabel("Full name").fill(traveller.name);
    await this.page.getByLabel("Email").fill(traveller.email);
  }

  async fillCard(card: CardInput): Promise<void> {
    await fillPaymentForm(this.page, card);
  }

  async totalCents(): Promise<number> {
    const text = await this.total.innerText();
    return Math.round(Number.parseFloat(text.replace(/[^0-9.]/g, "")) * 100);
  }

  async pay(): Promise<void> {
    await expect(this.payButton).toBeEnabled();
    await this.payButton.click();
  }
}`,
    sourceRef: "BUG-1842",
    sourceKind: "generated",
    versions: [
      {
        version: 6,
        createdAt: "2026-09-07T09:33:40Z",
        author: "Aether Agent",
        note: "Swap the pay locator to getByRole and drop payViaTestId (fix for BUG-1842).",
        diff: `--- a/e2e/pages/CheckoutPage.ts
+++ b/e2e/pages/CheckoutPage.ts
@@ -11,7 +11,8 @@
-    this.payButton = page.locator('[data-testid="submit"]');
+    // Role locator, not the test id: 91ac2f dropped data-testid="submit" (BUG-1842).
+    this.payButton = page.getByRole("button", { name: /^Pay/ });
@@ -36,4 +37,0 @@
-  async payViaTestId(): Promise<void> {
-    await this.page.click('[data-testid="submit"]');
-  }`,
      },
      {
        version: 5,
        createdAt: "2026-08-31T12:08:22Z",
        author: "Bharat (You)",
        note: "Add totalCents() so money assertions compare integers, not formatted strings.",
        diff: `--- a/e2e/pages/CheckoutPage.ts
+++ b/e2e/pages/CheckoutPage.ts
@@ -28,0 +29,5 @@
+  async totalCents(): Promise<number> {
+    const text = await this.total.innerText();
+    return Math.round(Number.parseFloat(text.replace(/[^0-9.]/g, "")) * 100);
+  }`,
      },
    ],
    updatedAt: "2026-09-07T09:33:40Z",
  },
  {
    id: "sc-008",
    name: "TourListPage",
    kind: "page-object",
    language: "typescript",
    description:
      "Page object for /tours: search, region and sort filters, card grid and the horizontally clipped departure table (which needs keyboard focus per A11Y-55).",
    params: [
      { name: "region", type: "string", required: false, description: "Pre-applies a region filter on goto()." },
      { name: "sort", type: "string", required: false, default: "popularity", description: "popularity | price | departure." },
    ],
    tags: ["catalog", "page-object", "shared"],
    version: 3,
    usageCount: 231,
    code: `import { expect, type Locator, type Page } from "@playwright/test";

export class TourListPage {
  readonly cards: Locator;
  readonly search: Locator;
  readonly departureScroller: Locator;

  constructor(private readonly page: Page) {
    this.cards = page.getByTestId("tours-card");
    this.search = page.getByRole("searchbox", { name: "Search tours" });
    this.departureScroller = page.getByTestId("tours-departure-scroller");
  }

  async goto(options: { region?: string; sort?: string } = {}): Promise<void> {
    const query = new URLSearchParams();
    if (options.region) query.set("region", options.region);
    query.set("sort", options.sort ?? "popularity");
    await this.page.goto("/tours?" + query.toString());
    await expect(this.cards.first()).toBeVisible();
  }

  async searchFor(term: string): Promise<void> {
    await this.search.fill(term);
    await this.page.waitForResponse((res) => res.url().includes("/api/search/suggest"));
  }

  async openTour(slug: string): Promise<void> {
    await this.page.getByTestId("tours-card-" + slug).click();
    await expect(this.page).toHaveURL(new RegExp("/tours/" + slug));
  }

  async visibleTitles(): Promise<string[]> {
    return this.cards.getByRole("heading").allInnerTexts();
  }
}`,
    sourceRef: "#555",
    sourceKind: "generated",
    versions: [
      {
        version: 3,
        createdAt: "2026-09-06T02:38:14Z",
        author: "Aether Agent",
        note: "Expose the departure scroller so the a11y skill can assert it is focusable (A11Y-55).",
        diff: `--- a/e2e/pages/TourListPage.ts
+++ b/e2e/pages/TourListPage.ts
@@ -6,0 +7,1 @@
+  readonly departureScroller: Locator;
@@ -12,0 +14,1 @@
+    this.departureScroller = page.getByTestId("tours-departure-scroller");`,
      },
    ],
    updatedAt: "2026-09-06T02:38:14Z",
  },
  {
    id: "sc-009",
    name: "LoginPage",
    kind: "page-object",
    language: "typescript",
    description:
      "Page object for /login. Reads the error region by role so the assertion survives copy changes, and exposes the reset link that is still a focusable span (A11Y-52).",
    params: [],
    tags: ["auth", "page-object", "shared"],
    version: 2,
    usageCount: 158,
    code: `import { expect, type Locator, type Page } from "@playwright/test";

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  /** Still a focusable span rather than a button — see A11Y-52. */
  readonly resetLink: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.submit = page.getByRole("button", { name: "Sign in" });
    this.error = page.getByRole("alert");
    this.resetLink = page.getByTestId("login-forgot-password");
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
    await expect(this.submit).toBeVisible();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  async expectError(pattern: RegExp): Promise<void> {
    await expect(this.error).toHaveText(pattern);
  }
}`,
    sourceRef: "rec-2026-08-19-0942",
    sourceKind: "recording",
    versions: [
      {
        version: 2,
        createdAt: "2026-08-29T08:55:03Z",
        author: "Bharat (You)",
        note: "Read the error by role=alert instead of .form-error, which the redesign renamed.",
        diff: `--- a/e2e/pages/LoginPage.ts
+++ b/e2e/pages/LoginPage.ts
@@ -15,1 +15,1 @@
-    this.error = page.locator(".form-error");
+    this.error = page.getByRole("alert");`,
      },
    ],
    updatedAt: "2026-08-29T08:55:03Z",
  },
  {
    id: "sc-010",
    name: "authedPage",
    kind: "fixture",
    language: "typescript",
    description:
      "Worker-scoped storage state: signs in once per worker, reuses the cookie jar for every test in it, and re-authenticates when the saved state has expired.",
    params: [
      { name: "email", type: "string", required: false, default: "ada@blixen.test", description: "Fixture account." },
      { name: "statePath", type: "string", required: false, default: ".auth/member.json", description: "Where the storage state is cached." },
    ],
    tags: ["auth", "fixture", "shared"],
    version: 4,
    usageCount: 521,
    code: `import { test as base, type Page } from "@playwright/test";
import fs from "node:fs";
import { login } from "./steps/login";

const STATE_PATH = ".auth/member.json";
const MAX_AGE_MS = 20 * 60 * 1000;

function stateIsFresh(): boolean {
  if (!fs.existsSync(STATE_PATH)) return false;
  return Date.now() - fs.statSync(STATE_PATH).mtimeMs < MAX_AGE_MS;
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ browser }, use) => {
    if (!stateIsFresh()) {
      const seed = await browser.newPage();
      await login(seed, { email: "ada@blixen.test", viaApi: true });
      await seed.context().storageState({ path: STATE_PATH });
      await seed.close();
    }

    const context = await browser.newContext({ storageState: STATE_PATH });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";`,
    sourceRef: "#557",
    sourceKind: "generated",
    versions: [
      {
        version: 4,
        createdAt: "2026-09-06T09:12:41Z",
        author: "Aether Agent",
        note: "Expire the cached state after 20 minutes — a stale token caused the environment failures in run #558.",
        diff: `--- a/e2e/fixtures/authedPage.ts
+++ b/e2e/fixtures/authedPage.ts
@@ -6,3 +6,6 @@
-function stateIsFresh(): boolean {
-  return fs.existsSync(STATE_PATH);
-}
+function stateIsFresh(): boolean {
+  if (!fs.existsSync(STATE_PATH)) return false;
+  return Date.now() - fs.statSync(STATE_PATH).mtimeMs < MAX_AGE_MS;
+}`,
      },
      {
        version: 3,
        createdAt: "2026-08-25T17:30:08Z",
        author: "Bharat (You)",
        note: "Seed the state through the API login so the fixture no longer depends on the form markup.",
        diff: `--- a/e2e/fixtures/authedPage.ts
+++ b/e2e/fixtures/authedPage.ts
@@ -17,1 +17,1 @@
-      await login(seed, { email: "ada@blixen.test" });
+      await login(seed, { email: "ada@blixen.test", viaApi: true });`,
      },
    ],
    updatedAt: "2026-09-06T09:12:41Z",
  },
  {
    id: "sc-011",
    name: "seededCart",
    kind: "fixture",
    language: "typescript",
    description:
      "Creates a cart with two Lofoten seats over the API, hands the cart id to the test, and deletes the cart afterwards so parallel workers never share inventory.",
    params: [
      { name: "tourSlug", type: "string", required: false, default: "lofoten-night-sky", description: "Tour to seed." },
      { name: "travellers", type: "number", required: false, default: "2", description: "Seats per line." },
      { name: "currency", type: "string", required: false, default: "EUR", description: "EUR or NOK." },
    ],
    tags: ["cart", "fixture", "shared"],
    version: 2,
    usageCount: 264,
    code: `import { test as base, type APIRequestContext } from "@playwright/test";

interface SeededCart {
  cartId: string;
  itemId: string;
  totalCents: number;
}

async function createCart(request: APIRequestContext): Promise<SeededCart> {
  const cart = await request.post("/api/cart", { data: { currency: "EUR" } });
  const { cartId } = (await cart.json()) as { cartId: string };

  const item = await request.post("/api/cart/items", {
    data: {
      cartId,
      tourId: "lofoten-night-sky",
      departureId: "dep-2026-10-04",
      travellers: 2,
    },
  });
  const { itemId, subtotalCents } = (await item.json()) as { itemId: string; subtotalCents: number };
  return { cartId, itemId, totalCents: subtotalCents };
}

export const test = base.extend<{ seededCart: SeededCart }>({
  seededCart: async ({ request }, use) => {
    const cart = await createCart(request);
    await use(cart);
    await request.delete("/api/cart/items/" + cart.itemId);
  },
});

export { expect } from "@playwright/test";`,
    sourceRef: "#556",
    sourceKind: "generated",
    versions: [
      {
        version: 2,
        createdAt: "2026-09-06T14:26:55Z",
        author: "Aether Agent",
        note: "Release the seat in teardown; parallel workers were exhausting the October departure.",
        diff: `--- a/e2e/fixtures/seededCart.ts
+++ b/e2e/fixtures/seededCart.ts
@@ -27,2 +27,3 @@
     await use(cart);
+    await request.delete("/api/cart/items/" + cart.itemId);
   },`,
      },
    ],
    updatedAt: "2026-09-06T14:26:55Z",
  },
  {
    id: "sc-012",
    name: "contract.payments",
    kind: "api",
    language: "typescript",
    description:
      "Contract test for POST /api/payments: amount must be an integer in minor units, the response must carry the status enum, and a repeat must not create a second charge.",
    params: [
      { name: "orderId", type: "string", required: true, description: "Order created by /api/checkout." },
      { name: "amountCents", type: "number", required: false, default: "34800", description: "Integer minor units." },
      { name: "idempotencyKey", type: "string", required: false, description: "Sent as Idempotency-Key when present." },
    ],
    tags: ["api", "contract", "money"],
    version: 3,
    usageCount: 187,
    code: `import { expect, test } from "@playwright/test";

const PAYMENT_STATUSES = ["succeeded", "requires_action", "failed"] as const;

test.describe("POST /api/payments contract", () => {
  test("rejects a formatted amount string", async ({ request }) => {
    // Guards API-54: the client sent "348.00" and the handler coerced it to 348 cents.
    const res = await request.post("/api/payments", {
      data: { orderId: "ord_8841", amount: "348.00", currency: "EUR", paymentMethodId: "pm_card_visa" },
    });
    expect(res.status()).toBe(400);
  });

  test("accepts minor units and returns the documented shape", async ({ request }) => {
    const res = await request.post("/api/payments", {
      data: { orderId: "ord_8841", amount: 34800, currency: "EUR", paymentMethodId: "pm_card_visa" },
    });
    expect(res.status()).toBe(200);

    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(
      expect.arrayContaining(["paymentId", "status", "amountCents", "receiptUrl"]),
    );
    expect(PAYMENT_STATUSES).toContain(body.status);
    expect(body.amountCents).toBe(34800);
  });

  test("is idempotent for a repeated key", async ({ request }) => {
    const headers = { "Idempotency-Key": "ct-payments-8841" };
    const data = { orderId: "ord_8841", amount: 34800, currency: "EUR", paymentMethodId: "pm_card_visa" };
    const first = await request.post("/api/payments", { data, headers });
    const second = await request.post("/api/payments", { data, headers });
    expect((await second.json()).paymentId).toBe((await first.json()).paymentId);
  });
});`,
    sourceRef: "API-54",
    sourceKind: "generated",
    versions: [
      {
        version: 3,
        createdAt: "2026-09-07T09:36:18Z",
        author: "Aether Agent",
        note: "Add the status enum assertion after the undocumented field turned up in traffic (API-55).",
        diff: `--- a/e2e/api/payments.contract.spec.ts
+++ b/e2e/api/payments.contract.spec.ts
@@ -21,3 +21,6 @@
     expect(Object.keys(body)).toEqual(
-      expect.arrayContaining(["paymentId", "amountCents", "receiptUrl"]),
+      expect.arrayContaining(["paymentId", "status", "amountCents", "receiptUrl"]),
     );
+    expect(PAYMENT_STATUSES).toContain(body.status);`,
      },
      {
        version: 2,
        createdAt: "2026-09-04T18:02:09Z",
        author: "Bharat (You)",
        note: "Assert the string amount is rejected rather than coerced.",
        diff: `--- a/e2e/api/payments.contract.spec.ts
+++ b/e2e/api/payments.contract.spec.ts
@@ -8,2 +8,2 @@
-    expect(res.status()).toBe(200);
+    expect(res.status()).toBe(400);`,
      },
    ],
    updatedAt: "2026-09-07T09:36:18Z",
  },
  {
    id: "sc-013",
    name: "contract.availability",
    kind: "api",
    language: "typescript",
    description:
      "Contract test for GET /api/availability: date parameters must be validated, a malformed range must return 400, and a 5xx body must never leak driver text.",
    params: [
      { name: "from", type: "string", required: true, description: "ISO date, inclusive." },
      { name: "to", type: "string", required: true, description: "ISO date, inclusive." },
      { name: "tourId", type: "string", required: false, description: "Narrow the window to one tour." },
    ],
    tags: ["api", "contract", "security"],
    version: 2,
    usageCount: 133,
    code: `import { expect, test } from "@playwright/test";

const LEAKY = /(postgres|pg_|relation |current_user|blixen_app)/i;

test.describe("GET /api/availability contract", () => {
  test("returns slots for a valid window", async ({ request }) => {
    const res = await request.get("/api/availability?from=2026-10-01&to=2026-10-31");
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { slots: unknown[]; currency: string; supplierSyncedAt: string };
    expect(Array.isArray(body.slots)).toBe(true);
    expect(["EUR", "NOK"]).toContain(body.currency);
    expect(Number.isNaN(Date.parse(body.supplierSyncedAt))).toBe(false);
  });

  test("rejects a malformed date instead of reaching the query", async ({ request }) => {
    // Guards SEC-31 / API-66.
    const res = await request.get("/api/availability?from=2026-10-01'&to=2026-10-31");
    expect(res.status()).toBe(400);
    expect(LEAKY.test(await res.text())).toBe(false);
  });

  test("rejects an inverted range", async ({ request }) => {
    const res = await request.get("/api/availability?from=2026-12-31&to=2026-10-01");
    expect(res.status()).toBe(400);
  });
});`,
    sourceRef: "SEC-31",
    sourceKind: "generated",
    versions: [
      {
        version: 2,
        createdAt: "2026-09-07T09:37:44Z",
        author: "Aether Agent",
        note: "Assert the 400 body carries no driver text (API-67).",
        diff: `--- a/e2e/api/availability.contract.spec.ts
+++ b/e2e/api/availability.contract.spec.ts
@@ -19,2 +19,3 @@
     expect(res.status()).toBe(400);
+    expect(LEAKY.test(await res.text())).toBe(false);`,
      },
    ],
    updatedAt: "2026-09-07T09:37:44Z",
  },
  {
    id: "sc-014",
    name: "skill.a11y-audit",
    kind: "skill",
    language: "typescript",
    description:
      "Agent skill: runs axe-core over a list of routes at AA, groups violations by rule and returns them in the A11yIssue shape the findings pipeline expects.",
    params: [
      { name: "routes", type: "string", required: true, description: "Comma-separated paths, e.g. /,/tours,/checkout." },
      { name: "level", type: "string", required: false, default: "AA", description: "A | AA | AAA — maps to the axe tag set." },
      { name: "failOnImpact", type: "string", required: false, default: "critical", description: "Impact at which the skill reports a failure." },
      { name: "includeIncomplete", type: "boolean", required: false, default: "false", description: "Report axe's incomplete results too." },
    ],
    tags: ["a11y", "skill", "agent"],
    version: 5,
    usageCount: 349,
    code: `import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

const TAGS: Record<string, string[]> = {
  A: ["wcag2a", "wcag21a"],
  AA: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  AAA: ["wcag2a", "wcag2aa", "wcag2aaa", "wcag21aa"],
};

export interface AuditOptions {
  routes: string[];
  level?: keyof typeof TAGS;
  failOnImpact?: "critical" | "serious" | "moderate" | "minor";
}

export async function auditRoutes(page: Page, options: AuditOptions) {
  const tags = TAGS[options.level ?? "AA"];
  const findings = [];

  for (const route of options.routes) {
    await page.goto(route, { waitUntil: "networkidle" });
    const result = await new AxeBuilder({ page })
      .withTags(tags)
      .exclude('iframe[src*="js.stripe.com"]')
      .analyze();

    for (const violation of result.violations) {
      findings.push({
        ruleId: violation.id,
        impact: violation.impact,
        criteria: violation.tags.filter((tag) => tag.startsWith("wcag") && /\\d/.test(tag)),
        url: page.url(),
        selector: String(violation.nodes[0]?.target[0] ?? ""),
        html: violation.nodes[0]?.html ?? "",
        remediation: violation.help,
        nodeCount: violation.nodes.length,
      });
    }
  }

  return findings;
}`,
    sourceRef: "#555",
    sourceKind: "generated",
    versions: [
      {
        version: 5,
        createdAt: "2026-09-07T09:39:02Z",
        author: "Aether Agent",
        note: "Exclude the Stripe iframes — their own violations are not ours to fix and drowned the report.",
        diff: `--- a/agent/skills/a11yAudit.ts
+++ b/agent/skills/a11yAudit.ts
@@ -25,2 +25,3 @@
       .withTags(tags)
+      .exclude('iframe[src*="js.stripe.com"]')
       .analyze();`,
      },
      {
        version: 4,
        createdAt: "2026-09-06T02:33:27Z",
        author: "Aether Agent",
        note: "Keep every WCAG criterion axe reports instead of only the first one.",
        diff: `--- a/agent/skills/a11yAudit.ts
+++ b/agent/skills/a11yAudit.ts
@@ -31,1 +31,1 @@
-        criteria: [violation.tags[0]],
+        criteria: violation.tags.filter((tag) => tag.startsWith("wcag") && /\\d/.test(tag)),`,
      },
      {
        version: 3,
        createdAt: "2026-08-30T14:11:40Z",
        author: "Bharat (You)",
        note: "Wait for networkidle; lazy-loaded tour cards were being audited before they rendered.",
        diff: `--- a/agent/skills/a11yAudit.ts
+++ b/agent/skills/a11yAudit.ts
@@ -22,1 +22,1 @@
-    await page.goto(route);
+    await page.goto(route, { waitUntil: "networkidle" });`,
      },
    ],
    updatedAt: "2026-09-07T09:39:02Z",
  },
  {
    id: "sc-015",
    name: "skill.visual-sweep",
    kind: "skill",
    language: "typescript",
    description:
      "Agent skill: captures every named baseline at three viewports, masks the volatile regions and reports the diff percentage against the stored PNG.",
    params: [
      { name: "targets", type: "string", required: true, description: "Comma-separated route or component keys to capture." },
      { name: "viewports", type: "string", required: false, default: "desktop,tablet,mobile", description: "Subset of the configured viewports." },
      { name: "threshold", type: "number", required: false, default: "0.1", description: "Allowed ratio of differing pixels." },
      { name: "updateBaselines", type: "boolean", required: false, default: "false", description: "Write the capture back as the new baseline." },
    ],
    tags: ["visual", "skill", "agent"],
    version: 3,
    usageCount: 212,
    code: `import { expect, type Page } from "@playwright/test";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 390, height: 844 },
} as const;

const MASKS = [
  ".hero__weather-widget",
  ".tour-card__seats-left",
  ".order-summary__total",
  '[data-testid="confirm-reference"]',
];

export interface SweepOptions {
  targets: { name: string; route: string }[];
  viewports?: (keyof typeof VIEWPORTS)[];
  threshold?: number;
}

export async function visualSweep(page: Page, options: SweepOptions) {
  const viewports = options.viewports ?? (["desktop", "tablet", "mobile"] as const);
  const results: { name: string; viewport: string; ok: boolean }[] = [];

  for (const key of viewports) {
    await page.setViewportSize(VIEWPORTS[key]);

    for (const target of options.targets) {
      await page.goto(target.route, { waitUntil: "networkidle" });
      // Freeze CSS animations so a mid-transition frame cannot fail the comparison.
      await page.emulateMedia({ reducedMotion: "reduce" });

      const name = target.name + "-" + key + ".png";
      let ok = true;
      try {
        await expect(page).toHaveScreenshot(name, {
          mask: MASKS.map((selector) => page.locator(selector)),
          maxDiffPixelRatio: options.threshold ?? 0.1,
          animations: "disabled",
        });
      } catch {
        ok = false;
      }
      results.push({ name, viewport: key, ok });
    }
  }

  return results;
}`,
    sourceRef: "VIS-77",
    sourceKind: "generated",
    versions: [
      {
        version: 3,
        createdAt: "2026-09-07T09:40:26Z",
        author: "Aether Agent",
        note: "Force reduced motion; the hero parallax was producing a different frame on every run.",
        diff: `--- a/agent/skills/visualSweep.ts
+++ b/agent/skills/visualSweep.ts
@@ -30,0 +31,2 @@
+      // Freeze CSS animations so a mid-transition frame cannot fail the comparison.
+      await page.emulateMedia({ reducedMotion: "reduce" });`,
      },
      {
        version: 2,
        createdAt: "2026-08-26T10:05:51Z",
        author: "Bharat (You)",
        note: "Mask the live seat counter and the totals — both change between captures.",
        diff: `--- a/agent/skills/visualSweep.ts
+++ b/agent/skills/visualSweep.ts
@@ -8,1 +8,6 @@
-const MASKS = [".hero__weather-widget"];
+const MASKS = [
+  ".hero__weather-widget",
+  ".tour-card__seats-left",
+  ".order-summary__total",
+  '[data-testid="confirm-reference"]',
+];`,
      },
    ],
    updatedAt: "2026-09-07T09:40:26Z",
  },
];

import type { SecurityHeaderCheck, SecurityIssue, SecuritySummary } from "@/lib/api/types";

/**
 * SECURITY FIXTURES — passive scan + authenticated probe of the Blixen Tours staging
 * environment, run #558 (branch main · 91ac2f).
 *
 * CWE ids and CVSS 3.1 base scores are real. SEC-19 is intentionally the same issue as
 * the IDOR finding in the findings fixture — the same defect surfaces in both views.
 */
export const SECURITY_ISSUES: SecurityIssue[] = [
  {
    id: "SEC-24",
    title: "JWT signature not verified when alg is set to none",
    category: "auth",
    severity: "critical",
    cvss: 9.1,
    cwe: "CWE-347",
    url: "https://blixen-tours.test/api/users/me",
    evidence:
      'Re-signed the session token with {"alg":"none"} and an empty signature segment, changed sub to 8841, and GET /api/users/me returned 200 with that user\'s profile and booking list.',
    remediation:
      'Pin the accepted algorithms in the verifier: jwtVerify(token, key, { algorithms: ["RS256"] }). Reject a token whose header alg is not on the list before any claim is read.',
    status: "confirmed",
    detectedAt: "2026-09-07T09:16:41Z",
  },
  {
    id: "SEC-19",
    title: "IDOR on /api/orders/{id} — any session can read any order",
    category: "authz",
    severity: "critical",
    cvss: 8.1,
    cwe: "CWE-639",
    url: "https://blixen-tours.test/api/orders/8841",
    evidence:
      "Authenticated as user 4127 and walked ids 8830-8850. Every id returned 200 with the full order payload including payer name, email and the last four card digits. No 403 was observed at any id.",
    remediation:
      "Scope the lookup to the session instead of filtering after the fact: db.orders.find({ id, userId: session.user.id }) and throw ForbiddenError on a miss. Switch the public identifier to a ULID so enumeration stops being cheap.",
    status: "confirmed",
    detectedAt: "2026-09-06T21:04:12Z",
  },
  {
    id: "SEC-31",
    title: "Error-based SQL injection in the availability date filter",
    category: "injection",
    severity: "critical",
    cvss: 9.1,
    cwe: "CWE-89",
    url: "https://blixen-tours.test/api/availability?from=2026-10-01",
    evidence:
      "from=2026-10-01' AND 1=CAST((SELECT current_user) AS int)-- returned a 500 whose body contained the Postgres error text and the role name blixen_app, confirming the value reaches the planner unparameterised.",
    remediation:
      "Parameterise the range clause ($1/$2) rather than interpolating the query string, and validate both dates against an ISO-date schema at the route boundary. Strip driver error text from 5xx responses.",
    status: "confirmed",
    detectedAt: "2026-09-07T09:18:03Z",
  },
  {
    id: "SEC-27",
    title: "Stripe restricted secret key shipped in the client bundle",
    category: "secrets",
    severity: "high",
    cvss: 7.5,
    cwe: "CWE-798",
    url: "https://blixen-tours.test/_next/static/chunks/checkout-2f91ab.js",
    evidence:
      'The chunk contains rk_test_51Nq...H8vP at byte 41,208, reached through process.env.STRIPE_RESTRICTED_KEY being read inside a "use client" module. The key still authorises refund creation against the test account.',
    remediation:
      "Move the refund call behind /api/payments/:id/refund on the server, rename the variable so it can never be inlined (no NEXT_PUBLIC_ prefix), roll the key in the Stripe dashboard, and add a bundle grep for rk_/sk_ to CI.",
    status: "confirmed",
    detectedAt: "2026-09-07T09:15:27Z",
  },
  {
    id: "SEC-22",
    title: "Session cookie set without HttpOnly or SameSite",
    category: "auth",
    severity: "high",
    cvss: 6.5,
    cwe: "CWE-1004",
    url: "https://blixen-tours.test/api/auth/login",
    evidence:
      "Set-Cookie: blx_session=eyJhbGciOi...; Path=/; Secure. HttpOnly and SameSite are both absent, so document.cookie exposes the token to any injected script and the cookie rides along on cross-site POSTs.",
    remediation:
      "Set HttpOnly, SameSite=Lax and an explicit Max-Age on the session cookie. Keep the separate CSRF token cookie readable, but nothing else.",
    status: "confirmed",
    detectedAt: "2026-09-06T21:07:55Z",
  },
  {
    id: "SEC-29",
    title: "Reflected XSS in the tour search query echo",
    category: "injection",
    severity: "high",
    cvss: 6.1,
    cwe: "CWE-79",
    url: "https://blixen-tours.test/search?q=fjord",
    evidence:
      'q=fjord"><img src=x onerror=alert(document.domain)> is written into the "Results for ..." heading through dangerouslySetInnerHTML and executes on load. The response carries no CSP to blunt it.',
    remediation:
      "Render the echoed query as a text child instead of raw HTML. If the highlight markup is required, build it from a sanitised token list rather than the raw parameter.",
    status: "new",
    detectedAt: "2026-09-07T09:19:44Z",
  },
  {
    id: "SEC-33",
    title: "axios 0.21.1 is vulnerable to SSRF via redirect (CVE-2020-28168)",
    category: "deps",
    severity: "high",
    cvss: 7.5,
    cwe: "CWE-918",
    url: "https://blixen-tours.test/api/availability",
    evidence:
      "package-lock.json pins axios 0.21.1, reached from the supplier-availability client. A 302 to http://169.254.169.254/latest/meta-data/ is followed with the proxy configuration dropped.",
    remediation:
      "Upgrade to axios >= 0.21.2 (1.x preferred) and set maxRedirects: 0 on the supplier client, resolving redirects explicitly against an allow-list of supplier hosts.",
    status: "new",
    detectedAt: "2026-09-06T21:11:09Z",
  },
  {
    id: "SEC-17",
    title: "No Content-Security-Policy on HTML responses",
    category: "headers",
    severity: "medium",
    cvss: 6.1,
    cwe: "CWE-693",
    url: "https://blixen-tours.test/checkout",
    evidence:
      "All eleven document responses sampled returned without Content-Security-Policy or Content-Security-Policy-Report-Only. The header exists only on /checkout, where it was added in 91ac2f and is scoped too narrowly to help elsewhere.",
    remediation:
      "Ship a site-wide policy from middleware, starting in report-only: default-src 'self'; script-src 'self' https://js.stripe.com; connect-src 'self' https://analytics.blixen.tours; frame-ancestors 'none'; object-src 'none'.",
    status: "new",
    detectedAt: "2026-09-07T09:12:02Z",
  },
  {
    id: "SEC-18",
    title: "Strict-Transport-Security missing on the apex host",
    category: "transport",
    severity: "medium",
    cvss: 5.9,
    cwe: "CWE-319",
    url: "https://blixen-tours.test/",
    evidence:
      "No Strict-Transport-Security header on any HTTPS response, and http://blixen-tours.test/ answers 301 rather than being refused, leaving a first-visit downgrade window.",
    remediation:
      "Add Strict-Transport-Security: max-age=31536000; includeSubDomains at the edge, verify every subdomain serves TLS, then submit the apex to the HSTS preload list.",
    status: "new",
    detectedAt: "2026-09-07T09:12:02Z",
  },
  {
    id: "SEC-21",
    title: "X-Frame-Options and frame-ancestors both absent",
    category: "headers",
    severity: "medium",
    cvss: 4.3,
    cwe: "CWE-1021",
    url: "https://blixen-tours.test/checkout",
    evidence:
      "The checkout document renders inside a cross-origin iframe on a scratch page with no framing restriction, so the payment step can be overlaid and click-jacked.",
    remediation:
      "Send frame-ancestors 'none' in the CSP and X-Frame-Options: DENY for older agents. The Stripe iframes are children of the page and are unaffected.",
    status: "new",
    detectedAt: "2026-09-07T09:12:02Z",
  },
  {
    id: "SEC-26",
    title: "Mapbox access token has no URL restriction",
    category: "secrets",
    severity: "medium",
    cvss: 5.3,
    cwe: "CWE-522",
    url: "https://blixen-tours.test/tours/lofoten-night-sky",
    evidence:
      "pk.eyJ1IjoiYmxpeGVu... is embedded in the itinerary map component and was accepted verbatim from an unrelated origin, so the tile quota can be spent by anyone who copies it.",
    remediation:
      "Add a URL restriction for blixen-tours.test and its staging host in the Mapbox account, scope the token to styles:tiles only, and rotate the current value.",
    status: "new",
    detectedAt: "2026-09-06T21:13:36Z",
  },
  {
    id: "SEC-23",
    title: "No rate limiting or lockout on /api/auth/login",
    category: "auth",
    severity: "medium",
    cvss: 5.3,
    cwe: "CWE-307",
    url: "https://blixen-tours.test/api/auth/login",
    evidence:
      "600 sequential POSTs with the same email and varying passwords all returned 401 in under 40 seconds with no 429, no delay and no captcha. The response time difference between a known and unknown email is a steady 55ms.",
    remediation:
      "Rate-limit per IP and per account (10 attempts / 15 min), return 429 with Retry-After, and equalise the failure path so the timing no longer discloses which addresses exist.",
    status: "new",
    detectedAt: "2026-09-07T09:21:18Z",
  },
  {
    id: "SEC-20",
    title: "X-Content-Type-Options not set on static assets",
    category: "headers",
    severity: "low",
    cvss: 3.1,
    cwe: "CWE-430",
    url: "https://blixen-tours.test/_next/static/chunks/main-app-6c02d4.js",
    evidence:
      "Static asset responses omit X-Content-Type-Options, so a user-uploaded review attachment served from the same origin can be MIME-sniffed into script.",
    remediation:
      "Add X-Content-Type-Options: nosniff to every response at the edge, and serve user uploads from a separate origin with Content-Disposition: attachment.",
    status: "fixed",
    detectedAt: "2026-09-06T21:14:50Z",
  },
  {
    id: "SEC-25",
    title: "Mixed content: partner logos loaded over http",
    category: "transport",
    severity: "low",
    cvss: 3.7,
    cwe: "CWE-319",
    url: "https://blixen-tours.test/tours",
    evidence:
      "Three <img> elements in the partner strip point at http://cdn.nordicpartners.example/logos/*.png. Chrome auto-upgrades them and the request fails, so the strip renders empty rather than insecure.",
    remediation:
      "Rewrite the URLs to https, or self-host the logos under /media/partners so the dependency on a partner CDN disappears entirely.",
    status: "false-positive",
    detectedAt: "2026-09-06T21:15:22Z",
  },
];

/**
 * Header posture for the primary document response. Split out as its own export so the
 * checklist panel can render without pulling the whole summary.
 */
export const HEADER_CHECKS: SecurityHeaderCheck[] = [
  {
    header: "Content-Security-Policy",
    present: false,
    expected: "default-src 'self'; script-src 'self' https://js.stripe.com; frame-ancestors 'none'; object-src 'none'",
    severity: "high",
  },
  {
    header: "Strict-Transport-Security",
    present: false,
    expected: "max-age=31536000; includeSubDomains; preload",
    severity: "high",
  },
  {
    header: "X-Content-Type-Options",
    present: true,
    value: "nosniff",
    expected: "nosniff",
    severity: "medium",
  },
  {
    header: "X-Frame-Options",
    present: false,
    expected: "DENY (or CSP frame-ancestors 'none')",
    severity: "medium",
  },
  {
    header: "Referrer-Policy",
    present: true,
    value: "strict-origin-when-cross-origin",
    expected: "strict-origin-when-cross-origin or no-referrer",
    severity: "low",
  },
  {
    header: "Permissions-Policy",
    present: false,
    expected: "geolocation=(self), camera=(), microphone=(), payment=(self \"https://js.stripe.com\")",
    severity: "low",
  },
  {
    header: "Cross-Origin-Opener-Policy",
    present: false,
    expected: "same-origin",
    severity: "medium",
  },
  {
    header: "Cache-Control",
    present: true,
    value: "no-store, max-age=0",
    expected: "no-store on authenticated documents",
    severity: "low",
  },
];

export const SECURITY_SUMMARY: SecuritySummary = {
  score: 54,
  byCategory: [
    { category: "headers", count: 3 },
    { category: "auth", count: 3 },
    { category: "injection", count: 2 },
    { category: "secrets", count: 2 },
    { category: "transport", count: 2 },
    { category: "authz", count: 1 },
    { category: "deps", count: 1 },
  ],
  bySeverity: { critical: 3, high: 4, medium: 5, low: 2 },
  headers: HEADER_CHECKS,
  scannedUrls: 47,
  lastScan: "2026-09-07T09:22:40Z",
};

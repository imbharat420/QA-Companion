import type { A11yIssue, A11ySummary } from "@/lib/api/types";

/**
 * ACCESSIBILITY FIXTURES — one axe-core 4.10 sweep of the Blixen Tours staging build
 * (run #558, branch main · 91ac2f).
 *
 * Rule ids, help text and success criteria are the real axe values, not invented ones:
 * the remediation loop links straight out to dequeuniversity.com/rules/axe/4.10/<ruleId>,
 * so a fabricated id would 404 in the UI.
 */
export const A11Y_ISSUES: A11yIssue[] = [
  {
    id: "A11Y-42",
    ruleId: "button-name",
    title: "Cart icon button has no accessible name",
    description:
      "Buttons must have discernible text. The header cart control renders only an SVG, so assistive technology announces it as an unlabelled \"button\".",
    impact: "critical",
    wcagLevel: "A",
    criteria: ["4.1.2"],
    url: "https://blixen-tours.test/",
    selector: "header.site-nav > button.icon-button[data-cart]",
    html: '<button class="icon-button" data-cart><svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6h15l-1.5 9h-12z"/></svg></button>',
    remediation:
      'Add aria-label="Open cart" to the button and aria-hidden="true" to the decorative SVG. Where the label must be translatable, use a visually hidden <span> instead of aria-label.',
    nodeCount: 3,
    status: "confirmed",
    category: "aria",
  },
  {
    id: "A11Y-37",
    ruleId: "image-alt",
    title: "Tour card media missing alt text",
    description:
      "Images must have alternate text. Seven tour-card images render without an alt attribute, so screen readers fall back to announcing the file name.",
    impact: "critical",
    wcagLevel: "A",
    criteria: ["1.1.1"],
    url: "https://blixen-tours.test/tours",
    selector: ".tour-grid article:nth-child(3) img.card-media",
    html: '<img src="/media/aurora-camp-1600.avif" class="card-media" loading="lazy" width="800" height="500">',
    remediation:
      'Describe the tour: alt="Aurora over the Senja base camp at night". If the adjacent card heading already carries the tour name, alt="" is correct and the image should be marked decorative.',
    nodeCount: 7,
    status: "new",
    category: "media",
  },
  {
    id: "A11Y-45",
    ruleId: "label",
    title: "Card number field labelled only by its placeholder",
    description:
      "Form elements must have labels. A placeholder disappears on input, is not reliably announced by every screen reader, and fails at 2.71:1 contrast on its own.",
    impact: "critical",
    wcagLevel: "A",
    criteria: ["3.3.2"],
    url: "https://blixen-tours.test/checkout",
    selector: 'form#payment input[name="card"]',
    html: '<input name="card" inputmode="numeric" placeholder="Card number" class="field">',
    remediation:
      'Associate a real label: <label for="card-number">Card number</label> with id="card-number" on the input. Keep the placeholder only as a format hint ("4242 4242 4242 4242").',
    nodeCount: 4,
    status: "new",
    category: "forms",
  },
  {
    id: "A11Y-51",
    ruleId: "aria-required-children",
    title: "Departure tablist owns no tabs",
    description:
      "Elements with an ARIA role that requires child roles must contain them. The .tab-scroller wrapper sits between the tablist and its tabs, breaking ownership, so the widget is announced as an empty tablist.",
    impact: "critical",
    wcagLevel: "A",
    criteria: ["1.3.1"],
    url: "https://blixen-tours.test/tours",
    selector: '#departure-tabs[role="tablist"]',
    html: '<div id="departure-tabs" role="tablist"><div class="tab-scroller"><button role="tab" aria-selected="true">June</button><button role="tab">July</button></div></div>',
    remediation:
      'Give the scroller role="presentation" so the tabs are still owned by the tablist, or drop the wrapper and move the overflow styling onto the tablist itself.',
    nodeCount: 1,
    status: "new",
    category: "aria",
  },
  {
    id: "A11Y-33",
    ruleId: "meta-viewport",
    title: "Viewport meta disables pinch zoom",
    description:
      "The viewport meta must not prevent text scaling and zooming. maximum-scale=1 with user-scalable=no stops low-vision users magnifying the page on iOS and Android.",
    impact: "critical",
    wcagLevel: "AA",
    criteria: ["1.4.4"],
    url: "https://blixen-tours.test/",
    selector: 'meta[name="viewport"]',
    html: '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">',
    remediation:
      'Reduce the content to "width=device-width, initial-scale=1". The zoom lock was added to hide horizontal overflow in the hero — fix the overflow with overflow-x:clip on the section instead.',
    nodeCount: 1,
    status: "confirmed",
    category: "structure",
  },
  {
    id: "A11Y-29",
    ruleId: "color-contrast",
    title: "Order-summary secondary text at 2.71:1",
    description:
      "Text must have a contrast ratio of at least 4.5:1 against its background. The muted total line measures 2.71:1 at 13px regular, and the same token repeats across 24 nodes.",
    impact: "high",
    wcagLevel: "AA",
    criteria: ["1.4.3"],
    url: "https://blixen-tours.test/checkout",
    selector: ".order-summary .muted-total",
    html: '<span class="muted-total">Incl. VAT &euro;69.60</span>',
    remediation:
      "Darken the muted foreground token one step (4.62:1 measured) or promote the line to 16px semibold so the 3:1 large-text threshold applies. Changing the token fixes all 24 nodes at once.",
    nodeCount: 24,
    status: "new",
    category: "contrast",
  },
  {
    id: "A11Y-46",
    ruleId: "link-name",
    title: "Footer social links have no discernible text",
    description:
      "Links must have discernible text. The four social links contain only an aria-hidden icon, so the accessible name computation yields an empty string.",
    impact: "high",
    wcagLevel: "A",
    criteria: ["2.4.4"],
    url: "https://blixen-tours.test/",
    selector: 'footer .social a[href*="instagram"]',
    html: '<a href="https://instagram.com/blixentours" class="social-link"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/></svg></a>',
    remediation:
      'Name each link for its destination — aria-label="Blixen Tours on Instagram" — rather than a generic "Instagram", so the link list read out of context stays useful.',
    nodeCount: 4,
    status: "fixed",
    category: "aria",
  },
  {
    id: "A11Y-53",
    ruleId: "tabindex",
    title: "Positive tabindex on the payment form",
    description:
      "Elements should not have a tabindex greater than zero. The checkout form hand-numbers 1, 2 and 3, which pulls those controls ahead of the site header in the tab order.",
    impact: "high",
    wcagLevel: "A",
    criteria: ["2.4.3"],
    url: "https://blixen-tours.test/checkout",
    selector: "#payment button.primary",
    html: '<button class="primary" tabindex="3">Pay &euro;348.00</button>',
    remediation:
      "Remove all three positive tabindex values and let DOM order drive focus. If the visual order differs from source order, reorder the markup rather than the tab sequence.",
    nodeCount: 3,
    status: "new",
    category: "keyboard",
  },
  {
    id: "A11Y-26",
    ruleId: "html-has-lang",
    title: "Confirmation page <html> has no lang attribute",
    description:
      "The <html> element must have a lang attribute so screen readers select the correct pronunciation dictionary. The Norwegian confirmation copy is currently read with an English voice.",
    impact: "high",
    wcagLevel: "A",
    criteria: ["3.1.1"],
    url: "https://blixen-tours.test/confirmation",
    selector: "html",
    html: '<html class="theme-light" data-locale="nb-NO">',
    remediation:
      'Render the locale into the attribute the browser actually reads: <html lang="nb-NO">. data-locale is app state and is invisible to assistive technology.',
    nodeCount: 1,
    status: "confirmed",
    category: "structure",
  },
  {
    id: "A11Y-58",
    ruleId: "frame-title",
    title: "Stripe card iframes have no title",
    description:
      "Frames must have an accessible name so a user can decide whether to enter them. Both payment iframes are announced only as \"frame\".",
    impact: "high",
    wcagLevel: "A",
    criteria: ["2.4.1"],
    url: "https://blixen-tours.test/checkout",
    selector: 'iframe[src^="https://js.stripe.com"]',
    html: '<iframe src="https://js.stripe.com/v3/elements-inner-card" allow="payment *" frameborder="0"></iframe>',
    remediation:
      'Pass a title through the Elements mount options (elements.create("card", { title: "Card details" })), or set title="Card details, secure payment frame" on the iframe after mount.',
    nodeCount: 2,
    status: "new",
    category: "media",
  },
  {
    id: "A11Y-49",
    ruleId: "listitem",
    title: "Itinerary <li> elements are not inside a list",
    description:
      "List items must be contained in a <ul>, <ol> or an element with role=list. Wrapped in a plain div, the eight itinerary days lose both the list semantics and the item count.",
    impact: "high",
    wcagLevel: "A",
    criteria: ["1.3.1"],
    url: "https://blixen-tours.test/tours/lofoten-night-sky",
    selector: ".itinerary > li",
    html: '<div class="itinerary"><li class="day">Day 1 &mdash; Arrival in Svolv&aelig;r</li><li class="day">Day 2 &mdash; Trollfjord crossing</li></div>',
    remediation:
      'The itinerary is ordered, so change the wrapper to <ol class="itinerary">. If the div must stay for layout reasons, role="list" on it restores the semantics.',
    nodeCount: 8,
    status: "new",
    category: "structure",
  },
  {
    id: "A11Y-55",
    ruleId: "scrollable-region-focusable",
    title: "Departure table scroller is unreachable by keyboard",
    description:
      "Scrollable regions must be keyboard accessible. The departure grid clips horizontally on viewports under 1100px and contains no focusable child, so keyboard-only users cannot read the clipped columns.",
    impact: "high",
    wcagLevel: "A",
    criteria: ["2.1.1"],
    url: "https://blixen-tours.test/tours",
    selector: ".departure-table__scroll",
    html: '<div class="departure-table__scroll" style="overflow-x:auto"><table id="departure-grid">&hellip;</table></div>',
    remediation:
      'Add tabindex="0" to the scroller plus role="region" and aria-label="Departure dates" so it is both focusable and announced when it receives focus.',
    nodeCount: 2,
    status: "new",
    category: "keyboard",
  },
  {
    id: "A11Y-61",
    ruleId: "td-headers-attr",
    title: "Booking table headers attribute points at a missing id",
    description:
      "Cells that use the headers attribute may only reference ids of cells inside the same table. col-total was renamed to col-amount in commit 8fe10c, so every price cell now resolves half its header list to nothing.",
    impact: "high",
    wcagLevel: "A",
    criteria: ["1.3.1"],
    url: "https://blixen-tours.test/bookings",
    selector: "#booking-table td[headers]",
    html: '<td headers="col-price col-total">&euro;348.00</td>',
    remediation:
      'Point the attribute at the surviving id (headers="col-amount") or, simpler for this flat grid, delete the headers attributes and put scope="col" on the header row.',
    nodeCount: 12,
    status: "confirmed",
    category: "structure",
  },
  {
    id: "A11Y-47",
    ruleId: "autocomplete-valid",
    title: 'Checkout uses autocomplete="zip", which is not a spec token',
    description:
      "The autocomplete attribute must use a token defined by the HTML specification. Invalid tokens are ignored wholesale, so browser and password-manager autofill silently stops working for the address block.",
    impact: "high",
    wcagLevel: "AA",
    criteria: ["1.3.5"],
    url: "https://blixen-tours.test/checkout",
    selector: 'form#payment input[name="postcode"]',
    html: '<input name="postcode" autocomplete="zip" class="field" inputmode="numeric">',
    remediation:
      'Use the spec tokens: autocomplete="postal-code" here, and "cc-name" rather than "name" on the cardholder field two rows above.',
    nodeCount: 3,
    status: "new",
    category: "forms",
  },
  {
    id: "A11Y-39",
    ruleId: "heading-order",
    title: "Heading level jumps from h2 to h4 in reviews",
    description:
      "Heading levels should increase by one at a time. The reviews section is marked h4 because of its visual size, which puts a gap in the document outline screen-reader users navigate by.",
    impact: "medium",
    wcagLevel: "A",
    criteria: ["1.3.1"],
    url: "https://blixen-tours.test/tours/lofoten-night-sky",
    selector: "section.reviews h4",
    html: '<h4 class="reviews__title">What travellers say</h4>',
    remediation:
      "Promote the title to <h3> and keep the small type by class. Choose the heading level from the outline, never from the font size.",
    nodeCount: 5,
    status: "new",
    category: "structure",
  },
  {
    id: "A11Y-44",
    ruleId: "region",
    title: "Newsletter block sits outside any landmark",
    description:
      "All page content should be contained by landmarks. The aurora-alerts signup renders after </main>, so it is unreachable when jumping between regions.",
    impact: "medium",
    wcagLevel: "A",
    criteria: ["1.3.1"],
    url: "https://blixen-tours.test/",
    selector: ".newsletter-signup",
    html: '<div class="newsletter-signup"><h2 id="newsletter-heading">Aurora alerts</h2><form>&hellip;</form></div>',
    remediation:
      'Wrap it in <section aria-labelledby="newsletter-heading"> so it becomes a named region, or move it inside <main> if it is page content rather than a site-wide aside.',
    nodeCount: 2,
    status: "wont-fix",
    category: "structure",
  },
  {
    id: "A11Y-52",
    ruleId: "focus-order-semantics",
    title: "Focusable span acts as the password-reset link",
    description:
      "An element in the focus order needs a role that describes what it does. This span is focusable and clickable but is announced as plain text, and it does not respond to Enter or Space.",
    impact: "low",
    wcagLevel: "A",
    criteria: ["2.4.3"],
    url: "https://blixen-tours.test/login",
    selector: '#login .forgot[tabindex="0"]',
    html: '<span class="forgot" tabindex="0" onclick="openReset()">Forgot password?</span>',
    remediation:
      'Use the real control: <button type="button" class="forgot">Forgot password?</button>. It gets the role, the keyboard activation and the focus ring for free.',
    nodeCount: 1,
    status: "new",
    category: "keyboard",
  },
  {
    id: "A11Y-35",
    ruleId: "duplicate-id-aria",
    title: "Cart rows repeat the id referenced by aria-labelledby",
    description:
      "Ids used in ARIA or label references must be unique. All three cart lines emit id=\"qty-label\", so every quantity stepper is labelled by the first row and the announcement is identical for each.",
    impact: "low",
    wcagLevel: "A",
    criteria: ["4.1.1"],
    url: "https://blixen-tours.test/cart",
    selector: "#qty-label",
    html: '<label id="qty-label">Travellers</label>',
    remediation:
      "Suffix the id with the cart line id (qty-label-8841) and update the matching aria-labelledby on each stepper. The row component already receives the item id as a prop.",
    nodeCount: 3,
    status: "new",
    category: "aria",
  },
];

export const A11Y_SUMMARY: A11ySummary = {
  score: 68,
  violations: 18,
  passes: 214,
  incomplete: 6,
  byLevel: { A: 15, AA: 3, AAA: 0 },
  byImpact: { critical: 5, high: 9, medium: 2, low: 2 },
  // Dips at #555 (the accessibility sweep that first surfaced the checkout form) and
  // again at #558, where the 91ac2f header rewrite dropped the cart button's label.
  trend: [
    { run: "#552", score: 74 },
    { run: "#553", score: 76 },
    { run: "#554", score: 79 },
    { run: "#555", score: 71 },
    { run: "#556", score: 77 },
    { run: "#557", score: 81 },
    { run: "#558", score: 68 },
  ],
};

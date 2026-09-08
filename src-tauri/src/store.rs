//! JSON persistence and the seeded starter dataset.
//!
//! The whole database is one document: it is small (a few hundred rows), it is
//! only ever read and written as a unit, and keeping it in one file makes the
//! desktop build inspectable with a text editor. Writes go through a temp file
//! plus rename so a crash mid-write can never leave a half-serialised store on
//! disk.

use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::AppResult;
use crate::models::*;

const DB_FILE: &str = "aether-db.json";

/// 2026-09-07T10:00:00Z — the instant the seeded dataset is anchored to, so the
/// relative "3h ago" labels the UI renders stay coherent with each other.
const SEED_EPOCH: u64 = 1_788_775_200;

/* ==========================================================================
   TIME — there is no chrono in the dependency set, and every timestamp that
   crosses the IPC boundary is an ISO-8601 string, so the two directions we
   actually need are hand-rolled.
   ======================================================================== */

/// Civil date from a Unix day number (Howard Hinnant's `civil_from_days`).
fn civil_from_days(days: i64) -> (i64, u32, u32) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    (if m <= 2 { y + 1 } else { y }, m, d)
}

pub fn iso_from_unix(secs: u64) -> String {
    let (year, month, day) = civil_from_days((secs / 86_400) as i64);
    let tod = secs % 86_400;
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        tod / 3600,
        (tod % 3600) / 60,
        tod % 60
    )
}

/// Wall-clock now, for records the user just created.
pub fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(SEED_EPOCH);
    iso_from_unix(secs)
}

/// Seeded timestamp, `minutes` before the demo epoch.
fn ago(minutes: u64) -> String {
    iso_from_unix(SEED_EPOCH.saturating_sub(minutes * 60))
}

/* ==========================================================================
   THE DATABASE
   ======================================================================== */

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Db {
    pub workspaces: Vec<Workspace>,
    pub folders: Vec<WorkspaceFolder>,
    pub suites: Vec<Suite>,
    pub cases: Vec<TestCase>,
    pub runs: Vec<TestRun>,
    pub flaky: Vec<FlakyTest>,
    pub findings: Vec<Finding>,
    pub a11y_issues: Vec<A11yIssue>,
    pub a11y_trend: Vec<ScorePoint>,
    pub security_issues: Vec<SecurityIssue>,
    pub security_headers: Vec<SecurityHeaderCheck>,
    pub perf_desktop: PerfSummary,
    pub perf_mobile: PerfSummary,
    pub baselines: Vec<VisualBaseline>,
    pub endpoints: Vec<ApiEndpoint>,
    pub scripts: Vec<ScriptEntry>,
    /// Keyed by `PageId::key()` — a JSON object cannot be keyed by an enum.
    pub dom_trees: HashMap<String, DomNode>,
    /// Keyed by DOM node id, mirroring `fixtures/browser.ts`.
    pub selectors: HashMap<String, Vec<SelectorCandidate>>,
}

impl Db {
    fn path(app: &AppHandle) -> AppResult<PathBuf> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| crate::error::AppError::Invalid(format!("no app data dir: {e}")))?;
        Ok(dir.join(DB_FILE))
    }

    /// A missing or corrupt store is not an error worth failing startup over —
    /// the seed is always a usable dataset, so log the reason and carry on.
    pub fn load(app: &AppHandle) -> Db {
        let path = match Self::path(app) {
            Ok(path) => path,
            Err(err) => {
                eprintln!("aether: cannot resolve the store path ({err}); using the seed");
                return Db::seed();
            }
        };
        match fs::read_to_string(&path) {
            Ok(raw) => match serde_json::from_str::<Db>(&raw) {
                Ok(db) => db,
                Err(err) => {
                    eprintln!("aether: {} is unreadable ({err}); using the seed", path.display());
                    Db::seed()
                }
            },
            Err(_) => Db::seed(),
        }
    }

    pub fn save(&self, app: &AppHandle) -> AppResult<()> {
        let path = Self::path(app)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        // Temp-then-rename: `fs::rename` replaces the destination on every
        // platform we ship, so readers never observe a truncated document.
        let temp = path.with_extension("json.tmp");
        fs::write(&temp, serde_json::to_vec_pretty(self)?)?;
        fs::rename(&temp, &path)?;
        Ok(())
    }
}

/* ==========================================================================
   SEED — a coherent starter dataset. Every cross-reference below resolves:
   suites point at real workspaces, cases at real suites, findings at real
   runs and cases. The Tauri adapter is a first-class data source, not a stub.
   ======================================================================== */

impl Db {
    pub fn seed() -> Db {
        let workspaces = seed_workspaces();
        let suites = seed_suites();
        let cases = seed_cases(&suites);
        let runs = seed_runs();
        let findings = seed_findings(&runs, &cases);
        Db {
            folders: seed_folders(),
            flaky: seed_flaky(&cases),
            a11y_issues: seed_a11y(),
            a11y_trend: (0..6)
                .map(|i| ScorePoint {
                    run: format!("#{}", 2286 + i),
                    score: 78 + (i * 3) % 11,
                })
                .collect(),
            security_issues: seed_security(),
            security_headers: seed_headers(),
            perf_desktop: seed_perf(Device::Desktop),
            perf_mobile: seed_perf(Device::Mobile),
            baselines: seed_baselines(&runs),
            endpoints: seed_endpoints(),
            scripts: seed_scripts(),
            dom_trees: seed_dom_trees(),
            selectors: seed_selectors(),
            workspaces,
            suites,
            cases,
            runs,
            findings,
        }
    }
}

fn owner(name: &str) -> WorkspaceOwner {
    WorkspaceOwner {
        name: name.to_owned(),
        avatar: name.chars().next().unwrap_or('A').to_uppercase().to_string(),
    }
}

fn seed_workspaces() -> Vec<Workspace> {
    // (id, name, path, framework, branch, category, folder, sessions, tests,
    //  health, minutes ago, owner, description)
    const ROWS: [(&str, &str, &str, &str, &str, &str, &str, u32, u32, u32, u64, &str, &str); 5] = [
        (
            "ws-001",
            "blixen-tours",
            "D:/work/blixen-tours",
            "Next.js 15",
            "main",
            "E-commerce",
            "Local Workspaces",
            42,
            186,
            72,
            18,
            "Ada Lovelace",
            "Nordic tour booking funnel. The checkout flow the agent regression-tests every night.",
        ),
        (
            "ws-002",
            "helios-admin",
            "D:/work/helios-admin",
            "React 19 + Vite",
            "develop",
            "Internal tools",
            "Local Workspaces",
            27,
            241,
            91,
            96,
            "Grace Hopper",
            "Operations console. Heavy on tables, permissions and CSV exports.",
        ),
        (
            "ws-003",
            "orbit-marketing",
            "github.com/aether/orbit-marketing",
            "Astro 5",
            "main",
            "Marketing",
            "GitHub Repositories",
            9,
            64,
            96,
            420,
            "Alan Turing",
            "Static marketing site. Visual regression and Core Web Vitals are the whole story here.",
        ),
        (
            "ws-004",
            "vault-api",
            "github.com/aether/vault-api",
            "Fastify 5",
            "release/2.4",
            "API",
            "GitHub Repositories",
            33,
            158,
            64,
            240,
            "Katherine Johnson",
            "Payments and secrets service. Contract drift and authz are the recurring failures.",
        ),
        (
            "ws-005",
            "legacy-portal",
            "D:/uploads/legacy-portal.zip",
            "jQuery 3",
            "snapshot",
            "Legacy",
            "Uploads",
            4,
            38,
            41,
            2_880,
            "Ada Lovelace",
            "Uploaded snapshot of the portal being replaced. Accessibility debt is the priority.",
        ),
    ];

    ROWS.iter()
        .enumerate()
        .map(|(i, r)| Workspace {
            id: r.0.to_owned(),
            name: r.1.to_owned(),
            path: r.2.to_owned(),
            framework: r.3.to_owned(),
            branch: r.4.to_owned(),
            sessions: r.7,
            tests: r.8,
            last_active: ago(r.10),
            health: r.9,
            description: r.12.to_owned(),
            dev_command: "npm run dev".to_owned(),
            test_command: "npm run test:e2e".to_owned(),
            git_url: r.2.starts_with("github.com").then(|| format!("https://{}", r.2)),
            category: r.5.to_owned(),
            thumbnail: format!("chart-{}", (i % 5) + 1),
            starred: Some(i < 2),
            owner: owner(r.11),
            folder: Some(r.6.to_owned()),
        })
        .collect()
}

fn seed_folders() -> Vec<WorkspaceFolder> {
    [
        ("folder-local", "Local Workspaces", "chart-1"),
        ("folder-github", "GitHub Repositories", "chart-2"),
        ("folder-uploads", "Uploads", "chart-4"),
    ]
    .iter()
    .map(|(id, name, token)| WorkspaceFolder {
        id: (*id).to_owned(),
        name: (*name).to_owned(),
        // Recounted on every read by `list_project_folders`, so the seeded
        // value only has to be right at rest.
        count: 0,
        color_token: (*token).to_owned(),
    })
    .collect()
}

fn seed_suites() -> Vec<Suite> {
    // (id, name, file, cases, pass rate, status, project, minutes ago, tags)
    const ROWS: [(&str, &str, &str, u32, u32, SuiteStatus, &str, u64, &str); 6] = [
        ("suite-checkout", "Checkout", "e2e/checkout.spec.ts", 5, 60, SuiteStatus::Failing, "ws-001", 18, "critical-path,payments"),
        ("suite-auth", "Authentication", "e2e/auth.spec.ts", 4, 100, SuiteStatus::Passing, "ws-001", 22, "critical-path,auth"),
        ("suite-search", "Tour search", "e2e/search.spec.ts", 3, 67, SuiteStatus::Flaky, "ws-001", 34, "search"),
        ("suite-cart", "Cart and pricing", "e2e/cart.spec.ts", 3, 100, SuiteStatus::Passing, "ws-001", 41, "pricing"),
        ("suite-a11y", "Accessibility sweep", "e2e/a11y.spec.ts", 3, 67, SuiteStatus::Flaky, "ws-005", 210, "a11y,wcag"),
        ("suite-api", "Vault API contract", "e2e/api.contract.spec.ts", 2, 50, SuiteStatus::Failing, "ws-004", 260, "api,contract"),
    ];

    ROWS.iter()
        .map(|r| Suite {
            id: r.0.to_owned(),
            name: r.1.to_owned(),
            file: r.2.to_owned(),
            cases: r.3,
            pass_rate: r.4,
            last_run: ago(r.7),
            status: r.5,
            project_id: Some(r.6.to_owned()),
            tags: Some(r.8.split(',').map(str::to_owned).collect()),
        })
        .collect()
}

fn seed_cases(suites: &[Suite]) -> Vec<TestCase> {
    // (id, suite, title, locator, status, duration ms, flake rate)
    const ROWS: [(&str, &str, &str, &str, TestStatus, u32, f64); 20] = [
        ("case-checkout-pay", "suite-checkout", "pays with the vault card and lands on /confirmation", "[data-testid='checkout-pay']", TestStatus::Failed, 12_480, 0.04),
        ("case-checkout-validate", "suite-checkout", "rejects an expired card with an inline error", "[data-testid='card-expiry']", TestStatus::Passed, 4_210, 0.0),
        ("case-checkout-3ds", "suite-checkout", "completes the 3-D Secure challenge", "iframe[name='3ds']", TestStatus::Flaky, 18_902, 0.22),
        ("case-checkout-total", "suite-checkout", "shows the tax-inclusive total before submit", "[data-testid='order-total']", TestStatus::Passed, 2_890, 0.0),
        ("case-checkout-empty", "suite-checkout", "blocks submit while required fields are empty", "form#payment", TestStatus::Failed, 3_140, 0.08),
        ("case-auth-login", "suite-auth", "signs in with a valid password", "[data-testid='login-submit']", TestStatus::Passed, 3_620, 0.0),
        ("case-auth-bad", "suite-auth", "shows exactly one error for a bad password", "[data-testid='login-error']", TestStatus::Passed, 2_410, 0.01),
        ("case-auth-reset", "suite-auth", "sends a reset mail exactly once", "[data-testid='reset-send']", TestStatus::Passed, 5_120, 0.0),
        ("case-auth-logout", "suite-auth", "clears the session cookie on logout", "[data-testid='nav-signout']", TestStatus::Passed, 1_980, 0.0),
        ("case-search-query", "suite-search", "finds the Lofoten Night Sky tour", "[data-testid='home-search']", TestStatus::Passed, 2_740, 0.03),
        ("case-search-empty", "suite-search", "renders the empty state for no matches", "[data-testid='search-empty']", TestStatus::Flaky, 3_310, 0.31),
        ("case-search-facets", "suite-search", "narrows results by the season facet", "[data-testid='facet-season']", TestStatus::Passed, 4_050, 0.02),
        ("case-cart-add", "suite-cart", "adds a tour and bumps the cart badge", "[data-testid='cart-badge']", TestStatus::Passed, 2_180, 0.0),
        ("case-cart-qty", "suite-cart", "recalculates the price for two travellers", "[data-testid='qty-input']", TestStatus::Passed, 3_460, 0.0),
        ("case-cart-remove", "suite-cart", "empties the cart and restores the CTA", "[data-testid='cart-remove']", TestStatus::Passed, 2_020, 0.0),
        ("case-a11y-contrast", "suite-a11y", "has no contrast violations on the landing page", "main", TestStatus::Failed, 6_740, 0.05),
        ("case-a11y-keyboard", "suite-a11y", "completes the funnel with the keyboard only", "body", TestStatus::Passed, 9_120, 0.06),
        ("case-a11y-landmarks", "suite-a11y", "exposes exactly one main landmark per page", "[role='main']", TestStatus::Skipped, 0, 0.0),
        ("case-api-schema", "suite-api", "POST /payments matches the documented schema", "response", TestStatus::Failed, 1_240, 0.0),
        ("case-api-authz", "suite-api", "rejects a cross-tenant order read with 403", "response", TestStatus::Passed, 980, 0.0),
    ];

    ROWS.iter()
        .map(|r| {
            let suite = suites.iter().find(|s| s.id == r.1);
            let file = suite
                .map(|s| s.file.clone())
                .unwrap_or_else(|| "e2e/unknown.spec.ts".to_owned());
            let project = suite.and_then(|s| s.project_id.clone());
            TestCase {
                id: r.0.to_owned(),
                title: r.2.to_owned(),
                suite_id: r.1.to_owned(),
                file,
                primary_locator: r.3.to_owned(),
                status: r.4,
                duration_ms: r.5,
                last_run: ago(18),
                owner: match project.as_deref() {
                    Some("ws-004") => "Katherine Johnson".to_owned(),
                    Some("ws-005") => "Alan Turing".to_owned(),
                    _ => "Ada Lovelace".to_owned(),
                },
                tags: r.1.trim_start_matches("suite-").split('-').map(str::to_owned).collect(),
                flake_rate: r.6,
                steps: seed_steps(r.2, r.3),
                assertions: seed_assertions(r.0, r.3),
                generated_by: Some(if r.6 > 0.2 { GeneratedBy::Agent } else { GeneratedBy::Human }),
            }
        })
        .collect()
}

fn seed_steps(title: &str, locator: &str) -> Vec<TestStep> {
    vec![
        TestStep {
            id: "step-1".to_owned(),
            index: 1,
            action: StepAction::Navigate,
            target: "https://blixen.tours".to_owned(),
            value: None,
            code: "await page.goto('https://blixen.tours')".to_owned(),
        },
        TestStep {
            id: "step-2".to_owned(),
            index: 2,
            action: StepAction::Click,
            target: locator.to_owned(),
            value: None,
            code: format!("await page.locator(\"{locator}\").click()"),
        },
        TestStep {
            id: "step-3".to_owned(),
            index: 3,
            action: StepAction::Assert,
            target: locator.to_owned(),
            value: Some(title.to_owned()),
            code: format!("await expect(page.locator(\"{locator}\")).toBeVisible()"),
        },
    ]
}

fn seed_assertions(case_id: &str, locator: &str) -> Vec<Assertion> {
    vec![
        Assertion {
            id: format!("{case_id}-a1"),
            kind: AssertionKind::Visible,
            target: locator.to_owned(),
            expected: "visible".to_owned(),
            soft: false,
        },
        Assertion {
            id: format!("{case_id}-a2"),
            kind: AssertionKind::Url,
            target: "page".to_owned(),
            expected: "/confirmation".to_owned(),
            soft: true,
        },
    ]
}

/* ==========================================================================
   RUNS
   ======================================================================== */

fn run_groups(passed: u32, failed: u32, flaky: u32, skipped: u32) -> Vec<RunGroup> {
    vec![
        RunGroup {
            title: "Passed".to_owned(),
            count: passed,
            desc: "assertions green, no retries".to_owned(),
            tone: Tone::Green,
        },
        RunGroup {
            title: "Failed".to_owned(),
            count: failed,
            desc: "hard assertion or navigation failure".to_owned(),
            tone: Tone::Red,
        },
        RunGroup {
            title: "Flaky".to_owned(),
            count: flaky,
            desc: "green only after a retry".to_owned(),
            tone: Tone::Amber,
        },
        RunGroup {
            title: "Skipped".to_owned(),
            count: skipped,
            desc: "filtered out or dependency skipped".to_owned(),
            tone: Tone::Neutral,
        },
    ]
}

fn seed_runs() -> Vec<TestRun> {
    // (id, name, branch, minutes ago, duration ms, passed, failed, flaky, skipped, project, trigger, commit, author)
    const ROWS: [(&str, &str, &str, u64, u64, u32, u32, u32, u32, &str, RunTrigger, &str, &str); 5] = [
        ("run-2291", "Nightly regression #2291", "main", 18, 742_000, 168, 6, 4, 8, "ws-001", RunTrigger::Schedule, "fix(checkout): drop the legacy submit test id", "Ada Lovelace"),
        ("run-2290", "PR #814 checkout locators", "feat/checkout-locators", 96, 512_000, 174, 2, 3, 7, "ws-001", RunTrigger::Ci, "refactor(checkout): move to getByRole locators", "Grace Hopper"),
        ("run-2289", "Agent exploration session", "main", 240, 318_000, 41, 3, 1, 0, "ws-001", RunTrigger::Agent, "chore: none (agent session ses-0142)", "aether-agent"),
        ("run-2288", "Vault API contract sweep", "release/2.4", 420, 96_000, 148, 8, 0, 2, "ws-004", RunTrigger::Ci, "feat(payments): add idempotency key", "Katherine Johnson"),
        ("run-2287", "Legacy portal a11y audit", "snapshot", 2_880, 214_000, 24, 11, 1, 2, "ws-005", RunTrigger::Manual, "chore: import legacy snapshot", "Alan Turing"),
    ];

    ROWS.iter()
        .map(|r| TestRun {
            id: r.0.to_owned(),
            name: r.1.to_owned(),
            branch: r.2.to_owned(),
            when: ago(r.3),
            duration: format!("{}m {:02}s", r.4 / 60_000, (r.4 % 60_000) / 1000),
            passed: r.5,
            failed: r.6,
            flaky: r.7,
            skipped: r.8,
            groups: run_groups(r.5, r.6, r.7, r.8),
            specs: seed_specs(r.5, r.6, r.7, r.8),
            project_id: Some(r.9.to_owned()),
            trigger: Some(r.10),
            engine: Some("Playwright 1.51 / Chromium 128".to_owned()),
            commit_message: Some(r.11.to_owned()),
            author: Some(r.12.to_owned()),
            status: Some(if r.6 > 0 {
                TestStatus::Failed
            } else if r.7 > 0 {
                TestStatus::Flaky
            } else {
                TestStatus::Passed
            }),
            started_at: Some(ago(r.3 + r.4 / 60_000)),
            duration_ms: Some(r.4),
        })
        .collect()
}

/// Spec rows are a presentation of the run totals, so they are derived from
/// them rather than duplicated — the two can never disagree.
fn seed_specs(passed: u32, failed: u32, flaky: u32, skipped: u32) -> Vec<RunSpec> {
    const FILES: [(&str, &str); 4] = [
        ("e2e/checkout.spec.ts", "checkout"),
        ("e2e/auth.spec.ts", "auth"),
        ("e2e/search.spec.ts", "search"),
        ("e2e/cart.spec.ts", "cart"),
    ];
    let plan = [
        (TestStatus::Failed, failed),
        (TestStatus::Flaky, flaky),
        (TestStatus::Skipped, skipped),
        (TestStatus::Passed, passed),
    ];

    let mut specs: Vec<RunSpec> = FILES
        .iter()
        .map(|(file, _)| RunSpec {
            file: (*file).to_owned(),
            tests: Vec::new(),
        })
        .collect();

    let mut slot = 0usize;
    for (status, count) in plan {
        // Cap the rendered rows: a 168-pass run does not need 168 spec lines to
        // read correctly, and the totals live on the run itself.
        for n in 0..count.min(6) {
            let (_, label) = FILES[slot % FILES.len()];
            specs[slot % FILES.len()].tests.push(RunSpecTest {
                name: format!("{label} › case {}", n + 1),
                status,
            });
            slot += 1;
        }
    }
    specs.retain(|spec| !spec.tests.is_empty());
    specs
}

fn seed_flaky(cases: &[TestCase]) -> Vec<FlakyTest> {
    const CAUSES: [&str; 4] = [
        "3-D Secure iframe attaches after the click handler binds",
        "search debounce races the assertion on a cold cache",
        "animation still running when the contrast probe samples",
        "shared fixture leaks a session cookie between workers",
    ];
    cases
        .iter()
        .filter(|case| case.flake_rate >= 0.02)
        .enumerate()
        .map(|(i, case)| FlakyTest {
            id: case.id.clone(),
            title: case.title.clone(),
            file: case.file.clone(),
            flake_rate: case.flake_rate,
            runs_affected: 2 + (i as u32 % 4) * 3,
            last_failure: ago(18 + (i as u64) * 96),
            suspected_cause: CAUSES[i % CAUSES.len()].to_owned(),
        })
        .collect()
}

/* ==========================================================================
   FINDINGS
   ======================================================================== */

fn seed_findings(runs: &[TestRun], cases: &[TestCase]) -> Vec<Finding> {
    // BUG-1842 is written out in full: it is the finding the scripted agent run
    // opens and the one the failure cockpit is designed around.
    let mut findings = vec![Finding {
        id: "BUG-1842".to_owned(),
        title: "Checkout submit button unresponsive".to_owned(),
        category: "Functional".to_owned(),
        severity: Severity::High,
        confidence: 94,
        status: FindingStatus::New,
        url: "https://blixen.tours/checkout".to_owned(),
        element: "button \"Pay EUR 348.00\"".to_owned(),
        expected: "click -> POST /api/payments -> 200 -> redirect to /confirmation".to_owned(),
        actual: "click -> POST /api/payments -> 200 -> no state transition, form still mounted"
            .to_owned(),
        rca: "The locator changed in commit 91ac2f. The spec targets button[data-testid='submit'] \
              but the component now renders button.primary without the test id, so the click lands \
              on the form wrapper and the submit handler never runs."
            .to_owned(),
        fix: "- await page.click('[data-testid=\"submit\"]')\n+ await page.getByRole('button', {\n+   name: 'Pay EUR 348.00'\n+ }).click()".to_owned(),
        commit: "91ac2f".to_owned(),
        related_tests: 7,
        run_id: Some("run-2291".to_owned()),
        suite_id: Some("suite-checkout".to_owned()),
        case_id: Some("case-checkout-pay".to_owned()),
        project_id: Some("ws-001".to_owned()),
        detected_at: Some(ago(17)),
        facts: Some(vec![
            "POST /api/payments returned 200 in 342ms.".to_owned(),
            "The URL stayed on /checkout for 5000ms after the click.".to_owned(),
            "GET /api/orders/latest returned 404 - no order row was created.".to_owned(),
            "The rendered submit is <button class=\"primary\"> with no data-testid attribute."
                .to_owned(),
        ]),
        inferences: Some(vec![
            "The 200 comes from the gateway pre-auth, not from an order being persisted.".to_owned(),
            "The click is absorbed by form#payment because the locator resolves to zero nodes."
                .to_owned(),
            "Restoring the test id - or switching to getByRole - fixes all 7 related specs."
                .to_owned(),
        ]),
        evidence: Some(vec![
            Evidence {
                id: "ev-1842-shot".to_owned(),
                kind: EvidenceKind::Screenshot,
                label: "checkout-stuck.png".to_owned(),
                src: Some("/mock/shots/checkout-stuck.png".to_owned()),
                captured_at: Some(ago(17)),
            },
            Evidence {
                id: "ev-1842-dom".to_owned(),
                kind: EvidenceKind::Dom,
                label: "form#payment outerHTML".to_owned(),
                src: None,
                captured_at: Some(ago(17)),
            },
            Evidence {
                id: "ev-1842-net".to_owned(),
                kind: EvidenceKind::Network,
                label: "payments.har (8 requests)".to_owned(),
                src: Some("/mock/har/run-2291.har".to_owned()),
                captured_at: Some(ago(17)),
            },
        ]),
    }];

    // (id, title, category, severity, status, confidence, case index)
    const ROWS: [(&str, &str, &str, Severity, FindingStatus, u32, usize); 11] = [
        ("BUG-1843", "Expired-card error renders twice", "Functional", Severity::Medium, FindingStatus::Confirmed, 88, 1),
        ("BUG-1844", "3-D Secure iframe never receives focus", "Functional", Severity::High, FindingStatus::New, 76, 2),
        ("BUG-1845", "Order total excludes VAT for NO addresses", "Data", Severity::Critical, FindingStatus::Confirmed, 97, 3),
        ("BUG-1846", "Submit stays enabled with empty required fields", "Validation", Severity::Medium, FindingStatus::New, 81, 4),
        ("BUG-1847", "Password reset sends two mails on double click", "Functional", Severity::Medium, FindingStatus::Fixed, 91, 7),
        ("BUG-1848", "Search empty state flashes before results", "UX", Severity::Low, FindingStatus::WontFix, 63, 10),
        ("BUG-1849", "Season facet loses selection on back navigation", "Functional", Severity::Medium, FindingStatus::New, 84, 11),
        ("BUG-1850", "Cart badge lags one click behind", "Functional", Severity::Low, FindingStatus::FalsePositive, 52, 12),
        ("BUG-1851", "Landing hero text fails 4.5:1 contrast", "Accessibility", Severity::High, FindingStatus::Confirmed, 99, 15),
        ("BUG-1852", "POST /payments returns an undocumented 409", "API", Severity::High, FindingStatus::New, 89, 18),
        ("BUG-1853", "Session cookie missing the Secure attribute", "Security", Severity::Critical, FindingStatus::Confirmed, 95, 8),
    ];

    findings.extend(ROWS.iter().enumerate().map(|(i, r)| {
        let case = cases.get(r.6);
        let run = &runs[i % runs.len()];
        Finding {
            id: r.0.to_owned(),
            title: r.1.to_owned(),
            category: r.2.to_owned(),
            severity: r.3,
            confidence: r.5,
            status: r.4,
            url: format!("https://blixen.tours/{}", r.2.to_lowercase()),
            element: case
                .map(|c| c.primary_locator.clone())
                .unwrap_or_else(|| "body".to_owned()),
            expected: case
                .map(|c| format!("{} - assertion holds", c.title))
                .unwrap_or_else(|| "assertion holds".to_owned()),
            actual: format!("{} - observed on {}", r.1, run.branch),
            rca: format!(
                "Reproduced in {} on {}. The agent narrowed it to the {} layer after re-resolving \
                 the locator and replaying the request.",
                run.id, run.branch, r.2
            ),
            fix: format!(
                "- // {}\n+ // patched by the agent: {}",
                r.1,
                r.1.to_lowercase()
            ),
            commit: run
                .commit_message
                .as_deref()
                .unwrap_or("unknown")
                .chars()
                .take(6)
                .collect(),
            related_tests: 1 + (i as u32 % 5),
            run_id: Some(run.id.clone()),
            suite_id: case.map(|c| c.suite_id.clone()),
            case_id: case.map(|c| c.id.clone()),
            project_id: run.project_id.clone(),
            detected_at: Some(ago(20 + (i as u64) * 47)),
            facts: Some(vec![
                format!("The assertion failed in {} on {}.", run.id, run.branch),
                format!("Confidence {}% from {} corroborating signals.", r.5, 2 + i % 3),
            ]),
            inferences: Some(vec![format!(
                "The {} regression is the most probable cause; {} related specs share the locator.",
                r.2.to_lowercase(),
                1 + (i % 5)
            )]),
            evidence: Some(vec![Evidence {
                id: format!("ev-{}-shot", r.0.to_lowercase()),
                kind: EvidenceKind::Screenshot,
                label: format!("{}.png", r.0.to_lowercase()),
                src: Some(format!("/mock/shots/{}.png", r.0.to_lowercase())),
                captured_at: Some(ago(20 + (i as u64) * 47)),
            }]),
        }
    }));

    findings
}

/* ==========================================================================
   ACCESSIBILITY
   ======================================================================== */

fn seed_a11y() -> Vec<A11yIssue> {
    // (id, rule, title, impact, level, criteria, category, nodes, status)
    const ROWS: [(&str, &str, &str, Severity, WcagLevel, &str, &str, u32, FindingStatus); 8] = [
        ("A11Y-401", "color-contrast", "Hero heading contrast is 3.1:1", Severity::High, WcagLevel::Aa, "1.4.3", "contrast", 4, FindingStatus::Confirmed),
        ("A11Y-402", "button-name", "Icon-only cart button has no accessible name", Severity::Critical, WcagLevel::A, "4.1.2,2.4.4", "aria", 1, FindingStatus::New),
        ("A11Y-403", "label", "Card CVV input has no associated label", Severity::Critical, WcagLevel::A, "1.3.1,3.3.2", "forms", 1, FindingStatus::New),
        ("A11Y-404", "landmark-one-main", "Checkout renders two main landmarks", Severity::Medium, WcagLevel::Aa, "1.3.1", "structure", 2, FindingStatus::Confirmed),
        ("A11Y-405", "focus-order-semantics", "Tab order jumps past the payment fieldset", Severity::High, WcagLevel::Aa, "2.4.3", "keyboard", 6, FindingStatus::New),
        ("A11Y-406", "image-alt", "Tour card images have empty alt text", Severity::Medium, WcagLevel::A, "1.1.1", "media", 9, FindingStatus::Confirmed),
        ("A11Y-407", "aria-required-children", "Facet list uses role=list without listitem children", Severity::Low, WcagLevel::A, "1.3.1", "aria", 3, FindingStatus::WontFix),
        ("A11Y-408", "heading-order", "Legacy portal skips from h1 to h4", Severity::Low, WcagLevel::Aaa, "1.3.1,2.4.6", "structure", 11, FindingStatus::New),
    ];

    ROWS.iter()
        .map(|r| A11yIssue {
            id: r.0.to_owned(),
            rule_id: r.1.to_owned(),
            title: r.2.to_owned(),
            description: format!(
                "axe-core rule `{}` reported {} node(s). {}",
                r.1, r.7, r.2
            ),
            impact: r.3,
            wcag_level: r.4,
            criteria: r.5.split(',').map(str::to_owned).collect(),
            url: "https://blixen.tours/checkout".to_owned(),
            selector: format!("[data-axe='{}']", r.1),
            html: format!("<div class=\"{}\">…</div>", r.6),
            remediation: format!(
                "Fix the {} violation reported by `{}` on all {} node(s).",
                r.6, r.1, r.7
            ),
            node_count: r.7,
            status: r.8,
            category: r.6.to_owned(),
        })
        .collect()
}

/* ==========================================================================
   SECURITY
   ======================================================================== */

fn seed_security() -> Vec<SecurityIssue> {
    // (id, title, category, severity, cvss, cwe, minutes ago, status)
    const ROWS: [(&str, &str, &str, Severity, f64, &str, u64, FindingStatus); 6] = [
        ("SEC-201", "Session cookie missing Secure and SameSite", "transport", Severity::Critical, 8.1, "CWE-614", 22, FindingStatus::Confirmed),
        ("SEC-202", "Content-Security-Policy header absent", "headers", Severity::High, 6.5, "CWE-693", 22, FindingStatus::New),
        ("SEC-203", "Stripe test key committed in the client bundle", "secrets", Severity::High, 7.5, "CWE-798", 96, FindingStatus::Confirmed),
        ("SEC-204", "Order read allows a cross-tenant id", "authz", Severity::Critical, 9.1, "CWE-639", 240, FindingStatus::New),
        ("SEC-205", "Login endpoint has no rate limit", "auth", Severity::Medium, 5.3, "CWE-307", 420, FindingStatus::Confirmed),
        ("SEC-206", "Search reflects unescaped query in the DOM", "injection", Severity::Medium, 6.1, "CWE-79", 2_880, FindingStatus::Fixed),
    ];

    ROWS.iter()
        .map(|r| SecurityIssue {
            id: r.0.to_owned(),
            title: r.1.to_owned(),
            category: r.2.to_owned(),
            severity: r.3,
            cvss: Some(r.4),
            cwe: Some(r.5.to_owned()),
            url: "https://blixen.tours".to_owned(),
            evidence: format!("Observed while scanning the {} surface: {}", r.2, r.1),
            remediation: format!("Remediate {} ({}) before the next release.", r.5, r.2),
            status: r.7,
            detected_at: ago(r.6),
        })
        .collect()
}

fn seed_headers() -> Vec<SecurityHeaderCheck> {
    // (header, present, value, expected, severity)
    const ROWS: [(&str, bool, &str, &str, Severity); 6] = [
        ("Content-Security-Policy", false, "", "default-src 'self'", Severity::High),
        ("Strict-Transport-Security", true, "max-age=15552000", "max-age>=31536000; includeSubDomains", Severity::Medium),
        ("X-Content-Type-Options", true, "nosniff", "nosniff", Severity::Low),
        ("X-Frame-Options", false, "", "DENY", Severity::Medium),
        ("Referrer-Policy", true, "no-referrer-when-downgrade", "strict-origin-when-cross-origin", Severity::Low),
        ("Permissions-Policy", false, "", "geolocation=(), camera=()", Severity::Low),
    ];

    ROWS.iter()
        .map(|r| SecurityHeaderCheck {
            header: r.0.to_owned(),
            present: r.1,
            value: r.1.then(|| r.2.to_owned()),
            expected: r.3.to_owned(),
            severity: r.4,
        })
        .collect()
}

/* ==========================================================================
   PERFORMANCE
   ======================================================================== */

fn seed_perf(device: Device) -> PerfSummary {
    // Mobile is the throttled profile, so every timing is scaled and the score
    // drops accordingly — one table, two coherent reports.
    let scale = if matches!(device, Device::Mobile) { 2.4 } else { 1.0 };

    // (id, label, value, unit, budget, delta)
    const ROWS: [(PerfMetricId, &str, f64, MetricUnit, f64, f64); 6] = [
        (PerfMetricId::Lcp, "Largest Contentful Paint", 2_180.0, MetricUnit::Ms, 2_500.0, -140.0),
        (PerfMetricId::Cls, "Cumulative Layout Shift", 0.06, MetricUnit::Score, 0.1, 0.01),
        (PerfMetricId::Inp, "Interaction to Next Paint", 240.0, MetricUnit::Ms, 200.0, 38.0),
        (PerfMetricId::Fcp, "First Contentful Paint", 1_120.0, MetricUnit::Ms, 1_800.0, -60.0),
        (PerfMetricId::Ttfb, "Time to First Byte", 410.0, MetricUnit::Ms, 800.0, 24.0),
        (PerfMetricId::Tbt, "Total Blocking Time", 310.0, MetricUnit::Ms, 200.0, 74.0),
    ];

    let metrics: Vec<PerfMetric> = ROWS
        .iter()
        .map(|r| {
            // CLS is unitless, so it must not be scaled by the device profile.
            let unitless = matches!(r.3, MetricUnit::Score);
            let value = if unitless { r.2 } else { r.2 * scale };
            PerfMetric {
                id: r.0,
                label: r.1.to_owned(),
                value: (value * 100.0).round() / 100.0,
                unit: r.3,
                budget: r.4,
                rating: if value <= r.4 {
                    PerfRating::Good
                } else if value <= r.4 * 1.6 {
                    PerfRating::NeedsImprovement
                } else {
                    PerfRating::Poor
                },
                delta: r.5,
                history: (0..6)
                    .map(|i| MetricPoint {
                        run: format!("#{}", 2286 + i),
                        value: (value * (0.9 + (i as f64) * 0.035) * 100.0).round() / 100.0,
                    })
                    .collect(),
            }
        })
        .collect();

    // (url, type, size, transfer, duration, start, blocking, cached)
    const RES: [(&str, ResourceType, u64, u64, u32, u32, bool, bool); 7] = [
        ("/", ResourceType::Document, 18_432, 6_140, 182, 0, true, false),
        ("/_next/static/chunks/main.js", ResourceType::Script, 284_120, 92_480, 341, 190, true, false),
        ("/_next/static/css/app.css", ResourceType::Stylesheet, 61_204, 12_880, 96, 190, true, true),
        ("/fonts/inter-var.woff2", ResourceType::Font, 48_920, 48_920, 74, 240, false, true),
        ("/img/lofoten-hero.avif", ResourceType::Image, 412_880, 412_880, 612, 260, false, false),
        ("/api/tours", ResourceType::Xhr, 7_204, 2_140, 96, 210, false, false),
        ("/api/pricing", ResourceType::Xhr, 1_840, 940, 61, 520, false, false),
    ];

    let resources: Vec<ResourceEntry> = RES
        .iter()
        .enumerate()
        .map(|(i, r)| ResourceEntry {
            id: format!("res-{:02}", i + 1),
            url: r.0.to_owned(),
            kind: r.1,
            size_bytes: r.2,
            transfer_bytes: r.3,
            duration_ms: (r.4 as f64 * scale) as u32,
            start_ms: r.5,
            blocking: r.6,
            cached: r.7,
        })
        .collect();

    let over_budget = metrics
        .iter()
        .filter(|m| !matches!(m.rating, PerfRating::Good))
        .count() as u32;

    PerfSummary {
        score: 96_u32.saturating_sub(over_budget * 9 + if scale > 1.0 { 18 } else { 0 }),
        url: "https://blixen.tours".to_owned(),
        device,
        metrics,
        resources,
        opportunities: vec![
            PerfOpportunity {
                title: "Defer the analytics bundle".to_owned(),
                savings_ms: 420,
                detail: "main.js blocks the first paint for 341ms; 92kB of it is analytics.".to_owned(),
            },
            PerfOpportunity {
                title: "Serve the hero image at the rendered size".to_owned(),
                savings_ms: 310,
                detail: "lofoten-hero.avif is 2560px wide and renders at 1280px.".to_owned(),
            },
            PerfOpportunity {
                title: "Reserve space for the pricing widget".to_owned(),
                savings_ms: 0,
                detail: "The late /api/pricing response is the whole CLS contribution.".to_owned(),
            },
        ],
        last_run: ago(18),
    }
}

/* ==========================================================================
   VISUAL REGRESSION
   ======================================================================== */

fn seed_baselines(runs: &[TestRun]) -> Vec<VisualBaseline> {
    const VIEWPORTS: [(&str, u32, u32); 3] = [
        ("Desktop 1440", 1_440, 900),
        ("Tablet 834", 834, 1_112),
        ("Mobile 390", 390, 844),
    ];
    // (id, name, target, status, change kind, diff percent, pixels)
    const ROWS: [(&str, &str, &str, BaselineStatus, ChangeKind, f64, u32); 8] = [
        ("vis-001", "Landing hero", "/", BaselineStatus::Changed, ChangeKind::Changed, 4.82, 62_140),
        ("vis-002", "Tour grid", "/tours", BaselineStatus::Approved, ChangeKind::None, 0.0, 0),
        ("vis-003", "Checkout form", "/checkout", BaselineStatus::Changed, ChangeKind::Moved, 1.94, 18_420),
        ("vis-004", "Confirmation panel", "/confirmation", BaselineStatus::New, ChangeKind::Added, 100.0, 1_296_000),
        ("vis-005", "Sign-in dialog", "[data-testid='login-dialog']", BaselineStatus::Pending, ChangeKind::Changed, 0.61, 5_240),
        ("vis-006", "Cart drawer", "[data-testid='cart-drawer']", BaselineStatus::Approved, ChangeKind::None, 0.0, 0),
        ("vis-007", "Footer", "footer", BaselineStatus::Pending, ChangeKind::Moved, 0.18, 1_940),
        ("vis-008", "Legacy portal shell", "/portal", BaselineStatus::Changed, ChangeKind::Removed, 12.4, 214_800),
    ];

    ROWS.iter()
        .enumerate()
        .map(|(i, r)| {
            let (label, width, height) = VIEWPORTS[i % VIEWPORTS.len()];
            VisualBaseline {
                id: r.0.to_owned(),
                name: r.1.to_owned(),
                target: r.2.to_owned(),
                viewport: ViewportSpec {
                    label: label.to_owned(),
                    width,
                    height,
                },
                branch: "main".to_owned(),
                status: r.3,
                diff_percent: r.5,
                pixels_changed: r.6,
                change_kind: r.4,
                baseline_src: format!("/mock/visual/{}-base.png", r.0),
                actual_src: format!("/mock/visual/{}-actual.png", r.0),
                diff_src: format!("/mock/visual/{}-diff.png", r.0),
                mask_selectors: vec!["[data-testid='session-clock']".to_owned()],
                threshold: 0.5,
                updated_at: ago(18 + (i as u64) * 30),
                run_id: runs.first().map(|run| run.id.clone()),
            }
        })
        .collect()
}

/* ==========================================================================
   API INTELLIGENCE
   ======================================================================== */

fn seed_endpoints() -> Vec<ApiEndpoint> {
    // (id, method, path, via, auth, statuses, calls, p50, p95, error rate)
    const ROWS: [(&str, HttpMethod, &str, DiscoveredVia, bool, &str, u32, u32, u32, f64); 7] = [
        ("api-001", HttpMethod::Post, "/api/payments", DiscoveredVia::Traffic, true, "200,409,422", 1_284, 342, 910, 0.043),
        ("api-002", HttpMethod::Get, "/api/orders/latest", DiscoveredVia::Openapi, true, "200,404", 942, 61, 180, 0.118),
        ("api-003", HttpMethod::Get, "/api/tours", DiscoveredVia::Openapi, false, "200", 8_410, 96, 210, 0.0),
        ("api-004", HttpMethod::Post, "/api/auth/login", DiscoveredVia::Openapi, false, "200,401,429", 3_120, 148, 402, 0.061),
        ("api-005", HttpMethod::Patch, "/api/cart/{id}", DiscoveredVia::Traffic, true, "200,404", 2_048, 88, 240, 0.012),
        ("api-006", HttpMethod::Delete, "/api/sessions", DiscoveredVia::Manual, true, "204,401", 610, 42, 96, 0.0),
        ("api-007", HttpMethod::Get, "/api/pricing", DiscoveredVia::Traffic, false, "200,500", 5_204, 61, 620, 0.021),
    ];

    ROWS.iter()
        .map(|r| {
            let drifted = matches!(r.3, DiscoveredVia::Traffic);
            ApiEndpoint {
                id: r.0.to_owned(),
                method: r.1,
                path: r.2.to_owned(),
                discovered_via: r.3,
                auth_required: r.4,
                observed_statuses: r.5.split(',').filter_map(|s| s.parse().ok()).collect(),
                call_count: r.6,
                p50_ms: r.7,
                p95_ms: r.8,
                error_rate: r.9,
                request_schema: vec![
                    ApiSchemaField {
                        name: "amount".to_owned(),
                        kind: "integer".to_owned(),
                        required: true,
                        drift: None,
                        documented_type: None,
                    },
                    ApiSchemaField {
                        name: "idempotencyKey".to_owned(),
                        kind: "string".to_owned(),
                        required: false,
                        drift: drifted.then_some(SchemaDrift::Extra),
                        documented_type: None,
                    },
                ],
                response_schema: vec![
                    ApiSchemaField {
                        name: "id".to_owned(),
                        kind: "string".to_owned(),
                        required: true,
                        drift: None,
                        documented_type: None,
                    },
                    ApiSchemaField {
                        name: "status".to_owned(),
                        kind: "string".to_owned(),
                        required: true,
                        drift: drifted.then_some(SchemaDrift::TypeChanged),
                        documented_type: drifted.then(|| "integer".to_owned()),
                    },
                ],
                issues: if r.9 > 0.02 {
                    vec![ApiIssue {
                        id: format!("{}-i1", r.0),
                        detector: "api.contract_drift".to_owned(),
                        severity: if r.9 > 0.1 { Severity::High } else { Severity::Medium },
                        summary: format!("{} returns undocumented statuses", r.2),
                        detail: format!(
                            "Observed {} across {} calls with a {:.1}% error rate.",
                            r.5,
                            r.6,
                            r.9 * 100.0
                        ),
                    }]
                } else {
                    Vec::new()
                },
                last_seen: ago(18),
                tags: vec![r.2.split('/').nth(2).unwrap_or("api").to_owned()],
            }
        })
        .collect()
}

/* ==========================================================================
   SCRIPT LIBRARY
   ======================================================================== */

fn seed_scripts() -> Vec<ScriptEntry> {
    // (id, name, kind, language, description, code)
    const ROWS: [(&str, &str, ScriptKind, ScriptLanguage, &str, &str); 5] = [
        (
            "scr-001",
            "checkout.pay",
            ScriptKind::Step,
            ScriptLanguage::Typescript,
            "Fills the payment form from the workspace vault and submits it.",
            "export async function pay(page: Page, card: VaultCard) {\n  await page.getByLabel('Cardholder').fill(card.holder);\n  await page.getByLabel('Card number').fill(card.number);\n  await page.getByRole('button', { name: /^Pay/ }).click();\n}",
        ),
        (
            "scr-002",
            "CheckoutPage",
            ScriptKind::PageObject,
            ScriptLanguage::Typescript,
            "Page object for /checkout, anchored on role locators rather than test ids.",
            "export class CheckoutPage {\n  constructor(private page: Page) {}\n  total() {\n    return this.page.getByTestId('order-total');\n  }\n}",
        ),
        (
            "scr-003",
            "vault-card",
            ScriptKind::Fixture,
            ScriptLanguage::Typescript,
            "Test card fixture that never leaves a real PAN in the trace.",
            "export const vaultCard = {\n  holder: 'Ada Lovelace',\n  number: '4242424242424242',\n  cvv: '***',\n};",
        ),
        (
            "scr-004",
            "assert_contract",
            ScriptKind::Api,
            ScriptLanguage::Python,
            "Compares an observed response against the documented OpenAPI schema.",
            "def assert_contract(observed, schema):\n    missing = schema.keys() - observed.keys()\n    assert not missing, f'missing fields: {missing}'",
        ),
        (
            "scr-005",
            "explore-funnel",
            ScriptKind::Skill,
            ScriptLanguage::Typescript,
            "Agent skill: crawl a funnel, collect interactive elements, rank locators.",
            "export const skill = {\n  name: 'explore-funnel',\n  async run(ctx: AgentContext) {\n    await ctx.crawl({ depth: 3, follow: 'nav a' });\n    return ctx.rankLocators();\n  },\n};",
        ),
    ];

    ROWS.iter()
        .enumerate()
        .map(|(i, r)| ScriptEntry {
            id: r.0.to_owned(),
            name: r.1.to_owned(),
            kind: r.2,
            language: r.3,
            description: r.4.to_owned(),
            params: vec![ScriptParam {
                name: "page".to_owned(),
                kind: ParamType::String,
                required: true,
                default: None,
                description: Some("Playwright page handle or URL under test.".to_owned()),
            }],
            tags: vec!["checkout".to_owned(), "generated".to_owned()],
            version: 2 + i as u32,
            usage_count: 4 + (i as u32) * 11,
            code: r.5.to_owned(),
            source_ref: Some("ses-0142".to_owned()),
            source_kind: Some(if i % 2 == 0 {
                SourceKind::Generated
            } else {
                SourceKind::Extracted
            }),
            versions: (1..=2 + i as u32)
                .map(|v| ScriptVersion {
                    version: v,
                    created_at: ago(60 * (3 + i as u64) - (v as u64) * 30),
                    author: if v == 1 { "Ada Lovelace" } else { "aether-agent" }.to_owned(),
                    note: if v == 1 {
                        "initial extraction".to_owned()
                    } else {
                        format!("v{v}: switched to role locators")
                    },
                    diff: format!("- v{}\n+ v{}", v.saturating_sub(1).max(1), v),
                })
                .collect(),
            updated_at: ago(30 * (1 + i as u64)),
        })
        .collect()
}

/* ==========================================================================
   BROWSER / INSPECTOR — the fake site the agent drives. Node `id`s are the
   contract between the rendered page, `BrowserState.highlight` and the
   selector candidates below, so they are bare ids, never CSS.
   ======================================================================== */

fn el(tag: &str, attrs: &str, children: Vec<DomNode>) -> DomNode {
    DomNode {
        tag: tag.to_owned(),
        attrs: (!attrs.is_empty()).then(|| attrs.to_owned()),
        id: None,
        children: Some(children),
    }
}

fn leaf(tag: &str, attrs: &str, id: &str) -> DomNode {
    DomNode {
        tag: tag.to_owned(),
        attrs: (!attrs.is_empty()).then(|| attrs.to_owned()),
        id: (!id.is_empty()).then(|| id.to_owned()),
        children: None,
    }
}

fn page(body: Vec<DomNode>) -> DomNode {
    el("html", "lang=\"en\"", vec![el("body", "", body)])
}

fn seed_dom_trees() -> HashMap<String, DomNode> {
    let nav = el(
        "header",
        "class=\"site-nav\"",
        vec![
            leaf("a", "class=\"logo\"", ""),
            el(
                "nav",
                "",
                vec![
                    leaf("a", "href=\"/tours\"", "nav-tours"),
                    leaf("a", "href=\"/about\"", "nav-about"),
                ],
            ),
            leaf("button", "class=\"btn-dark\"", "nav-signin"),
        ],
    );

    let mut trees = HashMap::new();
    trees.insert(PageId::Blank.key().to_owned(), page(Vec::new()));
    trees.insert(
        PageId::Loading.key().to_owned(),
        page(vec![leaf("div", "class=\"splash\"", "splash")]),
    );
    trees.insert(
        PageId::Home.key().to_owned(),
        page(vec![
            nav.clone(),
            el(
                "main",
                "",
                vec![
                    el(
                        "section",
                        "class=\"hero\"",
                        vec![
                            leaf("h1", "", ""),
                            leaf("input", "type=\"search\"", "home-search"),
                            leaf("button", "class=\"btn-primary\"", "home-go"),
                        ],
                    ),
                    el(
                        "section",
                        "class=\"tours\"",
                        vec![
                            leaf("article", "data-tour=\"lofoten\"", "tour-lofoten"),
                            leaf("article", "data-tour=\"fjords\"", "tour-fjords"),
                            leaf("article", "data-tour=\"aurora\"", "tour-aurora"),
                        ],
                    ),
                ],
            ),
        ]),
    );
    trees.insert(
        PageId::Login.key().to_owned(),
        page(vec![
            nav.clone(),
            el(
                "main",
                "",
                vec![el(
                    "form",
                    "id=\"login\"",
                    vec![
                        leaf("input", "type=\"email\"", "login-email"),
                        leaf("input", "type=\"password\"", "login-password"),
                        leaf("button", "type=\"submit\"", "login-submit"),
                    ],
                )],
            ),
        ]),
    );
    trees.insert(
        PageId::Checkout.key().to_owned(),
        page(vec![
            nav.clone(),
            el(
                "main",
                "",
                vec![
                    el(
                        "form",
                        "id=\"payment\"",
                        vec![
                            leaf("input", "name=\"name\"", "checkout-name"),
                            leaf("input", "name=\"card\"", "checkout-card"),
                            leaf("input", "name=\"expiry\"", "checkout-expiry"),
                            leaf("input", "name=\"cvv\"", "checkout-cvv"),
                            // The regression BUG-1842 describes: the submit no
                            // longer carries its data-testid.
                            leaf("button", "class=\"primary\"", "pay-submit"),
                        ],
                    ),
                    leaf("aside", "class=\"summary\"", "order-total"),
                ],
            ),
        ]),
    );
    trees.insert(
        PageId::Confirm.key().to_owned(),
        page(vec![
            nav,
            el(
                "main",
                "",
                vec![
                    leaf("h1", "class=\"confirmed\"", "confirm-heading"),
                    leaf("p", "class=\"reference\"", "confirm-reference"),
                ],
            ),
        ]),
    );
    trees
}

fn seed_selectors() -> HashMap<String, Vec<SelectorCandidate>> {
    // (node id, test id, role, accessible name, css, test id still present)
    const ROWS: [(&str, &str, &str, &str, &str, bool); 11] = [
        ("pay-submit", "checkout-pay", "button", "Pay EUR 348.00", "form#payment button.primary", false),
        ("checkout-card", "card-number", "textbox", "Card number", "input[name='card']", true),
        ("checkout-expiry", "card-expiry", "textbox", "Expiry", "input[name='expiry']", true),
        ("checkout-cvv", "card-cvv", "textbox", "CVV", "input[name='cvv']", true),
        ("order-total", "order-total", "status", "Order total", "aside.summary", true),
        ("login-email", "login-email", "textbox", "Email", "input[type='email']", true),
        ("login-password", "login-password", "textbox", "Password", "input[type='password']", true),
        ("login-submit", "login-submit", "button", "Sign in", "form#login button[type='submit']", true),
        ("nav-signin", "nav-signin", "button", "Sign in", "header.site-nav button.btn-dark", true),
        ("nav-tours", "nav-tours", "link", "Tours", "a[href='/tours']", true),
        ("home-search", "home-search", "searchbox", "Search tours", "input[type='search']", true),
    ];

    ROWS.iter()
        .map(|r| {
            // Ordered by stability descending: a test id survives a refactor,
            // an xpath survives nothing.
            let candidates = vec![
                SelectorCandidate {
                    selector: format!("[data-testid=\"{}\"]", r.1),
                    strategy: SelectorStrategy::Testid,
                    stability: 97,
                    // Ranked high as a *strategy* even when the attribute is
                    // gone from the component — that gap is the finding.
                    unique: r.5,
                },
                SelectorCandidate {
                    selector: format!("getByRole(\"{}\", {{ name: \"{}\" }})", r.2, r.3),
                    strategy: SelectorStrategy::Role,
                    stability: 84,
                    unique: true,
                },
                SelectorCandidate {
                    selector: format!("getByLabel(\"{}\")", r.3),
                    strategy: SelectorStrategy::Label,
                    stability: 76,
                    unique: true,
                },
                SelectorCandidate {
                    selector: r.4.to_owned(),
                    strategy: SelectorStrategy::Css,
                    stability: 52,
                    unique: true,
                },
                SelectorCandidate {
                    selector: format!("//*[@id=\"{}\"]", r.0),
                    strategy: SelectorStrategy::Xpath,
                    stability: 16,
                    unique: true,
                },
            ];
            (r.0.to_owned(), candidates)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_epoch_formats_to_the_demo_instant() {
        assert_eq!(iso_from_unix(SEED_EPOCH), "2026-09-07T10:00:00Z");
    }

    #[test]
    fn seed_cross_references_resolve() {
        let db = Db::seed();
        assert!(!db.workspaces.is_empty() && !db.findings.is_empty());
        for case in &db.cases {
            assert!(db.suites.iter().any(|s| s.id == case.suite_id), "orphan case {}", case.id);
        }
        for suite in &db.suites {
            let project = suite.project_id.as_deref().unwrap_or_default();
            assert!(db.workspaces.iter().any(|w| w.id == project), "orphan suite {}", suite.id);
        }
        for finding in &db.findings {
            let run = finding.run_id.as_deref().unwrap_or_default();
            assert!(db.runs.iter().any(|r| r.id == run), "orphan finding {}", finding.id);
            if let Some(case_id) = finding.case_id.as_deref() {
                assert!(db.cases.iter().any(|c| c.id == case_id), "dangling case on {}", finding.id);
            }
        }
    }
}

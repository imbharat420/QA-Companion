//! The live agent task.
//!
//! `start_agent_task` spawns a worker that emits a scripted `AgentEvent`
//! sequence on the `agent://event` channel — the same story the mock adapter
//! replays, so the Workbench behaves identically on either data source: explore
//! the funnel, fill the payment form, stop dead at the approval gate, resume on
//! a decision, fail the confirmation assertion and open BUG-1842.
//!
//! Two things it must never do: busy-wait at the gate (it parks on a `Notify`)
//! and outlive a stop (every await is raced against the cancel watch).

use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::{watch, Notify};
use uuid::Uuid;

use crate::error::{AppError, AppResult};
use crate::models::*;
use crate::state::AppState;
use crate::store::{iso_from_unix, now_iso};

/// Cadence between emissions. Slow enough to read in the UI, fast enough that a
/// full run finishes inside half a minute.
const STEP: Duration = Duration::from_millis(400);
const CHANNEL: &str = "agent://event";

/* ==========================================================================
   COMMANDS
   ======================================================================== */

#[tauri::command]
pub async fn start_agent_task(
    app: AppHandle,
    state: State<'_, AppState>,
    input: AgentTaskInput,
) -> AppResult<AgentTaskHandle> {
    if input.prompt.trim().is_empty() {
        return Err(AppError::Invalid("an agent task needs a prompt".into()));
    }

    let task_id = format!("task-{}", Uuid::new_v4().simple());
    let started_at = now_iso();

    // Everything the script needs is lifted out of the database up front, so the
    // worker never has to take the lock mid-run.
    let (home, checkout, finding) = state.read(|db| {
        (
            db.dom_trees.get(PageId::Home.key()).cloned(),
            db.dom_trees.get(PageId::Checkout.key()).cloned(),
            db.findings.iter().find(|f| f.id == "BUG-1842").cloned(),
        )
    });

    let gate = Arc::new(Notify::new());
    let cancel = state.register_task(&task_id, Arc::clone(&gate));
    let script = build_script(&input, home, checkout, finding);

    let worker = app.clone();
    let worker_id = task_id.clone();
    tauri::async_runtime::spawn(async move {
        replay(worker, worker_id, script, gate, cancel).await;
    });

    Ok(AgentTaskHandle {
        task_id,
        started_at,
    })
}

#[tauri::command]
pub async fn stop_agent_task(state: State<'_, AppState>, task_id: String) -> AppResult<()> {
    // The kill switch is idempotent: stopping a run that already finished is
    // not something the UI should have to render an error for.
    if state.is_running(&task_id) {
        state.cancel_task(&task_id)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn resolve_approval(
    state: State<'_, AppState>,
    task_id: String,
    approval_id: String,
    decision: String,
) -> AppResult<()> {
    match decision.as_str() {
        "approve" => state.release_approval(&task_id, &approval_id),
        // A rejection releases the gate *and* ends the run — the plan's next
        // stage depends on the action the operator just refused.
        "reject" => {
            state.release_approval(&task_id, &approval_id)?;
            state.cancel_task(&task_id)
        }
        other => Err(AppError::Invalid(format!(
            "unknown approval decision {other:?}"
        ))),
    }
}

/* ==========================================================================
   THE WORKER
   ======================================================================== */

/// Tags each emission with its task id so one channel can carry every run —
/// `AgentEvent` is internally tagged, so the id is injected into the same object
/// rather than wrapping it, which is the envelope `tauri.ts` expects.
fn emit(app: &AppHandle, task_id: &str, event: &AgentEvent) {
    let mut payload = serde_json::to_value(event).unwrap_or(serde_json::Value::Null);
    if let Some(object) = payload.as_object_mut() {
        object.insert("taskId".to_owned(), serde_json::Value::String(task_id.to_owned()));
    }
    // A closed window is the normal way a run ends; there is nobody left to
    // report the failure to.
    let _ = app.emit(CHANNEL, payload);
}

/// One cadence tick, raced against the cancel signal. Returns true if the run
/// should stop.
async fn tick(cancel: &mut watch::Receiver<bool>) -> bool {
    tokio::select! {
        _ = tokio::time::sleep(STEP) => *cancel.borrow(),
        _ = cancel.changed() => true,
    }
}

async fn replay(
    app: AppHandle,
    task_id: String,
    script: Vec<AgentEvent>,
    gate: Arc<Notify>,
    mut cancel: watch::Receiver<bool>,
) {
    let mut finished = true;

    for event in &script {
        if *cancel.borrow() {
            finished = false;
            break;
        }

        // Arm before emitting: the decision can come back on the very next IPC
        // message, and it has to find the gate already open.
        if let AgentEvent::Approval {
            request: Some(request),
        } = event
        {
            app.state::<AppState>().arm_approval(&task_id, &request.id);
        }

        emit(&app, &task_id, event);

        if matches!(
            event,
            AgentEvent::Status {
                status: AgentStatus::Waiting,
                ..
            }
        ) {
            // Park until `resolve_approval` notifies or the run is cancelled —
            // no polling, no timeout, the gate is a real barrier.
            tokio::select! {
                _ = gate.notified() => {}
                _ = cancel.changed() => {}
            }
            if *cancel.borrow() {
                finished = false;
                break;
            }
            continue;
        }

        if tick(&mut cancel).await {
            finished = false;
            break;
        }
    }

    if !finished {
        emit(
            &app,
            &task_id,
            &AgentEvent::Status {
                status: AgentStatus::Stopped,
                ts: now_iso(),
            },
        );
        emit(
            &app,
            &task_id,
            &AgentEvent::Done {
                status: DoneStatus::Stopped,
                summary: "Run stopped by the operator. Every artefact captured so far is attached \
                          to the session."
                    .to_owned(),
            },
        );
    }

    app.state::<AppState>().forget_task(&task_id);
}

/* ==========================================================================
   THE SCRIPT
   ======================================================================== */

/// ISO-8601 with milliseconds. The timeline scrubber orders by this, so two
/// events one cadence tick apart must not collapse onto the same instant.
fn ts(base_ms: u64, ordinal: u64) -> String {
    let at = base_ms + ordinal * STEP.as_millis() as u64;
    format!(
        "{}.{:03}Z",
        iso_from_unix(at / 1000).trim_end_matches('Z'),
        at % 1000
    )
}

fn stage(id: &str, label: &str, detail: &str, state: StageState) -> PlanStage {
    PlanStage {
        id: id.to_owned(),
        label: label.to_owned(),
        state,
        detail: Some(detail.to_owned()),
    }
}

fn plan(states: [StageState; 5], budget_tokens: u32) -> PlanCard {
    PlanCard {
        id: "plan-0142".to_owned(),
        goal: "Book the Lofoten Night Sky tour end to end and verify the confirmation reference"
            .to_owned(),
        stages: vec![
            stage(
                "stage-explore",
                "Map the booking funnel",
                "crawl nav + collect interactive elements",
                states[0],
            ),
            stage(
                "stage-search",
                "Find the Lofoten Night Sky tour",
                "search box -> tour card",
                states[1],
            ),
            stage(
                "stage-checkout",
                "Fill payment details",
                "cardholder, card, expiry, CVV from the workspace vault",
                states[2],
            ),
            stage(
                "stage-pay",
                "Submit payment",
                "approval-gated · irreversible",
                states[3],
            ),
            stage(
                "stage-verify",
                "Assert confirmation",
                "/confirmation + booking reference + screenshot",
                states[4],
            ),
        ],
        budget_tokens,
    }
}

fn message(id: u32, from: ChatFrom, base: u64, ordinal: u64, text: &str) -> AgentEvent {
    AgentEvent::Message {
        message: ChatMessage {
            id,
            from,
            text: text.to_owned(),
            ts: ts(base, ordinal),
            card: None,
            card_kind: None,
        },
    }
}

#[allow(clippy::too_many_arguments)]
fn step(
    id: u32,
    base: u64,
    ordinal: u64,
    kind: TimelineKind,
    label: &str,
    detail: &str,
    status: StepStatus,
    duration_ms: Option<u32>,
    finding_id: Option<&str>,
) -> AgentEvent {
    AgentEvent::Step {
        step: TimelineStep {
            id,
            ts: ts(base, ordinal),
            kind,
            label: label.to_owned(),
            detail: detail.to_owned(),
            status,
            screenshot_src: matches!(kind, TimelineKind::Screenshot)
                .then(|| "/mock/shots/checkout-stuck.png".to_owned()),
            finding_id: finding_id.map(str::to_owned),
            duration_ms,
        },
    }
}

fn network(id: u32, method: &str, url: &str, status: u16, ms: u32, start_ms: u32) -> AgentEvent {
    AgentEvent::Network {
        entry: NetworkEntry {
            id,
            method: method.to_owned(),
            url: url.to_owned(),
            status,
            ms,
            kind: Some(if method == "GET" && url.ends_with('/') {
                ResourceType::Document
            } else {
                ResourceType::Xhr
            }),
            size_bytes: Some(486 + u64::from(id) * 128),
            start_ms: Some(start_ms),
        },
    }
}

fn console(id: u32, level: ConsoleLevel, base: u64, ordinal: u64, text: &str) -> AgentEvent {
    AgentEvent::Console {
        entry: ConsoleEntry {
            id,
            level,
            text: text.to_owned(),
            ts: ts(base, ordinal),
            source: Some("checkout.tsx:214".to_owned()),
        },
    }
}

fn typing(field: &str, text: &str, overlay: &str, highlight: &str) -> AgentEvent {
    AgentEvent::Browser {
        patch: BrowserPatch {
            typing: Some(Some(TypingState {
                field: field.to_owned(),
                text: text.to_owned(),
            })),
            overlay: Some(Some(overlay.to_owned())),
            highlight: Some(Some(highlight.to_owned())),
            ..BrowserPatch::default()
        },
    }
}

fn approval_request() -> ApprovalRequest {
    ApprovalRequest {
        id: "apr-0142-payment".to_owned(),
        title: "Submit payment?".to_owned(),
        desc: "The agent wants to click \"Pay EUR 348.00\" on blixen-tours using the vault card ·· 4242."
            .to_owned(),
        action: "payment.submit".to_owned(),
        risk: Risk::High,
        target: Some("button \"Pay EUR 348.00\" · form#payment".to_owned()),
        payload_preview: Some(
            "POST /api/payments\n{\n  \"amount\": 34800,\n  \"currency\": \"EUR\",\n  \"cardToken\": \"tok_vault_ws001_4242\",\n  \"cvv\": \"***\",\n  \"idempotencyKey\": \"blx-90413-a1\"\n}"
                .to_owned(),
        ),
        payload_hash: Some("sha256:9f2c41ab7d6e0b53c8a17f4d2e9b6058c31da74e".to_owned()),
        reason: Some(
            "Irreversible side effect: the staging gateway authorises a real test card and fires an \
             orders webhook. No dry-run endpoint is exposed, so the charge cannot be rolled back."
                .to_owned(),
        ),
        remember_scope: Some(RememberScope::Step),
    }
}

fn build_script(
    input: &AgentTaskInput,
    home: Option<DomNode>,
    checkout: Option<DomNode>,
    finding: Option<Finding>,
) -> Vec<AgentEvent> {
    use StageState::{Active, Done, Failed, Pending};

    let base = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let budget = input.budget_tokens.unwrap_or(20_000);
    let goal = input.prompt.trim();

    let mut events = vec![
        AgentEvent::Status {
            status: AgentStatus::Thinking,
            ts: ts(base, 0),
        },
        AgentEvent::Tokens { total: 210 },
        message(
            2,
            ChatFrom::Agent,
            base,
            2,
            &format!(
                "On it — {goal}. I'll drive blixen-tours end to end and verify the confirmation. \
                 Watch the browser."
            ),
        ),
        AgentEvent::Status {
            status: AgentStatus::Planning,
            ts: ts(base, 3),
        },
        AgentEvent::Plan {
            plan: plan([Active, Pending, Pending, Pending, Pending], budget),
        },
        step(
            1,
            base,
            5,
            TimelineKind::Plan,
            "Plan created",
            "5 stages · 1 approval gate · budget 20k tokens",
            StepStatus::Info,
            None,
            None,
        ),
        AgentEvent::Tokens { total: 780 },
        AgentEvent::Status {
            status: AgentStatus::Executing,
            ts: ts(base, 7),
        },
        AgentEvent::Browser {
            patch: BrowserPatch {
                url: Some("https://blixen.tours".to_owned()),
                page: Some(PageId::Loading),
                title: Some("Loading…".to_owned()),
                loading: Some(true),
                overlay: Some(Some("browser.navigate -> blixen.tours".to_owned())),
                tabs: Some(vec![BrowserTab {
                    id: "tab-1".to_owned(),
                    title: "Loading…".to_owned(),
                    url: Some("https://blixen.tours".to_owned()),
                }]),
                ..BrowserPatch::default()
            },
        },
        step(
            2,
            base,
            9,
            TimelineKind::Navigate,
            "Navigate",
            "https://blixen.tours",
            StepStatus::Ok,
            Some(182),
            None,
        ),
        network(1, "GET", "https://blixen.tours/", 200, 182, 0),
        AgentEvent::Browser {
            patch: BrowserPatch {
                page: Some(PageId::Home),
                title: Some("Blixen Tours — Nordic adventures".to_owned()),
                loading: Some(false),
                overlay: Some(None),
                ..BrowserPatch::default()
            },
        },
    ];

    if let Some(tree) = home {
        events.push(AgentEvent::Dom {
            page: PageId::Home,
            tree,
        });
    }

    events.extend([
        network(2, "GET", "/api/tours", 200, 96, 210),
        AgentEvent::Tokens { total: 1_420 },
        AgentEvent::Plan {
            plan: plan([Done, Active, Pending, Pending, Pending], budget),
        },
        typing(
            "home-search",
            "lofoten night sky",
            "browser.type -> searchbox",
            "home-search",
        ),
        step(
            3,
            base,
            16,
            TimelineKind::Type,
            "Type",
            "searchbox \"Search tours\" -> lofoten night sky",
            StepStatus::Ok,
            Some(96),
            None,
        ),
        AgentEvent::Browser {
            patch: BrowserPatch {
                typing: Some(None),
                overlay: Some(Some("browser.click -> article \"Lofoten Night Sky\"".to_owned())),
                highlight: Some(Some("tour-lofoten".to_owned())),
                cursor: Some(Some(Point { x: 32.0, y: 48.0 })),
                ..BrowserPatch::default()
            },
        },
        step(
            4,
            base,
            18,
            TimelineKind::Click,
            "Click",
            "article \"Lofoten Night Sky\" -> /checkout",
            StepStatus::Ok,
            Some(214),
            None,
        ),
        AgentEvent::Browser {
            patch: BrowserPatch {
                page: Some(PageId::Checkout),
                url: Some("https://blixen.tours/checkout".to_owned()),
                title: Some("Checkout — Blixen Tours".to_owned()),
                overlay: Some(None),
                highlight: Some(None),
                ripple: Some(Some(Ripple {
                    x: 32.0,
                    y: 48.0,
                    key: 1,
                })),
                ..BrowserPatch::default()
            },
        },
    ]);

    if let Some(tree) = checkout {
        events.push(AgentEvent::Dom {
            page: PageId::Checkout,
            tree,
        });
    }

    events.extend([
        AgentEvent::Plan {
            plan: plan([Done, Done, Active, Pending, Pending], budget),
        },
        typing(
            "checkout-name",
            "Ada Lovelace",
            "browser.type -> Cardholder",
            "checkout-name",
        ),
        step(
            5,
            base,
            23,
            TimelineKind::Type,
            "Type",
            "textbox \"Cardholder\" -> Ada Lovelace",
            StepStatus::Ok,
            None,
            None,
        ),
        typing(
            "checkout-card",
            "•••• •••• •••• 4242",
            "browser.type -> Card number (from vault)",
            "checkout-card",
        ),
        step(
            6,
            base,
            25,
            TimelineKind::Type,
            "Type",
            "textbox \"Card number\" -> vault card ·· 4242",
            StepStatus::Ok,
            None,
            None,
        ),
        typing(
            "checkout-expiry",
            "09/28",
            "browser.type -> Expiry",
            "checkout-expiry",
        ),
        typing(
            "checkout-cvv",
            "•••",
            "browser.type -> CVV (masked)",
            "checkout-cvv",
        ),
        step(
            7,
            base,
            28,
            TimelineKind::Type,
            "Type",
            "unnamed textbox (cvv) -> ••• (masked)",
            StepStatus::Ok,
            None,
            None,
        ),
        AgentEvent::Tokens { total: 5_630 },
        AgentEvent::Browser {
            patch: BrowserPatch {
                typing: Some(None),
                overlay: Some(Some("Waiting for your approval…".to_owned())),
                cursor: Some(Some(Point { x: 34.0, y: 72.0 })),
                highlight: Some(Some("pay-submit".to_owned())),
                ..BrowserPatch::default()
            },
        },
        AgentEvent::Approval {
            request: Some(approval_request()),
        },
        step(
            8,
            base,
            32,
            TimelineKind::Approval,
            "Approval required",
            "payment.submit -> POST /api/payments · risk high",
            StepStatus::Warn,
            None,
            None,
        ),
        // The worker parks here until `resolve_approval` releases the gate.
        AgentEvent::Status {
            status: AgentStatus::Waiting,
            ts: ts(base, 33),
        },
        AgentEvent::Approval { request: None },
        AgentEvent::Status {
            status: AgentStatus::Executing,
            ts: ts(base, 35),
        },
        message(
            36,
            ChatFrom::System,
            base,
            36,
            "Approved · payment.submit — allowed once, for this step only.",
        ),
        AgentEvent::Browser {
            patch: BrowserPatch {
                overlay: Some(Some("Submitting payment…".to_owned())),
                highlight: Some(None),
                ripple: Some(Some(Ripple {
                    x: 34.0,
                    y: 72.0,
                    key: 4,
                })),
                ..BrowserPatch::default()
            },
        },
        step(
            9,
            base,
            38,
            TimelineKind::Click,
            "Click",
            "button \"Pay EUR 348.00\" -> POST /api/payments 200",
            StepStatus::Ok,
            Some(342),
            None,
        ),
        network(3, "POST", "/api/payments", 200, 342, 5_120),
        console(
            5,
            ConsoleLevel::Warn,
            base,
            40,
            "[checkout] no route change 2000ms after submit — payment form still mounted",
        ),
        step(
            10,
            base,
            41,
            TimelineKind::Assert,
            "Assert booking confirmed",
            "expected url /confirmation + booking ref · still on /checkout after 5000ms",
            StepStatus::Fail,
            Some(5_000),
            Some("BUG-1842"),
        ),
        network(4, "GET", "/api/orders/latest", 404, 61, 10_480),
        console(
            6,
            ConsoleLevel::Error,
            base,
            43,
            "[checkout] GET /api/orders/latest -> 404 · no order was created",
        ),
        AgentEvent::Tokens { total: 7_830 },
        message(
            45,
            ChatFrom::Agent,
            base,
            45,
            "Assertion failed. The payment POST returned 200 but the app never left /checkout, and \
             /api/orders/latest is a 404 — so nothing was persisted. Opening a finding.",
        ),
    ]);

    if let Some(finding) = finding {
        events.push(AgentEvent::Finding { finding });
    }

    events.extend([
        step(
            11,
            base,
            47,
            TimelineKind::Finding,
            "Finding opened",
            "BUG-1842 · Checkout submit button unresponsive · high",
            StepStatus::Warn,
            None,
            Some("BUG-1842"),
        ),
        step(
            12,
            base,
            48,
            TimelineKind::Screenshot,
            "Screenshot",
            "checkout-stuck.png · full page · 1440x900",
            StepStatus::Info,
            None,
            None,
        ),
        step(
            13,
            base,
            49,
            TimelineKind::Inspect,
            "Re-resolve locator",
            "[data-testid=\"checkout-pay\"] -> 0 nodes · button.primary -> 1 node",
            StepStatus::Warn,
            None,
            None,
        ),
        AgentEvent::Tokens { total: 9_060 },
        AgentEvent::Plan {
            plan: plan([Done, Done, Done, Done, Failed], budget),
        },
        AgentEvent::Browser {
            patch: BrowserPatch {
                overlay: Some(None),
                cursor: Some(None),
                highlight: Some(None),
                typing: Some(None),
                ripple: Some(None),
                loading: Some(false),
                ..BrowserPatch::default()
            },
        },
        message(
            53,
            ChatFrom::Agent,
            base,
            53,
            "Run complete. Four stages passed, the confirmation assertion failed. 13 steps, 4 \
             requests (1 404), 2 console entries and 1 screenshot are attached to this session. I \
             opened BUG-1842 with a proposed locator patch that also fixes the 7 related specs — \
             want me to apply it and re-run the checkout suite?",
        ),
        AgentEvent::Tokens { total: 12_400 },
        AgentEvent::Status {
            status: AgentStatus::Completed,
            ts: ts(base, 55),
        },
        AgentEvent::Done {
            status: DoneStatus::Completed,
            summary: format!(
                "Booking flow walked end to end on blixen-tours. Payment submitted after approval, \
                 but the confirmation assertion failed: POST /api/payments returned 200 with no \
                 state transition and no order persisted. 1 finding opened (BUG-1842, high, 94% \
                 confidence) with a locator patch covering 7 related tests. 12,400 tokens of a \
                 {budget} budget."
            ),
        },
    ]);

    events
}

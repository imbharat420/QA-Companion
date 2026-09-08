use serde::Serialize;
use tauri::State;

use crate::error::AppResult;
use crate::models::{DashboardSummary, FindingStatus, Severity, TestStatus};
use crate::state::AppState;

/// The Settings screen adds `latencyMs` itself — the backend cannot see the IPC
/// round trip it is trying to measure.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Health {
    pub ok: bool,
    pub detail: String,
}

#[tauri::command]
pub async fn health_check(state: State<'_, AppState>) -> AppResult<Health> {
    let (workspaces, findings) = state.read(|db| (db.workspaces.len(), db.findings.len()));
    Ok(Health {
        ok: true,
        detail: format!(
            "Rust backend {} · {workspaces} workspaces · {findings} findings",
            env!("CARGO_PKG_VERSION")
        ),
    })
}

/// One rollup feeds every nav badge, so it is computed in a single pass rather
/// than as one query per counter.
#[tauri::command]
pub async fn get_dashboard_summary(state: State<'_, AppState>) -> AppResult<DashboardSummary> {
    let pending_approvals = state.pending_approvals();
    Ok(state.read(|db| {
        let open = db
            .findings
            .iter()
            .filter(|finding| matches!(finding.status, FindingStatus::New | FindingStatus::Confirmed));

        let total_tests: u32 = db.cases.len() as u32;
        let passed = db
            .cases
            .iter()
            .filter(|case| matches!(case.status, TestStatus::Passed))
            .count() as u32;
        let scored = db
            .cases
            .iter()
            .filter(|case| !matches!(case.status, TestStatus::Skipped | TestStatus::Pending))
            .count() as u32;
        let durations: Vec<u32> = db
            .cases
            .iter()
            .map(|case| case.duration_ms)
            .filter(|ms| *ms > 0)
            .collect();

        DashboardSummary {
            open_findings: open.clone().count() as u32,
            critical_findings: open
                .filter(|finding| matches!(finding.severity, Severity::Critical))
                .count() as u32,
            running_runs: db
                .runs
                .iter()
                .filter(|run| matches!(run.status, Some(TestStatus::Running)))
                .count() as u32,
            pending_approvals,
            a11y_violations: db
                .a11y_issues
                .iter()
                .filter(|issue| matches!(issue.status, FindingStatus::New | FindingStatus::Confirmed))
                .count() as u32,
            security_issues: db
                .security_issues
                .iter()
                .filter(|issue| matches!(issue.status, FindingStatus::New | FindingStatus::Confirmed))
                .count() as u32,
            visual_diffs: db
                .baselines
                .iter()
                .filter(|baseline| {
                    matches!(
                        baseline.status,
                        crate::models::BaselineStatus::Changed | crate::models::BaselineStatus::New
                    )
                })
                .count() as u32,
            pass_rate: if scored == 0 {
                0
            } else {
                (passed * 100) / scored
            },
            total_tests,
            avg_duration_ms: if durations.is_empty() {
                0
            } else {
                durations.iter().sum::<u32>() / durations.len() as u32
            },
        }
    }))
}

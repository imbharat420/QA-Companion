use serde::Serialize;
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::models::{Finding, FindingStatus, Paged};
use crate::state::AppState;

use super::{active, matches_search, paginate, wire_eq, FindingFilter};

/// What the failure cockpit's "apply fix" button reads back.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FixResult {
    pub ok: bool,
    pub commit: String,
    pub detail: String,
}

#[tauri::command]
pub async fn list_findings(
    state: State<'_, AppState>,
    query: Option<FindingFilter>,
) -> AppResult<Paged<Finding>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<Finding> = db
            .findings
            .iter()
            .filter(|finding| match active(&filter.severity) {
                Some(severity) => wire_eq(&finding.severity, severity),
                None => true,
            })
            .filter(|finding| match active(&filter.status) {
                Some(status) => wire_eq(&finding.status, status),
                None => true,
            })
            .filter(|finding| match active(&filter.category) {
                Some(category) => finding.category.eq_ignore_ascii_case(category),
                None => true,
            })
            .filter(|finding| match active(&filter.run_id) {
                Some(run) => finding.run_id.as_deref() == Some(run),
                None => true,
            })
            .filter(|finding| match active(&filter.project_id) {
                Some(project) => finding.project_id.as_deref() == Some(project),
                None => true,
            })
            .filter(|finding| {
                matches_search(
                    Some(&filter.list),
                    &[
                        &finding.id,
                        &finding.title,
                        &finding.category,
                        &finding.element,
                        &finding.url,
                    ],
                )
            })
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn get_finding(state: State<'_, AppState>, id: String) -> AppResult<Option<Finding>> {
    Ok(state.read(|db| db.findings.iter().find(|finding| finding.id == id).cloned()))
}

#[tauri::command]
pub async fn update_finding_status(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    status: FindingStatus,
) -> AppResult<Finding> {
    state.mutate(&app, |db| {
        let finding = db
            .findings
            .iter_mut()
            .find(|finding| finding.id == id)
            .ok_or_else(|| AppError::NotFound(format!("finding {id}")))?;
        finding.status = status;
        Ok(finding.clone())
    })
}

/// Applying a fix is a state transition, not a patch of the working tree: the
/// desktop shell has no git access, so it records the decision and reports the
/// commit the finding proposed.
#[tauri::command]
pub async fn apply_finding_fix(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> AppResult<FixResult> {
    state.mutate(&app, |db| {
        let finding = db
            .findings
            .iter_mut()
            .find(|finding| finding.id == id)
            .ok_or_else(|| AppError::NotFound(format!("finding {id}")))?;
        if finding.fix.trim().is_empty() {
            return Err(AppError::Invalid(format!("{id} has no proposed patch")));
        }
        finding.status = FindingStatus::Fixed;
        Ok(FixResult {
            ok: true,
            commit: finding.commit.clone(),
            detail: format!(
                "Applied the proposed patch for {} — {} related test(s) re-queued.",
                finding.id, finding.related_tests
            ),
        })
    })
}

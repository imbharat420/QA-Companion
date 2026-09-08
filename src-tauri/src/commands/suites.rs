use tauri::State;

use crate::error::AppResult;
use crate::models::{Paged, Suite, TestCase};
use crate::state::AppState;

use super::{active, matches_search, paginate, wire_eq, CaseFilter, SuiteFilter};

#[tauri::command]
pub async fn list_suites(
    state: State<'_, AppState>,
    query: Option<SuiteFilter>,
) -> AppResult<Paged<Suite>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<Suite> = db
            .suites
            .iter()
            .filter(|suite| match active(&filter.project_id) {
                Some(project) => suite.project_id.as_deref() == Some(project),
                None => true,
            })
            .filter(|suite| matches_search(Some(&filter.list), &[&suite.name, &suite.file]))
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn list_cases(
    state: State<'_, AppState>,
    query: Option<CaseFilter>,
) -> AppResult<Paged<TestCase>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<TestCase> = db
            .cases
            .iter()
            .filter(|case| match active(&filter.suite_id) {
                Some(suite) => case.suite_id == suite,
                None => true,
            })
            .filter(|case| match active(&filter.status) {
                Some(status) => wire_eq(&case.status, status),
                None => true,
            })
            .filter(|case| match active(&filter.tag) {
                Some(tag) => case.tags.iter().any(|t| t.eq_ignore_ascii_case(tag)),
                None => true,
            })
            .filter(|case| {
                matches_search(
                    Some(&filter.list),
                    &[&case.title, &case.file, &case.primary_locator, &case.owner],
                )
            })
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn get_case(state: State<'_, AppState>, id: String) -> AppResult<Option<TestCase>> {
    Ok(state.read(|db| db.cases.iter().find(|case| case.id == id).cloned()))
}

use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::error::AppResult;
use crate::models::{
    FlakyTest, Paged, RunGroup, RunSpec, RunSpecTest, TestRun, TestStatus, Tone, TrendPoint,
};
use crate::state::AppState;
use crate::store::now_iso;

use super::{active, matches_search, paginate, wire_eq, RunFilter};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartRunInput {
    pub suite_id: Option<String>,
    pub case_ids: Option<Vec<String>>,
    pub project_id: Option<String>,
}

#[tauri::command]
pub async fn list_runs(
    state: State<'_, AppState>,
    query: Option<RunFilter>,
) -> AppResult<Paged<TestRun>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<TestRun> = db
            .runs
            .iter()
            .filter(|run| match active(&filter.status) {
                Some(status) => run.status.as_ref().is_some_and(|s| wire_eq(s, status)),
                None => true,
            })
            .filter(|run| match active(&filter.project_id) {
                Some(project) => run.project_id.as_deref() == Some(project),
                None => true,
            })
            .filter(|run| match active(&filter.branch) {
                Some(branch) => run.branch == branch,
                None => true,
            })
            // A run does not carry a suite id, so the suite filter resolves
            // through the spec files the run actually executed.
            .filter(|run| match active(&filter.suite_id) {
                Some(suite_id) => db
                    .suites
                    .iter()
                    .find(|suite| suite.id == suite_id)
                    .is_some_and(|suite| run.specs.iter().any(|spec| spec.file == suite.file)),
                None => true,
            })
            .filter(|run| {
                matches_search(
                    Some(&filter.list),
                    &[
                        &run.name,
                        &run.branch,
                        run.commit_message.as_deref().unwrap_or_default(),
                        run.author.as_deref().unwrap_or_default(),
                    ],
                )
            })
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn get_run(state: State<'_, AppState>, id: String) -> AppResult<Option<TestRun>> {
    Ok(state.read(|db| db.runs.iter().find(|run| run.id == id).cloned()))
}

/// Derived from the run list rather than stored, so a run started here shows up
/// on the trend chart without a second write.
#[tauri::command]
pub async fn get_run_trend(state: State<'_, AppState>) -> AppResult<Vec<TrendPoint>> {
    Ok(state.read(|db| {
        db.runs
            .iter()
            .rev()
            .map(|run| TrendPoint {
                run: format!("#{}", run.id.trim_start_matches("run-")),
                pass: run.passed,
                fail: run.failed + run.flaky,
            })
            .collect()
    }))
}

#[tauri::command]
pub async fn list_flaky_tests(state: State<'_, AppState>) -> AppResult<Vec<FlakyTest>> {
    Ok(state.read(|db| db.flaky.clone()))
}

#[tauri::command]
pub async fn start_run(
    app: AppHandle,
    state: State<'_, AppState>,
    input: StartRunInput,
) -> AppResult<TestRun> {
    state.mutate(&app, |db| {
        let selected: Vec<&crate::models::TestCase> = db
            .cases
            .iter()
            .filter(|case| match input.case_ids.as_deref() {
                Some(ids) if !ids.is_empty() => ids.contains(&case.id),
                _ => match input.suite_id.as_deref() {
                    Some(suite) => case.suite_id == suite,
                    None => true,
                },
            })
            .collect();

        let suite = input
            .suite_id
            .as_deref()
            .and_then(|id| db.suites.iter().find(|suite| suite.id == id));
        let project = input
            .project_id
            .clone()
            .or_else(|| suite.and_then(|s| s.project_id.clone()))
            .or_else(|| db.workspaces.first().map(|ws| ws.id.clone()));

        // Ids stay monotonic so the trend chart and the run route (`?run=2292`)
        // both read in order.
        let next = db
            .runs
            .iter()
            .filter_map(|run| run.id.trim_start_matches("run-").parse::<u32>().ok())
            .max()
            .unwrap_or(2_290)
            + 1;

        let mut specs: Vec<RunSpec> = Vec::new();
        for case in &selected {
            match specs.iter_mut().find(|spec| spec.file == case.file) {
                Some(spec) => spec.tests.push(RunSpecTest {
                    name: case.title.clone(),
                    status: TestStatus::Pending,
                }),
                None => specs.push(RunSpec {
                    file: case.file.clone(),
                    tests: vec![RunSpecTest {
                        name: case.title.clone(),
                        status: TestStatus::Pending,
                    }],
                }),
            }
        }

        let pending = selected.len() as u32;
        let run = TestRun {
            id: format!("run-{next}"),
            name: match suite {
                Some(suite) => format!("{} run #{next}", suite.name),
                None => format!("Full regression #{next}"),
            },
            branch: suite
                .and_then(|s| s.project_id.as_deref())
                .and_then(|id| db.workspaces.iter().find(|ws| ws.id == id))
                .map(|ws| ws.branch.clone())
                .unwrap_or_else(|| "main".to_owned()),
            when: now_iso(),
            duration: "running".to_owned(),
            passed: 0,
            failed: 0,
            flaky: 0,
            skipped: 0,
            groups: vec![RunGroup {
                title: "Queued".to_owned(),
                count: pending,
                desc: "waiting for a worker".to_owned(),
                tone: Tone::Cyan,
            }],
            specs,
            project_id: project,
            trigger: Some(crate::models::RunTrigger::Manual),
            engine: Some("Playwright 1.51 / Chromium 128".to_owned()),
            commit_message: Some("chore: manual run from the desktop app".to_owned()),
            author: Some("You".to_owned()),
            status: Some(TestStatus::Running),
            started_at: Some(now_iso()),
            duration_ms: Some(0),
        };

        db.runs.insert(0, run.clone());
        Ok(run)
    })
}

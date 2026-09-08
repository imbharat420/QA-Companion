use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::models::{
    A11yIssue, A11ySummary, ApiEndpoint, ApiSummary, BaselineStatus, CategoryCount, ChangeKind,
    Device, FindingStatus, Paged, PerfSummary, SecurityIssue, SecuritySummary, SeverityCounts,
    ViewportCount, VisualBaseline, VisualSummary, WcagCounts,
};
use crate::state::AppState;
use crate::store::now_iso;

use super::{
    active, matches_search, paginate, wire_eq, A11yFilter, ApiFilter, PerfQuery, SecurityFilter,
    VisualFilter,
};

/// A finding that is fixed, waived or dismissed no longer counts against a
/// score — every summary below shares this rule.
fn is_open(status: FindingStatus) -> bool {
    matches!(status, FindingStatus::New | FindingStatus::Confirmed)
}

/* --- accessibility ------------------------------------------------------ */

#[tauri::command]
pub async fn list_a11y_issues(
    state: State<'_, AppState>,
    query: Option<A11yFilter>,
) -> AppResult<Paged<A11yIssue>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<A11yIssue> = db
            .a11y_issues
            .iter()
            .filter(|issue| match active(&filter.level) {
                Some(level) => wire_eq(&issue.wcag_level, level),
                None => true,
            })
            .filter(|issue| match active(&filter.impact) {
                Some(impact) => wire_eq(&issue.impact, impact),
                None => true,
            })
            .filter(|issue| match active(&filter.category) {
                Some(category) => issue.category.eq_ignore_ascii_case(category),
                None => true,
            })
            .filter(|issue| {
                matches_search(
                    Some(&filter.list),
                    &[&issue.rule_id, &issue.title, &issue.selector, &issue.category],
                )
            })
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn get_a11y_summary(state: State<'_, AppState>) -> AppResult<A11ySummary> {
    Ok(state.read(|db| {
        let open: Vec<&A11yIssue> = db
            .a11y_issues
            .iter()
            .filter(|issue| is_open(issue.status))
            .collect();

        let mut by_level = WcagCounts::default();
        let mut by_impact = SeverityCounts::default();
        for issue in &open {
            by_level.add(issue.wcag_level);
            by_impact.add(issue.impact);
        }

        // axe reports a count, not a grade, so the score is the weighted damage
        // subtracted from a clean sheet.
        let penalty = by_impact.critical * 9 + by_impact.high * 5 + by_impact.medium * 2 + by_impact.low;
        A11ySummary {
            score: 100_u32.saturating_sub(penalty),
            violations: open.len() as u32,
            passes: 148,
            incomplete: 6,
            by_level,
            by_impact,
            trend: db.a11y_trend.clone(),
        }
    }))
}

/* --- security ----------------------------------------------------------- */

#[tauri::command]
pub async fn list_security_issues(
    state: State<'_, AppState>,
    query: Option<SecurityFilter>,
) -> AppResult<Paged<SecurityIssue>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<SecurityIssue> = db
            .security_issues
            .iter()
            .filter(|issue| match active(&filter.category) {
                Some(category) => issue.category.eq_ignore_ascii_case(category),
                None => true,
            })
            .filter(|issue| match active(&filter.severity) {
                Some(severity) => wire_eq(&issue.severity, severity),
                None => true,
            })
            .filter(|issue| {
                matches_search(
                    Some(&filter.list),
                    &[
                        &issue.id,
                        &issue.title,
                        &issue.category,
                        issue.cwe.as_deref().unwrap_or_default(),
                    ],
                )
            })
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn get_security_summary(state: State<'_, AppState>) -> AppResult<SecuritySummary> {
    Ok(state.read(|db| {
        let mut by_severity = SeverityCounts::default();
        let mut by_category: Vec<CategoryCount> = Vec::new();
        for issue in db.security_issues.iter().filter(|i| is_open(i.status)) {
            by_severity.add(issue.severity);
            match by_category
                .iter_mut()
                .find(|entry| entry.category == issue.category)
            {
                Some(entry) => entry.count += 1,
                None => by_category.push(CategoryCount {
                    category: issue.category.clone(),
                    count: 1,
                }),
            }
        }
        by_category.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.category.cmp(&b.category)));

        let missing_headers = db.security_headers.iter().filter(|h| !h.present).count() as u32;
        let penalty =
            by_severity.critical * 14 + by_severity.high * 8 + by_severity.medium * 3 + missing_headers * 2;

        SecuritySummary {
            score: 100_u32.saturating_sub(penalty),
            by_category,
            by_severity,
            headers: db.security_headers.clone(),
            scanned_urls: 42,
            last_scan: db
                .security_issues
                .first()
                .map(|issue| issue.detected_at.clone())
                .unwrap_or_else(now_iso),
        }
    }))
}

/* --- performance -------------------------------------------------------- */

#[tauri::command]
pub async fn get_perf_summary(
    state: State<'_, AppState>,
    query: Option<PerfQuery>,
) -> AppResult<PerfSummary> {
    let query = query.unwrap_or_default();
    Ok(state.read(|db| {
        let mut summary = match query.device.unwrap_or(Device::Desktop) {
            Device::Mobile => db.perf_mobile.clone(),
            Device::Desktop => db.perf_desktop.clone(),
        };
        // The page owns which URL it is asking about; the metrics are the same
        // captured profile either way.
        if let Some(url) = query.url.filter(|url| !url.trim().is_empty()) {
            summary.url = url;
        }
        summary
    }))
}

/* --- visual regression -------------------------------------------------- */

#[tauri::command]
pub async fn list_visual_baselines(
    state: State<'_, AppState>,
    query: Option<VisualFilter>,
) -> AppResult<Paged<VisualBaseline>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<VisualBaseline> = db
            .baselines
            .iter()
            .filter(|baseline| match active(&filter.status) {
                Some(status) => wire_eq(&baseline.status, status),
                None => true,
            })
            .filter(|baseline| match active(&filter.viewport) {
                Some(viewport) => baseline
                    .viewport
                    .label
                    .to_lowercase()
                    .contains(&viewport.to_lowercase()),
                None => true,
            })
            .filter(|baseline| {
                matches_search(
                    Some(&filter.list),
                    &[&baseline.name, &baseline.target, &baseline.viewport.label],
                )
            })
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn get_visual_summary(state: State<'_, AppState>) -> AppResult<VisualSummary> {
    Ok(state.read(|db| {
        let mut by_viewport: Vec<ViewportCount> = Vec::new();
        for baseline in &db.baselines {
            let changed = u32::from(matches!(baseline.status, BaselineStatus::Changed));
            match by_viewport
                .iter_mut()
                .find(|entry| entry.viewport == baseline.viewport.label)
            {
                Some(entry) => {
                    entry.total += 1;
                    entry.changed += changed;
                }
                None => by_viewport.push(ViewportCount {
                    viewport: baseline.viewport.label.clone(),
                    changed,
                    total: 1,
                }),
            }
        }
        let count = |wanted: BaselineStatus| {
            db.baselines
                .iter()
                .filter(|baseline| baseline.status == wanted)
                .count() as u32
        };
        VisualSummary {
            total: db.baselines.len() as u32,
            changed: count(BaselineStatus::Changed),
            pending: count(BaselineStatus::Pending) + count(BaselineStatus::New),
            approved: count(BaselineStatus::Approved),
            by_viewport,
        }
    }))
}

#[tauri::command]
pub async fn approve_baseline(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> AppResult<VisualBaseline> {
    state.mutate(&app, |db| {
        let baseline = db
            .baselines
            .iter_mut()
            .find(|baseline| baseline.id == id)
            .ok_or_else(|| AppError::NotFound(format!("baseline {id}")))?;
        // Approving promotes the actual capture to the baseline, so the diff is
        // gone by definition — not merely acknowledged.
        baseline.status = BaselineStatus::Approved;
        baseline.change_kind = ChangeKind::None;
        baseline.diff_percent = 0.0;
        baseline.pixels_changed = 0;
        baseline.baseline_src = baseline.actual_src.clone();
        baseline.updated_at = now_iso();
        Ok(baseline.clone())
    })
}

/* --- api intelligence --------------------------------------------------- */

#[tauri::command]
pub async fn list_api_endpoints(
    state: State<'_, AppState>,
    query: Option<ApiFilter>,
) -> AppResult<Paged<ApiEndpoint>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<ApiEndpoint> = db
            .endpoints
            .iter()
            .filter(|endpoint| match active(&filter.method) {
                Some(method) => wire_eq(&endpoint.method, method),
                None => true,
            })
            .filter(|endpoint| match filter.has_issues {
                Some(true) => !endpoint.issues.is_empty(),
                Some(false) => endpoint.issues.is_empty(),
                None => true,
            })
            .filter(|endpoint| {
                matches_search(Some(&filter.list), &[&endpoint.path, &endpoint.tags.join(" ")])
            })
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn get_api_summary(state: State<'_, AppState>) -> AppResult<ApiSummary> {
    Ok(state.read(|db| {
        let documented = db
            .endpoints
            .iter()
            .filter(|endpoint| matches!(endpoint.discovered_via, crate::models::DiscoveredVia::Openapi))
            .count() as u32;
        let mut by_severity = SeverityCounts::default();
        let mut drift_count = 0;
        for endpoint in &db.endpoints {
            for issue in &endpoint.issues {
                by_severity.add(issue.severity);
            }
            drift_count += endpoint
                .request_schema
                .iter()
                .chain(endpoint.response_schema.iter())
                .filter(|field| field.drift.is_some())
                .count() as u32;
        }
        ApiSummary {
            endpoints: db.endpoints.len() as u32,
            documented,
            undocumented: db.endpoints.len() as u32 - documented,
            drift_count,
            by_severity,
            spec_source: Some("openapi/vault-api.v2.4.yaml".to_owned()),
        }
    }))
}

//! The IPC surface. One module per `DataSource` group, one command per method,
//! command names matching the TypeScript adapter's `invoke` strings exactly.
//!
//! The filter shapes below mirror `src/lib/api/contract.ts`, and the helpers
//! mirror its `paginate` / `searchFilter` so the mock, REST and Tauri adapters
//! page and search identically — a page cannot tell which one it is talking to.

pub mod agent;
pub mod findings;
pub mod inspector;
pub mod projects;
pub mod quality;
pub mod runs;
pub mod scripts;
pub mod suites;
pub mod system;

use serde::{Deserialize, Serialize};

use crate::models::{Device, ListQuery, Paged};

/// `paginate` from the TS contract: the cursor is the numeric offset as a
/// string, and there is no next cursor once the window reaches the end.
pub fn paginate<T: Clone>(items: &[T], query: Option<&ListQuery>) -> Paged<T> {
    let start = query
        .and_then(|q| q.cursor.as_deref())
        .and_then(|cursor| cursor.parse::<usize>().ok())
        .unwrap_or(0)
        .min(items.len());
    let limit = query.and_then(|q| q.limit).unwrap_or(items.len());
    let page: Vec<T> = items[start..].iter().take(limit).cloned().collect();
    let end = start + page.len();
    Paged {
        items: page,
        total: items.len(),
        next_cursor: (end < items.len()).then(|| end.to_string()),
    }
}

/// `searchFilter` from the TS contract: case-insensitive substring across the
/// caller's chosen fields, and a blank needle matches everything.
pub fn matches_search(query: Option<&ListQuery>, fields: &[&str]) -> bool {
    let needle = match query
        .and_then(|q| q.search.as_deref())
        .map(str::trim)
        .filter(|search| !search.is_empty())
    {
        Some(needle) => needle.to_lowercase(),
        None => return true,
    };
    fields
        .iter()
        .any(|field| field.to_lowercase().contains(&needle))
}

/// Select controls send "all" for "no filter", and "" while a page is still
/// hydrating from its search params. Both mean: do not narrow anything.
pub fn active(value: &Option<String>) -> Option<&str> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty() && !value.eq_ignore_ascii_case("all"))
}

/// Compares an enum against a filter string using serde's own spelling, so a
/// kebab-case wire value like "false-positive" needs no second mapping table
/// that could drift away from `models.rs`.
pub fn wire_eq<T: Serialize>(value: &T, wanted: &str) -> bool {
    serde_json::to_value(value)
        .ok()
        .and_then(|json| json.as_str().map(|text| text.eq_ignore_ascii_case(wanted)))
        .unwrap_or(false)
}

/* ==========================================================================
   FILTER SHAPES — `#[serde(flatten)]` carries the shared `ListQuery` half, so
   the wire object is flat exactly as `contract.ts` declares it.
   ======================================================================== */

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuiteFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub project_id: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaseFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub suite_id: Option<String>,
    pub tag: Option<String>,
    pub status: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub status: Option<String>,
    pub suite_id: Option<String>,
    pub project_id: Option<String>,
    pub branch: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindingFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub severity: Option<String>,
    pub status: Option<String>,
    pub category: Option<String>,
    pub run_id: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct A11yFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub level: Option<String>,
    pub impact: Option<String>,
    pub category: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub category: Option<String>,
    pub severity: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub status: Option<String>,
    pub viewport: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub method: Option<String>,
    pub has_issues: Option<bool>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptFilter {
    #[serde(flatten)]
    pub list: ListQuery,
    pub kind: Option<String>,
    pub tag: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerfQuery {
    pub device: Option<Device>,
    pub url: Option<String>,
}

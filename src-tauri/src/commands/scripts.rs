use tauri::{AppHandle, State};

use crate::error::AppResult;
use crate::models::{Paged, ScriptEntry, ScriptVersion};
use crate::state::AppState;
use crate::store::now_iso;

use super::{active, matches_search, paginate, wire_eq, ScriptFilter};

#[tauri::command]
pub async fn list_scripts(
    state: State<'_, AppState>,
    query: Option<ScriptFilter>,
) -> AppResult<Paged<ScriptEntry>> {
    let filter = query.unwrap_or_default();
    Ok(state.read(|db| {
        let hits: Vec<ScriptEntry> = db
            .scripts
            .iter()
            .filter(|script| match active(&filter.kind) {
                Some(kind) => wire_eq(&script.kind, kind),
                None => true,
            })
            .filter(|script| match active(&filter.tag) {
                Some(tag) => script.tags.iter().any(|t| t.eq_ignore_ascii_case(tag)),
                None => true,
            })
            .filter(|script| {
                matches_search(
                    Some(&filter.list),
                    &[&script.name, &script.description, &script.tags.join(" ")],
                )
            })
            .cloned()
            .collect();
        paginate(&hits, Some(&filter.list))
    }))
}

#[tauri::command]
pub async fn get_script(state: State<'_, AppState>, id: String) -> AppResult<Option<ScriptEntry>> {
    Ok(state.read(|db| db.scripts.iter().find(|script| script.id == id).cloned()))
}

/// Upsert. Saving an existing script bumps its version and pushes a history
/// entry, because the library's whole value is being able to see what changed.
#[tauri::command]
pub async fn save_script(
    app: AppHandle,
    state: State<'_, AppState>,
    script: ScriptEntry,
) -> AppResult<ScriptEntry> {
    state.mutate(&app, |db| {
        let mut saved = script.clone();
        saved.updated_at = now_iso();

        match db.scripts.iter_mut().find(|entry| entry.id == saved.id) {
            Some(existing) => {
                if existing.code != saved.code {
                    saved.version = existing.version + 1;
                    saved.versions = existing.versions.clone();
                    saved.versions.push(ScriptVersion {
                        version: saved.version,
                        created_at: saved.updated_at.clone(),
                        author: "You".to_owned(),
                        note: format!("v{} saved from the script editor", saved.version),
                        diff: format!(
                            "- {} lines\n+ {} lines",
                            existing.code.lines().count(),
                            saved.code.lines().count()
                        ),
                    });
                } else {
                    // Metadata-only edit: bumping the version here would make
                    // the history lie about the code.
                    saved.version = existing.version;
                    saved.versions = existing.versions.clone();
                }
                *existing = saved.clone();
            }
            None => {
                if saved.id.trim().is_empty() {
                    saved.id = format!("scr-{}", uuid::Uuid::new_v4().simple());
                }
                saved.version = 1;
                saved.versions = vec![ScriptVersion {
                    version: 1,
                    created_at: saved.updated_at.clone(),
                    author: "You".to_owned(),
                    note: "created in the script editor".to_owned(),
                    diff: format!("+ {} lines", saved.code.lines().count()),
                }];
                db.scripts.insert(0, saved.clone());
            }
        }
        Ok(saved)
    })
}

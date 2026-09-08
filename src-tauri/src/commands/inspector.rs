use tauri::State;

use crate::error::{AppError, AppResult};
use crate::models::{DomNode, PageId, SelectorCandidate};
use crate::state::AppState;

#[tauri::command]
pub async fn get_dom_tree(state: State<'_, AppState>, page: PageId) -> AppResult<DomNode> {
    state
        .read(|db| db.dom_trees.get(page.key()).cloned())
        .ok_or_else(|| AppError::NotFound(format!("dom tree for {}", page.key())))
}

/// `target` is a bare DOM node id, matching `BrowserState.highlight`, so the
/// lookup stays an equality check rather than selector parsing. An unknown node
/// is not an error — the inspector shows "no candidates" for it.
#[tauri::command]
pub async fn get_selector_candidates(
    state: State<'_, AppState>,
    page: PageId,
    target: String,
) -> AppResult<Vec<SelectorCandidate>> {
    Ok(state.read(|db| {
        // The page is part of the request so the frontend can key its cache by
        // it; ids are unique across the fake site, so it does not narrow here.
        let _ = page;
        db.selectors.get(&target).cloned().unwrap_or_default()
    }))
}

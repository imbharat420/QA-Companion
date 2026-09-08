use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::models::{ListQuery, Paged, Workspace, WorkspaceFolder, WorkspaceOwner};
use crate::state::AppState;
use crate::store::now_iso;

use super::{matches_search, paginate};

/// `Pick<Workspace, "name" | "path" | "framework"> & Partial<Workspace>` — only
/// the three the Projects dialog requires are mandatory here too.
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub path: String,
    pub framework: String,
    pub id: Option<String>,
    pub branch: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub folder: Option<String>,
    pub dev_command: Option<String>,
    pub test_command: Option<String>,
    pub git_url: Option<String>,
    pub starred: Option<bool>,
    pub owner: Option<WorkspaceOwner>,
}

#[tauri::command]
pub async fn list_projects(
    state: State<'_, AppState>,
    query: Option<ListQuery>,
) -> AppResult<Paged<Workspace>> {
    Ok(state.read(|db| {
        let hits: Vec<Workspace> = db
            .workspaces
            .iter()
            .filter(|ws| {
                matches_search(
                    query.as_ref(),
                    &[&ws.name, &ws.path, &ws.framework, &ws.category, &ws.description],
                )
            })
            .cloned()
            .collect();
        paginate(&hits, query.as_ref())
    }))
}

#[tauri::command]
pub async fn get_project(state: State<'_, AppState>, id: String) -> AppResult<Option<Workspace>> {
    Ok(state.read(|db| db.workspaces.iter().find(|ws| ws.id == id).cloned()))
}

/// Counts are recomputed rather than stored: `create_project` would otherwise
/// have to remember to bump the right folder.
#[tauri::command]
pub async fn list_project_folders(state: State<'_, AppState>) -> AppResult<Vec<WorkspaceFolder>> {
    Ok(state.read(|db| {
        db.folders
            .iter()
            .map(|folder| WorkspaceFolder {
                count: db
                    .workspaces
                    .iter()
                    .filter(|ws| ws.folder.as_deref() == Some(folder.name.as_str()))
                    .count() as u32,
                ..folder.clone()
            })
            .collect()
    }))
}

#[tauri::command]
pub async fn create_project(
    app: AppHandle,
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> AppResult<Workspace> {
    if input.name.trim().is_empty() || input.path.trim().is_empty() {
        return Err(AppError::Invalid("a project needs a name and a path".into()));
    }

    let workspace = Workspace {
        id: input
            .id
            .unwrap_or_else(|| format!("ws-{}", uuid::Uuid::new_v4().simple())),
        name: input.name.trim().to_owned(),
        path: input.path.trim().to_owned(),
        framework: input.framework,
        branch: input.branch.unwrap_or_else(|| "main".to_owned()),
        sessions: 0,
        tests: 0,
        last_active: now_iso(),
        // A project with no run history has nothing to score yet; the Projects
        // page renders this as "indexing" rather than as a failing workspace.
        health: 0,
        description: input.description.unwrap_or_default(),
        dev_command: input.dev_command.unwrap_or_else(|| "npm run dev".to_owned()),
        test_command: input
            .test_command
            .unwrap_or_else(|| "npm run test:e2e".to_owned()),
        git_url: input.git_url,
        category: input.category.unwrap_or_else(|| "Uncategorised".to_owned()),
        thumbnail: "chart-1".to_owned(),
        starred: Some(input.starred.unwrap_or(false)),
        owner: input.owner.unwrap_or(WorkspaceOwner {
            name: "You".to_owned(),
            avatar: "Y".to_owned(),
        }),
        folder: Some(input.folder.unwrap_or_else(|| "Local Workspaces".to_owned())),
    };

    state.mutate(&app, |db| {
        if db.workspaces.iter().any(|ws| ws.id == workspace.id) {
            return Err(AppError::Invalid(format!("{} already exists", workspace.id)));
        }
        db.workspaces.insert(0, workspace.clone());
        Ok(workspace.clone())
    })
}

#[tauri::command]
pub async fn toggle_project_star(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> AppResult<Workspace> {
    state.mutate(&app, |db| {
        let workspace = db
            .workspaces
            .iter_mut()
            .find(|ws| ws.id == id)
            .ok_or_else(|| AppError::NotFound(format!("project {id}")))?;
        workspace.starred = Some(!workspace.starred.unwrap_or(false));
        Ok(workspace.clone())
    })
}

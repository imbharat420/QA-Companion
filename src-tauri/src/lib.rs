//! The Aether desktop shell.
//!
//! Everything the frontend can reach is registered in `run()`: one command per
//! `DataSource` method, named exactly as `src/lib/api/tauri.ts` invokes it.

pub mod commands;
pub mod error;
pub mod models;
pub mod state;
pub mod store;

use tauri::Manager;

use crate::state::AppState;
use crate::store::Db;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::new())
        .setup(|app| {
            // The state starts on the seed, so a missing or unreadable store is
            // already handled — this only promotes what is on disk.
            let db = Db::load(app.handle());
            app.state::<AppState>().replace_db(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::health_check,
            commands::system::get_dashboard_summary,
            commands::projects::list_projects,
            commands::projects::get_project,
            commands::projects::list_project_folders,
            commands::projects::create_project,
            commands::projects::toggle_project_star,
            commands::suites::list_suites,
            commands::suites::list_cases,
            commands::suites::get_case,
            commands::runs::list_runs,
            commands::runs::get_run,
            commands::runs::get_run_trend,
            commands::runs::list_flaky_tests,
            commands::runs::start_run,
            commands::findings::list_findings,
            commands::findings::get_finding,
            commands::findings::update_finding_status,
            commands::findings::apply_finding_fix,
            commands::quality::list_a11y_issues,
            commands::quality::get_a11y_summary,
            commands::quality::list_security_issues,
            commands::quality::get_security_summary,
            commands::quality::get_perf_summary,
            commands::quality::list_visual_baselines,
            commands::quality::get_visual_summary,
            commands::quality::approve_baseline,
            commands::quality::list_api_endpoints,
            commands::quality::get_api_summary,
            commands::scripts::list_scripts,
            commands::scripts::get_script,
            commands::scripts::save_script,
            commands::inspector::get_dom_tree,
            commands::inspector::get_selector_candidates,
            commands::agent::start_agent_task,
            commands::agent::stop_agent_task,
            commands::agent::resolve_approval,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start the Aether window");
}

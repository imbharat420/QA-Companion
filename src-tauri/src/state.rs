//! The managed application state.
//!
//! Two locks, both `parking_lot`: the database and the live agent task registry.
//! Nothing outside this module touches either of them — commands hand in a
//! closure and get a value back, which is what keeps the "never hold a guard
//! across an `.await`" rule mechanical rather than a matter of discipline.

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::{Mutex, RwLock};
use tauri::AppHandle;
use tokio::sync::{watch, Notify};

use crate::error::{AppError, AppResult};
use crate::store::Db;

/// A running agent task: the cancel signal it polls, the gate it parks on at an
/// approval, and the approval it is currently waiting for.
pub struct TaskHandle {
    cancel: watch::Sender<bool>,
    gate: Arc<Notify>,
    pending_approval: Option<String>,
}

pub struct AppState {
    db: RwLock<Db>,
    tasks: Mutex<HashMap<String, TaskHandle>>,
}

impl AppState {
    /// Starts on the seed so every command works before `setup()` has read the
    /// store off disk — a query that lands during startup gets data, not an error.
    pub fn new() -> Self {
        Self {
            db: RwLock::new(Db::seed()),
            tasks: Mutex::new(HashMap::new()),
        }
    }

    /* --- database ------------------------------------------------------- */

    /// Read-only access. The closure returns owned data, so the guard dies here.
    pub fn read<R>(&self, f: impl FnOnce(&Db) -> R) -> R {
        f(&self.db.read())
    }

    /// Mutate then persist. Routing every write through one place is what makes
    /// "a change is always on disk" true without each command remembering to
    /// save, and the snapshot is taken so the file I/O happens unlocked.
    pub fn mutate<R>(&self, app: &AppHandle, f: impl FnOnce(&mut Db) -> AppResult<R>) -> AppResult<R> {
        let (result, snapshot) = {
            let mut db = self.db.write();
            let result = f(&mut db)?;
            (result, db.clone())
        };
        snapshot.save(app)?;
        Ok(result)
    }

    pub fn replace_db(&self, db: Db) {
        *self.db.write() = db;
    }

    /* --- agent tasks ---------------------------------------------------- */

    /// Registers a task and hands back the receiver its worker loop selects on.
    pub fn register_task(&self, task_id: &str, gate: Arc<Notify>) -> watch::Receiver<bool> {
        let (cancel, receiver) = watch::channel(false);
        self.tasks.lock().insert(
            task_id.to_owned(),
            TaskHandle {
                cancel,
                gate,
                pending_approval: None,
            },
        );
        receiver
    }

    pub fn forget_task(&self, task_id: &str) {
        self.tasks.lock().remove(task_id);
    }

    pub fn is_running(&self, task_id: &str) -> bool {
        self.tasks.lock().contains_key(task_id)
    }

    /// Records which approval the task is about to block on, so a stale
    /// `resolve_approval` for an earlier gate cannot release the current one.
    pub fn arm_approval(&self, task_id: &str, approval_id: &str) {
        if let Some(handle) = self.tasks.lock().get_mut(task_id) {
            handle.pending_approval = Some(approval_id.to_owned());
        }
    }

    pub fn pending_approvals(&self) -> u32 {
        self.tasks
            .lock()
            .values()
            .filter(|handle| handle.pending_approval.is_some())
            .count() as u32
    }

    /// Flips the cancel watch and wakes the gate, so a task parked at an
    /// approval stops as promptly as one mid-step.
    pub fn cancel_task(&self, task_id: &str) -> AppResult<()> {
        let mut tasks = self.tasks.lock();
        let handle = tasks
            .get_mut(task_id)
            .ok_or_else(|| AppError::NotFound(format!("agent task {task_id}")))?;
        let _ = handle.cancel.send(true);
        handle.gate.notify_one();
        Ok(())
    }

    /// Releases the approval gate. `notify_one` rather than `notify_waiters`
    /// because it stores a permit: a decision that arrives in the window between
    /// arming the gate and parking on it must not be lost.
    pub fn release_approval(&self, task_id: &str, approval_id: &str) -> AppResult<()> {
        let mut tasks = self.tasks.lock();
        let handle = tasks
            .get_mut(task_id)
            .ok_or_else(|| AppError::NotFound(format!("agent task {task_id}")))?;
        match handle.pending_approval.as_deref() {
            Some(pending) if pending == approval_id => {
                handle.pending_approval = None;
                handle.gate.notify_one();
                Ok(())
            }
            Some(pending) => Err(AppError::Invalid(format!(
                "approval {approval_id} is not the open gate ({pending} is)"
            ))),
            None => Err(AppError::Invalid(format!(
                "task {task_id} is not waiting for an approval"
            ))),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

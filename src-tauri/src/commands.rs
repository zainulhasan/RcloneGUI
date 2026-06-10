use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use serde_json::Value;
use tauri::State;

use crate::disk;
use crate::rclone::daemon::{self, DaemonHandle, DaemonStatus};
use crate::rclone::detect::{self, RcloneInfo};
use crate::rclone::{port, proxy};

#[derive(Default)]
pub struct DaemonState(pub Mutex<Option<DaemonHandle>>);

impl DaemonState {
    pub fn status(&self) -> DaemonStatus {
        let mut guard = self.0.lock().expect("daemon state poisoned");
        if let Some(handle) = guard.as_mut() {
            if handle.is_running() {
                return DaemonStatus {
                    running: true,
                    port: Some(handle.port),
                    pid: Some(handle.pid()),
                };
            }
        }
        DaemonStatus {
            running: false,
            port: None,
            pid: None,
        }
    }

    pub fn shutdown(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut handle) = guard.take() {
                let _ = handle.stop();
            }
        }
    }
}

/// Detect the rclone installation. Returns `None` when not found so the
/// frontend can offer a download.
#[tauri::command]
pub fn detect_rclone(configured_path: Option<String>) -> Option<RcloneInfo> {
    let path = detect::find_rclone(configured_path.as_deref())?;
    detect::probe(&path)
}

/// Start the RC daemon (no-op if already running) and return its status.
#[tauri::command]
pub async fn daemon_start(
    state: State<'_, DaemonState>,
    configured_path: Option<String>,
) -> Result<DaemonStatus, String> {
    let current = state.status();
    if current.running {
        return Ok(current);
    }

    let binary = detect::find_rclone(configured_path.as_deref())
        .ok_or_else(|| "rclone binary not found".to_string())?;

    let rc_port = port::pick_free_port().map_err(|e| format!("no free port: {e}"))?;
    let handle = daemon::spawn_daemon(&binary.to_string_lossy(), rc_port)
        .map_err(|e| format!("failed to start rclone daemon: {e}"))?;

    // Store before the readiness wait so a failed wait still gets cleaned up.
    {
        let mut guard = state.0.lock().expect("daemon state poisoned");
        *guard = Some(handle);
    }

    if let Err(e) = daemon::wait_until_ready(rc_port, Duration::from_secs(15)).await {
        state.shutdown();
        return Err(e);
    }

    Ok(state.status())
}

#[tauri::command]
pub fn daemon_stop(state: State<'_, DaemonState>) {
    state.shutdown();
}

#[tauri::command]
pub fn daemon_status(state: State<'_, DaemonState>) -> DaemonStatus {
    state.status()
}

/// Proxy a single RC API call to the running daemon.
#[tauri::command]
pub async fn rc_call(
    state: State<'_, DaemonState>,
    method: String,
    params: Value,
) -> Result<Value, String> {
    let status = state.status();
    let port = status
        .port
        .filter(|_| status.running)
        .ok_or_else(|| "rclone daemon is not running".to_string())?;
    proxy::rc_call(port, &method, params).await
}

/// Free disk space (bytes) on the filesystem containing `path`.
#[tauri::command]
pub fn disk_free(path: String) -> Result<u64, String> {
    disk::available_space(Path::new(&path)).map_err(|e| e.to_string())
}

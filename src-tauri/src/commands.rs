use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;

use serde::Deserialize;
use serde_json::Value;
use tauri::State;

use crate::disk;
use crate::rclone::daemon::{self, DaemonHandle, DaemonStatus};
use crate::rclone::detect::{self, RcloneInfo};
use crate::rclone::{port, proxy, stale};

#[derive(Default)]
pub struct DaemonState(pub Mutex<Option<DaemonHandle>>);

/// Serializes `daemon_start` so concurrent calls (e.g. React strict-mode
/// double effects) can't both pass the "already running" check and spawn
/// two daemons.
#[derive(Default)]
pub struct StartLock(pub tokio::sync::Mutex<()>);

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
                stale::clear_pid(&stale::default_pidfile());
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
    start_lock: State<'_, StartLock>,
    configured_path: Option<String>,
) -> Result<DaemonStatus, String> {
    let _serialized = start_lock.0.lock().await;
    let current = state.status();
    if current.running {
        return Ok(current);
    }

    let binary = detect::find_rclone(configured_path.as_deref())
        .ok_or_else(|| "rclone binary not found".to_string())?;

    // A previous instance that died uncleanly may have left its daemon behind.
    stale::kill_stale(&stale::default_pidfile());

    let rc_port = port::pick_free_port().map_err(|e| format!("no free port: {e}"))?;
    let handle = daemon::spawn_daemon(&binary.to_string_lossy(), rc_port)
        .map_err(|e| format!("failed to start rclone daemon: {e}"))?;
    stale::record_pid(&stale::default_pidfile(), handle.pid());

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

/// Credentials for a remote rclone daemon (Settings → Hosts).
#[derive(Debug, Deserialize)]
pub struct HostParam {
    pub url: String,
    pub user: Option<String>,
    pub pass: Option<String>,
}

/// Proxy a single RC API call — to the local daemon, or to a remote
/// daemon when `host` is provided.
#[tauri::command]
pub async fn rc_call(
    state: State<'_, DaemonState>,
    method: String,
    params: Value,
    host: Option<HostParam>,
) -> Result<Value, String> {
    if let Some(host) = host {
        return proxy::rc_call_url(
            &host.url,
            host.user.as_deref(),
            host.pass.as_deref(),
            &method,
            params,
        )
        .await;
    }
    let status = state.status();
    let port = status
        .port
        .filter(|_| status.running)
        .ok_or_else(|| "rclone daemon is not running".to_string())?;
    proxy::rc_call(port, &method, params).await
}

/// Captured daemon log lines (rclone writes its log to stderr).
#[tauri::command]
pub fn daemon_logs(state: State<'_, DaemonState>) -> Vec<String> {
    let guard = state.0.lock().expect("daemon state poisoned");
    guard.as_ref().map(|h| h.logs()).unwrap_or_default()
}

/// Free disk space (bytes) on the filesystem containing `path`.
#[tauri::command]
pub fn disk_free(path: String) -> Result<u64, String> {
    disk::available_space(Path::new(&path)).map_err(|e| e.to_string())
}

/// The machine's LAN IPv4 (UDP-connect trick; no packets are sent).
#[tauri::command]
pub fn lan_ip() -> Option<String> {
    let socket = std::net::UdpSocket::bind("0.0.0.0:0").ok()?;
    socket.connect("8.8.8.8:80").ok()?;
    Some(socket.local_addr().ok()?.ip().to_string())
}

/// A currently-free TCP port (for serve's "auto" port button).
#[tauri::command]
pub fn free_port() -> Result<u16, String> {
    port::pick_free_port().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lan_ip_is_a_parseable_ipv4_when_available() {
        if let Some(ip) = lan_ip() {
            assert!(ip.parse::<std::net::Ipv4Addr>().is_ok(), "got {ip}");
        }
    }

    #[test]
    fn free_port_returns_nonzero() {
        assert!(free_port().unwrap() > 0);
    }
}

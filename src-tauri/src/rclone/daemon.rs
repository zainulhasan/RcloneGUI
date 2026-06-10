use std::io;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use serde::Serialize;

/// A running rclone `rcd` daemon (or, in tests, any child process).
pub struct DaemonHandle {
    child: Child,
    pub port: u16,
}

#[derive(Debug, Clone, Serialize)]
pub struct DaemonStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub pid: Option<u32>,
}

impl DaemonHandle {
    pub fn pid(&self) -> u32 {
        self.child.id()
    }

    /// True while the child has not exited.
    pub fn is_running(&mut self) -> bool {
        matches!(self.child.try_wait(), Ok(None))
    }

    /// Kill the child and reap it. Idempotent: succeeds if already dead.
    pub fn stop(&mut self) -> io::Result<()> {
        match self.child.try_wait() {
            Ok(Some(_)) => Ok(()),
            _ => {
                self.child.kill()?;
                self.child.wait()?;
                Ok(())
            }
        }
    }
}

impl Drop for DaemonHandle {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

/// The exact arguments used to launch the RC daemon.
pub fn rcd_args(port: u16) -> Vec<String> {
    vec![
        "rcd".into(),
        "--rc-no-auth".into(),
        format!("--rc-addr=127.0.0.1:{port}"),
    ]
}

/// Spawn an arbitrary command as a managed daemon. Used directly by tests;
/// production code goes through [`spawn_daemon`].
pub fn spawn_command(command: &mut Command, port: u16) -> io::Result<DaemonHandle> {
    let child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;
    Ok(DaemonHandle { child, port })
}

/// Spawn `rclone rcd --rc-no-auth --rc-addr=127.0.0.1:<port>`.
pub fn spawn_daemon(binary: &str, port: u16) -> io::Result<DaemonHandle> {
    spawn_command(Command::new(binary).args(rcd_args(port)), port)
}

/// Poll the daemon's RC endpoint until it answers or the timeout elapses.
pub async fn wait_until_ready(port: u16, timeout: Duration) -> Result<(), String> {
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{port}/core/pid");
    let deadline = tokio::time::Instant::now() + timeout;
    loop {
        match client.post(&url).json(&serde_json::json!({})).send().await {
            Ok(resp) if resp.status().is_success() => return Ok(()),
            _ if tokio::time::Instant::now() >= deadline => {
                return Err(format!("rclone daemon did not become ready on port {port}"));
            }
            _ => tokio::time::sleep(Duration::from_millis(100)).await,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn long_running_command() -> Command {
        // A portable long-running process that ignores our fake port.
        let mut cmd = Command::new("sleep");
        cmd.arg("30");
        cmd
    }

    #[test]
    fn rcd_args_shape() {
        assert_eq!(
            rcd_args(5572),
            vec!["rcd", "--rc-no-auth", "--rc-addr=127.0.0.1:5572"]
        );
    }

    #[test]
    fn spawn_reports_running_then_stop_kills() {
        let mut daemon =
            spawn_command(&mut long_running_command(), 0).expect("spawn should succeed");
        assert!(daemon.is_running());
        assert!(daemon.pid() > 0);
        daemon.stop().expect("stop should succeed");
        assert!(!daemon.is_running());
    }

    #[test]
    fn stop_is_idempotent() {
        let mut daemon = spawn_command(&mut long_running_command(), 0).unwrap();
        daemon.stop().unwrap();
        daemon.stop().expect("second stop should be a no-op");
    }

    #[test]
    fn drop_kills_the_child() {
        let pid;
        {
            let daemon = spawn_command(&mut long_running_command(), 0).unwrap();
            pid = daemon.pid();
        }
        // After drop, the process must be gone. `kill -0` checks existence.
        let alive = Command::new("kill")
            .args(["-0", &pid.to_string()])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        assert!(!alive, "child {pid} should have been killed on drop");
    }

    #[test]
    fn spawn_missing_binary_errors() {
        let result = spawn_daemon("/definitely/not/a/real/binary", 5572);
        assert!(result.is_err());
    }

    /// Full lifecycle against a real rclone binary. Ignored by default so CI
    /// (which has no rclone) stays green; run locally with
    /// `cargo test -- --include-ignored`.
    #[tokio::test]
    #[ignore]
    async fn real_rclone_daemon_lifecycle() {
        let rclone = crate::rclone::detect::find_rclone(None).expect("rclone installed");
        let port = crate::rclone::port::pick_free_port().unwrap();
        let mut daemon = spawn_daemon(&rclone.to_string_lossy(), port).unwrap();
        wait_until_ready(port, Duration::from_secs(10))
            .await
            .expect("daemon should come up");
        assert!(daemon.is_running());
        daemon.stop().unwrap();
        assert!(!daemon.is_running());
    }
}

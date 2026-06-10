use std::collections::VecDeque;
use std::io::{self, BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::Serialize;

/// Maximum daemon log lines kept in memory.
const LOG_CAPACITY: usize = 2000;

/// A running rclone `rcd` daemon (or, in tests, any child process).
pub struct DaemonHandle {
    child: Child,
    pub port: u16,
    logs: Arc<Mutex<VecDeque<String>>>,
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

    /// Captured stderr lines (rclone logs to stderr), oldest first.
    pub fn logs(&self) -> Vec<String> {
        self.logs
            .lock()
            .map(|l| l.iter().cloned().collect())
            .unwrap_or_default()
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
        "--log-level".into(),
        "INFO".into(),
    ]
}

/// Spawn an arbitrary command as a managed daemon. Used directly by tests;
/// production code goes through [`spawn_daemon`].
pub fn spawn_command(command: &mut Command, port: u16) -> io::Result<DaemonHandle> {
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()?;

    let logs = Arc::new(Mutex::new(VecDeque::new()));
    if let Some(stderr) = child.stderr.take() {
        let sink = Arc::clone(&logs);
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                if let Ok(mut buffer) = sink.lock() {
                    if buffer.len() >= LOG_CAPACITY {
                        buffer.pop_front();
                    }
                    buffer.push_back(line);
                }
            }
        });
    }

    Ok(DaemonHandle { child, port, logs })
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
            vec![
                "rcd",
                "--rc-no-auth",
                "--rc-addr=127.0.0.1:5572",
                "--log-level",
                "INFO"
            ]
        );
    }

    #[test]
    fn captures_stderr_lines() {
        let mut cmd = Command::new("sh");
        cmd.args(["-c", "echo one >&2; echo two >&2; sleep 30"]);
        let mut daemon = spawn_command(&mut cmd, 0).unwrap();
        // The reader thread needs a moment to drain the pipe.
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        loop {
            let logs = daemon.logs();
            if logs.len() >= 2 {
                assert_eq!(logs, vec!["one", "two"]);
                break;
            }
            assert!(std::time::Instant::now() < deadline, "logs never arrived");
            std::thread::sleep(Duration::from_millis(20));
        }
        daemon.stop().unwrap();
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

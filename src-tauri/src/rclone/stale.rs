//! Cleanup of daemons orphaned by an unclean exit (crash, force-kill,
//! `tauri dev` rebuild). The spawned daemon's PID is recorded in a pidfile;
//! the next startup kills the recorded process if — and only if — it still
//! looks like our daemon.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Default pidfile location, shared across app instances per machine.
pub fn default_pidfile() -> PathBuf {
    std::env::temp_dir().join("rclonegui-daemon.pid")
}

pub fn record_pid(pidfile: &Path, pid: u32) {
    let _ = std::fs::write(pidfile, pid.to_string());
}

pub fn clear_pid(pidfile: &Path) {
    let _ = std::fs::remove_file(pidfile);
}

/// Kill the daemon recorded in `pidfile` if it is still alive and its
/// command line matches our spawn signature. Always removes the pidfile.
pub fn kill_stale(pidfile: &Path) {
    let Ok(content) = std::fs::read_to_string(pidfile) else {
        return;
    };
    if let Ok(pid) = content.trim().parse::<u32>() {
        if is_our_daemon(pid) {
            kill_process(pid);
        }
    }
    clear_pid(pidfile);
}

/// True when the process command line matches `rclone rcd --rc-no-auth …`.
fn is_our_daemon(pid: u32) -> bool {
    command_line(pid).is_some_and(|cmd| {
        cmd.contains("rclone") && cmd.contains("rcd") && cmd.contains("--rc-no-auth")
    })
}

#[cfg(unix)]
fn command_line(pid: u32) -> Option<String> {
    let output = Command::new("ps")
        .args(["-p", &pid.to_string(), "-o", "command="])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).into_owned())
}

#[cfg(unix)]
fn kill_process(pid: u32) {
    let _ = Command::new("kill").arg(pid.to_string()).status();
}

#[cfg(windows)]
fn command_line(pid: u32) -> Option<String> {
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"])
        .output()
        .ok()?;
    let line = String::from_utf8_lossy(&output.stdout).into_owned();
    // tasklist only exposes the image name; match on that.
    line.to_lowercase()
        .contains("rclone")
        .then_some("rclone rcd --rc-no-auth".to_string())
}

#[cfg(windows)]
fn kill_process(pid: u32) {
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .status();
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_pidfile(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("rclonegui-test-{name}-{}.pid", std::process::id()))
    }

    #[test]
    fn record_and_clear_roundtrip() {
        let pidfile = temp_pidfile("roundtrip");
        record_pid(&pidfile, 12345);
        assert_eq!(std::fs::read_to_string(&pidfile).unwrap(), "12345");
        clear_pid(&pidfile);
        assert!(!pidfile.exists());
    }

    #[test]
    fn kill_stale_ignores_missing_pidfile() {
        kill_stale(&temp_pidfile("missing"));
    }

    #[test]
    fn kill_stale_spares_unrelated_processes_and_removes_pidfile() {
        // A live process that is NOT an rclone daemon must survive.
        let mut child = Command::new("sleep").arg("30").spawn().unwrap();
        let pidfile = temp_pidfile("unrelated");
        record_pid(&pidfile, child.id());

        kill_stale(&pidfile);

        assert!(!pidfile.exists(), "pidfile should be removed");
        assert!(
            matches!(child.try_wait(), Ok(None)),
            "unrelated process must not be killed"
        );
        let _ = child.kill();
        let _ = child.wait();
    }

    #[test]
    fn kill_stale_handles_dead_pid_and_garbage() {
        let pidfile = temp_pidfile("garbage");
        std::fs::write(&pidfile, "not-a-pid").unwrap();
        kill_stale(&pidfile);
        assert!(!pidfile.exists());
    }
}

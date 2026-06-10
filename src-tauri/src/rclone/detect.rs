use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct RcloneInfo {
    pub path: String,
    pub version: String,
}

/// Locate the rclone binary: an explicitly configured path wins, then `PATH`.
pub fn find_rclone(configured: Option<&str>) -> Option<PathBuf> {
    if let Some(p) = configured {
        let path = PathBuf::from(p);
        if path.is_file() {
            return Some(path);
        }
    }
    which::which("rclone").ok()
}

/// Run `rclone version` to confirm the binary works and read its version.
pub fn probe(path: &Path) -> Option<RcloneInfo> {
    let output = Command::new(path).arg("version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let version = parse_version(&stdout)?;
    Some(RcloneInfo {
        path: path.to_string_lossy().into_owned(),
        version,
    })
}

/// Extract `v1.66.0` from the first line of `rclone version` output
/// (`rclone v1.66.0`).
pub fn parse_version(output: &str) -> Option<String> {
    let first = output.lines().next()?;
    let token = first.split_whitespace().find(|t| t.starts_with('v'))?;
    if token.len() > 1
        && token[1..]
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_digit())
    {
        Some(token.to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_version_from_standard_output() {
        let out = "rclone v1.66.0\n- os/version: darwin 14.0\n- go/version: go1.22\n";
        assert_eq!(parse_version(out), Some("v1.66.0".to_string()));
    }

    #[test]
    fn parses_beta_version() {
        let out = "rclone v1.67.0-beta.7890.abcdef123\n";
        assert_eq!(
            parse_version(out),
            Some("v1.67.0-beta.7890.abcdef123".to_string())
        );
    }

    #[test]
    fn rejects_garbage_output() {
        assert_eq!(parse_version("command not found"), None);
        assert_eq!(parse_version(""), None);
        assert_eq!(parse_version("rclone vX"), None);
    }

    #[test]
    fn configured_path_must_exist() {
        assert_eq!(
            find_rclone(Some("/nonexistent/definitely/not/rclone")),
            which::which("rclone").ok()
        );
    }
}

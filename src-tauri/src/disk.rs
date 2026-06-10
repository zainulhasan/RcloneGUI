use std::path::Path;

/// Free bytes available to the current user on the filesystem containing
/// `path`. Walks up to the nearest existing ancestor so it works for
/// not-yet-created watch folders.
pub fn available_space(path: &Path) -> std::io::Result<u64> {
    let mut probe = path;
    loop {
        if probe.exists() {
            return fs4::available_space(probe);
        }
        match probe.parent() {
            Some(parent) => probe = parent,
            None => {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("no existing ancestor for {}", path.display()),
                ))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_space_for_existing_dir() {
        let dir = tempfile::tempdir().unwrap();
        let space = available_space(dir.path()).unwrap();
        assert!(space > 0, "temp dir should have free space");
    }

    #[test]
    fn walks_up_for_missing_path() {
        let dir = tempfile::tempdir().unwrap();
        let missing = dir.path().join("not/created/yet");
        let space = available_space(&missing).unwrap();
        assert!(space > 0);
    }
}

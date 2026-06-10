use std::io;
use std::net::TcpListener;

/// Ask the OS for a free TCP port on the loopback interface.
///
/// The listener is dropped before returning, so there is a small window in
/// which another process could grab the port; the daemon spawn retries on a
/// fresh port if binding fails.
pub fn pick_free_port() -> io::Result<u16> {
    let listener = TcpListener::bind(("127.0.0.1", 0))?;
    Ok(listener.local_addr()?.port())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_a_nonzero_port() {
        let port = pick_free_port().expect("should find a free port");
        assert!(port > 0);
    }

    #[test]
    fn port_is_bindable_after_selection() {
        // Another parallel test can grab the port between selection and bind,
        // so allow a few attempts — one success proves the mechanism.
        for _ in 0..5 {
            let port = pick_free_port().expect("should find a free port");
            if TcpListener::bind(("127.0.0.1", port)).is_ok() {
                return;
            }
        }
        panic!("selected ports were never bindable");
    }

    #[test]
    fn successive_calls_can_return_different_ports() {
        // Not guaranteed by the OS, but holding the first listener open forces it.
        let first = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let first_port = first.local_addr().unwrap().port();
        let second = pick_free_port().unwrap();
        assert_ne!(first_port, second);
    }
}

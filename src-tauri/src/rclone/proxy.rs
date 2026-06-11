use serde_json::Value;

/// Build the RC endpoint URL for a method like `operations/list`.
pub fn rc_url(port: u16, method: &str) -> String {
    let method = method.trim_matches('/');
    format!("http://127.0.0.1:{port}/{method}")
}

/// Join a remote daemon base URL and an RC method path.
pub fn join_rc_url(base: &str, method: &str) -> String {
    format!(
        "{}/{}",
        base.trim_end_matches('/'),
        method.trim_matches('/')
    )
}

/// POST an RC call to a remote rclone daemon (basic auth when `user` set).
pub async fn rc_call_url(
    base: &str,
    user: Option<&str>,
    pass: Option<&str>,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let mut request = client.post(join_rc_url(base, method)).json(&params);
    if let Some(user) = user.filter(|u| !u.is_empty()) {
        request = request.basic_auth(user, pass);
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("RC request to {base} failed: {e}"))?;

    let status = response.status();
    if status.as_u16() == 401 {
        return Err("authentication failed — check the host's user and password".to_string());
    }
    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("RC response was not JSON: {e}"))?;

    if status.is_success() {
        Ok(body)
    } else {
        Err(extract_rc_error(&body, status.as_u16()))
    }
}

/// POST a JSON-RPC style call to the local rclone daemon and return the JSON
/// response. rclone signals errors with a non-2xx status and an `error` field.
pub async fn rc_call(port: u16, method: &str, params: Value) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let response = client
        .post(rc_url(port, method))
        .json(&params)
        .send()
        .await
        .map_err(|e| format!("RC request failed: {e}"))?;

    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|e| format!("RC response was not JSON: {e}"))?;

    if status.is_success() {
        Ok(body)
    } else {
        Err(extract_rc_error(&body, status.as_u16()))
    }
}

/// Shape rclone's error payload (`{"error": "...", "status": 500, ...}`)
/// into a readable message.
pub fn extract_rc_error(body: &Value, http_status: u16) -> String {
    body.get("error")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .unwrap_or_else(|| format!("RC call failed with HTTP {http_status}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn url_shaping() {
        assert_eq!(
            rc_url(5572, "operations/list"),
            "http://127.0.0.1:5572/operations/list"
        );
    }

    #[test]
    fn url_shaping_trims_slashes() {
        assert_eq!(rc_url(80, "/core/stats/"), "http://127.0.0.1:80/core/stats");
    }

    #[test]
    fn join_rc_url_trims_slashes() {
        assert_eq!(
            join_rc_url("http://nas.local:5572/", "/core/version/"),
            "http://nas.local:5572/core/version"
        );
        assert_eq!(
            join_rc_url("http://nas.local:5572", "operations/list"),
            "http://nas.local:5572/operations/list"
        );
    }

    #[test]
    fn extracts_rclone_error_message() {
        let body = json!({"error": "directory not found", "status": 404});
        assert_eq!(extract_rc_error(&body, 404), "directory not found");
    }

    #[test]
    fn falls_back_to_http_status() {
        let body = json!({"unexpected": true});
        assert_eq!(extract_rc_error(&body, 500), "RC call failed with HTTP 500");
    }
}

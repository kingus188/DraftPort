//! Shared leaf helpers: JSON response shaping, HTTP responses, path and time
//! formatting used across the desktop command modules.

use std::{fs, path::Path};

use chrono::{DateTime, SecondsFormat, Utc};
use tauri::http;

/// Converts a successful payload to the legacy JSON response shape.
pub(crate) fn json_success(payload: serde_json::Value) -> serde_json::Value {
    let mut value = payload;
    value["success"] = serde_json::json!(true);
    value
}

/// Converts an error message to the legacy JSON response shape.
pub(crate) fn json_error(message: &str) -> serde_json::Value {
    serde_json::json!({ "success": false, "error": message })
}

/// Builds a simple HTTP response with an explicit status.
pub(crate) fn response_with_status(
    status: http::StatusCode,
    body: Vec<u8>,
) -> http::Response<Vec<u8>> {
    http::Response::builder()
        .status(status)
        .body(body)
        .expect("status response should build")
}

/// Formats a path for the renderer.
pub(crate) fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

/// Formats metadata timestamps as ISO strings for stable JS Date parsing.
pub(crate) fn metadata_time(metadata: Option<&fs::Metadata>, created: bool) -> String {
    metadata
        .and_then(|value| {
            if created {
                value.created().ok()
            } else {
                value.modified().ok()
            }
        })
        .map(format_system_time)
        .unwrap_or_else(current_timestamp)
}

/// Converts system time to milliseconds since epoch.
pub(crate) fn system_time_ms(time: std::time::SystemTime) -> Option<u64> {
    time.duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

/// Formats a system timestamp in the ISO shape used by the former Electron store.
fn format_system_time(time: std::time::SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339_opts(SecondsFormat::Millis, true)
}

/// Returns a monotonic-enough ISO timestamp string for recent item ordering.
pub(crate) fn current_timestamp() -> String {
    format_system_time(std::time::SystemTime::now())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamps_use_js_parseable_iso_format() {
        let timestamp = format_system_time(std::time::UNIX_EPOCH);

        assert_eq!(timestamp, "1970-01-01T00:00:00.000Z");
    }
}

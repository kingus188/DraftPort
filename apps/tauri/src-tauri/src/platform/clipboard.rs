//! Native clipboard writes and trash operations backed by cross-platform crates.

use std::path::Path;

use arboard::Clipboard;
use serde::Deserialize;

use crate::shared::util::{json_error, json_success};

/// Payload used when writing rich copy output to the native clipboard.
#[derive(Debug, Deserialize)]
pub(crate) struct ClipboardHtmlPayload {
    html: Option<String>,
    text: Option<String>,
}

/// Writes plain text to the system clipboard.
pub(crate) fn write_text_to_clipboard(text: &str) -> Result<serde_json::Value, String> {
    if text.trim().is_empty() {
        return Ok(json_error("文本不能为空"));
    }
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    match clipboard.set_text(text) {
        Ok(()) => Ok(json_success(serde_json::json!({}))),
        Err(error) => Ok(json_error(&error.to_string())),
    }
}

/// Moves a file or folder to the system trash while preserving recoverability.
pub(crate) fn move_path_to_trash(path: &Path) -> Result<(), String> {
    trash::delete(path).map_err(|error| error.to_string())
}

/// Validates rich clipboard input and keeps the plain-text fallback alongside HTML.
pub(crate) fn html_clipboard_input(
    payload: &ClipboardHtmlPayload,
) -> Result<(String, String), String> {
    let html = payload
        .html
        .as_deref()
        .unwrap_or_default()
        .trim()
        .to_string();
    if html.is_empty() {
        return Err("HTML 不能为空".to_string());
    }
    let text = payload
        .text
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(&html)
        .to_string();
    Ok((html, text))
}

/// Writes HTML and a plain-text fallback to the system clipboard.
// ponytail: arboard backs the clipboard with the running app process. On Linux
// X11 the contents can vanish without a clipboard manager; fine for the
// mac/Windows targets, revisit with SetExtLinux::wait() if Linux ships.
pub(crate) fn write_html_to_clipboard(html: &str, text: &str) -> Result<serde_json::Value, String> {
    let mut clipboard = Clipboard::new().map_err(|error| error.to_string())?;
    match clipboard.set_html(html, Some(text)) {
        Ok(()) => Ok(json_success(serde_json::json!({}))),
        Err(error) => Ok(json_error(&error.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn html_clipboard_input_rejects_empty_html() {
        let payload = ClipboardHtmlPayload {
            html: Some("  ".to_string()),
            text: Some("Fallback".to_string()),
        };

        assert_eq!(
            html_clipboard_input(&payload),
            Err("HTML 不能为空".to_string())
        );
    }

    #[test]
    fn html_clipboard_input_keeps_html_and_plain_text() {
        let payload = ClipboardHtmlPayload {
            html: Some("<strong>Hello</strong>".to_string()),
            text: Some("Hello".to_string()),
        };

        assert_eq!(
            html_clipboard_input(&payload),
            Ok(("<strong>Hello</strong>".to_string(), "Hello".to_string()))
        );
    }
}

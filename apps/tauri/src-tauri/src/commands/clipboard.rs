//! Commands for writing rich HTML and plain text to the native clipboard.

use crate::platform::clipboard::{
    html_clipboard_input, write_html_to_clipboard, write_text_to_clipboard, ClipboardHtmlPayload,
};
use crate::shared::util::json_error;

/// Writes HTML copy output to the native rich-text clipboard.
#[tauri::command]
pub(crate) fn clipboard_write_html(
    payload: ClipboardHtmlPayload,
) -> Result<serde_json::Value, String> {
    let (html, text) = match html_clipboard_input(&payload) {
        Ok(value) => value,
        Err(error) => return Ok(json_error(&error)),
    };
    write_html_to_clipboard(&html, &text)
}

/// Writes plain text to the native clipboard.
#[tauri::command]
pub(crate) fn clipboard_write_text(text: String) -> Result<serde_json::Value, String> {
    write_text_to_clipboard(&text)
}

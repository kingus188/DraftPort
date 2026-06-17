//! Commands for window controls, opening external URLs, and reporting the host
//! platform.

use tauri::WebviewWindow;

/// Returns the Node-style platform string expected by the renderer.
#[tauri::command]
pub(crate) fn desktop_platform() -> &'static str {
    if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "windows") {
        "win32"
    } else {
        "linux"
    }
}

/// Minimizes the current Tauri window.
#[tauri::command]
pub(crate) fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

/// Toggles maximized state for the current Tauri window.
#[tauri::command]
pub(crate) fn window_maximize(window: WebviewWindow) -> Result<(), String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

/// Closes the current Tauri window.
#[tauri::command]
pub(crate) fn window_close(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

/// Returns whether the current Tauri window is maximized.
#[tauri::command]
pub(crate) fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|error| error.to_string())
}

/// Opens an external URL with the operating system default handler.
#[tauri::command]
pub(crate) fn shell_open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Ok(());
    }
    open::that(url).map_err(|error| error.to_string())
}

//! Commands for activating a workspace and listing its file tree.

use std::path::PathBuf;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::domain::recent::record_recent_item;
use crate::domain::workspace::{
    activate_workspace, is_path_inside_workspace_state, resolve_workspace_path, scan_workspace,
};
use crate::shared::model::{DesktopState, RecentItemType};
use crate::shared::util::{json_error, json_success, path_string};

/// Opens a native folder picker and activates the selected workspace.
#[tauri::command]
pub(crate) async fn workspace_select(
    app: AppHandle,
    state: State<'_, DesktopState>,
) -> Result<serde_json::Value, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("选择 DraftPort 工作区文件夹")
        .blocking_pick_folder();
    let Some(folder) = selected.and_then(|path| path.into_path().ok()) else {
        return Ok(json_success(serde_json::json!({ "canceled": true })));
    };
    activate_workspace(&app, &state, &folder)?;
    record_recent_item(&app, &state, &folder, RecentItemType::Folder, None, None)?;
    Ok(json_success(
        serde_json::json!({ "path": path_string(&folder) }),
    ))
}

/// Activates a workspace path supplied by the renderer.
#[tauri::command]
pub(crate) fn workspace_set(
    app: AppHandle,
    state: State<'_, DesktopState>,
    dir: String,
) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(dir);
    if !path.exists() || !path.is_dir() {
        return Ok(json_error("Directory not found"));
    }
    activate_workspace(&app, &state, &path)?;
    record_recent_item(&app, &state, &path, RecentItemType::Folder, None, None)?;
    Ok(json_success(
        serde_json::json!({ "path": path_string(&path) }),
    ))
}

/// Lists Markdown files and folders inside the active workspace.
#[tauri::command]
pub(crate) async fn file_list(
    state: State<'_, DesktopState>,
    dir: Option<String>,
) -> Result<serde_json::Value, String> {
    let target = resolve_workspace_path(&state, dir.as_deref())?;
    if !is_path_inside_workspace_state(&state, &target)? {
        return Ok(json_error("非法路径"));
    }
    let files = tauri::async_runtime::spawn_blocking(move || scan_workspace(&target))
        .await
        .map_err(|error| error.to_string())?;
    Ok(json_success(
        serde_json::json!({ "files": files }),
    ))
}

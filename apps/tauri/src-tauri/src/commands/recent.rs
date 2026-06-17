//! Commands for listing, recording, removing, clearing, and re-pathing recent
//! files and folders.

use std::path::Path;

use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::domain::recent::{
    record_recent_item, refresh_recent_missing_flags, remove_recent_path, rename_recent_path,
    save_recent_items,
};
use crate::domain::workspace::current_workspace;
use crate::platform::menu::refresh_app_menu;
use crate::shared::model::{DesktopState, RecentItemType};
use crate::shared::util::{json_success, path_string};

/// Payload used when a file or folder is renamed in recent item metadata.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenamePathPayload {
    old_path: String,
    new_path: String,
}

/// Payload used when recording a recent local file or folder.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecordOpenPayload {
    item_path: String,
    item_type: RecentItemType,
    title: Option<String>,
    theme_name: Option<String>,
}

/// Lists recent files and folders, optionally scoped to the active workspace.
#[tauri::command]
pub(crate) fn recent_items_list(
    app: AppHandle,
    state: State<'_, DesktopState>,
    limit: Option<usize>,
) -> Result<serde_json::Value, String> {
    refresh_recent_missing_flags(&app, &state)?;
    let workspace = current_workspace(&state).ok();
    let mut items = state
        .recent_items
        .lock()
        .map_err(|_| "Recent item lock poisoned".to_string())?
        .iter()
        .filter(|item| !item.missing)
        .filter(|item| {
            workspace
                .as_ref()
                .map(|path| item.workspace_path == path_string(path))
                .unwrap_or(true)
        })
        .cloned()
        .collect::<Vec<_>>();
    items.sort_by(|left, right| right.opened_at.cmp(&left.opened_at));
    items.truncate(limit.unwrap_or(100));
    Ok(json_success(serde_json::json!({ "items": items })))
}

/// Records a recent file or folder from renderer-side actions.
#[tauri::command]
pub(crate) fn recent_items_record_open(
    app: AppHandle,
    state: State<'_, DesktopState>,
    payload: RecordOpenPayload,
) -> Result<serde_json::Value, String> {
    let item = record_recent_item(
        &app,
        &state,
        Path::new(&payload.item_path),
        payload.item_type,
        payload.title,
        payload.theme_name,
    )?;
    Ok(json_success(serde_json::json!({ "item": item })))
}

/// Removes a path from the recent list.
#[tauri::command]
pub(crate) fn recent_items_remove(
    app: AppHandle,
    state: State<'_, DesktopState>,
    item_path: String,
) -> Result<serde_json::Value, String> {
    remove_recent_path(&app, &state, Path::new(&item_path))?;
    refresh_app_menu(&app)?;
    Ok(json_success(serde_json::json!({})))
}

/// Clears recent items for the active workspace.
#[tauri::command]
pub(crate) fn recent_items_clear(
    app: AppHandle,
    state: State<'_, DesktopState>,
) -> Result<serde_json::Value, String> {
    let workspace = current_workspace(&state)?;
    state
        .recent_items
        .lock()
        .map_err(|_| "Recent item lock poisoned".to_string())?
        .retain(|item| item.workspace_path != path_string(&workspace));
    save_recent_items(&app, &state)?;
    refresh_app_menu(&app)?;
    Ok(json_success(serde_json::json!({})))
}

/// Renames recent item paths after filesystem moves.
#[tauri::command]
pub(crate) fn recent_items_rename_path(
    app: AppHandle,
    state: State<'_, DesktopState>,
    payload: RenamePathPayload,
) -> Result<serde_json::Value, String> {
    rename_recent_path(
        &app,
        &state,
        Path::new(&payload.old_path),
        Path::new(&payload.new_path),
    )?;
    refresh_app_menu(&app)?;
    Ok(json_success(serde_json::json!({})))
}

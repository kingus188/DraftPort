//! Persistence and mutation of the recent files and folders list stored in the
//! app data directory.

use std::{
    fs,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager, State};

use crate::domain::workspace::{current_workspace, is_path_inside_workspace};
use crate::shared::model::{DesktopState, RecentItemRecord, RecentItemType};
use crate::shared::util::{current_timestamp, path_string, system_time_ms};

const RECENT_ITEMS_FILE: &str = "recent-items.json";

/// Loads recent items from the app data directory during startup.
pub(crate) fn load_recent_items(app: &AppHandle) -> tauri::Result<()> {
    let state = app.state::<DesktopState>();
    let path = recent_items_path(app)?;
    let items = fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str::<Vec<RecentItemRecord>>(&content).ok())
        .unwrap_or_default();
    *state
        .recent_items
        .lock()
        .expect("recent item lock poisoned") = items;
    Ok(())
}

/// Persists recent items to the app data directory.
pub(crate) fn save_recent_items(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
) -> Result<(), String> {
    let path = recent_items_path(app).map_err(|error| error.to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let items = state
        .recent_items
        .lock()
        .map_err(|_| "Recent item lock poisoned".to_string())?;
    let serialized = serde_json::to_string_pretty(&*items).map_err(|error| error.to_string())?;
    fs::write(path, serialized).map_err(|error| error.to_string())
}

/// Returns the on-disk recent item metadata path.
fn recent_items_path(app: &AppHandle) -> tauri::Result<PathBuf> {
    Ok(app.path().app_data_dir()?.join(RECENT_ITEMS_FILE))
}

/// Records a recent item and trims old rows for the same workspace.
pub(crate) fn record_recent_item(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
    item_path: &Path,
    item_type: RecentItemType,
    title: Option<String>,
    theme_name: Option<String>,
) -> Result<RecentItemRecord, String> {
    let workspace = current_workspace(state)?;
    if !is_path_inside_workspace(&workspace, item_path) {
        return Err("非法路径".to_string());
    }
    let metadata = fs::metadata(item_path).ok();
    let record = RecentItemRecord {
        workspace_path: path_string(&workspace),
        item_path: path_string(item_path),
        item_type,
        title,
        theme_name,
        opened_at: current_timestamp(),
        mtime: metadata
            .as_ref()
            .and_then(|value| value.modified().ok())
            .and_then(system_time_ms),
        size: metadata
            .as_ref()
            .filter(|value| value.is_file())
            .map(|value| value.len()),
        missing: !item_path.exists(),
    };
    let mut items = state
        .recent_items
        .lock()
        .map_err(|_| "Recent item lock poisoned".to_string())?;
    items.retain(|item| {
        !(item.workspace_path == record.workspace_path
            && item.item_path == record.item_path
            && item.item_type == record.item_type)
    });
    items.push(record.clone());
    items.sort_by(|left, right| right.opened_at.cmp(&left.opened_at));
    let workspace_path = record.workspace_path.clone();
    let mut seen = 0usize;
    items.retain(|item| {
        if item.workspace_path != workspace_path {
            return true;
        }
        seen += 1;
        seen <= 100
    });
    drop(items);
    save_recent_items(app, state)?;
    Ok(record)
}

/// Removes recent entries at or below a path.
pub(crate) fn remove_recent_path(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
    item_path: &Path,
) -> Result<(), String> {
    let workspace = current_workspace(state)?;
    let item_path = path_string(item_path);
    state
        .recent_items
        .lock()
        .map_err(|_| "Recent item lock poisoned".to_string())?
        .retain(|item| {
            item.workspace_path != path_string(&workspace)
                || !(item.item_path == item_path
                    || item.item_path.starts_with(&(item_path.clone() + "/")))
        });
    save_recent_items(app, state)
}

/// Rewrites recent entries at or below a moved path.
pub(crate) fn rename_recent_path(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
    old_path: &Path,
    new_path: &Path,
) -> Result<(), String> {
    let workspace = current_workspace(state)?;
    let old_path = path_string(old_path);
    let new_path = path_string(new_path);
    for item in state
        .recent_items
        .lock()
        .map_err(|_| "Recent item lock poisoned".to_string())?
        .iter_mut()
    {
        if item.workspace_path == path_string(&workspace)
            && (item.item_path == old_path || item.item_path.starts_with(&(old_path.clone() + "/")))
        {
            item.item_path = item.item_path.replacen(&old_path, &new_path, 1);
        }
    }
    save_recent_items(app, state)
}

/// Marks recent rows whose files no longer exist as missing.
pub(crate) fn refresh_recent_missing_flags(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
) -> Result<(), String> {
    for item in state
        .recent_items
        .lock()
        .map_err(|_| "Recent item lock poisoned".to_string())?
        .iter_mut()
    {
        item.missing = !Path::new(&item.item_path).exists();
    }
    save_recent_items(app, state)
}

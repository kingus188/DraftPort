//! Commands for reading, opening, creating, saving, renaming, deleting, and
//! revealing Markdown files inside the workspace.

use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::domain::recent::{record_recent_item, remove_recent_path, rename_recent_path};
use crate::domain::workspace::{
    current_workspace, extract_frontmatter_meta, is_path_inside_workspace,
    is_path_inside_workspace_state, read_workspace_file, unique_file_path,
};
use crate::platform::clipboard::move_path_to_trash;
use crate::shared::model::{DesktopState, RecentItemType};
use crate::shared::util::{json_error, json_success, path_string};

/// Payload used when the renderer creates a Markdown file.
#[derive(Debug, Deserialize)]
pub(crate) struct CreateFilePayload {
    filename: Option<String>,
    content: Option<String>,
}

/// Payload used when the renderer writes an existing Markdown file.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveFilePayload {
    file_path: String,
    content: String,
}

/// Payload used when the renderer renames a Markdown file.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenameFilePayload {
    old_path: String,
    new_name: String,
}

/// Reads a Markdown file after checking the workspace boundary.
#[tauri::command]
pub(crate) fn file_read(
    state: State<'_, DesktopState>,
    file_path: String,
) -> Result<serde_json::Value, String> {
    read_workspace_file(&state, &file_path, false)
}

/// Opens a Markdown file and records it in the recent list.
#[tauri::command]
pub(crate) fn file_open(
    app: AppHandle,
    state: State<'_, DesktopState>,
    file_path: String,
) -> Result<serde_json::Value, String> {
    let result = read_workspace_file(&state, &file_path, true)?;
    let meta = fs::read_to_string(&file_path)
        .ok()
        .map(|content| extract_frontmatter_meta(&content))
        .unwrap_or_default();
    record_recent_item(
        &app,
        &state,
        Path::new(&file_path),
        RecentItemType::File,
        meta.title,
        Some(meta.theme_name),
    )?;
    Ok(result)
}

/// Creates a new Markdown file in the active workspace.
#[tauri::command]
pub(crate) fn file_create(
    state: State<'_, DesktopState>,
    payload: CreateFilePayload,
) -> Result<serde_json::Value, String> {
    let workspace = current_workspace(&state)?;
    let requested = payload
        .filename
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "未命名文章.md".to_string());
    let mut target = if Path::new(&requested).is_absolute() {
        PathBuf::from(requested)
    } else {
        workspace.join(requested)
    };
    if !is_path_inside_workspace(&workspace, &target) {
        return Ok(json_error("非法路径"));
    }
    target = unique_file_path(&target);
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&target, payload.content.unwrap_or_default()).map_err(|error| error.to_string())?;
    Ok(json_success(serde_json::json!({
        "filePath": path_string(&target),
        "filename": target.file_name().and_then(|name| name.to_str()).unwrap_or_default()
    })))
}

/// Saves content to an existing or newly created Markdown file.
#[tauri::command]
pub(crate) fn file_save(
    state: State<'_, DesktopState>,
    payload: SaveFilePayload,
) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(&payload.file_path);
    if !is_path_inside_workspace_state(&state, &path)? {
        return Ok(json_error("非法路径"));
    }
    let current = fs::read_to_string(&path).unwrap_or_default();
    if current != payload.content {
        fs::write(&path, payload.content).map_err(|error| error.to_string())?;
    }
    Ok(json_success(
        serde_json::json!({ "filePath": path_string(&path) }),
    ))
}

/// Renames a Markdown file and keeps recent item paths in sync.
#[tauri::command]
pub(crate) fn file_rename(
    app: AppHandle,
    state: State<'_, DesktopState>,
    payload: RenameFilePayload,
) -> Result<serde_json::Value, String> {
    let old_path = PathBuf::from(&payload.old_path);
    if !is_path_inside_workspace_state(&state, &old_path)? {
        return Ok(json_error("非法路径"));
    }
    let trimmed = payload.new_name.trim();
    if trimmed.is_empty() {
        return Ok(json_error("文件名不能为空"));
    }
    let safe_name = if trimmed.ends_with(".md") {
        trimmed.to_string()
    } else {
        format!("{trimmed}.md")
    };
    let Some(parent) = old_path.parent() else {
        return Ok(json_error("Invalid path"));
    };
    let new_path = parent.join(
        Path::new(&safe_name)
            .file_name()
            .ok_or_else(|| "Invalid filename".to_string())?,
    );
    if old_path != new_path && new_path.exists() {
        return Ok(json_error("文件名已存在"));
    }
    fs::rename(&old_path, &new_path).map_err(|error| error.to_string())?;
    rename_recent_path(&app, &state, &old_path, &new_path)?;
    Ok(json_success(
        serde_json::json!({ "filePath": path_string(&new_path) }),
    ))
}

/// Moves a Markdown file to the OS trash and removes matching recent items.
#[tauri::command]
pub(crate) fn file_delete(
    app: AppHandle,
    state: State<'_, DesktopState>,
    file_path: String,
) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(&file_path);
    if !is_path_inside_workspace_state(&state, &path)? {
        return Ok(json_error("非法路径"));
    }
    if path.exists() {
        move_path_to_trash(&path)?;
    }
    remove_recent_path(&app, &state, &path)?;
    Ok(json_success(serde_json::json!({})))
}

/// Reveals a local file in the operating system file manager.
#[tauri::command]
pub(crate) fn file_reveal(state: State<'_, DesktopState>, file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if !is_path_inside_workspace_state(&state, &path)? {
        return Ok(());
    }
    let target = path.parent().unwrap_or_else(|| path.as_path());
    open::that(target).map_err(|error| error.to_string())
}

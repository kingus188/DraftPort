//! Commands for creating, inspecting, moving, renaming, and deleting folders
//! inside the workspace.

use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::domain::recent::remove_recent_path;
use crate::domain::workspace::{
    current_workspace, is_path_inside_workspace, is_path_inside_workspace_state, move_path,
    rename_path, target_folder_or_workspace,
};
use crate::platform::clipboard::move_path_to_trash;
use crate::shared::model::DesktopState;
use crate::shared::util::{json_error, json_success, path_string};

/// Payload used when creating folders from the sidebar.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FolderNamePayload {
    folder_name: String,
}

/// Payload used when moving a file to another folder.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MoveFilePayload {
    file_path: String,
    target_folder: String,
}

/// Payload used when renaming folders.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RenameFolderPayload {
    folder_path: String,
    new_name: String,
}

/// Payload used when moving folders.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MoveFolderPayload {
    folder_path: String,
    target_folder: String,
}

/// Payload accepted by the folder delete compatibility endpoint.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub(crate) enum DeleteFolderPayload {
    Path(String),
    Options {
        #[serde(rename = "folderPath")]
        folder_path: String,
        recursive: Option<bool>,
    },
}

/// Creates a folder inside the active workspace.
#[tauri::command]
pub(crate) fn folder_create(
    state: State<'_, DesktopState>,
    payload: FolderNamePayload,
) -> Result<serde_json::Value, String> {
    let workspace = current_workspace(&state)?;
    let folder_name = payload.folder_name.trim();
    if folder_name.is_empty() {
        return Ok(json_error("文件夹名称不能为空"));
    }
    let target = if Path::new(folder_name).is_absolute() {
        PathBuf::from(folder_name)
    } else {
        workspace.join(folder_name)
    };
    if !is_path_inside_workspace(&workspace, &target) {
        return Ok(json_error("非法路径"));
    }
    if target.exists() {
        return Ok(json_error("文件夹已存在"));
    }
    fs::create_dir_all(&target).map_err(|error| error.to_string())?;
    Ok(json_success(serde_json::json!({
        "path": path_string(&target),
        "name": target.file_name().and_then(|name| name.to_str()).unwrap_or_default()
    })))
}

/// Moves a Markdown file to another folder inside the workspace.
#[tauri::command]
pub(crate) fn folder_move_file(
    app: AppHandle,
    state: State<'_, DesktopState>,
    payload: MoveFilePayload,
) -> Result<serde_json::Value, String> {
    let source = PathBuf::from(&payload.file_path);
    let target_dir = target_folder_or_workspace(&state, &payload.target_folder)?;
    move_path(&app, &state, &source, &target_dir, "目标位置已存在同名文件")
}

/// Lists hidden and non-Markdown entries before folder deletion.
#[tauri::command]
pub(crate) fn folder_inspect(
    state: State<'_, DesktopState>,
    folder_path: String,
) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(folder_path);
    if !is_path_inside_workspace_state(&state, &path)? {
        return Ok(json_error("非法路径"));
    }
    if !path.is_dir() {
        return Ok(json_error("不是文件夹"));
    }
    let entries = fs::read_dir(&path)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            let file_type = entry.file_type().ok()?;
            if name.starts_with('.') || (file_type.is_file() && !name.ends_with(".md")) {
                Some(name)
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    Ok(json_success(serde_json::json!({ "entries": entries })))
}

/// Moves an empty folder or explicitly confirmed recursive folder to the OS trash.
#[tauri::command]
pub(crate) fn folder_delete(
    app: AppHandle,
    state: State<'_, DesktopState>,
    payload: DeleteFolderPayload,
) -> Result<serde_json::Value, String> {
    let (folder_path, recursive) = match payload {
        DeleteFolderPayload::Path(path) => (path, false),
        DeleteFolderPayload::Options {
            folder_path,
            recursive,
        } => (folder_path, recursive.unwrap_or(false)),
    };
    let path = PathBuf::from(folder_path);
    if !is_path_inside_workspace_state(&state, &path)? {
        return Ok(json_error("非法路径"));
    }
    if !path.exists() {
        return Ok(json_success(serde_json::json!({})));
    }
    if !path.is_dir() {
        return Ok(json_error("不是文件夹"));
    }
    if recursive {
        move_path_to_trash(&path)?;
    } else if path
        .read_dir()
        .map_err(|error| error.to_string())?
        .next()
        .is_some()
    {
        return Ok(json_error("文件夹不为空，请先移出或删除其中的文件"));
    } else {
        move_path_to_trash(&path)?;
    }
    remove_recent_path(&app, &state, &path)?;
    Ok(json_success(serde_json::json!({})))
}

/// Renames a folder inside the active workspace.
#[tauri::command]
pub(crate) fn folder_rename(
    app: AppHandle,
    state: State<'_, DesktopState>,
    payload: RenameFolderPayload,
) -> Result<serde_json::Value, String> {
    let source = PathBuf::from(&payload.folder_path);
    if !source.is_dir() {
        return Ok(json_error("文件夹不存在"));
    }
    let Some(parent) = source.parent() else {
        return Ok(json_error("Invalid path"));
    };
    let safe_name = Path::new(payload.new_name.trim())
        .file_name()
        .ok_or_else(|| "Invalid folder name".to_string())?;
    let target = parent.join(safe_name);
    rename_path(&app, &state, &source, &target, "文件夹已存在")
}

/// Moves a folder inside the active workspace while preventing self-nesting.
#[tauri::command]
pub(crate) fn folder_move_folder(
    app: AppHandle,
    state: State<'_, DesktopState>,
    payload: MoveFolderPayload,
) -> Result<serde_json::Value, String> {
    let source = PathBuf::from(&payload.folder_path);
    let target_dir = target_folder_or_workspace(&state, &payload.target_folder)?;
    let source_resolved = source.canonicalize().unwrap_or_else(|_| source.clone());
    let target_resolved = target_dir
        .canonicalize()
        .unwrap_or_else(|_| target_dir.clone());
    if target_resolved.starts_with(&source_resolved) {
        return Ok(json_error("不能移动到子文件夹"));
    }
    move_path(
        &app,
        &state,
        &source,
        &target_dir,
        "目标位置已存在同名文件夹",
    )
}

//! Tauri entrypoint for the DraftPort desktop shell.
//! The application keeps the renderer's existing desktop contract stable while
//! replacing Electron IPC and packaging with Tauri commands.

use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use chrono::{DateTime, SecondsFormat, Utc};
use notify::{RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{
    http,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, State, WebviewWindow,
};
use tauri_plugin_dialog::DialogExt;

const ASSET_PROTOCOL: &str = "draftport-asset";
const RECENT_ITEMS_FILE: &str = "recent-items.json";
const MENU_NEW_FILE: &str = "menu-new-file";
const MENU_SAVE: &str = "menu-save";
const MENU_SWITCH_WORKSPACE: &str = "menu-switch-workspace";
const MENU_OPEN_WEBSITE: &str = "menu-open-website";
const MENU_OPEN_GITHUB: &str = "menu-open-github";
const MENU_RECENT_EMPTY: &str = "recent-open-empty";
const MENU_RECENT_PREFIX: &str = "recent-open-";
const RECENT_MENU_LIMIT: usize = 10;
const SKIPPED_WORKSPACE_DIRS: &[&str] = &[
    ".git",
    ".turbo",
    "dist",
    "node_modules",
    "target",
];

/// Mutable desktop runtime state shared by Tauri commands.
#[derive(Default)]
struct DesktopState {
    workspace_dir: Mutex<Option<PathBuf>>,
    recent_items: Mutex<Vec<RecentItemRecord>>,
    watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

/// File or folder node returned to the existing React workspace tree.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileEntry {
    name: String,
    path: String,
    is_directory: bool,
    created_at: String,
    updated_at: String,
    size: u64,
    title: Option<String>,
    theme_name: String,
    children: Option<Vec<FileEntry>>,
}

/// Recent item type retained from the former Electron bridge contract.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
enum RecentItemType {
    File,
    Folder,
}

/// Persisted recent item row exposed to the renderer.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecentItemRecord {
    workspace_path: String,
    item_path: String,
    item_type: RecentItemType,
    title: Option<String>,
    theme_name: Option<String>,
    opened_at: String,
    mtime: Option<u64>,
    size: Option<u64>,
    missing: bool,
}

/// Payload used when the renderer creates a Markdown file.
#[derive(Debug, Deserialize)]
struct CreateFilePayload {
    filename: Option<String>,
    content: Option<String>,
}

/// Payload used when the renderer writes an existing Markdown file.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveFilePayload {
    file_path: String,
    content: String,
}

/// Payload used when the renderer renames a Markdown file.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameFilePayload {
    old_path: String,
    new_name: String,
}

/// Payload used when a file or folder is renamed in recent item metadata.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenamePathPayload {
    old_path: String,
    new_path: String,
}

/// Payload used when recording a recent local file or folder.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RecordOpenPayload {
    item_path: String,
    item_type: RecentItemType,
    title: Option<String>,
    theme_name: Option<String>,
}

/// Payload used when creating folders from the sidebar.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FolderNamePayload {
    folder_name: String,
}

/// Payload used when moving a file to another folder.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveFilePayload {
    file_path: String,
    target_folder: String,
}

/// Payload used when renaming folders.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameFolderPayload {
    folder_path: String,
    new_name: String,
}

/// Payload used when moving folders.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MoveFolderPayload {
    folder_path: String,
    target_folder: String,
}

/// Payload accepted by the folder delete compatibility endpoint.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum DeleteFolderPayload {
    Path(String),
    Options {
        #[serde(rename = "folderPath")]
        folder_path: String,
        recursive: Option<bool>,
    },
}

/// Payload used when writing rich copy output to the native clipboard.
#[derive(Debug, Deserialize)]
struct ClipboardHtmlPayload {
    html: Option<String>,
    text: Option<String>,
}

fn main() {
    tauri::Builder::default()
        .manage(DesktopState::default())
        .plugin(tauri_plugin_dialog::init())
        .menu(build_app_menu)
        .on_menu_event(handle_menu_event)
        .register_uri_scheme_protocol(ASSET_PROTOCOL, |ctx, request| {
            serve_workspace_asset(ctx.app_handle(), request)
        })
        .setup(|app| {
            load_recent_items(app.handle())?;
            refresh_app_menu(app.handle())
                .map_err(|error| tauri::Error::Io(std::io::Error::other(error)))?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_platform,
            workspace_select,
            workspace_set,
            file_list,
            file_read,
            file_open,
            file_create,
            file_save,
            file_rename,
            file_delete,
            file_reveal,
            folder_create,
            folder_move_file,
            folder_inspect,
            folder_delete,
            folder_rename,
            folder_move_folder,
            recent_items_list,
            recent_items_record_open,
            recent_items_remove,
            recent_items_clear,
            recent_items_rename_path,
            window_minimize,
            window_maximize,
            window_close,
            window_is_maximized,
            shell_open_external,
            clipboard_write_html,
            clipboard_write_text,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run DraftPort Tauri app");
}

/// Returns the Node-style platform string expected by the renderer.
#[tauri::command]
fn desktop_platform() -> &'static str {
    if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "windows") {
        "win32"
    } else {
        "linux"
    }
}

/// Opens a native folder picker and activates the selected workspace.
#[tauri::command]
async fn workspace_select(
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
fn workspace_set(
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
async fn file_list(
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

/// Reads a Markdown file after checking the workspace boundary.
#[tauri::command]
fn file_read(
    state: State<'_, DesktopState>,
    file_path: String,
) -> Result<serde_json::Value, String> {
    read_workspace_file(&state, &file_path, false)
}

/// Opens a Markdown file and records it in the recent list.
#[tauri::command]
fn file_open(
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
fn file_create(
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
fn file_save(
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
fn file_rename(
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
fn file_delete(
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
fn file_reveal(state: State<'_, DesktopState>, file_path: String) -> Result<(), String> {
    let path = PathBuf::from(&file_path);
    if !is_path_inside_workspace_state(&state, &path)? {
        return Ok(());
    }
    let target = path.parent().unwrap_or_else(|| path.as_path());
    open::that(target).map_err(|error| error.to_string())
}

/// Creates a folder inside the active workspace.
#[tauri::command]
fn folder_create(
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
fn folder_move_file(
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
fn folder_inspect(
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
fn folder_delete(
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
fn folder_rename(
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
fn folder_move_folder(
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

/// Lists recent files and folders, optionally scoped to the active workspace.
#[tauri::command]
fn recent_items_list(
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
fn recent_items_record_open(
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
fn recent_items_remove(
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
fn recent_items_clear(
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
fn recent_items_rename_path(
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

/// Minimizes the current Tauri window.
#[tauri::command]
fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

/// Toggles maximized state for the current Tauri window.
#[tauri::command]
fn window_maximize(window: WebviewWindow) -> Result<(), String> {
    if window.is_maximized().map_err(|error| error.to_string())? {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

/// Closes the current Tauri window.
#[tauri::command]
fn window_close(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

/// Returns whether the current Tauri window is maximized.
#[tauri::command]
fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|error| error.to_string())
}

/// Opens an external URL with the operating system default handler.
#[tauri::command]
fn shell_open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Ok(());
    }
    open::that(url).map_err(|error| error.to_string())
}

/// Writes HTML copy output to the native rich-text clipboard.
#[tauri::command]
fn clipboard_write_html(payload: ClipboardHtmlPayload) -> Result<serde_json::Value, String> {
    let (html, text) = match html_clipboard_input(&payload) {
        Ok(value) => value,
        Err(error) => return Ok(json_error(&error)),
    };
    write_html_to_clipboard(&html, &text)
}

/// Writes plain text to the native clipboard.
#[tauri::command]
fn clipboard_write_text(text: String) -> Result<serde_json::Value, String> {
    write_text_to_clipboard(&text)
}

/// Activates the workspace and starts a root-level watcher for renderer refresh events.
fn activate_workspace(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
    dir: &Path,
) -> Result<(), String> {
    *state
        .workspace_dir
        .lock()
        .map_err(|_| "Workspace lock poisoned".to_string())? = Some(dir.to_path_buf());
    start_workspace_watcher(app, state, dir)?;
    Ok(())
}

/// Starts a debounced root-level watcher that mirrors Electron's `file:refresh` event.
fn start_workspace_watcher(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
    dir: &Path,
) -> Result<(), String> {
    let app = app.clone();
    let last_emit = Arc::new(Mutex::new(None::<Instant>));
    let last_emit_for_callback = Arc::clone(&last_emit);
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if event.is_err() {
            return;
        }
        let Ok(mut last_emit) = last_emit_for_callback.lock() else {
            return;
        };
        let now = Instant::now();
        if last_emit
            .map(|previous| now.duration_since(previous) < Duration::from_millis(300))
            .unwrap_or(false)
        {
            return;
        }
        *last_emit = Some(now);
        let _ = app.emit("file:refresh", ());
    })
    .map_err(|error| error.to_string())?;
    watcher
        .watch(dir, RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;
    *state
        .watcher
        .lock()
        .map_err(|_| "Watcher lock poisoned".to_string())? = Some(watcher);
    Ok(())
}

/// Builds the native desktop menu and keeps renderer-facing menu events stable.
fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let file_menu = build_file_menu(app)?;
    let edit_menu = Submenu::with_items(
        app,
        "编辑",
        true,
        &[
            &PredefinedMenuItem::undo(app, Some("撤销"))?,
            &PredefinedMenuItem::redo(app, Some("重做"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some("剪切"))?,
            &PredefinedMenuItem::copy(app, Some("复制"))?,
            &PredefinedMenuItem::paste(app, Some("粘贴"))?,
            &PredefinedMenuItem::select_all(app, Some("全选"))?,
        ],
    )?;
    let view_menu = Submenu::with_items(
        app,
        "查看",
        true,
        &[&PredefinedMenuItem::fullscreen(app, Some("全屏"))?],
    )?;
    let window_menu = Submenu::with_items(
        app,
        "窗口",
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some("最小化"))?,
            &PredefinedMenuItem::maximize(app, Some("缩放"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some("关闭窗口"))?,
        ],
    )?;
    let help_menu = Submenu::with_items(
        app,
        "帮助",
        true,
        &[
            &MenuItem::with_id(app, MENU_OPEN_WEBSITE, "访问官网", true, None::<&str>)?,
            &MenuItem::with_id(app, MENU_OPEN_GITHUB, "GitHub 仓库", true, None::<&str>)?,
        ],
    )?;
    Menu::with_items(
        app,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app,
                "DraftPort",
                true,
                &[
                    &PredefinedMenuItem::about(app, Some("关于 DraftPort"), None)?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::services(app, Some("服务"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::hide(app, Some("隐藏 DraftPort"))?,
                    &PredefinedMenuItem::hide_others(app, Some("隐藏其他"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, Some("退出 DraftPort"))?,
                ],
            )?,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )
}

/// Maps native menu selections to the renderer events and safe external URLs.
fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().as_ref();
    if let Some(index) = recent_menu_index(id) {
        open_recent_menu_item(app, index);
        return;
    }
    match id {
        MENU_NEW_FILE => {
            let _ = app.emit("menu:new-file", ());
        }
        MENU_SAVE => {
            let _ = app.emit("menu:save", ());
        }
        MENU_SWITCH_WORKSPACE => {
            let _ = app.emit("menu:switch-workspace", ());
        }
        MENU_OPEN_WEBSITE => {
            let _ = open::that("https://draftport.app");
        }
        MENU_OPEN_GITHUB => {
            let _ = open::that("https://github.com/kingus188/DraftPort");
        }
        _ => {}
    }
}

/// Builds the File menu, including dynamic recent-open items from persisted state.
fn build_file_menu(app: &AppHandle) -> tauri::Result<Submenu<tauri::Wry>> {
    let file_menu = Submenu::with_items(app, "文件", true, &[])?;
    file_menu.append(&MenuItem::with_id(
        app,
        MENU_NEW_FILE,
        "新建文章",
        true,
        Some("CmdOrCtrl+N"),
    )?)?;
    file_menu.append(&PredefinedMenuItem::separator(app)?)?;
    file_menu.append(&MenuItem::with_id(
        app,
        MENU_SAVE,
        "保存",
        true,
        Some("CmdOrCtrl+S"),
    )?)?;
    file_menu.append(&PredefinedMenuItem::separator(app)?)?;
    file_menu.append(&build_recent_menu(app)?)?;
    file_menu.append(&PredefinedMenuItem::separator(app)?)?;
    file_menu.append(&MenuItem::with_id(
        app,
        MENU_SWITCH_WORKSPACE,
        "切换工作区...",
        true,
        None::<&str>,
    )?)?;
    file_menu.append(&PredefinedMenuItem::separator(app)?)?;
    file_menu.append(&PredefinedMenuItem::close_window(app, Some("关闭窗口"))?)?;
    Ok(file_menu)
}

/// Builds the recent-open submenu with stable positional IDs for menu events.
fn build_recent_menu(app: &AppHandle) -> tauri::Result<Submenu<tauri::Wry>> {
    let recent_menu = Submenu::with_items(app, "最近打开", true, &[])?;
    let items = recent_menu_items(app);
    if items.is_empty() {
        recent_menu.append(&MenuItem::with_id(
            app,
            MENU_RECENT_EMPTY,
            "暂无最近项目",
            false,
            None::<&str>,
        )?)?;
        return Ok(recent_menu);
    }
    for (index, item) in items.iter().enumerate() {
        recent_menu.append(&MenuItem::with_id(
            app,
            recent_menu_id(index),
            recent_menu_label(item),
            true,
            None::<&str>,
        )?)?;
    }
    Ok(recent_menu)
}

/// Rebuilds the native menu after recent item state changes.
fn refresh_app_menu(app: &AppHandle) -> Result<(), String> {
    let menu = build_app_menu(app).map_err(|error| error.to_string())?;
    app.set_menu(menu).map_err(|error| error.to_string())?;
    Ok(())
}

/// Returns recent menu candidates using the same workspace scoping as Electron.
fn recent_menu_items(app: &AppHandle) -> Vec<RecentItemRecord> {
    let state = app.state::<DesktopState>();
    let workspace = current_workspace(&state)
        .ok()
        .map(|path| path_string(&path));
    let Ok(items) = state.recent_items.lock() else {
        return Vec::new();
    };
    let mut items = items
        .iter()
        .filter(|item| !item.missing)
        .filter(|item| {
            workspace
                .as_ref()
                .map(|workspace| item.workspace_path == *workspace)
                .unwrap_or(true)
        })
        .cloned()
        .collect::<Vec<_>>();
    items.sort_by(|left, right| right.opened_at.cmp(&left.opened_at));
    items.truncate(RECENT_MENU_LIMIT);
    items
}

/// Opens a recent item from the native menu and notifies the renderer.
fn open_recent_menu_item(app: &AppHandle, index: usize) {
    let Some(item) = recent_menu_items(app).get(index).cloned() else {
        return;
    };
    let state = app.state::<DesktopState>();
    let workspace = PathBuf::from(&item.workspace_path);
    if workspace.is_dir() {
        let _ = activate_workspace(app, &state, &workspace);
    }
    let _ = record_recent_item(
        app,
        &state,
        Path::new(&item.item_path),
        item.item_type.clone(),
        item.title.clone(),
        item.theme_name.clone(),
    );
    let _ = app.emit("menu:open-recent-item", item);
}

/// Formats a recent menu item ID from its displayed position.
fn recent_menu_id(index: usize) -> String {
    format!("{MENU_RECENT_PREFIX}{index}")
}

/// Parses a recent menu item position from a native menu ID.
fn recent_menu_index(id: &str) -> Option<usize> {
    id.strip_prefix(MENU_RECENT_PREFIX)?.parse().ok()
}

/// Builds a compact menu label from item metadata and path.
fn recent_menu_label(item: &RecentItemRecord) -> String {
    item.title
        .as_deref()
        .filter(|title| !title.trim().is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            Path::new(&item.item_path)
                .file_name()
                .and_then(|name| name.to_str())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_else(|| item.item_path.clone())
}

/// Returns the active workspace path or a user-facing command error.
fn current_workspace(state: &State<'_, DesktopState>) -> Result<PathBuf, String> {
    state
        .workspace_dir
        .lock()
        .map_err(|_| "Workspace lock poisoned".to_string())?
        .clone()
        .ok_or_else(|| "No workspace".to_string())
}

/// Resolves an optional command path against the active workspace.
fn resolve_workspace_path(
    state: &State<'_, DesktopState>,
    path: Option<&str>,
) -> Result<PathBuf, String> {
    match path {
        Some(value) if !value.is_empty() => Ok(PathBuf::from(value)),
        _ => current_workspace(state),
    }
}

/// Returns whether a path is inside the active workspace.
fn is_path_inside_workspace_state(
    state: &State<'_, DesktopState>,
    target: &Path,
) -> Result<bool, String> {
    let workspace = current_workspace(state)?;
    Ok(is_path_inside_workspace(&workspace, target))
}

/// Checks a path boundary with resolved, separator-aware prefix matching.
fn is_path_inside_workspace(workspace: &Path, target: &Path) -> bool {
    let workspace_resolved = workspace
        .canonicalize()
        .unwrap_or_else(|_| workspace.to_path_buf());
    let target_resolved = target
        .canonicalize()
        .unwrap_or_else(|_| target.to_path_buf());
    target_resolved == workspace_resolved || target_resolved.starts_with(&workspace_resolved)
}

/// Recursively scans folders before Markdown files to match the existing UI order.
fn scan_workspace(dir: &Path) -> Vec<FileEntry> {
    let mut folders = Vec::new();
    let mut files = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if should_skip_workspace_entry(&name) {
            continue;
        }
        if path.is_dir() {
            folders.push(read_folder_entry(&path, &name));
        } else if path.is_file() && name.ends_with(".md") {
            files.push(read_file_entry(&path, &name));
        }
    }
    folders.sort_by(|left, right| left.name.cmp(&right.name));
    files.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
    folders.extend(files);
    folders
}

/// Returns whether a workspace entry should be ignored during recursive scans.
fn should_skip_workspace_entry(name: &str) -> bool {
    name.starts_with('.') || SKIPPED_WORKSPACE_DIRS.contains(&name)
}

/// Builds a file tree node for a folder.
fn read_folder_entry(path: &Path, name: &str) -> FileEntry {
    let metadata = fs::metadata(path).ok();
    FileEntry {
        name: name.to_string(),
        path: path_string(path),
        is_directory: true,
        created_at: metadata_time(metadata.as_ref(), true),
        updated_at: metadata_time(metadata.as_ref(), false),
        size: 0,
        title: None,
        theme_name: String::new(),
        children: Some(scan_workspace(path)),
    }
}

/// Builds a file tree node and extracts small frontmatter metadata.
fn read_file_entry(path: &Path, name: &str) -> FileEntry {
    let metadata = fs::metadata(path).ok();
    let meta = fs::read_to_string(path)
        .ok()
        .map(|content| extract_frontmatter_meta(&content))
        .unwrap_or_default();
    FileEntry {
        name: name.to_string(),
        path: path_string(path),
        is_directory: false,
        created_at: metadata_time(metadata.as_ref(), true),
        updated_at: metadata_time(metadata.as_ref(), false),
        size: metadata.as_ref().map(|value| value.len()).unwrap_or(0),
        title: meta.title,
        theme_name: meta.theme_name,
        children: None,
    }
}

#[derive(Default)]
struct MarkdownMeta {
    title: Option<String>,
    theme_name: String,
}

/// Extracts title and theme metadata from simple YAML-style frontmatter.
fn extract_frontmatter_meta(content: &str) -> MarkdownMeta {
    let mut meta = MarkdownMeta {
        title: None,
        theme_name: "默认主题".to_string(),
    };
    let Some(rest) = content.strip_prefix("---") else {
        return meta;
    };
    let Some(end) = rest.find("---") else {
        return meta;
    };
    for line in rest[..end].lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let cleaned = value
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();
        match key.trim() {
            "title" => meta.title = Some(cleaned),
            "themeName" | "theme" => meta.theme_name = cleaned,
            _ => {}
        }
    }
    meta
}

/// Reads a workspace file and returns the compatibility response payload.
fn read_workspace_file(
    state: &State<'_, DesktopState>,
    file_path: &str,
    include_path: bool,
) -> Result<serde_json::Value, String> {
    let path = PathBuf::from(file_path);
    if !is_path_inside_workspace_state(state, &path)? {
        return Ok(json_error("非法路径"));
    }
    if !path.exists() {
        return Ok(json_error("File not found"));
    }
    let content = fs::read_to_string(&path).map_err(|error| error.to_string())?;
    let mut payload = serde_json::json!({ "content": content });
    if include_path {
        payload["filePath"] = serde_json::json!(path_string(&path));
    }
    Ok(json_success(payload))
}

/// Generates a non-conflicting filename by appending a numeric suffix.
fn unique_file_path(target: &Path) -> PathBuf {
    if !target.exists() {
        return target.to_path_buf();
    }
    let parent = target.parent().unwrap_or_else(|| Path::new(""));
    let stem = target
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("文件");
    let ext = target
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    for index in 1.. {
        let filename = if ext.is_empty() {
            format!("{stem} ({index})")
        } else {
            format!("{stem} ({index}).{ext}")
        };
        let candidate = parent.join(filename);
        if !candidate.exists() {
            return candidate;
        }
    }
    unreachable!("infinite numeric suffix loop should always return")
}

/// Resolves an empty target folder as the workspace root.
fn target_folder_or_workspace(
    state: &State<'_, DesktopState>,
    target_folder: &str,
) -> Result<PathBuf, String> {
    if target_folder.is_empty() {
        current_workspace(state)
    } else {
        Ok(PathBuf::from(target_folder))
    }
}

/// Moves a file or folder into a target directory and updates recent metadata.
fn move_path(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
    source: &Path,
    target_dir: &Path,
    conflict_error: &str,
) -> Result<serde_json::Value, String> {
    let Some(name) = source.file_name() else {
        return Ok(json_error("Invalid path"));
    };
    let target = target_dir.join(name);
    rename_path(app, state, source, &target, conflict_error)
}

/// Renames or moves a path inside the workspace and returns the new path.
fn rename_path(
    app: &AppHandle,
    state: &State<'_, DesktopState>,
    source: &Path,
    target: &Path,
    conflict_error: &str,
) -> Result<serde_json::Value, String> {
    if !is_path_inside_workspace_state(state, source)?
        || !is_path_inside_workspace_state(state, target)?
    {
        return Ok(json_error("非法路径"));
    }
    if source == target {
        return Ok(json_success(
            serde_json::json!({ "newPath": path_string(target) }),
        ));
    }
    if target.exists() {
        return Ok(json_error(conflict_error));
    }
    fs::rename(source, target).map_err(|error| error.to_string())?;
    rename_recent_path(app, state, source, target)?;
    Ok(json_success(
        serde_json::json!({ "newPath": path_string(target) }),
    ))
}

/// Loads recent items from the app data directory during startup.
fn load_recent_items(app: &AppHandle) -> tauri::Result<()> {
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
fn save_recent_items(app: &AppHandle, state: &State<'_, DesktopState>) -> Result<(), String> {
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
fn record_recent_item(
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
fn remove_recent_path(
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
fn rename_recent_path(
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
fn refresh_recent_missing_flags(
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

/// Serves workspace preview assets through the same custom scheme and boundary as Electron.
fn serve_workspace_asset(
    app: &AppHandle,
    request: http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>> {
    let path = request.uri().path().trim_start_matches("/local/");
    let decoded = urlencoding::decode(path)
        .map(|value| value.into_owned())
        .unwrap_or_default();
    let file_path = PathBuf::from(decoded);
    if !file_path.is_absolute() {
        return response_with_status(http::StatusCode::BAD_REQUEST, b"Bad asset path".to_vec());
    }
    let state = app.state::<DesktopState>();
    match is_path_inside_workspace_state(&state, &file_path) {
        Ok(true) => {}
        Ok(false) => {
            return response_with_status(http::StatusCode::FORBIDDEN, b"Forbidden".to_vec())
        }
        Err(error) => {
            return response_with_status(http::StatusCode::BAD_REQUEST, error.into_bytes())
        }
    }
    if !file_path.is_file() {
        return response_with_status(http::StatusCode::NOT_FOUND, b"Asset not found".to_vec());
    }
    match fs::read(&file_path) {
        Ok(bytes) => http::Response::builder()
            .header(
                http::header::CONTENT_TYPE,
                mime_guess::from_path(file_path)
                    .first_or_octet_stream()
                    .as_ref(),
            )
            .body(bytes)
            .expect("asset response should build"),
        Err(error) => response_with_status(
            http::StatusCode::BAD_REQUEST,
            error.to_string().into_bytes(),
        ),
    }
}

/// Writes text to the macOS clipboard with pbcopy, matching the current target platform.
fn write_text_to_clipboard(text: &str) -> Result<serde_json::Value, String> {
    if text.trim().is_empty() {
        return Ok(json_error("文本不能为空"));
    }
    #[cfg(target_os = "macos")]
    {
        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|error| error.to_string())?;
        child
            .stdin
            .as_mut()
            .ok_or_else(|| "无法写入剪贴板".to_string())?
            .write_all(text.as_bytes())
            .map_err(|error| error.to_string())?;
        let status = child.wait().map_err(|error| error.to_string())?;
        if status.success() {
            Ok(json_success(serde_json::json!({})))
        } else {
            Ok(json_error("写入剪贴板失败"))
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = text;
        Ok(json_error("当前平台暂未实现原生剪贴板"))
    }
}

/// Moves a file or folder to the macOS Trash while preserving recoverability.
fn move_path_to_trash(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("osascript")
            .arg("-e")
            .arg(finder_trash_script(path))
            .status()
            .map_err(|error| error.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err("移入废纸篓失败".to_string())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
        Err("当前平台暂未实现移入废纸篓".to_string())
    }
}

/// Builds the Finder AppleScript used by the trash operation.
fn finder_trash_script(path: &Path) -> String {
    format!(
        "tell application \"Finder\" to delete POSIX file \"{}\"",
        escape_apple_script_string(&path_string(path))
    )
}

/// Escapes a Rust string for placement inside an AppleScript string literal.
fn escape_apple_script_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Validates rich clipboard input and keeps the plain-text fallback alongside HTML.
fn html_clipboard_input(payload: &ClipboardHtmlPayload) -> Result<(String, String), String> {
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

/// Writes HTML and plain text to macOS NSPasteboard using native clipboard types.
fn write_html_to_clipboard(html: &str, text: &str) -> Result<serde_json::Value, String> {
    #[cfg(target_os = "macos")]
    {
        let status = Command::new("osascript")
            .arg("-l")
            .arg("JavaScript")
            .arg("-e")
            .arg(HTML_CLIPBOARD_SCRIPT)
            .env("DRAFTPORT_CLIP_HTML", clipboard_env_value(html))
            .env("DRAFTPORT_CLIP_TEXT", clipboard_env_value(text))
            .status()
            .map_err(|error| error.to_string())?;
        if status.success() {
            Ok(json_success(serde_json::json!({})))
        } else {
            Ok(json_error("写入剪贴板失败"))
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = html;
        write_text_to_clipboard(text)
    }
}

const HTML_CLIPBOARD_SCRIPT: &str = r#"ObjC.import("AppKit");
const env = $.NSProcessInfo.processInfo.environment;
const html = decodeURIComponent(env.objectForKey("DRAFTPORT_CLIP_HTML").js);
const text = decodeURIComponent(env.objectForKey("DRAFTPORT_CLIP_TEXT").js);
const pasteboard = $.NSPasteboard.generalPasteboard;
pasteboard.clearContents;
pasteboard.setStringForType($(html), $.NSPasteboardTypeHTML);
pasteboard.setStringForType($(text), $.NSPasteboardTypeString);
"#;

/// Encodes clipboard payloads for JXA environment variables without script interpolation.
fn clipboard_env_value(value: &str) -> String {
    urlencoding::encode(value).into_owned()
}

/// Converts a successful payload to the legacy JSON response shape.
fn json_success(payload: serde_json::Value) -> serde_json::Value {
    let mut value = payload;
    value["success"] = serde_json::json!(true);
    value
}

/// Converts an error message to the legacy JSON response shape.
fn json_error(message: &str) -> serde_json::Value {
    serde_json::json!({ "success": false, "error": message })
}

/// Builds a simple HTTP response with an explicit status.
fn response_with_status(status: http::StatusCode, body: Vec<u8>) -> http::Response<Vec<u8>> {
    http::Response::builder()
        .status(status)
        .body(body)
        .expect("status response should build")
}

/// Formats a path for the renderer.
fn path_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

/// Formats metadata timestamps as ISO strings for stable JS Date parsing.
fn metadata_time(metadata: Option<&fs::Metadata>, created: bool) -> String {
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
fn system_time_ms(time: std::time::SystemTime) -> Option<u64> {
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
fn current_timestamp() -> String {
    format_system_time(std::time::SystemTime::now())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn path_boundary_rejects_sibling_prefix() {
        let workspace = Path::new("/tmp/work");

        assert!(is_path_inside_workspace(
            workspace,
            Path::new("/tmp/work/a.md")
        ));
        assert!(!is_path_inside_workspace(
            workspace,
            Path::new("/tmp/workspace/a.md")
        ));
    }

    #[test]
    fn frontmatter_extracts_title_and_theme_name() {
        let meta = extract_frontmatter_meta("---\ntitle: Hello\nthemeName: Clean\n---\nBody");

        assert_eq!(meta.title.as_deref(), Some("Hello"));
        assert_eq!(meta.theme_name, "Clean");
    }

    #[test]
    fn timestamps_use_js_parseable_iso_format() {
        let timestamp = format_system_time(std::time::UNIX_EPOCH);

        assert_eq!(timestamp, "1970-01-01T00:00:00.000Z");
    }

    #[test]
    fn workspace_scan_skips_heavy_project_directories() {
        let root = std::env::temp_dir().join(format!(
            "draftport-scan-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("test clock should be after unix epoch")
                .as_nanos()
        ));
        fs::create_dir_all(root.join("docs")).expect("test workspace should be created");
        fs::create_dir_all(root.join("node_modules/pkg"))
            .expect("dependency folder should be created");
        fs::create_dir_all(root.join("target/debug")).expect("build folder should be created");
        fs::create_dir_all(root.join(".git")).expect("git folder should be created");
        fs::write(root.join("docs/visible.md"), "# Visible")
            .expect("visible markdown should be written");
        fs::write(root.join("node_modules/pkg/hidden.md"), "# Hidden")
            .expect("dependency markdown should be written");
        fs::write(root.join("target/debug/hidden.md"), "# Hidden")
            .expect("build markdown should be written");
        fs::write(root.join(".git/hidden.md"), "# Hidden").expect("git markdown should be written");

        let files = scan_workspace(&root);
        let names = files.iter().map(|entry| entry.name.as_str()).collect::<Vec<_>>();

        assert_eq!(names, vec!["docs"]);
        assert_eq!(
            files[0]
                .children
                .as_ref()
                .expect("docs folder should include children")[0]
                .name,
            "visible.md"
        );

        fs::remove_dir_all(root).expect("test workspace should be removed");
    }

    #[test]
    fn finder_trash_script_escapes_posix_paths() {
        let script = finder_trash_script(Path::new("/tmp/DraftPort's Test.md"));

        assert_eq!(
            script,
            "tell application \"Finder\" to delete POSIX file \"/tmp/DraftPort's Test.md\""
        );
    }

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

    #[test]
    fn recent_menu_ids_round_trip_indexes() {
        let id = recent_menu_id(12);

        assert_eq!(id, "recent-open-12");
        assert_eq!(recent_menu_index(&id), Some(12));
        assert_eq!(recent_menu_index("recent-open-bad"), None);
        assert_eq!(recent_menu_index("menu-save"), None);
    }

    #[test]
    fn clipboard_env_values_are_percent_encoded() {
        assert_eq!(
            clipboard_env_value("<strong>DraftPort</strong>"),
            "%3Cstrong%3EDraftPort%3C%2Fstrong%3E"
        );
    }
}

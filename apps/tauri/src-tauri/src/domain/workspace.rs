//! Workspace resolution, boundary checks, filesystem scanning, frontmatter
//! parsing, and the path move/rename helpers shared by the file commands.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};

use notify::{RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, State};

use crate::domain::recent::rename_recent_path;
use crate::shared::model::{DesktopState, FileEntry};
use crate::shared::util::{json_error, json_success, metadata_time, path_string};

const SKIPPED_WORKSPACE_DIRS: &[&str] = &[".git", ".turbo", "dist", "node_modules", "target"];

/// Frontmatter metadata extracted from a Markdown file header.
#[derive(Default)]
pub(crate) struct MarkdownMeta {
    pub(crate) title: Option<String>,
    pub(crate) theme_name: String,
}

/// Activates the workspace and starts a root-level watcher for renderer refresh events.
pub(crate) fn activate_workspace(
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

/// Returns the active workspace path or a user-facing command error.
pub(crate) fn current_workspace(state: &State<'_, DesktopState>) -> Result<PathBuf, String> {
    state
        .workspace_dir
        .lock()
        .map_err(|_| "Workspace lock poisoned".to_string())?
        .clone()
        .ok_or_else(|| "No workspace".to_string())
}

/// Resolves an optional command path against the active workspace.
pub(crate) fn resolve_workspace_path(
    state: &State<'_, DesktopState>,
    path: Option<&str>,
) -> Result<PathBuf, String> {
    match path {
        Some(value) if !value.is_empty() => Ok(PathBuf::from(value)),
        _ => current_workspace(state),
    }
}

/// Returns whether a path is inside the active workspace.
pub(crate) fn is_path_inside_workspace_state(
    state: &State<'_, DesktopState>,
    target: &Path,
) -> Result<bool, String> {
    let workspace = current_workspace(state)?;
    Ok(is_path_inside_workspace(&workspace, target))
}

/// Checks a path boundary with resolved, separator-aware prefix matching.
pub(crate) fn is_path_inside_workspace(workspace: &Path, target: &Path) -> bool {
    let workspace_resolved = workspace
        .canonicalize()
        .unwrap_or_else(|_| workspace.to_path_buf());
    let target_resolved = target
        .canonicalize()
        .unwrap_or_else(|_| target.to_path_buf());
    target_resolved == workspace_resolved || target_resolved.starts_with(&workspace_resolved)
}

/// Recursively scans folders before Markdown files to match the existing UI order.
pub(crate) fn scan_workspace(dir: &Path) -> Vec<FileEntry> {
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

/// Extracts title and theme metadata from simple YAML-style frontmatter.
pub(crate) fn extract_frontmatter_meta(content: &str) -> MarkdownMeta {
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
pub(crate) fn read_workspace_file(
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
pub(crate) fn unique_file_path(target: &Path) -> PathBuf {
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
pub(crate) fn target_folder_or_workspace(
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
pub(crate) fn move_path(
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
pub(crate) fn rename_path(
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
}

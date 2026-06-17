//! Shared data structures crossing the desktop command modules: runtime state,
//! the workspace file tree node, and persisted recent item rows.

use std::{path::PathBuf, sync::Mutex};

use serde::{Deserialize, Serialize};

/// Mutable desktop runtime state shared by Tauri commands.
#[derive(Default)]
pub(crate) struct DesktopState {
    pub(crate) workspace_dir: Mutex<Option<PathBuf>>,
    pub(crate) recent_items: Mutex<Vec<RecentItemRecord>>,
    pub(crate) watcher: Mutex<Option<notify::RecommendedWatcher>>,
}

/// File or folder node returned to the existing React workspace tree.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileEntry {
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) is_directory: bool,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
    pub(crate) size: u64,
    pub(crate) title: Option<String>,
    pub(crate) theme_name: String,
    pub(crate) children: Option<Vec<FileEntry>>,
}

/// Recent item type retained from the former Electron bridge contract.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum RecentItemType {
    File,
    Folder,
}

/// Persisted recent item row exposed to the renderer.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RecentItemRecord {
    pub(crate) workspace_path: String,
    pub(crate) item_path: String,
    pub(crate) item_type: RecentItemType,
    pub(crate) title: Option<String>,
    pub(crate) theme_name: Option<String>,
    pub(crate) opened_at: String,
    pub(crate) mtime: Option<u64>,
    pub(crate) size: Option<u64>,
    pub(crate) missing: bool,
}

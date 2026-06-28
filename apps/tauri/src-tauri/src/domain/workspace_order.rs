//! Project-local file tree order persistence for the active workspace.
//! The config belongs to the workspace, not app data, and must never read or
//! write paths outside the selected workspace boundary.

use std::{
    collections::BTreeMap,
    fs,
    path::{Component, Path, PathBuf},
};

use serde::{Deserialize, Serialize};

const WORKSPACE_CONFIG_DIR: &str = ".draftport";
const WORKSPACE_ORDER_FILE: &str = "order.json";
const WORKSPACE_ORDER_VERSION: u8 = 1;

/// Project-local ordering metadata keyed by parent folder path.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WorkspaceOrderConfig {
    pub(crate) version: u8,
    #[serde(default)]
    pub(crate) folders: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub(crate) sort_modes: BTreeMap<String, WorkspaceSortMode>,
}

/// Supported renderer sort modes for one folder level in the sidebar tree.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub(crate) enum WorkspaceSortMode {
    OpenedDesc,
    UpdatedDesc,
    NameAsc,
    NameDesc,
    Manual,
}

impl Default for WorkspaceOrderConfig {
    fn default() -> Self {
        Self {
            version: WORKSPACE_ORDER_VERSION,
            folders: BTreeMap::new(),
            sort_modes: BTreeMap::new(),
        }
    }
}

/// Loads the workspace order config, returning an empty versioned config when missing.
pub(crate) fn load_workspace_order_config(
    workspace: &Path,
) -> Result<WorkspaceOrderConfig, String> {
    let path = workspace_order_path(workspace);
    let Some(content) = fs::read_to_string(path).ok() else {
        return Ok(WorkspaceOrderConfig::default());
    };
    let mut config = serde_json::from_str::<WorkspaceOrderConfig>(&content)
        .map_err(|error| error.to_string())?;
    config.version = WORKSPACE_ORDER_VERSION;
    Ok(config)
}

/// Saves workspace order config after checking every recorded path stays inside the workspace.
pub(crate) fn save_workspace_order_config(
    workspace: &Path,
    config: &WorkspaceOrderConfig,
) -> Result<(), String> {
    validate_workspace_order_config(workspace, config)?;
    let path = workspace_order_path(workspace);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut normalized = config.clone();
    normalized.version = WORKSPACE_ORDER_VERSION;
    let serialized =
        serde_json::to_string_pretty(&normalized).map_err(|error| error.to_string())?;
    fs::write(path, serialized).map_err(|error| error.to_string())
}

/// Returns the hidden project config file path for manual file tree ordering.
fn workspace_order_path(workspace: &Path) -> PathBuf {
    workspace
        .join(WORKSPACE_CONFIG_DIR)
        .join(WORKSPACE_ORDER_FILE)
}

/// Rejects malicious or accidental order entries outside the active workspace.
fn validate_workspace_order_config(
    workspace: &Path,
    config: &WorkspaceOrderConfig,
) -> Result<(), String> {
    for (parent, children) in &config.folders {
        validate_workspace_order_path(workspace, Path::new(parent))?;
        for child in children {
            validate_workspace_order_path(workspace, Path::new(child))?;
        }
    }
    for parent in config.sort_modes.keys() {
        validate_workspace_order_path(workspace, Path::new(parent))?;
    }
    Ok(())
}

/// Checks one order path using filesystem components so sibling prefixes do not match.
fn validate_workspace_order_path(workspace: &Path, target: &Path) -> Result<(), String> {
    if target
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err("非法路径".to_string());
    }
    let workspace = workspace
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let target = if target.exists() {
        target.canonicalize().map_err(|error| error.to_string())?
    } else {
        target.to_path_buf()
    };
    if target.starts_with(&workspace) {
        Ok(())
    } else {
        Err("非法路径".to_string())
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::{Path, PathBuf},
    };

    use super::{
        load_workspace_order_config, save_workspace_order_config, WorkspaceOrderConfig,
        WorkspaceSortMode,
    };

    fn test_workspace(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "draftport-workspace-order-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("docs")).expect("workspace folders should be created");
        fs::write(root.join("docs").join("b.md"), "# B").expect("workspace file should be created");
        fs::write(root.join("a.md"), "# A").expect("workspace file should be created");
        root
    }

    fn cleanup(path: &Path) {
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn workspace_order_config_round_trips_inside_project_config_file() {
        let workspace = test_workspace("round-trip");
        let root_path = workspace.to_string_lossy().to_string();
        let docs_path = workspace.join("docs").to_string_lossy().to_string();
        let file_path = workspace.join("a.md").to_string_lossy().to_string();
        let mut config = WorkspaceOrderConfig::default();
        config
            .folders
            .insert(root_path.clone(), vec![docs_path, file_path]);
        config
            .sort_modes
            .insert(root_path.clone(), WorkspaceSortMode::Manual);

        save_workspace_order_config(&workspace, &config).expect("order config should save");
        let loaded = load_workspace_order_config(&workspace).expect("order config should load");

        assert_eq!(loaded.version, 1);
        assert_eq!(
            loaded.folders.get(&root_path),
            config.folders.get(&root_path)
        );
        assert_eq!(
            loaded.sort_modes.get(&root_path),
            Some(&WorkspaceSortMode::Manual)
        );
        assert!(workspace.join(".draftport").join("order.json").is_file());
        cleanup(&workspace);
    }

    #[test]
    fn workspace_order_config_loads_legacy_files_without_sort_modes() {
        let workspace = test_workspace("legacy-file");
        let order_dir = workspace.join(".draftport");
        fs::create_dir_all(&order_dir).expect("project config folder should be created");
        fs::write(
            order_dir.join("order.json"),
            r#"{"version":1,"folders":{}}"#,
        )
        .expect("legacy order config should be written");

        let loaded = load_workspace_order_config(&workspace).expect("order config should load");

        assert_eq!(loaded.version, 1);
        assert!(loaded.folders.is_empty());
        assert!(loaded.sort_modes.is_empty());
        cleanup(&workspace);
    }

    #[test]
    fn workspace_order_config_rejects_paths_outside_workspace() {
        let workspace = test_workspace("outside-path");
        let mut config = WorkspaceOrderConfig::default();
        config.folders.insert(
            workspace.to_string_lossy().to_string(),
            vec!["/tmp/outside.md".to_string()],
        );

        let result = save_workspace_order_config(&workspace, &config);

        assert_eq!(result, Err("非法路径".to_string()));
        assert!(!workspace.join(".draftport").join("order.json").exists());
        cleanup(&workspace);
    }

    #[test]
    fn workspace_order_config_rejects_parent_dir_segments() {
        let workspace = test_workspace("parent-dir");
        let mut config = WorkspaceOrderConfig::default();
        config.folders.insert(
            workspace.to_string_lossy().to_string(),
            vec![workspace
                .join("..")
                .join("outside.md")
                .to_string_lossy()
                .to_string()],
        );

        let result = save_workspace_order_config(&workspace, &config);

        assert_eq!(result, Err("非法路径".to_string()));
        assert!(!workspace.join(".draftport").join("order.json").exists());
        cleanup(&workspace);
    }

    #[test]
    fn workspace_order_config_rejects_sort_mode_paths_outside_workspace() {
        let workspace = test_workspace("outside-sort-mode-path");
        let mut config = WorkspaceOrderConfig::default();
        config
            .sort_modes
            .insert("/tmp/outside".to_string(), WorkspaceSortMode::NameAsc);

        let result = save_workspace_order_config(&workspace, &config);

        assert_eq!(result, Err("非法路径".to_string()));
        assert!(!workspace.join(".draftport").join("order.json").exists());
        cleanup(&workspace);
    }
}

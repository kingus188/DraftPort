//! Native application menu construction, menu event routing, and the dynamic
//! recent-open submenu backed by persisted recent items.

use std::path::{Path, PathBuf};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager,
};

use crate::domain::recent::record_recent_item;
use crate::domain::workspace::{activate_workspace, current_workspace};
use crate::shared::model::{DesktopState, RecentItemRecord};
use crate::shared::util::path_string;

const MENU_NEW_FILE: &str = "menu-new-file";
const MENU_SAVE: &str = "menu-save";
const MENU_SWITCH_WORKSPACE: &str = "menu-switch-workspace";
const MENU_OPEN_WEBSITE: &str = "menu-open-website";
const MENU_OPEN_GITHUB: &str = "menu-open-github";
const MENU_RECENT_EMPTY: &str = "recent-open-empty";
const MENU_RECENT_PREFIX: &str = "recent-open-";
const RECENT_MENU_LIMIT: usize = 10;

/// Builds the native desktop menu and keeps renderer-facing menu events stable.
pub(crate) fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
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
pub(crate) fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
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
pub(crate) fn refresh_app_menu(app: &AppHandle) -> Result<(), String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recent_menu_ids_round_trip_indexes() {
        let id = recent_menu_id(12);

        assert_eq!(id, "recent-open-12");
        assert_eq!(recent_menu_index(&id), Some(12));
        assert_eq!(recent_menu_index("recent-open-bad"), None);
        assert_eq!(recent_menu_index("menu-save"), None);
    }
}

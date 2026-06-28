//! Tauri entrypoint for the DraftPort desktop shell.
//! The application keeps the renderer's existing desktop contract stable while
//! replacing Electron IPC and packaging with Tauri commands.

mod commands;
mod domain;
mod platform;
mod shared;

use crate::domain::recent::load_recent_items;
use crate::platform::asset::serve_workspace_asset;
use crate::platform::menu::{build_app_menu, handle_menu_event, refresh_app_menu};
use crate::shared::model::DesktopState;

const ASSET_PROTOCOL: &str = "draftport-asset";

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
            commands::window::desktop_platform,
            commands::workspace::workspace_select,
            commands::workspace::workspace_set,
            commands::workspace::file_list,
            commands::workspace::workspace_order_get,
            commands::workspace::workspace_order_save,
            commands::files::file_read,
            commands::files::file_open,
            commands::files::file_create,
            commands::files::file_save,
            commands::files::file_rename,
            commands::files::file_delete,
            commands::files::file_reveal,
            commands::folders::folder_create,
            commands::folders::folder_move_file,
            commands::folders::folder_inspect,
            commands::folders::folder_delete,
            commands::folders::folder_rename,
            commands::folders::folder_move_folder,
            commands::recent::recent_items_list,
            commands::recent::recent_items_record_open,
            commands::recent::recent_items_remove,
            commands::recent::recent_items_clear,
            commands::recent::recent_items_rename_path,
            commands::window::window_minimize,
            commands::window::window_maximize,
            commands::window::window_close,
            commands::window::window_is_maximized,
            commands::window::shell_open_external,
            commands::clipboard::clipboard_write_html,
            commands::clipboard::clipboard_write_text,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run DraftPort Tauri app");
}

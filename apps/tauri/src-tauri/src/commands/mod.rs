//! Tauri command surface exposed to the renderer, split by domain. Each command
//! is a thin orchestration layer over the domain and platform modules.

pub(crate) mod clipboard;
pub(crate) mod files;
pub(crate) mod folders;
pub(crate) mod recent;
pub(crate) mod window;
pub(crate) mod workspace;

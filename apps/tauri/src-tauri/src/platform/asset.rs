//! Custom URI scheme that serves workspace preview assets within the workspace
//! boundary, mirroring the former Electron protocol.

use std::{fs, path::PathBuf};

use tauri::{http, AppHandle, Manager};

use crate::domain::workspace::is_path_inside_workspace_state;
use crate::shared::model::DesktopState;
use crate::shared::util::response_with_status;

/// Serves workspace preview assets through the same custom scheme and boundary as Electron.
pub(crate) fn serve_workspace_asset(
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

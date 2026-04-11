use crate::capture::{self, CaptureData};
use crate::history::HistoryEntry;
use crate::settings::AppSettings;
use crate::AppState;
use base64::{engine::general_purpose, Engine as _};
use chrono::Local;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tokio::time::sleep;
use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

// ─── Window helpers ───────────────────────────────────────────────────────────

pub fn do_open_settings_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("settings") {
        w.show().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("/settings".into()))
        .title("Settings")
        .inner_size(600.0, 500.0)
        .resizable(false)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn do_open_history_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("history") {
        w.show().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(app, "history", WebviewUrl::App("/history".into()))
        .title("Screenshot History")
        .inner_size(800.0, 600.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn do_open_editor_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("editor") {
        w.show().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    WebviewWindowBuilder::new(app, "editor", WebviewUrl::App("/editor".into()))
        .title("Edit Screenshot")
        .inner_size(1000.0, 700.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn open_capture_window<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    // Close existing capture window if present
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.close();
    }

    // Compute logical bounds across all monitors so the window covers every screen
    // WITHOUT using macOS fullscreen mode (which creates a new Space with animation).
    let (pos_x, pos_y, logical_w, logical_h) = {
        let state = app.state::<Mutex<AppState>>();
        let state = state.lock().unwrap();
        if let Some(data) = &state.full_screenshot {
            let min_x = data.screens.iter().map(|s| s.x).min().unwrap_or(0);
            let min_y = data.screens.iter().map(|s| s.y).min().unwrap_or(0);
            let max_x = data.screens.iter().map(|s| s.x + s.width as i32).max().unwrap_or(1920);
            let max_y = data.screens.iter().map(|s| s.y + s.height as i32).max().unwrap_or(1080);
            (min_x as f64, min_y as f64, (max_x - min_x) as f64, (max_y - min_y) as f64)
        } else {
            (0.0, 0.0, 1920.0, 1080.0)
        }
    };

    WebviewWindowBuilder::new(app, "capture", WebviewUrl::App("/capture".into()))
        .title("Capture")
        .decorations(false)
        .always_on_top(true)
        .visible_on_all_workspaces(true)  // stay on current Space, no animation
        .skip_taskbar(true)
        .inner_size(logical_w, logical_h)
        .position(pos_x, pos_y)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Public capture entrypoints ───────────────────────────────────────────────

pub async fn do_start_area_capture<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    // Hide all windows briefly to not capture them
    for (_, window) in app.webview_windows() {
        let _ = window.hide();
    }

    // Wait for windows to hide
    sleep(Duration::from_millis(150)).await;

    // Capture all screens
    let capture_data = capture::capture_all_screens()?;

    // Store in app state
    {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        state.full_screenshot = Some(capture_data);
        state.capture_mode = Some("area".to_string());
    }

    // Open capture overlay window
    open_capture_window(app)?;
    Ok(())
}

pub async fn do_start_fullscreen_capture<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    // Hide windows
    for (_, window) in app.webview_windows() {
        let _ = window.hide();
    }
    sleep(Duration::from_millis(150)).await;

    let capture_data = capture::capture_all_screens()?;

    {
        let state = app.state::<Mutex<AppState>>();
        let mut state = state.lock().unwrap();
        state.full_screenshot = Some(capture_data);
        state.capture_mode = Some("fullscreen".to_string());
    }

    // Open capture overlay — frontend will detect fullscreen mode and pre-select full screen
    open_capture_window(app)?;
    Ok(())
}

#[tauri::command]
pub fn get_capture_mode(state: tauri::State<'_, Mutex<AppState>>) -> String {
    state.lock().unwrap().capture_mode.clone().unwrap_or_else(|| "area".to_string())
}

async fn handle_after_capture<R: Runtime>(
    app: &AppHandle<R>,
    after_capture: &str,
    image_data: &str,
    width: u32,
    height: u32,
) -> Result<(), String> {
    match after_capture {
        "editor" => {
            do_open_editor_window(app)?;
        }
        "save" => {
            do_auto_save(app, image_data, width, height)?;
        }
        "copy" => {
            do_copy_to_clipboard(image_data)?;
            // temp path returned but not needed here
        }
        _ => {
            do_open_editor_window(app)?;
        }
    }
    Ok(())
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn start_area_capture(
    _state: tauri::State<'_, Mutex<AppState>>,
    app: AppHandle,
) -> Result<(), String> {
    do_start_area_capture(&app).await
}

#[tauri::command]
pub async fn start_fullscreen_capture(
    _state: tauri::State<'_, Mutex<AppState>>,
    app: AppHandle,
) -> Result<(), String> {
    do_start_fullscreen_capture(&app).await
}

#[tauri::command]
pub async fn confirm_capture(
    state: tauri::State<'_, Mutex<AppState>>,
    app: AppHandle,
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    scale_factor: f64,
) -> Result<(), String> {
    let (full_data, after_capture) = {
        let state = state.lock().unwrap();
        let full = state
            .full_screenshot
            .clone()
            .ok_or("No screenshot in state")?;
        (full, state.settings.after_capture.clone())
    };

    // Convert logical coordinates to physical pixels (clamp to 0 minimum)
    let phys_x = ((x.max(0) as f64) * scale_factor) as u32;
    let phys_y = ((y.max(0) as f64) * scale_factor) as u32;
    let phys_w = (width as f64 * scale_factor) as u32;
    let phys_h = (height as f64 * scale_factor) as u32;

    // Crop the image
    let cropped = capture::crop_image(&full_data.image_data, phys_x, phys_y, phys_w, phys_h)?;

    {
        let mut state = state.lock().unwrap();
        state.edit_image = Some(cropped.clone());
    }

    // Close capture window
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.close();
    }

    handle_after_capture(&app, &after_capture, &cropped, phys_w, phys_h).await?;
    Ok(())
}

#[tauri::command]
pub fn cancel_capture(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("capture") {
        let _ = w.close();
    }
    Ok(())
}

#[tauri::command]
pub fn get_current_capture(
    state: tauri::State<'_, Mutex<AppState>>,
) -> Result<CaptureData, String> {
    let state = state.lock().unwrap();
    state
        .full_screenshot
        .clone()
        .ok_or("No capture data available".to_string())
}

#[tauri::command]
pub fn get_edit_image(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let state = state.lock().unwrap();
    state
        .edit_image
        .clone()
        .ok_or("No edit image available".to_string())
}

#[tauri::command]
pub async fn save_screenshot(
    state: tauri::State<'_, Mutex<AppState>>,
    _app: AppHandle,
    image_data: String,
    path: Option<String>,
    format: Option<String>,
) -> Result<String, String> {
    let (save_folder, fmt, quality, template, history_limit) = {
        let state = state.lock().unwrap();
        (
            state.settings.save_folder.clone(),
            format.unwrap_or_else(|| state.settings.format.clone()),
            state.settings.jpg_quality,
            state.settings.file_template.clone(),
            state.settings.history_limit as usize,
        )
    };

    let save_path = if let Some(p) = path {
        PathBuf::from(p)
    } else {
        let folder = PathBuf::from(&save_folder);
        fs::create_dir_all(&folder).map_err(|e| format!("Cannot create folder: {}", e))?;

        let datetime = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
        let filename = template.replace("{datetime}", &datetime);
        folder.join(format!("{}.{}", filename, fmt))
    };

    let img = capture::decode_base64_to_image(&image_data)?;

    // Ensure parent directory exists
    if let Some(parent) = save_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create dir: {}", e))?;
    }

    match fmt.as_str() {
        "jpg" | "jpeg" => {
            let rgb = img.to_rgb8();
            let mut out = Vec::new();
            let mut cursor = std::io::Cursor::new(&mut out);
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality);
            encoder
                .encode(
                    rgb.as_raw(),
                    rgb.width(),
                    rgb.height(),
                    image::ExtendedColorType::Rgb8,
                )
                .map_err(|e| format!("JPEG encode failed: {}", e))?;
            fs::write(&save_path, &out).map_err(|e| format!("Write failed: {}", e))?;
        }
        "webp" => {
            img.save_with_format(&save_path, image::ImageFormat::WebP)
                .map_err(|e| format!("WebP save failed: {}", e))?;
        }
        _ => {
            img.save_with_format(&save_path, image::ImageFormat::Png)
                .map_err(|e| format!("PNG save failed: {}", e))?;
        }
    }

    let path_str = save_path.to_string_lossy().to_string();

    // Create thumbnail and add to history
    let thumbnail = capture::create_thumbnail(&image_data, 160).unwrap_or_default();
    let entry = HistoryEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: Local::now().timestamp(),
        file_path: Some(path_str.clone()),
        thumbnail,
        width: img.width(),
        height: img.height(),
    };

    {
        let mut state = state.lock().unwrap();
        state.history.limit = history_limit;
        state.history.add(entry);
    }

    Ok(path_str)
}

/// Copy image to clipboard and save a temp file.
/// Uses osascript so macOS pasteboard holds both PNG data (paste in image apps)
/// and a plain-text path (paste in Terminal).
/// Returns the path to the temp file.
fn do_copy_to_clipboard(image_data: &str) -> Result<String, String> {
    let temp_path = crate::temp::save_temp_image(image_data)?;
    let path_str = temp_path.to_string_lossy().to_string();

    // AppleScript: write PNG bytes + the path string to the pasteboard.
    // In image apps Cmd+V pastes the image; in Terminal Cmd+V pastes the path.
    let script = format!(
        "set p to \"{}\"
set imgData to (read (POSIX file p) as \u{00AB}class PNGf\u{00BB})
set the clipboard to {{\u{00AB}class PNGf\u{00BB}:imgData, string:p}}",
        path_str
    );

    let status = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .status()
        .map_err(|e| format!("osascript launch failed: {}", e))?;

    if !status.success() {
        return Err("osascript returned a non-zero exit code".to_string());
    }

    Ok(path_str)
}

fn do_auto_save<R: Runtime>(
    app: &AppHandle<R>,
    image_data: &str,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let state = app.state::<Mutex<AppState>>();
    let (save_folder, fmt, template) = {
        let s = state.lock().unwrap();
        (
            s.settings.save_folder.clone(),
            s.settings.format.clone(),
            s.settings.file_template.clone(),
        )
    };

    let folder = PathBuf::from(&save_folder);
    fs::create_dir_all(&folder).map_err(|e| format!("Cannot create folder: {}", e))?;

    let datetime = Local::now().format("%Y-%m-%d_%H-%M-%S").to_string();
    let filename = template.replace("{datetime}", &datetime);
    let save_path = folder.join(format!("{}.{}", filename, fmt));

    let img = capture::decode_base64_to_image(image_data)?;
    img.save(&save_path).map_err(|e| format!("Save failed: {}", e))?;

    let thumbnail = capture::create_thumbnail(image_data, 160).unwrap_or_default();
    let entry = HistoryEntry {
        id: Uuid::new_v4().to_string(),
        timestamp: Local::now().timestamp(),
        file_path: Some(save_path.to_string_lossy().to_string()),
        thumbnail,
        width,
        height,
    };
    let mut s = state.lock().unwrap();
    s.history.add(entry);
    Ok(())
}

#[tauri::command]
pub async fn copy_to_clipboard(image_data: String) -> Result<(), String> {
    do_copy_to_clipboard(&image_data).map(|_| ())
}

#[tauri::command]
pub fn get_settings(state: tauri::State<'_, Mutex<AppState>>) -> AppSettings {
    state.lock().unwrap().settings.clone()
}

#[tauri::command]
pub async fn update_settings(
    state: tauri::State<'_, Mutex<AppState>>,
    _app: AppHandle,
    settings: AppSettings,
) -> Result<(), String> {
    settings.save()?;
    let mut state = state.lock().unwrap();
    state.settings = settings;
    Ok(())
}

#[tauri::command]
pub fn get_history(state: tauri::State<'_, Mutex<AppState>>) -> Vec<HistoryEntry> {
    state.lock().unwrap().history.get_all().clone()
}

#[tauri::command]
pub async fn delete_history_entry(
    state: tauri::State<'_, Mutex<AppState>>,
    id: String,
    delete_file: bool,
) -> Result<(), String> {
    let mut state = state.lock().unwrap();
    state.history.remove(&id, delete_file);
    Ok(())
}

#[tauri::command]
pub async fn open_history_item(
    state: tauri::State<'_, Mutex<AppState>>,
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    let (file_path, thumbnail) = {
        let state = state.lock().unwrap();
        match state.history.get_by_id(&id) {
            Some(entry) => (entry.file_path.clone(), entry.thumbnail.clone()),
            None => return Err("History entry not found".to_string()),
        }
    };

    let image_data = if let Some(path) = &file_path {
        let bytes = fs::read(path).map_err(|e| format!("Failed to read file: {}", e))?;
        general_purpose::STANDARD.encode(&bytes)
    } else {
        thumbnail
    };

    {
        let mut state = state.lock().unwrap();
        state.edit_image = Some(image_data);
    }

    do_open_editor_window(&app)?;
    Ok(())
}

#[tauri::command]
pub fn open_settings_window(app: AppHandle) -> Result<(), String> {
    do_open_settings_window(&app)
}

#[tauri::command]
pub fn open_history_window(app: AppHandle) -> Result<(), String> {
    do_open_history_window(&app)
}

#[tauri::command]
pub fn open_editor_window(app: AppHandle) -> Result<(), String> {
    do_open_editor_window(&app)
}

#[tauri::command]
pub fn get_screen_info(state: tauri::State<'_, Mutex<AppState>>) -> Result<CaptureData, String> {
    let state = state.lock().unwrap();
    state
        .full_screenshot
        .clone()
        .ok_or("No screen info available".to_string())
}

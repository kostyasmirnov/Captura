mod capture;
mod commands;
mod history;
mod settings;
mod tray;

use commands::*;
use history::HistoryManager;
use settings::AppSettings;
use std::sync::Mutex;
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

pub struct AppState {
    pub settings: AppSettings,
    pub history: HistoryManager,
    pub full_screenshot: Option<capture::CaptureData>,
    pub edit_image: Option<String>,
    pub capture_mode: Option<String>,
}

impl AppState {
    pub fn new() -> Self {
        let settings = AppSettings::load();
        let limit = settings.history_limit as usize;
        AppState {
            settings,
            history: HistoryManager::new(limit),
            full_screenshot: None,
            edit_image: None,
            capture_mode: None,
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(AppState::new()))
        .setup(|app| {
            // Set activation policy to Accessory (hide from dock)
            #[cfg(target_os = "macos")]
            {
                use tauri::ActivationPolicy;
                let _ = app.handle().set_activation_policy(ActivationPolicy::Accessory);
            }

            // Setup tray
            tray::setup_tray(app.handle())?;

            // Register global hotkeys
            register_hotkeys(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_area_capture,
            start_fullscreen_capture,
            confirm_capture,
            cancel_capture,
            get_current_capture,
            get_capture_mode,
            get_edit_image,
            save_screenshot,
            copy_to_clipboard,
            get_settings,
            update_settings,
            get_history,
            delete_history_entry,
            open_history_item,
            open_settings_window,
            open_history_window,
            open_editor_window,
            get_screen_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn register_hotkeys(app: &tauri::AppHandle) {
    use tauri_plugin_global_shortcut::GlobalShortcutExt;

    let app_area = app.clone();
    let app_full = app.clone();

    // Cmd+Shift+1 for area capture
    let _ = app.global_shortcut().on_shortcut(
        Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::Digit1),
        move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let app = app_area.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = do_start_area_capture(&app).await;
                });
            }
        },
    );

    // Cmd+Shift+2 for fullscreen capture
    let _ = app.global_shortcut().on_shortcut(
        Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::Digit2),
        move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let app = app_full.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = do_start_fullscreen_capture(&app).await;
                });
            }
        },
    );
}

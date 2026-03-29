use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Runtime,
};

pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), tauri::Error> {
    let capture_area =
        MenuItem::with_id(app, "capture_area", "Capture Area", true, Some("Cmd+Shift+1"))?;
    let capture_screen = MenuItem::with_id(
        app,
        "capture_screen",
        "Capture Screen",
        true,
        Some("Cmd+Shift+2"),
    )?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let history = MenuItem::with_id(app, "history", "History", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let separator2 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, Some("Cmd+Q"))?;

    let menu = Menu::with_items(
        app,
        &[
            &capture_area,
            &capture_screen,
            &separator1,
            &history,
            &settings,
            &separator2,
            &quit,
        ],
    )?;

    // Use default window icon or a fallback 1x1 pixel
    let icon = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| Image::new_owned(vec![0u8, 0u8, 0u8, 255u8], 1, 1));

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .menu(&menu)
        .tooltip("Captura  •  ⌘⇧1 Area  •  ⌘⇧2 Fullscreen")
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "capture_area" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::commands::do_start_area_capture(&app).await;
                });
            }
            "capture_screen" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::commands::do_start_fullscreen_capture(&app).await;
                });
            }
            "history" => {
                let _ = crate::commands::do_open_history_window(app);
            }
            "settings" => {
                let _ = crate::commands::do_open_settings_window(app);
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::commands::do_start_area_capture(&app).await;
                });
            }
        })
        .build(app)?;

    Ok(())
}

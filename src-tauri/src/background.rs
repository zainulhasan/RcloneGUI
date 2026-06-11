use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, State, WindowEvent};

/// Runtime flags controlling background behaviour.
pub struct AppFlags {
    /// Hide the window on close instead of quitting (tray mode).
    pub hide_on_close: AtomicBool,
    /// Set when the user picked Quit from the tray; lets close proceed.
    pub quitting: AtomicBool,
}

impl Default for AppFlags {
    fn default() -> Self {
        Self {
            hide_on_close: AtomicBool::new(true),
            quitting: AtomicBool::new(false),
        }
    }
}

const TRAY_ID: &str = "main-tray";

/// Build the system tray with Open/Quit actions.
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open RcloneGUI", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit RcloneGUI", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip("RcloneGUI")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main_window(app),
            "quit" => {
                app.state::<AppFlags>()
                    .quitting
                    .store(true, Ordering::SeqCst);
                app.state::<crate::commands::DaemonState>().shutdown();
                app.exit(0);
            }
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Window-event hook: hide to tray on close when enabled.
pub fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { api, .. } = event {
        let flags = window.app_handle().state::<AppFlags>();
        if flags.hide_on_close.load(Ordering::SeqCst) && !flags.quitting.load(Ordering::SeqCst) {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

/// Frontend toggle for tray mode (Settings → run in background).
#[tauri::command]
pub fn set_hide_on_close(state: State<'_, AppFlags>, enabled: bool) {
    state.hide_on_close.store(enabled, Ordering::SeqCst);
}

/// Live transfer status shown next to / under the tray icon.
/// Empty text clears it back to the idle tooltip.
#[tauri::command]
pub fn tray_status(app: AppHandle, text: String) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if text.is_empty() {
            let _ = tray.set_tooltip(Some("RcloneGUI"));
            #[cfg(target_os = "macos")]
            let _ = tray.set_title(None::<&str>);
        } else {
            let _ = tray.set_tooltip(Some(format!("RcloneGUI — {text}")));
            #[cfg(target_os = "macos")]
            let _ = tray.set_title(Some(&text));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flags_default_to_tray_mode_not_quitting() {
        let flags = AppFlags::default();
        assert!(flags.hide_on_close.load(Ordering::SeqCst));
        assert!(!flags.quitting.load(Ordering::SeqCst));
    }
}

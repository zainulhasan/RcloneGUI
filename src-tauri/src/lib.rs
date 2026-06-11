pub mod background;
pub mod commands;
pub mod disk;
pub mod rclone;

use background::AppFlags;
use commands::{DaemonState, StartLock};
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:media.db",
                    vec![tauri_plugin_sql::Migration {
                        version: 1,
                        description: "create media_items",
                        sql: include_str!("../migrations/001_media_items.sql"),
                        kind: tauri_plugin_sql::MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .manage(DaemonState::default())
        .manage(StartLock::default())
        .manage(AppFlags::default())
        .setup(|app| {
            background::setup_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(background::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::detect_rclone,
            commands::daemon_start,
            commands::daemon_stop,
            commands::daemon_status,
            commands::daemon_logs,
            commands::rc_call,
            commands::disk_free,
            background::set_hide_on_close,
            background::tray_status,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Make sure the rclone daemon never outlives the app.
            if let tauri::RunEvent::Exit = event {
                app_handle.state::<DaemonState>().shutdown();
            }
        });
}

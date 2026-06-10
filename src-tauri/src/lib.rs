pub mod commands;
pub mod disk;
pub mod rclone;

use commands::DaemonState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DaemonState::default())
        .invoke_handler(tauri::generate_handler![
            commands::detect_rclone,
            commands::daemon_start,
            commands::daemon_stop,
            commands::daemon_status,
            commands::rc_call,
            commands::disk_free,
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

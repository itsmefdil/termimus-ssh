pub mod commands;
pub mod db;
pub mod sftp;
pub mod ssh;
pub mod vault;

use commands::AppState;
use db::Database;
use sftp::SftpManager;
use ssh::SessionManager;
use std::sync::Arc;
use vault::VaultManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Arc::new(Database::new().expect("Failed to initialize SQLite database"));
    let vault = Arc::new(VaultManager::new());
    let ssh = Arc::new(SessionManager::new());
    let sftp = Arc::new(SftpManager::new());

    let state = AppState { db, vault, ssh, sftp };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::vault_status,
            commands::vault_setup,
            commands::vault_unlock,
            commands::vault_lock,
            commands::host_list,
            commands::host_save,
            commands::host_delete,
            commands::folder_list,
            commands::folder_save,
            commands::folder_delete,
            commands::ssh_connect,
            commands::ssh_write,
            commands::ssh_resize,
            commands::ssh_disconnect,
            commands::sftp_connect,
            commands::sftp_list,
            commands::sftp_mkdir,
            commands::sftp_delete,
            commands::sftp_rename,
            commands::sftp_upload,
            commands::sftp_download,
            commands::sftp_disconnect,
            commands::local_home_dir,
            commands::local_list,
            commands::local_mkdir,
            commands::local_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running termimus application");
}

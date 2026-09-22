pub mod commands;
pub mod db;
pub mod sftp;
pub mod ssh;
pub mod tunnel;
pub mod vault;

use commands::AppState;
use db::Database;
use sftp::SftpManager;
use ssh::SessionManager;
use std::sync::Arc;
use tunnel::TunnelManager;
use vault::VaultManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Arc::new(Database::new().expect("Failed to initialize SQLite database"));
    let vault = Arc::new(VaultManager::new());
    let ssh = Arc::new(SessionManager::new());
    let sftp = Arc::new(SftpManager::new());
    let tunnel = Arc::new(TunnelManager::new());

    let state = AppState { db, vault, ssh, sftp, tunnel };

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
            commands::sftp_read_file,
            commands::sftp_write_file,
            commands::local_home_dir,
            commands::local_list,
            commands::local_mkdir,
            commands::local_delete,
            commands::local_read_file,
            commands::local_write_file,
            commands::tunnel_rule_list,
            commands::tunnel_rule_save,
            commands::tunnel_rule_delete,
            commands::tunnel_start,
            commands::tunnel_stop,
            commands::tunnel_active_list,
            commands::snippet_list,
            commands::snippet_save,
            commands::snippet_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running termimus application");
}

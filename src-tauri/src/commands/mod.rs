use crate::db::models::{Folder, Host, HostInput, Credential};
use crate::db::Database;
use crate::ssh::{SessionManager, SshAuth};
use crate::vault::VaultManager;
use chrono::Utc;
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

pub struct AppState {
    pub db: Arc<Database>,
    pub vault: Arc<VaultManager>,
    pub ssh: Arc<SessionManager>,
}

#[derive(Serialize)]
pub struct VaultStatus {
    pub is_initialized: bool,
    pub is_unlocked: bool,
}

#[tauri::command]
pub fn vault_status(state: State<AppState>) -> Result<VaultStatus, String> {
    let is_initialized = state
        .db
        .get_vault_meta("salt")
        .map_err(|e| e.to_string())?
        .is_some();
    let is_unlocked = state.vault.is_unlocked();
    Ok(VaultStatus {
        is_initialized,
        is_unlocked,
    })
}

#[tauri::command]
pub fn vault_setup(state: State<AppState>, password: String) -> Result<(), String> {
    if password.len() < 4 {
        return Err("Password must be at least 4 characters long".to_string());
    }
    let salt = VaultManager::generate_salt();
    let key = VaultManager::derive_key(&password, &salt)?;

    // Store salt
    state
        .db
        .set_vault_meta("salt", &salt)
        .map_err(|e| e.to_string())?;

    // Store verification token (encrypted with derived key)
    state.vault.set_key(key);
    let (ciphertext, nonce) = state.vault.encrypt(VaultManager::verification_payload())?;
    state
        .db
        .set_vault_meta("verifier_ciphertext", &ciphertext)
        .map_err(|e| e.to_string())?;
    state
        .db
        .set_vault_meta("verifier_nonce", &nonce)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn vault_unlock(state: State<AppState>, password: String) -> Result<bool, String> {
    let salt = state
        .db
        .get_vault_meta("salt")
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Vault has not been initialized yet".to_string())?;

    let verifier_ct = state
        .db
        .get_vault_meta("verifier_ciphertext")
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Corrupted vault state: verifier missing".to_string())?;

    let verifier_nonce = state
        .db
        .get_vault_meta("verifier_nonce")
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Corrupted vault state: nonce missing".to_string())?;

    let key = VaultManager::derive_key(&password, &salt)?;
    state.vault.set_key(key);

    match state.vault.decrypt(&verifier_ct, &verifier_nonce) {
        Ok(decrypted) if decrypted == VaultManager::verification_payload() => Ok(true),
        _ => {
            state.vault.lock();
            Err("Incorrect master password".to_string())
        }
    }
}

#[tauri::command]
pub fn vault_lock(state: State<AppState>) -> Result<(), String> {
    state.vault.lock();
    Ok(())
}

#[tauri::command]
pub fn host_list(state: State<AppState>) -> Result<Vec<Host>, String> {
    state.db.list_hosts().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn host_save(state: State<AppState>, input: HostInput, host_id: Option<String>) -> Result<Host, String> {
    let now = Utc::now().to_rfc3339();
    let id = host_id.unwrap_or_else(|| Uuid::new_v4().to_string());

    let mut credential_id = None;

    // Encrypt secret if supplied
    if let Some(secret) = input.secret {
        if !secret.trim().is_empty() {
            if !state.vault.is_unlocked() {
                return Err("Vault must be unlocked to save credentials".to_string());
            }
            let (ciphertext, nonce) = state.vault.encrypt(secret.as_bytes())?;
            let (passphrase_ciphertext, passphrase_nonce) = match input.passphrase {
                Some(p) if !p.trim().is_empty() => {
                    let (ct, n) = state.vault.encrypt(p.as_bytes())?;
                    (Some(ct), Some(n))
                }
                _ => (None, None),
            };

            let cred = Credential {
                id: Uuid::new_v4().to_string(),
                kind: input.auth_method.clone(),
                ciphertext,
                nonce,
                passphrase_ciphertext,
                passphrase_nonce,
            };
            state.db.save_credential(&cred).map_err(|e| e.to_string())?;
            credential_id = Some(cred.id);
        }
    }

    let existing = state.db.get_host(&id).map_err(|e| e.to_string())?;
    let created_at = existing.map(|h| h.created_at).unwrap_or_else(|| now.clone());

    let host = Host {
        id,
        folder_id: input.folder_id,
        label: input.label,
        address: input.address,
        port: input.port,
        username: input.username,
        auth_method: input.auth_method,
        credential_id,
        tags: input.tags,
        created_at,
        updated_at: now,
    };

    state.db.save_host(&host).map_err(|e| e.to_string())?;
    Ok(host)
}

#[tauri::command]
pub fn host_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_host(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn folder_list(state: State<AppState>) -> Result<Vec<Folder>, String> {
    state.db.list_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn folder_save(state: State<AppState>, name: String, parent_id: Option<String>) -> Result<Folder, String> {
    let folder = Folder {
        id: Uuid::new_v4().to_string(),
        name,
        parent_id,
        created_at: Utc::now().to_rfc3339(),
    };
    state.db.save_folder(&folder).map_err(|e| e.to_string())?;
    Ok(folder)
}

#[tauri::command]
pub fn folder_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_folder(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_connect(
    app: AppHandle,
    state: State<'_, AppState>,
    host_id: String,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let host = state
        .db
        .get_host(&host_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Host not found".to_string())?;

    let auth = match host.auth_method.as_str() {
        "password" => {
            let secret = if let Some(cred_id) = host.credential_id {
                let cred = state
                    .db
                    .get_credential(&cred_id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "Credential record not found".to_string())?;
                let bytes = state.vault.decrypt(&cred.ciphertext, &cred.nonce)?;
                String::from_utf8(bytes).map_err(|e| format!("Invalid utf-8 password: {e}"))?
            } else {
                return Err("No password configured for this host".to_string());
            };
            SshAuth::Password(secret)
        }
        "private_key" => {
            let (pem, passphrase) = if let Some(cred_id) = host.credential_id {
                let cred = state
                    .db
                    .get_credential(&cred_id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "Credential record not found".to_string())?;
                let pem_bytes = state.vault.decrypt(&cred.ciphertext, &cred.nonce)?;
                let pem_str = String::from_utf8(pem_bytes).map_err(|e| format!("Invalid utf-8 PEM: {e}"))?;
                let pp = match (cred.passphrase_ciphertext, cred.passphrase_nonce) {
                    (Some(ct), Some(n)) => {
                        let bytes = state.vault.decrypt(&ct, &n)?;
                        Some(String::from_utf8(bytes).map_err(|e| format!("Invalid passphrase: {e}"))?)
                    }
                    _ => None,
                };
                (pem_str, pp)
            } else {
                return Err("No private key configured for this host".to_string());
            };
            SshAuth::PrivateKey { pem, passphrase }
        }
        _ => return Err(format!("Unsupported auth method: {}", host.auth_method)),
    };

    state
        .ssh
        .connect(
            app,
            session_id,
            host.address,
            host.port,
            host.username,
            auth,
            cols,
            rows,
        )
        .await
}

#[tauri::command]
pub async fn ssh_write(
    state: State<'_, AppState>,
    session_id: String,
    data: Vec<u8>,
) -> Result<(), String> {
    state.ssh.write(&session_id, data).await
}

#[tauri::command]
pub async fn ssh_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    state.ssh.resize(&session_id, cols, rows).await
}

#[tauri::command]
pub async fn ssh_disconnect(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.ssh.disconnect(&session_id).await
}

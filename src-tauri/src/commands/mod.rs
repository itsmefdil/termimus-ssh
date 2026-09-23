use crate::db::models::{Folder, Host, HostInput, Credential, KeychainItem, KeychainKeyInput, KeychainIdentityInput, PortForwardRule, PortForwardInput, Snippet, SnippetInput, KnownHost, BackupBundle, ImportSummary};
use crate::db::Database;
use crate::sftp::{self, FileEntry, SftpManager};
use crate::ssh::{SessionManager, SshAuth};
use crate::tunnel::TunnelManager;
use crate::vault::VaultManager;
use chrono::Utc;
use serde::Serialize;
use std::path::Path;
use std::sync::Arc;
use tauri::{AppHandle, State};
use uuid::Uuid;

pub struct AppState {
    pub db: Arc<Database>,
    pub vault: Arc<VaultManager>,
    pub ssh: Arc<SessionManager>,
    pub sftp: Arc<SftpManager>,
    pub tunnel: Arc<TunnelManager>,
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

    state
        .db
        .set_vault_meta("salt", &salt)
        .map_err(|e| e.to_string())?;

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

    // A Keychain item was picked from the dropdown — link directly to it,
    // no new anonymous credential needed.
    let mut credential_id = input.credential_id;

    if credential_id.is_none() {
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
                    // Anonymous one-off credential, not shown in the Keychain list.
                    name: String::new(),
                    key_type: String::new(),
                    public_key: String::new(),
                    fingerprint: String::new(),
                    username: None,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                };
                state.db.save_credential(&cred).map_err(|e| e.to_string())?;
                credential_id = Some(cred.id);
            }
        }
    }

    let existing = state.db.get_host(&id).map_err(|e| e.to_string())?;
    let created_at = existing.as_ref().map(|h| h.created_at.clone()).unwrap_or_else(|| now.clone());

    if credential_id.is_none() {
        if let Some(h) = &existing {
            credential_id = h.credential_id.clone();
        }
    }

    let last_connected_at = existing.as_ref().and_then(|h| h.last_connected_at.clone());

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
        last_connected_at,
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
pub fn folder_save(
    state: State<AppState>,
    name: String,
    parent_id: Option<String>,
    id: Option<String>,
) -> Result<Folder, String> {
    let folder = Folder {
        id: id.unwrap_or_else(|| Uuid::new_v4().to_string()),
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

fn resolve_host_auth(state: &AppState, host: &Host) -> Result<SshAuth, String> {
    match host.auth_method.as_str() {
        "password" => {
            let secret = if let Some(cred_id) = &host.credential_id {
                let cred = state
                    .db
                    .get_credential(cred_id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "Credential record not found".to_string())?;
                let bytes = state.vault.decrypt(&cred.ciphertext, &cred.nonce)?;
                String::from_utf8(bytes).map_err(|e| format!("Invalid utf-8 password: {e}"))?
            } else {
                return Err("No password configured for this host".to_string());
            };
            Ok(SshAuth::Password(secret))
        }
        "private_key" => {
            let (pem, passphrase) = if let Some(cred_id) = &host.credential_id {
                let cred = state
                    .db
                    .get_credential(cred_id)
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "Credential record not found".to_string())?;

                if cred.kind == "public_key" {
                    return Err(format!(
                        "Keychain item '{}' is a Public Key only (starts with ssh-rsa/ssh-ed25519). SSH login requires your matching Private Key (which starts with '-----BEGIN ... PRIVATE KEY-----', e.g. from ~/.ssh/id_rsa or ~/.ssh/id_ed25519 without .pub).",
                        cred.name
                    ));
                }

                let pem_bytes = state.vault.decrypt(&cred.ciphertext, &cred.nonce)?;
                let pem_str = String::from_utf8(pem_bytes).map_err(|e| format!("Invalid utf-8 PEM: {e}"))?;

                if crate::sshkey::is_public_key_text(&pem_str) {
                    return Err("The configured key is an OpenSSH Public Key (starts with ssh-rsa/ssh-ed25519). SSH client login requires the Private Key (starts with '-----BEGIN ... PRIVATE KEY-----'), not the public key.".to_string());
                }

                let pp = match (&cred.passphrase_ciphertext, &cred.passphrase_nonce) {
                    (Some(ct), Some(n)) => {
                        let bytes = state.vault.decrypt(ct, n)?;
                        Some(String::from_utf8(bytes).map_err(|e| format!("Invalid passphrase: {e}"))?)
                    }
                    _ => None,
                };
                (pem_str, pp)
            } else {
                return Err("No private key configured for this host".to_string());
            };
            Ok(SshAuth::PrivateKey { pem, passphrase })
        }
        _ => Err(format!("Unsupported auth method: {}", host.auth_method)),
    }
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

    let auth = resolve_host_auth(&state, &host)?;

    let result = state
        .ssh
        .connect(
            app,
            state.db.clone(),
            session_id,
            host.address,
            host.port,
            host.username,
            auth,
            cols,
            rows,
        )
        .await;

    if result.is_ok() {
        let _ = state.db.touch_host_last_connected(&host_id);
    }

    result
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

// ================= SSH KEY COMMANDS =================

#[derive(Debug, Clone, Serialize)]
pub struct GeneratedKeyPairDto {
    pub private_key_pem: String,
    pub public_key_openssh: String,
}

/// Generates a brand new SSH key pair (Ed25519, RSA or ECDSA) for use as a
/// host's private key. Returns both halves so the UI can show the public
/// key immediately for copying onto the remote server; the private key is
/// only persisted (encrypted) once the user saves the host.
#[tauri::command]
pub fn key_generate(algorithm: String, comment: String) -> Result<GeneratedKeyPairDto, String> {
    let pair = crate::sshkey::generate_keypair(&algorithm, &comment)?;
    Ok(GeneratedKeyPairDto {
        private_key_pem: pair.private_key_pem,
        public_key_openssh: pair.public_key_openssh,
    })
}

/// Derives the OpenSSH public key line from a private key PEM the user
/// pasted or imported, so it can be copied onto the remote server's
/// `~/.ssh/authorized_keys` without ever needing the public key stored
/// separately.
#[tauri::command]
pub fn key_derive_public(pem: String, passphrase: Option<String>) -> Result<String, String> {
    crate::sshkey::derive_public_key(&pem, passphrase.as_deref())
}

// ================= KEYCHAIN COMMANDS =================
//
// The Keychain is a Termius-style library of reusable, named credentials
// (SSH keys and password identities). A host's `credential_id` links to
// one of these instead of every host owning its own copy — pick once,
// reuse across every server.

#[tauri::command]
pub fn keychain_list(state: State<AppState>) -> Result<Vec<KeychainItem>, String> {
    state
        .db
        .list_keychain_items()
        .map_err(|e| e.to_string())
}

/// Saves (or updates, if `item_id` is given) a named SSH key in the Keychain.
/// The algorithm badge, OpenSSH public key and fingerprint are re-derived
/// server-side from the PEM so the UI never has to trust client-supplied values.
#[tauri::command]
pub fn keychain_save_key(
    state: State<AppState>,
    input: KeychainKeyInput,
    item_id: Option<String>,
) -> Result<KeychainItem, String> {
    if !state.vault.is_unlocked() {
        return Err("Vault must be unlocked to save Keychain items".to_string());
    }
    if input.name.trim().is_empty() {
        return Err("Key name is required".to_string());
    }

    let details = crate::sshkey::inspect_key(&input.private_key_pem, input.passphrase.as_deref())?;

    let kind = if details.is_public_key_only {
        "public_key".to_string()
    } else {
        "private_key".to_string()
    };

    let (ciphertext, nonce) = state.vault.encrypt(input.private_key_pem.as_bytes())?;
    let (passphrase_ciphertext, passphrase_nonce) = match &input.passphrase {
        Some(p) if !p.trim().is_empty() => {
            let (ct, n) = state.vault.encrypt(p.as_bytes())?;
            (Some(ct), Some(n))
        }
        _ => (None, None),
    };

    let now = Utc::now().to_rfc3339();
    let id = item_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing = state.db.get_credential(&id).map_err(|e| e.to_string())?;
    let created_at = existing.map(|c| c.created_at).unwrap_or_else(|| now.clone());

    let cred = Credential {
        id,
        kind,
        ciphertext,
        nonce,
        passphrase_ciphertext,
        passphrase_nonce,
        name: input.name.trim().to_string(),
        key_type: details.algorithm,
        public_key: details.public_key,
        fingerprint: details.fingerprint,
        username: input.username.filter(|u| !u.trim().is_empty()),
        created_at,
        updated_at: now,
    };
    state.db.save_credential(&cred).map_err(|e| e.to_string())?;
    Ok(KeychainItem::from(&cred))
}

/// Saves (or updates, if `item_id` is given) a named password identity in the Keychain.
#[tauri::command]
pub fn keychain_save_identity(
    state: State<AppState>,
    input: KeychainIdentityInput,
    item_id: Option<String>,
) -> Result<KeychainItem, String> {
    if !state.vault.is_unlocked() {
        return Err("Vault must be unlocked to save Keychain items".to_string());
    }
    if input.name.trim().is_empty() {
        return Err("Identity name is required".to_string());
    }
    if input.password.is_empty() {
        return Err("Password is required".to_string());
    }

    let (ciphertext, nonce) = state.vault.encrypt(input.password.as_bytes())?;

    let now = Utc::now().to_rfc3339();
    let id = item_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let existing = state.db.get_credential(&id).map_err(|e| e.to_string())?;
    let created_at = existing.map(|c| c.created_at).unwrap_or_else(|| now.clone());

    let cred = Credential {
        id,
        kind: "password".to_string(),
        ciphertext,
        nonce,
        passphrase_ciphertext: None,
        passphrase_nonce: None,
        name: input.name.trim().to_string(),
        key_type: String::new(),
        public_key: String::new(),
        fingerprint: String::new(),
        username: input.username.filter(|u| !u.trim().is_empty()),
        created_at,
        updated_at: now,
    };
    state.db.save_credential(&cred).map_err(|e| e.to_string())?;
    Ok(KeychainItem::from(&cred))
}

#[tauri::command]
pub fn keychain_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_credential(&id).map_err(|e| e.to_string())
}

/// Returns the OpenSSH public key for a stored Keychain SSH key, so it can
/// be copied without re-deriving it from ciphertext on every render.
#[tauri::command]
pub fn keychain_get_public_key(state: State<AppState>, id: String) -> Result<String, String> {
    let cred = state
        .db
        .get_credential(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Keychain item not found".to_string())?;
    if cred.public_key.is_empty() {
        return Err("This Keychain item has no public key".to_string());
    }
    Ok(cred.public_key)
}

// ================= SFTP COMMANDS =================

#[tauri::command]
pub async fn sftp_connect(
    state: State<'_, AppState>,
    host_id: String,
    session_id: String,
) -> Result<String, String> {
    let host = state
        .db
        .get_host(&host_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Host not found".to_string())?;

    let auth = resolve_host_auth(&state, &host)?;

    state
        .sftp
        .connect(
            state.db.clone(),
            session_id,
            host_id,
            host.address,
            host.port,
            host.username,
            auth,
        )
        .await
}

#[tauri::command]
pub async fn sftp_list(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<Vec<FileEntry>, String> {
    state.sftp.list(&session_id, &path).await
}

#[tauri::command]
pub async fn sftp_mkdir(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<(), String> {
    state.sftp.mkdir(&session_id, &path).await
}

#[tauri::command]
pub async fn sftp_delete(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    is_dir: bool,
) -> Result<(), String> {
    state.sftp.delete(&session_id, &path, is_dir).await
}

#[tauri::command]
pub async fn sftp_rename(
    state: State<'_, AppState>,
    session_id: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    state.sftp.rename(&session_id, &old_path, &new_path).await
}

#[tauri::command]
pub async fn sftp_upload(
    state: State<'_, AppState>,
    session_id: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    state.sftp.upload_file(&session_id, &local_path, &remote_path).await
}

#[tauri::command]
pub async fn sftp_download(
    state: State<'_, AppState>,
    session_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    state.sftp.download_file(&session_id, &remote_path, &local_path).await
}

#[tauri::command]
pub async fn sftp_disconnect(
    state: State<'_, AppState>,
    session_id: String,
) -> Result<(), String> {
    state.sftp.disconnect(&session_id).await
}

#[tauri::command]
pub async fn sftp_read_file(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
) -> Result<String, String> {
    state.sftp.read_text_file(&session_id, &path).await
}

#[tauri::command]
pub async fn sftp_write_file(
    state: State<'_, AppState>,
    session_id: String,
    path: String,
    content: String,
) -> Result<(), String> {
    state.sftp.write_text_file(&session_id, &path, &content).await
}

// Local filesystem helpers
#[tauri::command]
pub fn local_home_dir() -> String {
    sftp::get_user_home()
}

#[tauri::command]
pub fn local_list(path: Option<String>) -> Result<Vec<FileEntry>, String> {
    let p = match path {
        Some(s) if !s.trim().is_empty() => Path::new(&s).to_path_buf(),
        _ => Path::new(&sftp::get_user_home()).to_path_buf(),
    };
    sftp::list_local_directory(&p)
}

#[tauri::command]
pub fn local_read_file(path: String) -> Result<String, String> {
    sftp::read_local_text_file(Path::new(&path))
}

#[tauri::command]
pub fn local_write_file(path: String, content: String) -> Result<(), String> {
    sftp::write_local_text_file(Path::new(&path), &content)
}

#[tauri::command]
pub fn local_mkdir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| format!("Failed to create local directory: {e}"))
}

#[tauri::command]
pub fn local_delete(path: String, is_dir: bool) -> Result<(), String> {
    if is_dir {
        std::fs::remove_dir_all(&path).map_err(|e| format!("Failed to delete local folder: {e}"))
    } else {
        std::fs::remove_file(&path).map_err(|e| format!("Failed to delete local file: {e}"))
    }
}

// ================= TUNNEL COMMANDS =================

#[tauri::command]
pub fn tunnel_rule_list(state: State<AppState>) -> Result<Vec<PortForwardRule>, String> {
    state.db.list_port_forwards().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tunnel_rule_save(
    state: State<AppState>,
    input: PortForwardInput,
    rule_id: Option<String>,
) -> Result<PortForwardRule, String> {
    let now = Utc::now().to_rfc3339();
    let id = rule_id.unwrap_or_else(|| Uuid::new_v4().to_string());

    let existing = state.db.get_port_forward(&id).map_err(|e| e.to_string())?;
    let created_at = existing.map(|r| r.created_at).unwrap_or(now);

    let rule = PortForwardRule {
        id,
        host_id: input.host_id,
        label: input.label,
        forward_type: input.forward_type,
        local_address: input.local_address,
        local_port: input.local_port,
        remote_address: input.remote_address,
        remote_port: input.remote_port,
        created_at,
    };

    state.db.save_port_forward(&rule).map_err(|e| e.to_string())?;
    Ok(rule)
}

#[tauri::command]
pub fn tunnel_rule_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_port_forward(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tunnel_start(
    app: AppHandle,
    state: State<'_, AppState>,
    rule_id: String,
) -> Result<(), String> {
    let rule = state
        .db
        .get_port_forward(&rule_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Port forwarding rule not found".to_string())?;

    let host = state
        .db
        .get_host(&rule.host_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Target host not found".to_string())?;

    let auth = resolve_host_auth(&state, &host)?;

    state
        .tunnel
        .start_local_forward(
            app,
            state.db.clone(),
            rule_id,
            host.address,
            host.port,
            host.username,
            auth,
            rule.local_address,
            rule.local_port,
            rule.remote_address,
            rule.remote_port,
        )
        .await
}

#[tauri::command]
pub async fn tunnel_stop(
    state: State<'_, AppState>,
    rule_id: String,
) -> Result<(), String> {
    state.tunnel.stop(&rule_id).await
}

#[tauri::command]
pub async fn tunnel_active_list(
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    Ok(state.tunnel.list_active().await)
}

// ================= SNIPPET COMMANDS =================

#[tauri::command]
pub fn snippet_list(state: State<AppState>) -> Result<Vec<Snippet>, String> {
    state.db.list_snippets().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn snippet_save(
    state: State<AppState>,
    input: SnippetInput,
    snippet_id: Option<String>,
) -> Result<Snippet, String> {
    let now = Utc::now().to_rfc3339();
    let id = snippet_id.unwrap_or_else(|| Uuid::new_v4().to_string());

    let existing = state.db.list_snippets()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|s| s.id == id);
    let created_at = existing.map(|s| s.created_at).unwrap_or(now.clone());

    let snippet = Snippet {
        id,
        title: input.title,
        command: input.command,
        tags: input.tags,
        created_at,
        updated_at: now,
    };

    state.db.save_snippet(&snippet).map_err(|e| e.to_string())?;
    Ok(snippet)
}

#[tauri::command]
pub fn snippet_delete(state: State<AppState>, id: String) -> Result<(), String> {
    state.db.delete_snippet(&id).map_err(|e| e.to_string())
}

// ================= PING / LATENCY COMMANDS =================

#[derive(Serialize, Clone)]
pub struct PingResult {
    pub host_id: String,
    pub latency_ms: Option<u32>,
    pub online: bool,
}

async fn tcp_ping_one(address: String, port: u16) -> Option<u32> {
    let start = std::time::Instant::now();
    let addr = format!("{address}:{port}");
    let connect_fut = tokio::net::TcpStream::connect(&addr);

    match tokio::time::timeout(std::time::Duration::from_millis(2500), connect_fut).await {
        Ok(Ok(_stream)) => Some(start.elapsed().as_millis() as u32),
        _ => None,
    }
}

#[tauri::command]
pub async fn ping_host(address: String, port: u16) -> Result<Option<u32>, String> {
    Ok(tcp_ping_one(address, port).await)
}

#[tauri::command]
pub async fn ping_hosts(
    state: State<'_, AppState>,
) -> Result<Vec<PingResult>, String> {
    let hosts = state.db.list_hosts().map_err(|e| e.to_string())?;

    let mut handles = Vec::new();
    for host in hosts {
        let host_id = host.id.clone();
        let address = host.address.clone();
        let port = host.port;
        handles.push(tokio::spawn(async move {
            let latency_ms = tcp_ping_one(address, port).await;
            PingResult {
                host_id,
                online: latency_ms.is_some(),
                latency_ms,
            }
        }));
    }

    let mut results = Vec::new();
    for handle in handles {
        if let Ok(result) = handle.await {
            results.push(result);
        }
    }

    Ok(results)
}

// ================= KNOWN HOSTS / KEY FINGERPRINT COMMANDS =================

#[tauri::command]
pub fn known_host_list(state: State<AppState>) -> Result<Vec<KnownHost>, String> {
    state.db.list_known_hosts().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn known_host_delete(
    state: State<AppState>,
    address: String,
    port: u16,
) -> Result<(), String> {
    state.db.delete_known_host(&address, port).map_err(|e| e.to_string())
}

// ================= BACKUP & RESTORE COMMANDS =================

#[tauri::command]
pub fn backup_export(state: State<AppState>) -> Result<String, String> {
    let bundle = state.db.export_backup_bundle("0.1.0").map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&bundle)
        .map_err(|e| format!("Failed to serialize backup bundle: {e}"))
}

#[tauri::command]
pub fn backup_import(
    state: State<AppState>,
    backup_json: String,
    replace_all: bool,
) -> Result<ImportSummary, String> {
    let bundle: BackupBundle = serde_json::from_str(&backup_json)
        .map_err(|e| format!("Invalid backup file format: {e}"))?;

    if bundle.format_version != 1 {
        return Err(format!("Unsupported backup format version: {}", bundle.format_version));
    }

    state.db.import_backup_bundle(&bundle, replace_all).map_err(|e| e.to_string())
}

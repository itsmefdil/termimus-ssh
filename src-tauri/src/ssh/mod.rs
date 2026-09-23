use russh::client::{self, Handle, Handler};
use russh::keys::ssh_key::HashAlg;
use russh::keys::{decode_secret_key, PrivateKeyWithHashAlg};
use russh::Disconnect;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};

use crate::db::models::KnownHost;
use crate::db::Database;

/// Progress payload emitted to the frontend during connection handshake.
#[derive(Debug, Clone, Serialize)]
pub struct SshProgressPayload {
    pub step: u8,          // 1: Connect, 2: HostKey, 3: Auth, 4: Shell, 5: Ready
    pub step_name: String, // "connecting", "host_key", "authenticating", "opening_channel", "ready", "error"
    pub message: String,
    pub timestamp: String,
    pub is_error: bool,
}

/// Verifies the server's host key against the locally stored known_hosts
/// table (Trust On First Use), rejecting the connection outright if the
/// key ever changes for a previously trusted address:port — this is the
/// same protection OpenSSH's known_hosts file provides against MITM
/// attacks and impersonated servers.
pub struct SshClientHandler {
    pub address: String,
    pub port: u16,
    pub db: Arc<Database>,
}

impl Handler for SshClientHandler {
    type Error = anyhow::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::PublicKey,
    ) -> Result<bool, Self::Error> {
        let fingerprint = format!("{}", server_public_key.fingerprint(HashAlg::Sha256));
        let key_type = server_public_key.algorithm().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let existing = self.db.get_known_host(&self.address, self.port).ok().flatten();

        match existing {
            None => {
                // Trust On First Use: remember this key for future connections.
                let entry = KnownHost {
                    address: self.address.clone(),
                    port: self.port,
                    key_type,
                    fingerprint,
                    first_seen_at: now.clone(),
                    last_seen_at: now,
                };
                let _ = self.db.save_known_host(&entry);
                Ok(true)
            }
            Some(known) if known.fingerprint == fingerprint => {
                // Key matches what we trusted before — refresh last_seen_at.
                let mut updated = known;
                updated.last_seen_at = now;
                let _ = self.db.save_known_host(&updated);
                Ok(true)
            }
            Some(known) => {
                // Key mismatch: potential MITM attack, server reinstall, or IP reuse.
                Err(anyhow::anyhow!(
                    "REMOTE HOST IDENTIFICATION HAS CHANGED for {}:{}! Server presented a key with fingerprint {} but the previously trusted key was {} (first trusted {}). This could indicate a man-in-the-middle attack, or the server may have been reinstalled. Remove the old entry from Known Hosts if you trust this change.",
                    self.address, self.port, fingerprint, known.fingerprint, known.first_seen_at
                ))
            }
        }
    }
}

pub enum SshAuth {
    Password(String),
    PrivateKey { pem: String, passphrase: Option<String> },
}

pub enum SessionCommand {
    Data(Vec<u8>),
    Resize { cols: u32, rows: u32 },
}

/// Authenticates an SSH session using public key authentication, dynamically negotiating
/// the strongest RSA signature algorithm (rsa-sha2-512, rsa-sha2-256) accepted by the
/// server with fallback to sha-1, avoiding the "Authentication rejected" error seen on
/// modern OpenSSH (>= 8.8) servers that disable legacy SHA-1 ssh-rsa.
pub async fn authenticate_publickey_smart<H: russh::client::Handler>(
    handle: &mut russh::client::Handle<H>,
    username: &str,
    key_pair: russh::keys::PrivateKey,
) -> Result<russh::client::AuthResult, String> {
    let is_rsa = key_pair.algorithm().is_rsa();
    let best_hash = if is_rsa {
        match handle.best_supported_rsa_hash().await {
            Ok(Some(hash)) => hash,
            _ => Some(HashAlg::Sha512),
        }
    } else {
        None
    };

    let key = PrivateKeyWithHashAlg::new(Arc::new(key_pair.clone()), best_hash);
    let mut res = handle
        .authenticate_publickey(username, key)
        .await
        .map_err(|e| format!("Auth error: {e}"))?;

    if !res.success() && is_rsa {
        for fallback in [Some(HashAlg::Sha256), Some(HashAlg::Sha512), None] {
            if fallback == best_hash {
                continue;
            }
            let key = PrivateKeyWithHashAlg::new(Arc::new(key_pair.clone()), fallback);
            if let Ok(r) = handle.authenticate_publickey(username, key).await {
                if r.success() {
                    res = r;
                    break;
                }
            }
        }
    }

    Ok(res)
}

pub struct SshSession {
    pub id: String,
    handle: Handle<SshClientHandler>,
    cmd_tx: mpsc::UnboundedSender<SessionCommand>,
}

pub struct SessionManager {
    sessions: Mutex<HashMap<String, Arc<SshSession>>>,
    connecting: Mutex<HashSet<String>>,
}

impl SessionManager {
    pub fn new() -> Self {
        SessionManager {
            sessions: Mutex::new(HashMap::new()),
            connecting: Mutex::new(HashSet::new()),
        }
    }

    pub async fn connect(
        &self,
        app: AppHandle,
        db: Arc<Database>,
        session_id: String,
        address: String,
        port: u16,
        username: String,
        auth: SshAuth,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        // Prevent duplicate concurrent connection attempts for the exact same session_id
        {
            let mut connecting = self.connecting.lock().await;
            if connecting.contains(&session_id) {
                return Err("Connection already in progress for this session".to_string());
            }
            connecting.insert(session_id.clone());
        }

        // Clean up any stale existing session with this ID before starting fresh
        {
            let mut sessions = self.sessions.lock().await;
            if let Some(old_session) = sessions.remove(&session_id) {
                let _ = old_session.handle.disconnect(Disconnect::ByApplication, "", "en").await;
            }
        }

        let res = self
            .do_connect(app, db, session_id.clone(), address, port, username, auth, cols, rows)
            .await;

        {
            let mut connecting = self.connecting.lock().await;
            connecting.remove(&session_id);
        }

        res
    }

    async fn do_connect(
        &self,
        app: AppHandle,
        db: Arc<Database>,
        session_id: String,
        address: String,
        port: u16,
        username: String,
        auth: SshAuth,
        cols: u16,
        rows: u16,
    ) -> Result<(), String> {
        let progress_event = format!("ssh-progress-{session_id}");
        let emit_progress = |step: u8, step_name: &str, message: &str, is_error: bool| {
            let _ = app.emit(
                &progress_event,
                SshProgressPayload {
                    step,
                    step_name: step_name.to_string(),
                    message: message.to_string(),
                    timestamp: chrono::Utc::now().to_rfc3339(),
                    is_error,
                },
            );
        };

        emit_progress(1, "connecting", &format!("Resolving and connecting to {address}:{port}..."), false);

        let config = Arc::new(client::Config::default());
        let handler = SshClientHandler {
            address: address.clone(),
            port,
            db,
        };
        let mut handle = match client::connect(config, (address.as_str(), port), handler).await {
            Ok(h) => h,
            Err(e) => {
                let msg = format!("Connection failed: {e}");
                emit_progress(1, "error", &msg, true);
                return Err(msg);
            }
        };

        emit_progress(2, "host_key", "Verifying host key (Trust On First Use)...", false);

        emit_progress(3, "authenticating", &format!("Authenticating as {username}..."), false);

        let authenticated = match auth {
            SshAuth::Password(password) => match handle.authenticate_password(&username, &password).await {
                Ok(r) => r,
                Err(e) => {
                    let msg = format!("Auth error: {e}");
                    emit_progress(3, "error", &msg, true);
                    return Err(msg);
                }
            },
            SshAuth::PrivateKey { pem, passphrase } => {
                let key_pair = match decode_secret_key(&pem, passphrase.as_deref()) {
                    Ok(k) => k,
                    Err(e) => {
                        let msg = format!("Invalid private key: {e}");
                        emit_progress(3, "error", &msg, true);
                        return Err(msg);
                    }
                };
                match authenticate_publickey_smart(&mut handle, &username, key_pair).await {
                    Ok(r) => r,
                    Err(msg) => {
                        emit_progress(3, "error", &msg, true);
                        return Err(msg);
                    }
                }
            }
        };

        if !authenticated.success() {
            let msg = "Authentication rejected by server".to_string();
            emit_progress(3, "error", &msg, true);
            return Err(msg);
        }

        emit_progress(4, "opening_channel", "Opening shell channel...", false);

        let channel = match handle.channel_open_session().await {
            Ok(c) => c,
            Err(e) => {
                let msg = format!("Channel open failed: {e}");
                emit_progress(4, "error", &msg, true);
                return Err(msg);
            }
        };

        if let Err(e) = channel
            .request_pty(true, "xterm-256color", cols as u32, rows as u32, 0, 0, &[])
            .await
        {
            let msg = format!("PTY request failed: {e}");
            emit_progress(4, "error", &msg, true);
            return Err(msg);
        }

        if let Err(e) = channel.request_shell(true).await {
            let msg = format!("Shell request failed: {e}");
            emit_progress(4, "error", &msg, true);
            return Err(msg);
        }

        emit_progress(5, "ready", "Shell session ready.", false);

        let (cmd_tx, mut cmd_rx) = mpsc::unbounded_channel::<SessionCommand>();

        let session = Arc::new(SshSession {
            id: session_id.clone(),
            handle,
            cmd_tx,
        });

        {
            let mut sessions = self.sessions.lock().await;
            sessions.insert(session_id.clone(), session.clone());
        }

        let event_name = format!("ssh-data-{session_id}");
        let closed_event = format!("ssh-closed-{session_id}");
        let app_for_output = app.clone();
        let sid_for_output = session_id.clone();

        // Worker task: stream server output to frontend & handle incoming commands (write & resize)
        tokio::spawn(async move {
            let mut channel = channel;
            loop {
                tokio::select! {
                    msg = channel.wait() => {
                        match msg {
                            Some(russh::ChannelMsg::Data { ref data }) => {
                                let _ = app_for_output.emit(&event_name, data.to_vec());
                            }
                            Some(russh::ChannelMsg::ExtendedData { ref data, .. }) => {
                                let _ = app_for_output.emit(&event_name, data.to_vec());
                            }
                            Some(russh::ChannelMsg::Eof) | Some(russh::ChannelMsg::Close) | None => {
                                let _ = app_for_output.emit(&closed_event, sid_for_output.clone());
                                break;
                            }
                            _ => {}
                        }
                    }
                    cmd = cmd_rx.recv() => {
                        match cmd {
                            Some(SessionCommand::Data(data)) => {
                                let _ = channel.data(&data[..]).await;
                            }
                            Some(SessionCommand::Resize { cols, rows }) => {
                                // Safeguard: Ignore 0 or near-zero window sizes caused by hidden DOM elements
                                if cols >= 15 && rows >= 4 {
                                    let _ = channel.window_change(cols, rows, 0, 0).await;
                                }
                            }
                            None => break,
                        }
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn write(&self, session_id: &str, data: Vec<u8>) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        session
            .cmd_tx
            .send(SessionCommand::Data(data))
            .map_err(|e| format!("Failed to send input: {e}"))
    }

    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.lock().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        session
            .cmd_tx
            .send(SessionCommand::Resize {
                cols: cols as u32,
                rows: rows as u32,
            })
            .map_err(|e| format!("Failed to send resize: {e}"))
    }

    pub async fn disconnect(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.lock().await;
        if let Some(session) = sessions.remove(session_id) {
            let _ = session
                .handle
                .disconnect(Disconnect::ByApplication, "", "en")
                .await;
        }
        Ok(())
    }
}

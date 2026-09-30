use russh::client::{self, Handle, Handler};
use russh::keys::ssh_key::HashAlg;
use russh::keys::{decode_secret_key, PrivateKeyWithHashAlg};
use russh::Disconnect;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex, RwLock};

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

#[derive(Clone)]
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
    sessions: RwLock<HashMap<String, Arc<SshSession>>>,
    connecting: Mutex<HashSet<String>>,
}

impl SessionManager {
    pub fn new() -> Self {
        SessionManager {
            sessions: RwLock::new(HashMap::new()),
            connecting: Mutex::new(HashSet::new()),
        }
    }

    pub async fn connect(
        &self,
        app: AppHandle,
        db: Arc<Database>,
        session_id: String,
        host_id: Option<String>,
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
            let mut sessions = self.sessions.write().await;
            if let Some(old_session) = sessions.remove(&session_id) {
                let _ = old_session.handle.disconnect(Disconnect::ByApplication, "", "en").await;
            }
        }

        let res = self
            .do_connect(app, db, session_id.clone(), host_id, address, port, username, auth, cols, rows)
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
        host_id: Option<String>,
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
            db: db.clone(),
        };

        // Explicitly connect the TCP stream and disable Nagle's algorithm (TCP_NODELAY).
        // Standard russh::client::connect leaves Nagle enabled by default on Tokio TcpStream,
        // which combined with Linux delayed ACK can introduce 40-200ms delay per typed keystroke.
        let socket = match tokio::net::TcpStream::connect((address.as_str(), port)).await {
            Ok(s) => {
                let _ = s.set_nodelay(true);
                s
            }
            Err(e) => {
                let msg = format!("Connection failed: {e}");
                emit_progress(1, "error", &msg, true);
                return Err(msg);
            }
        };

        let mut handle = match client::connect_stream(config, socket, handler).await {
            Ok(h) => h,
            Err(e) => {
                let msg = format!("Connection failed: {e}");
                emit_progress(1, "error", &msg, true);
                return Err(msg);
            }
        };

        emit_progress(2, "host_key", "Verifying host key (Trust On First Use)...", false);

        emit_progress(3, "authenticating", &format!("Authenticating as {username}..."), false);

        let authenticated = match &auth {
            SshAuth::Password(password) => match handle.authenticate_password(&username, password).await {
                Ok(r) => r,
                Err(e) => {
                    let msg = format!("Auth error: {e}");
                    emit_progress(3, "error", &msg, true);
                    return Err(msg);
                }
            },
            SshAuth::PrivateKey { pem, passphrase } => {
                let key_pair = match decode_secret_key(pem, passphrase.as_deref()) {
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
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), session.clone());
        }

        let event_name = format!("ssh-data-{session_id}");
        let closed_event = format!("ssh-closed-{session_id}");
        let app_for_output = app.clone();
        let sid_for_output = session_id.clone();

        // Worker task: stream server output to frontend & handle incoming commands (write & resize)
        tokio::spawn(async move {
            let mut channel = channel;
            // Adaptive output coalescing:
            // 1. When the channel is idle (interactive keystroke echo, prompt display),
            //    emit immediately (0ms latency) and start a short cooldown timer.
            // 2. Any subsequent bursts of output arriving within the cooldown (e.g. cat,
            //    htop, build logs) are accumulated into `pending` and emitted in ~8ms batches
            //    (or at 64KB cap) to prevent saturating Tauri's IPC event bridge.
            let mut pending: Vec<u8> = Vec::new();
            let flush_delay = tokio::time::Duration::from_millis(8);
            let mut flush_deadline: Option<tokio::time::Instant> = None;

            loop {
                let sleep = async {
                    match flush_deadline {
                        Some(deadline) => tokio::time::sleep_until(deadline).await,
                        None => std::future::pending::<()>().await,
                    }
                };

                tokio::select! {
                    msg = channel.wait() => {
                        match msg {
                            Some(russh::ChannelMsg::Data { ref data }) => {
                                match flush_deadline {
                                    None => {
                                        // Idle stream: emit interactive echo immediately (0ms delay)
                                        let _ = app_for_output.emit(&event_name, data.to_vec());
                                        flush_deadline = Some(tokio::time::Instant::now() + flush_delay);
                                    }
                                    Some(_) => {
                                        pending.extend_from_slice(data);
                                        if pending.len() >= 64 * 1024 {
                                            let _ = app_for_output.emit(&event_name, std::mem::take(&mut pending));
                                            flush_deadline = None;
                                        }
                                    }
                                }
                            }
                            Some(russh::ChannelMsg::ExtendedData { ref data, .. }) => {
                                match flush_deadline {
                                    None => {
                                        let _ = app_for_output.emit(&event_name, data.to_vec());
                                        flush_deadline = Some(tokio::time::Instant::now() + flush_delay);
                                    }
                                    Some(_) => {
                                        pending.extend_from_slice(data);
                                        if pending.len() >= 64 * 1024 {
                                            let _ = app_for_output.emit(&event_name, std::mem::take(&mut pending));
                                            flush_deadline = None;
                                        }
                                    }
                                }
                            }
                            Some(russh::ChannelMsg::Eof) | Some(russh::ChannelMsg::Close) | None => {
                                if !pending.is_empty() {
                                    let _ = app_for_output.emit(&event_name, std::mem::take(&mut pending));
                                }
                                let _ = app_for_output.emit(&closed_event, sid_for_output.clone());
                                break;
                            }
                            _ => {}
                        }
                    }
                    _ = sleep => {
                        if !pending.is_empty() {
                            let _ = app_for_output.emit(&event_name, std::mem::take(&mut pending));
                        }
                        flush_deadline = None;
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

        // Spawn OS detection in the background via a separate exec channel.
        // Only runs when host_id is provided (interactive SSH sessions).
        // Fires-and-forgets: any failure is silently ignored — it never
        // affects the primary PTY channel or the session itself.
        if let Some(hid) = host_id {
            let app_for_os = app.clone();
            let db_for_os = db.clone();
            let addr_for_os = address.clone();
            let port_for_os = port;
            let user_for_os = username.clone();
            let auth_for_os = auth.clone();
            tokio::spawn(async move {
                // Small delay so the interactive shell can fully initialise
                // before we open a second channel (avoids race conditions on
                // slower servers).
                tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
                detect_os_via_exec(
                    &app_for_os,
                    db_for_os,
                    addr_for_os,
                    port_for_os,
                    user_for_os,
                    auth_for_os,
                    hid,
                )
                .await;
            });
        }

        Ok(())
    }

    pub async fn write(&self, session_id: &str, data: Vec<u8>) -> Result<(), String> {
        let sessions = self.sessions.read().await;
        let session = sessions
            .get(session_id)
            .ok_or_else(|| "Session not found".to_string())?;
        session
            .cmd_tx
            .send(SessionCommand::Data(data))
            .map_err(|e| format!("Failed to send input: {e}"))
    }

    pub async fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self.sessions.read().await;
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
        let mut sessions = self.sessions.write().await;
        if let Some(session) = sessions.remove(session_id) {
            let _ = session
                .handle
                .disconnect(Disconnect::ByApplication, "", "en")
                .await;
        }
        Ok(())
    }
}

/// Parse the output of `cat /etc/os-release` and map it to one of our
/// canonical distro slugs, which the frontend uses to pick an icon.
/// Returns `None` when OS detection fails or the output is unrecognisable.
pub fn parse_os_release(output: &str) -> Option<String> {
    // Extract the value of a KEY="value" or KEY=value line.
    let get = |key: &str| -> Option<String> {
        output.lines().find_map(|line| {
            let line = line.trim();
            let prefix = format!("{key}=");
            if line.starts_with(&prefix) {
                let val = line[prefix.len()..].trim_matches('"').to_lowercase();
                Some(val)
            } else {
                None
            }
        })
    };

    // Prefer ID_LIKE (parent distro), fall back to ID.
    let id = get("ID").unwrap_or_default();
    let id_like = get("ID_LIKE").unwrap_or_default();
    let pretty = get("PRETTY_NAME").unwrap_or_default();
    let name = get("NAME").unwrap_or_default();

    let combined = format!("{id} {id_like} {pretty} {name}");

    if combined.contains("ubuntu") {
        Some("ubuntu".to_string())
    } else if combined.contains("kali") {
        Some("kali".to_string())
    } else if combined.contains("mint") {
        Some("mint".to_string())
    } else if combined.contains("pop!_os") || combined.contains("pop_os") || combined.contains("popos") {
        Some("popos".to_string())
    } else if combined.contains("elementary") {
        Some("elementary".to_string())
    } else if combined.contains("debian") {
        Some("debian".to_string())
    } else if combined.contains("alpine") {
        Some("alpine".to_string())
    } else if combined.contains("arch") || combined.contains("manjaro") || combined.contains("endeavouros") || combined.contains("endeavour") {
        if combined.contains("manjaro") {
            Some("manjaro".to_string())
        } else if combined.contains("endeavouros") || combined.contains("endeavour") {
            Some("endeavour".to_string())
        } else {
            Some("arch".to_string())
        }
    } else if combined.contains("fedora") {
        Some("fedora".to_string())
    } else if combined.contains("rocky") {
        Some("rocky".to_string())
    } else if combined.contains("almalinux") || combined.contains("alma") {
        Some("almalinux".to_string())
    } else if combined.contains("centos") {
        Some("centos".to_string())
    } else if combined.contains("rhel") || combined.contains("red hat") || combined.contains("redhat") {
        Some("rhel".to_string())
    } else if combined.contains("opensuse") || combined.contains("suse") {
        Some("opensuse".to_string())
    } else if combined.contains("gentoo") {
        Some("gentoo".to_string())
    } else if combined.contains("nixos") {
        Some("nixos".to_string())
    } else if combined.contains("void") {
        Some("void".to_string())
    } else if combined.contains("raspbian") || combined.contains("raspberry") {
        Some("raspbian".to_string())
    } else if combined.contains("slackware") {
        Some("slackware".to_string())
    } else if combined.contains("amazon") || combined.contains("amzn") {
        Some("amazon".to_string())
    } else if !id.is_empty() {
        // Known to be Linux (has /etc/os-release) but distro unrecognised
        Some("linux".to_string())
    } else {
        None
    }
}

/// Open a fresh exec channel (not reusing the interactive PTY) and run
/// `cat /etc/os-release`.  Returns the detected distro slug, or `None`
/// on any failure — this never propagates errors to the caller.
pub async fn detect_os_via_exec(
    app: &AppHandle,
    db: Arc<Database>,
    address: String,
    port: u16,
    username: String,
    auth: SshAuth,
    host_id: String,
) {
    let result: Result<Option<String>, String> = async {
        let config = Arc::new(russh::client::Config {
            ..Default::default()
        });
        let handler = SshClientHandler {
            address: address.clone(),
            port,
            db: db.clone(),
        };
        let mut handle = russh::client::connect(config, (address.as_str(), port), handler)
            .await
            .map_err(|e| e.to_string())?;

        let authenticated = match auth {
            SshAuth::Password(password) => handle
                .authenticate_password(&username, &password)
                .await
                .map_err(|e| e.to_string())?,
            SshAuth::PrivateKey { pem, passphrase } => {
                let key_pair = russh::keys::decode_secret_key(&pem, passphrase.as_deref())
                    .map_err(|e| e.to_string())?;
                authenticate_publickey_smart(&mut handle, &username, key_pair)
                    .await
                    .map_err(|e| e.to_string())?
            }
        };

        if !authenticated.success() {
            return Ok(None);
        }

        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| e.to_string())?;
        channel
            .exec(true, "cat /etc/os-release")
            .await
            .map_err(|e| e.to_string())?;

        let mut output = String::new();
        let mut ch = channel;
        loop {
            match ch.wait().await {
                Some(russh::ChannelMsg::Data { ref data }) => {
                    output.push_str(&String::from_utf8_lossy(data));
                    if output.len() > 8192 {
                        break;
                    }
                }
                Some(russh::ChannelMsg::Eof)
                | Some(russh::ChannelMsg::Close)
                | None => break,
                _ => {}
            }
        }
        let _ = handle.disconnect(Disconnect::ByApplication, "", "en").await;
        Ok(parse_os_release(&output))
    }
    .await;

    if let Ok(Some(slug)) = result {
        if let Ok(()) = db.update_host_os_icon(&host_id, &slug) {
            let _ = app.emit(
                "host-os-detected",
                serde_json::json!({ "host_id": host_id, "os_icon": slug }),
            );
        }
    }
}

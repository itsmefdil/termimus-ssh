use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthMethod {
    Password,
    PrivateKey,
    Agent,
}

impl AuthMethod {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuthMethod::Password => "password",
            AuthMethod::PrivateKey => "private_key",
            AuthMethod::Agent => "agent",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "private_key" => AuthMethod::PrivateKey,
            "agent" => AuthMethod::Agent,
            _ => AuthMethod::Password,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Host {
    pub id: String,
    pub folder_id: Option<String>,
    pub label: String,
    pub address: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub credential_id: Option<String>,
    pub tags: Vec<String>,
    pub last_connected_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Payload used when creating or updating a host from the frontend.
/// `secret` carries the plaintext password or private-key PEM, which is
/// immediately encrypted before being persisted — it is never stored as-is.
#[derive(Debug, Clone, Deserialize)]
pub struct HostInput {
    pub folder_id: Option<String>,
    pub label: String,
    pub address: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
    pub credential_id: Option<String>,
    pub secret: Option<String>,
    pub passphrase: Option<String>,
    pub tags: Vec<String>,
}

/// A Keychain entry: a named, reusable credential (SSH private key or
/// password identity) that can be linked from any number of hosts via
/// `Host.credential_id`, instead of every host holding its own copy.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: String,
    /// "private_key" or "password" — what kind of secret this holds.
    pub kind: String,
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
    pub passphrase_ciphertext: Option<Vec<u8>>,
    pub passphrase_nonce: Option<Vec<u8>>,
    /// Display name in the Keychain UI, e.g. "fadil", "ai-care", "ClickHost".
    pub name: String,
    /// Algorithm badge for private keys, e.g. "ED25519", "RSA", "ECDSA-P256". Empty for identities.
    pub key_type: String,
    /// Derived OpenSSH public key line, stored in plaintext for instant listing/copying
    /// without needing the vault unlocked. Empty for password identities.
    pub public_key: String,
    /// SHA256 fingerprint of the public key, e.g. "SHA256:...". Empty for password identities.
    pub fingerprint: String,
    /// Optional default username to prefill when this item is picked in the host form.
    pub username: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Lightweight, secret-free view of a `Credential` for listing in the
/// Keychain UI and the host-form dropdown — never carries ciphertext.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeychainItem {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub key_type: String,
    pub public_key: String,
    pub fingerprint: String,
    pub username: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&Credential> for KeychainItem {
    fn from(c: &Credential) -> Self {
        KeychainItem {
            id: c.id.clone(),
            kind: c.kind.clone(),
            name: c.name.clone(),
            key_type: c.key_type.clone(),
            public_key: c.public_key.clone(),
            fingerprint: c.fingerprint.clone(),
            username: c.username.clone(),
            created_at: c.created_at.clone(),
            updated_at: c.updated_at.clone(),
        }
    }
}

/// Payload used to create/update a Keychain SSH key entry from the frontend.
#[derive(Debug, Clone, Deserialize)]
pub struct KeychainKeyInput {
    pub name: String,
    pub key_type: String,
    pub private_key_pem: String,
    pub public_key: String,
    pub fingerprint: String,
    pub passphrase: Option<String>,
    pub username: Option<String>,
}

/// Payload used to create/update a Keychain password identity from the frontend.
#[derive(Debug, Clone, Deserialize)]
pub struct KeychainIdentityInput {
    pub name: String,
    pub password: String,
    pub username: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ForwardType {
    Local,
    Remote,
    Dynamic,
}

impl ForwardType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ForwardType::Local => "local",
            ForwardType::Remote => "remote",
            ForwardType::Dynamic => "dynamic",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "remote" => ForwardType::Remote,
            "dynamic" => ForwardType::Dynamic,
            _ => ForwardType::Local,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortForwardRule {
    pub id: String,
    pub host_id: String,
    pub label: String,
    pub forward_type: String,
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PortForwardInput {
    pub host_id: String,
    pub label: String,
    pub forward_type: String,
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snippet {
    pub id: String,
    pub title: String,
    pub command: String,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SnippetInput {
    pub title: String,
    pub command: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnownHost {
    pub address: String,
    pub port: u16,
    pub key_type: String,
    pub fingerprint: String,
    pub first_seen_at: String,
    pub last_seen_at: String,
}

/// A full-fidelity snapshot of the encrypted database, used for backup/restore.
/// Credentials remain as their AES-256-GCM ciphertext/nonce — the file carries
/// no plaintext secrets by itself; the receiving vault still needs the same
/// master password to decrypt them after import.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupBundle {
    pub format_version: u32,
    pub app_version: String,
    pub exported_at: String,
    pub vault_salt: Option<Vec<u8>>,
    pub vault_verifier_ciphertext: Option<Vec<u8>>,
    pub vault_verifier_nonce: Option<Vec<u8>>,
    pub folders: Vec<Folder>,
    pub credentials: Vec<Credential>,
    pub hosts: Vec<Host>,
    pub port_forwards: Vec<PortForwardRule>,
    pub snippets: Vec<Snippet>,
    pub known_hosts: Vec<KnownHost>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSummary {
    pub folders: usize,
    pub credentials: usize,
    pub hosts: usize,
    pub port_forwards: usize,
    pub snippets: usize,
    pub known_hosts: usize,
    pub vault_meta_restored: bool,
}

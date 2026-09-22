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
    pub secret: Option<String>,
    pub passphrase: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    pub id: String,
    pub kind: String,
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
    pub passphrase_ciphertext: Option<Vec<u8>>,
    pub passphrase_nonce: Option<Vec<u8>>,
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

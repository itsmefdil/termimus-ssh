pub mod models;

use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use models::{Folder, Host, Credential, KeychainItem, PortForwardRule, Snippet, KnownHost, BackupBundle, ImportSummary};

pub struct Database {
    conn: std::sync::Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = get_database_path();
        if let Some(parent) = db_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let conn = Connection::open(&db_path)?;
        let db = Database {
            conn: std::sync::Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS vault_meta (
                key TEXT PRIMARY KEY,
                value BLOB NOT NULL
            );

            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS credentials (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                ciphertext BLOB NOT NULL,
                nonce BLOB NOT NULL,
                passphrase_ciphertext BLOB,
                passphrase_nonce BLOB,
                name TEXT NOT NULL DEFAULT '',
                key_type TEXT NOT NULL DEFAULT '',
                public_key TEXT NOT NULL DEFAULT '',
                fingerprint TEXT NOT NULL DEFAULT '',
                username TEXT,
                created_at TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS hosts (
                id TEXT PRIMARY KEY,
                folder_id TEXT,
                label TEXT NOT NULL,
                address TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                auth_method TEXT NOT NULL,
                credential_id TEXT,
                tags TEXT NOT NULL DEFAULT '[]',
                last_connected_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE SET NULL,
                FOREIGN KEY(credential_id) REFERENCES credentials(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS port_forwards (
                id TEXT PRIMARY KEY,
                host_id TEXT NOT NULL,
                label TEXT NOT NULL,
                forward_type TEXT NOT NULL DEFAULT 'local',
                local_address TEXT NOT NULL DEFAULT '127.0.0.1',
                local_port INTEGER NOT NULL,
                remote_address TEXT NOT NULL DEFAULT '127.0.0.1',
                remote_port INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(host_id) REFERENCES hosts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS snippets (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                command TEXT NOT NULL,
                tags TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS known_hosts (
                address TEXT NOT NULL,
                port INTEGER NOT NULL,
                key_type TEXT NOT NULL,
                fingerprint TEXT NOT NULL,
                first_seen_at TEXT NOT NULL,
                last_seen_at TEXT NOT NULL,
                PRIMARY KEY (address, port)
            );
            ",
        )?;

        // Ensure columns added in Keychain update exist on existing databases
        let _ = conn.execute("ALTER TABLE credentials ADD COLUMN name TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE credentials ADD COLUMN key_type TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE credentials ADD COLUMN public_key TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE credentials ADD COLUMN fingerprint TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE credentials ADD COLUMN username TEXT", []);
        let _ = conn.execute("ALTER TABLE credentials ADD COLUMN created_at TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE credentials ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''", []);
        let _ = conn.execute("ALTER TABLE hosts ADD COLUMN last_connected_at TEXT", []);

        Ok(())
    }

    pub fn list_hosts(&self) -> Result<Vec<Host>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, folder_id, label, address, port, username, auth_method, credential_id, tags, last_connected_at, created_at, updated_at FROM hosts ORDER BY label ASC"
        )?;

        let hosts = stmt.query_map([], |row| {
            let tags_str: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            Ok(Host {
                id: row.get(0)?,
                folder_id: row.get(1)?,
                label: row.get(2)?,
                address: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_method: row.get(6)?,
                credential_id: row.get(7)?,
                tags,
                last_connected_at: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(hosts)
    }

    pub fn get_host(&self, id: &str) -> Result<Option<Host>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, folder_id, label, address, port, username, auth_method, credential_id, tags, last_connected_at, created_at, updated_at FROM hosts WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let tags_str: String = row.get(8)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            Ok(Some(Host {
                id: row.get(0)?,
                folder_id: row.get(1)?,
                label: row.get(2)?,
                address: row.get(3)?,
                port: row.get(4)?,
                username: row.get(5)?,
                auth_method: row.get(6)?,
                credential_id: row.get(7)?,
                tags,
                last_connected_at: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_host(&self, host: &Host) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tags_str = serde_json::to_string(&host.tags).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT INTO hosts (id, folder_id, label, address, port, username, auth_method, credential_id, tags, last_connected_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
                folder_id=excluded.folder_id,
                label=excluded.label,
                address=excluded.address,
                port=excluded.port,
                username=excluded.username,
                auth_method=excluded.auth_method,
                credential_id=excluded.credential_id,
                tags=excluded.tags,
                updated_at=excluded.updated_at",
            params![
                host.id,
                host.folder_id,
                host.label,
                host.address,
                host.port,
                host.username,
                host.auth_method,
                host.credential_id,
                tags_str,
                host.last_connected_at,
                host.created_at,
                host.updated_at,
            ],
        )?;

        Ok(())
    }

    pub fn delete_host(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM hosts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn touch_host_last_connected(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE hosts SET last_connected_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn save_credential(&self, cred: &Credential) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO credentials (id, kind, ciphertext, nonce, passphrase_ciphertext, passphrase_nonce, name, key_type, public_key, fingerprint, username, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
             ON CONFLICT(id) DO UPDATE SET
                kind=excluded.kind,
                ciphertext=excluded.ciphertext,
                nonce=excluded.nonce,
                passphrase_ciphertext=excluded.passphrase_ciphertext,
                passphrase_nonce=excluded.passphrase_nonce,
                name=excluded.name,
                key_type=excluded.key_type,
                public_key=excluded.public_key,
                fingerprint=excluded.fingerprint,
                username=excluded.username,
                updated_at=excluded.updated_at",
            params![
                cred.id,
                cred.kind,
                cred.ciphertext,
                cred.nonce,
                cred.passphrase_ciphertext,
                cred.passphrase_nonce,
                cred.name,
                cred.key_type,
                cred.public_key,
                cred.fingerprint,
                cred.username,
                cred.created_at,
                cred.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_credential(&self, id: &str) -> Result<Option<Credential>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, kind, ciphertext, nonce, passphrase_ciphertext, passphrase_nonce, name, key_type, public_key, fingerprint, username, created_at, updated_at FROM credentials WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(Credential {
                id: row.get(0)?,
                kind: row.get(1)?,
                ciphertext: row.get(2)?,
                nonce: row.get(3)?,
                passphrase_ciphertext: row.get(4)?,
                passphrase_nonce: row.get(5)?,
                name: row.get(6)?,
                key_type: row.get(7)?,
                public_key: row.get(8)?,
                fingerprint: row.get(9)?,
                username: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn list_credentials(&self) -> Result<Vec<Credential>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, kind, ciphertext, nonce, passphrase_ciphertext, passphrase_nonce, name, key_type, public_key, fingerprint, username, created_at, updated_at FROM credentials ORDER BY name ASC"
        )?;
        let list = stmt.query_map([], |row| {
            Ok(Credential {
                id: row.get(0)?,
                kind: row.get(1)?,
                ciphertext: row.get(2)?,
                nonce: row.get(3)?,
                passphrase_ciphertext: row.get(4)?,
                passphrase_nonce: row.get(5)?,
                name: row.get(6)?,
                key_type: row.get(7)?,
                public_key: row.get(8)?,
                fingerprint: row.get(9)?,
                username: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(list)
    }

    pub fn delete_credential(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM credentials WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// Returns all named Keychain entries (omits old unlabelled anonymous credentials
    /// that were auto-created per host without names).
    pub fn list_keychain_items(&self) -> Result<Vec<KeychainItem>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, kind, name, key_type, public_key, fingerprint, username, created_at, updated_at
             FROM credentials
             WHERE name != ''
             ORDER BY name ASC",
        )?;
        let items = stmt
            .query_map([], |row| {
                Ok(KeychainItem {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    name: row.get(2)?,
                    key_type: row.get(3)?,
                    public_key: row.get(4)?,
                    fingerprint: row.get(5)?,
                    username: row.get(6)?,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        Ok(items)
    }

    pub fn list_folders(&self) -> Result<Vec<Folder>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, parent_id, created_at FROM folders ORDER BY name ASC")?;
        let folders = stmt.query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(folders)
    }

    pub fn save_folder(&self, folder: &Folder) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO folders (id, name, parent_id, created_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(id) DO UPDATE SET name=excluded.name, parent_id=excluded.parent_id",
            params![folder.id, folder.name, folder.parent_id, folder.created_at],
        )?;
        Ok(())
    }

    pub fn delete_folder(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM folders WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_port_forwards(&self) -> Result<Vec<PortForwardRule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, host_id, label, forward_type, local_address, local_port, remote_address, remote_port, created_at FROM port_forwards ORDER BY label ASC"
        )?;

        let rules = stmt.query_map([], |row| {
            Ok(PortForwardRule {
                id: row.get(0)?,
                host_id: row.get(1)?,
                label: row.get(2)?,
                forward_type: row.get(3)?,
                local_address: row.get(4)?,
                local_port: row.get(5)?,
                remote_address: row.get(6)?,
                remote_port: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(rules)
    }

    pub fn get_port_forward(&self, id: &str) -> Result<Option<PortForwardRule>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, host_id, label, forward_type, local_address, local_port, remote_address, remote_port, created_at FROM port_forwards WHERE id = ?1"
        )?;

        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            Ok(Some(PortForwardRule {
                id: row.get(0)?,
                host_id: row.get(1)?,
                label: row.get(2)?,
                forward_type: row.get(3)?,
                local_address: row.get(4)?,
                local_port: row.get(5)?,
                remote_address: row.get(6)?,
                remote_port: row.get(7)?,
                created_at: row.get(8)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_port_forward(&self, rule: &PortForwardRule) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO port_forwards (id, host_id, label, forward_type, local_address, local_port, remote_address, remote_port, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
             ON CONFLICT(id) DO UPDATE SET
                host_id=excluded.host_id,
                label=excluded.label,
                forward_type=excluded.forward_type,
                local_address=excluded.local_address,
                local_port=excluded.local_port,
                remote_address=excluded.remote_address,
                remote_port=excluded.remote_port",
            params![
                rule.id,
                rule.host_id,
                rule.label,
                rule.forward_type,
                rule.local_address,
                rule.local_port,
                rule.remote_address,
                rule.remote_port,
                rule.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_port_forward(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM port_forwards WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_snippets(&self) -> Result<Vec<Snippet>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, command, tags, created_at, updated_at FROM snippets ORDER BY title ASC"
        )?;

        let snippets = stmt.query_map([], |row| {
            let tags_str: String = row.get(3)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            Ok(Snippet {
                id: row.get(0)?,
                title: row.get(1)?,
                command: row.get(2)?,
                tags,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(snippets)
    }

    pub fn save_snippet(&self, snippet: &Snippet) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tags_str = serde_json::to_string(&snippet.tags).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT INTO snippets (id, title, command, tags, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                command=excluded.command,
                tags=excluded.tags,
                updated_at=excluded.updated_at",
            params![
                snippet.id,
                snippet.title,
                snippet.command,
                tags_str,
                snippet.created_at,
                snippet.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_snippet(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM snippets WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_known_host(&self, address: &str, port: u16) -> Result<Option<KnownHost>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT address, port, key_type, fingerprint, first_seen_at, last_seen_at FROM known_hosts WHERE address = ?1 AND port = ?2"
        )?;
        let mut rows = stmt.query(params![address, port])?;
        if let Some(row) = rows.next()? {
            Ok(Some(KnownHost {
                address: row.get(0)?,
                port: row.get(1)?,
                key_type: row.get(2)?,
                fingerprint: row.get(3)?,
                first_seen_at: row.get(4)?,
                last_seen_at: row.get(5)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_known_host(&self, entry: &KnownHost) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO known_hosts (address, port, key_type, fingerprint, first_seen_at, last_seen_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(address, port) DO UPDATE SET
                key_type=excluded.key_type,
                fingerprint=excluded.fingerprint,
                last_seen_at=excluded.last_seen_at",
            params![
                entry.address,
                entry.port,
                entry.key_type,
                entry.fingerprint,
                entry.first_seen_at,
                entry.last_seen_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_known_host(&self, address: &str, port: u16) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM known_hosts WHERE address = ?1 AND port = ?2",
            params![address, port],
        )?;
        Ok(())
    }

    pub fn list_known_hosts(&self) -> Result<Vec<KnownHost>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT address, port, key_type, fingerprint, first_seen_at, last_seen_at FROM known_hosts ORDER BY last_seen_at DESC"
        )?;
        let list = stmt.query_map([], |row| {
            Ok(KnownHost {
                address: row.get(0)?,
                port: row.get(1)?,
                key_type: row.get(2)?,
                fingerprint: row.get(3)?,
                first_seen_at: row.get(4)?,
                last_seen_at: row.get(5)?,
            })
        })?.filter_map(|r| r.ok()).collect();
        Ok(list)
    }

    // Vault metadata: salt & verification token to confirm correct master password
    pub fn get_vault_meta(&self, key: &str) -> Result<Option<Vec<u8>>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM vault_meta WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_vault_meta(&self, key: &str, value: &[u8]) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO vault_meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    /// Build a full snapshot of every table for export. Credential fields stay
    /// as their AES-256-GCM ciphertext/nonce — nothing here is plaintext.
    pub fn export_backup_bundle(&self, app_version: &str) -> Result<BackupBundle> {
        let vault_salt = self.get_vault_meta("salt")?;
        let vault_verifier_ciphertext = self.get_vault_meta("verifier_ciphertext")?;
        let vault_verifier_nonce = self.get_vault_meta("verifier_nonce")?;

        Ok(BackupBundle {
            format_version: 1,
            app_version: app_version.to_string(),
            exported_at: chrono::Utc::now().to_rfc3339(),
            vault_salt,
            vault_verifier_ciphertext,
            vault_verifier_nonce,
            folders: self.list_folders()?,
            credentials: self.list_credentials()?,
            hosts: self.list_hosts()?,
            port_forwards: self.list_port_forwards()?,
            snippets: self.list_snippets()?,
            known_hosts: self.list_known_hosts()?,
        })
    }

    /// Restore a backup bundle. When `replace_all` is true, every table this
    /// bundle covers is wiped first so the import produces an exact copy;
    /// otherwise rows are merged/upserted by their existing primary keys.
    pub fn import_backup_bundle(&self, bundle: &BackupBundle, replace_all: bool) -> Result<ImportSummary> {
        {
            let conn = self.conn.lock().unwrap();
            if replace_all {
                conn.execute_batch(
                    "DELETE FROM known_hosts;
                     DELETE FROM snippets;
                     DELETE FROM port_forwards;
                     DELETE FROM hosts;
                     DELETE FROM credentials;
                     DELETE FROM folders;",
                )?;
            }
        }

        let mut vault_meta_restored = false;
        if let (Some(salt), Some(ct), Some(nonce)) = (
            &bundle.vault_salt,
            &bundle.vault_verifier_ciphertext,
            &bundle.vault_verifier_nonce,
        ) {
            // Only restore vault metadata if this vault has not been initialized yet,
            // to avoid silently swapping the master password salt/verifier under the user.
            if self.get_vault_meta("salt")?.is_none() {
                self.set_vault_meta("salt", salt)?;
                self.set_vault_meta("verifier_ciphertext", ct)?;
                self.set_vault_meta("verifier_nonce", nonce)?;
                vault_meta_restored = true;
            }
        }

        for folder in &bundle.folders {
            self.save_folder(folder)?;
        }
        for cred in &bundle.credentials {
            self.save_credential(cred)?;
        }
        for host in &bundle.hosts {
            self.save_host(host)?;
        }
        for rule in &bundle.port_forwards {
            self.save_port_forward(rule)?;
        }
        for snippet in &bundle.snippets {
            self.save_snippet(snippet)?;
        }
        for kh in &bundle.known_hosts {
            self.save_known_host(kh)?;
        }

        Ok(ImportSummary {
            folders: bundle.folders.len(),
            credentials: bundle.credentials.len(),
            hosts: bundle.hosts.len(),
            port_forwards: bundle.port_forwards.len(),
            snippets: bundle.snippets.len(),
            known_hosts: bundle.known_hosts.len(),
            vault_meta_restored,
        })
    }
}

fn get_database_path() -> PathBuf {
    let base_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("termimus");
    base_dir.join("termimus.db")
}

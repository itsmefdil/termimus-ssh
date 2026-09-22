pub mod models;

use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;
use models::{Folder, Host, Credential, PortForwardRule};

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
                passphrase_nonce BLOB
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
            ",
        )?;

        Ok(())
    }

    pub fn list_hosts(&self) -> Result<Vec<Host>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, folder_id, label, address, port, username, auth_method, credential_id, tags, created_at, updated_at FROM hosts ORDER BY label ASC"
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
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(hosts)
    }

    pub fn get_host(&self, id: &str) -> Result<Option<Host>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, folder_id, label, address, port, username, auth_method, credential_id, tags, created_at, updated_at FROM hosts WHERE id = ?1"
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
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn save_host(&self, host: &Host) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let tags_str = serde_json::to_string(&host.tags).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT INTO hosts (id, folder_id, label, address, port, username, auth_method, credential_id, tags, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
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

    pub fn save_credential(&self, cred: &Credential) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO credentials (id, kind, ciphertext, nonce, passphrase_ciphertext, passphrase_nonce)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                kind=excluded.kind,
                ciphertext=excluded.ciphertext,
                nonce=excluded.nonce,
                passphrase_ciphertext=excluded.passphrase_ciphertext,
                passphrase_nonce=excluded.passphrase_nonce",
            params![
                cred.id,
                cred.kind,
                cred.ciphertext,
                cred.nonce,
                cred.passphrase_ciphertext,
                cred.passphrase_nonce,
            ],
        )?;
        Ok(())
    }

    pub fn get_credential(&self, id: &str) -> Result<Option<Credential>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, kind, ciphertext, nonce, passphrase_ciphertext, passphrase_nonce FROM credentials WHERE id = ?1"
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
            }))
        } else {
            Ok(None)
        }
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
}

fn get_database_path() -> PathBuf {
    let base_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("termimus");
    base_dir.join("termimus.db")
}

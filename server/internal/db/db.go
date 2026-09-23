package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	conn *sql.DB
	mu   sync.RWMutex
}

type RevisionInfo struct {
	Version    int64     `json:"version"`
	DeviceID   string    `json:"device_id"`
	DeviceName string    `json:"device_name"`
	CreatedAt  time.Time `json:"created_at"`
}

type DeviceInfo struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	LastSyncAt time.Time `json:"last_sync_at"`
	CreatedAt  time.Time `json:"created_at"`
}

func Open(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	conn, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	// Optimize SQLite settings for embedded concurrent operations
	conn.SetMaxOpenConns(1) // SQLite single writer lock safety

	d := &DB{conn: conn}
	if err := d.initTables(); err != nil {
		conn.Close()
		return nil, err
	}

	return d, nil
}

func (d *DB) Close() error {
	return d.conn.Close()
}

func (d *DB) initTables() error {
	schema := `
	PRAGMA journal_mode = WAL;
	PRAGMA busy_timeout = 5000;

	CREATE TABLE IF NOT EXISTS sync_revisions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		version INTEGER NOT NULL UNIQUE,
		device_id TEXT NOT NULL,
		device_name TEXT NOT NULL,
		encrypted_blob TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_sync_revisions_version ON sync_revisions(version);

	CREATE TABLE IF NOT EXISTS devices (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		last_sync_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	`
	_, err := d.conn.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}
	return nil
}

func (d *DB) GetLatestRevision() (*RevisionInfo, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	row := d.conn.QueryRow(`
		SELECT version, device_id, device_name, created_at
		FROM sync_revisions
		ORDER BY version DESC
		LIMIT 1
	`)

	var rev RevisionInfo
	err := row.Scan(&rev.Version, &rev.DeviceID, &rev.DeviceName, &rev.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil // No revisions yet
	}
	if err != nil {
		return nil, err
	}
	return &rev, nil
}

func (d *DB) GetLatestBlob() (string, int64, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	row := d.conn.QueryRow(`
		SELECT encrypted_blob, version
		FROM sync_revisions
		ORDER BY version DESC
		LIMIT 1
	`)

	var blob string
	var version int64
	err := row.Scan(&blob, &version)
	if err == sql.ErrNoRows {
		return "", 0, nil
	}
	if err != nil {
		return "", 0, err
	}
	return blob, version, nil
}

func (d *DB) SaveRevision(deviceID, deviceName, encryptedBlob string) (int64, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	tx, err := d.conn.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// Get next version number
	var currentVersion sql.NullInt64
	err = tx.QueryRow(`SELECT MAX(version) FROM sync_revisions`).Scan(&currentVersion)
	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}

	nextVersion := int64(1)
	if currentVersion.Valid {
		nextVersion = currentVersion.Int64 + 1
	}

	// Insert revision
	_, err = tx.Exec(`
		INSERT INTO sync_revisions (version, device_id, device_name, encrypted_blob, created_at)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
	`, nextVersion, deviceID, deviceName, encryptedBlob)
	if err != nil {
		return 0, fmt.Errorf("failed to insert sync revision: %w", err)
	}

	// Upsert device
	_, err = tx.Exec(`
		INSERT INTO devices (id, name, last_sync_at, created_at)
		VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			last_sync_at = CURRENT_TIMESTAMP
	`, deviceID, deviceName)
	if err != nil {
		return 0, fmt.Errorf("failed to update device record: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, err
	}

	return nextVersion, nil
}

func (d *DB) GetDevices() ([]DeviceInfo, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.conn.Query(`SELECT id, name, last_sync_at, created_at FROM devices ORDER BY last_sync_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []DeviceInfo
	for rows.Next() {
		var dev DeviceInfo
		if err := rows.Scan(&dev.ID, &dev.Name, &dev.LastSyncAt, &dev.CreatedAt); err != nil {
			return nil, err
		}
		devices = append(devices, dev)
	}
	return devices, nil
}

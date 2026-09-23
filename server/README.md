# Termimus Sync Server

A lightweight, zero-knowledge, self-hosted synchronization relay server for **Termimus** (Local-First SSH & Server Manager).

## 🔒 Zero-Knowledge Security Architecture

- **End-to-End Encryption (E2EE)**: All hosts, folders, snippets, tunnels, and credentials are encrypted on your local client device using **AES-256-GCM** with a key derived from your Master Password via **Argon2id**.
- **Blind Relay**: The server only receives, stores, and relays encrypted ciphertext bundles (`EncryptedBackupEnvelope`). It **never** has access to your master password or encryption keys.
- **Privacy First**: If your server VPS is ever compromised, the attacker only acquires encrypted blobs with zero access to your servers, SSH private keys, or passwords.
- **Real-Time WebSockets**: Connected devices receive immediate push notifications when changes occur on another device.

---

## 🚀 Quickstart

### Option 1: Docker (Single Command)

```bash
docker run -d \
  --name termimus-sync \
  -p 8080:8080 \
  -v termimus_data:/data \
  -e TERMIMUS_AUTH_TOKEN="your-secure-random-secret-token" \
  --restart unless-stopped \
  termimus-sync-server:latest
```

### Option 2: Docker Compose

```bash
cd server
docker compose up -d
```

### Option 3: Run from Source (Go)

Requires Go 1.22+:

```bash
cd server
export TERMIMUS_AUTH_TOKEN="your-secret-token"
export PORT="8080"
go run ./cmd/server
```

---

## ⚙️ Configuration (Environment Variables)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8080` | HTTP & WebSocket port to listen on |
| `DATA_DIR` | `./data` | Directory where SQLite database is stored |
| `DB_PATH` | `./data/sync.db` | Exact path to the SQLite database file |
| `TERMIMUS_AUTH_TOKEN` | `""` | Bearer token required to sync. If empty, runs in open mode. |

---

## 📡 API Reference

All `/api/v1/sync/*` endpoints require the `Authorization: Bearer <TOKEN>` header (or `?token=<TOKEN>` for WebSockets).

### 1. Health Check
`GET /health`
```json
{
  "status": "ok",
  "service": "termimus-sync-server",
  "version": "0.1.0"
}
```

### 2. Get Sync Status
`GET /api/v1/sync/status`
```json
{
  "has_data": true,
  "latest_version": 4,
  "device_id": "laptop-fedora-1234",
  "device_name": "Fedora Work Laptop",
  "updated_at": "2026-09-23T15:30:00Z"
}
```

### 3. Download Latest Encrypted Bundle
`GET /api/v1/sync/bundle`
```json
{
  "version": 4,
  "encrypted_blob": "{\"format_version\":2,\"encrypted\":true,...}"
}
```

### 4. Upload New Encrypted Bundle
`POST /api/v1/sync/bundle`
```json
{
  "device_id": "laptop-fedora-1234",
  "device_name": "Fedora Work Laptop",
  "encrypted_blob": "{\"format_version\":2,\"encrypted\":true,...}"
}
```

### 5. WebSocket Live Notification Stream
`GET /api/v1/sync/ws?token=<TOKEN>`

Clients receive:
```json
{
  "type": "SYNC_UPDATED",
  "version": 5,
  "device_id": "work-pc",
  "device_name": "Work PC"
}
```

---

## 🌐 Reverse Proxy Examples

### Caddy
```caddy
sync.yourdomain.com {
    reverse_proxy localhost:8080
}
```

### Nginx
```nginx
server {
    server_name sync.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

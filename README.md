# Termimus

Termimus is a self-hosted SSH & server management desktop app inspired by Termius. It's built with **Tauri v2 + Rust + React** for a lightweight, native, cross-platform experience.

![Design](https://img.shields.io/badge/theme-Terminal%20Obsidian-00d2b4) ![Stack](https://img.shields.io/badge/stack-Tauri%20%2B%20Rust%20%2B%20React-blue)

## Features

- **SSH Terminal** — Multi-tab sessions powered by `russh` (pure Rust) and `xterm.js`, with persistent sessions that survive switching views (no reconnects, no htop/curses corruption).
- **SFTP Browser** — Dual-pane file manager (local ↔ remote) with drag-free click-to-transfer, and an **in-app file editor** (open, edit, and save remote/local files directly, `Ctrl+S` to save).
- **Port Forwarding / Tunnels** — Local port forwarding over SSH (`channel_open_direct_tcpip`), managed with start/stop toggles and live status.
- **Snippets Library** — Save frequently used commands/scripts and run them instantly into the active terminal session.
- **Host Groups / Folders** — Organize servers into collapsible groups.
- **Live Ping / Latency Monitor** — Background TCP-connect probes show per-host latency and online/offline status.
- **Zero-Knowledge Vault** — Master password protected; all secrets encrypted at rest with **AES-256-GCM**, keys derived via **Argon2id**.
- **Known Hosts / MITM Protection** — Trust-On-First-Use host key fingerprinting (SHA256) with hard rejection on key mismatch, across SSH, SFTP, and tunnels.
- **Encrypted Backup & Restore** — Export/import all hosts, folders, snippets, tunnels, and credentials (still ciphertext) as a single portable JSON file, with merge or full-replace modes.
- **Frameless Termius-style UI** — Custom titlebar with integrated tabs, quick-connect (`Ctrl+K`), and a collapsible sidebar.

## Tech Stack

**Frontend**
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (Terminal Obsidian design system)
- Zustand (state management)
- `@xterm/xterm` + `@xterm/addon-fit`

**Backend (Rust / Tauri v2)**
- `russh` + `russh-sftp` — async SSH/SFTP client
- `rusqlite` — local SQLite storage
- `aes-gcm` + `argon2` — vault encryption
- `tokio` — async runtime

## Project Structure

```
termimus/
├── src/                          # React frontend
│   ├── components/
│   │   ├── layout/                # Header/titlebar, Sidebar, QuickConnectModal
│   │   ├── hosts/                  # Host list, host/folder modals
│   │   ├── terminal/                # XtermView, TabBar
│   │   ├── sftp/                    # SftpView, FilePane, FileEditorModal
│   │   ├── tunnels/                 # TunnelView, TunnelModal
│   │   ├── snippets/                # SnippetView, SnippetModal
│   │   └── vault/                   # VaultModal, VaultOverview, BackupRestoreSection
│   ├── stores/                     # Zustand stores (one per domain)
│   └── lib/                        # Tauri invoke wrappers, formatting helpers
└── src-tauri/                    # Rust backend
    └── src/
        ├── ssh/                     # SSH session manager + host key verification
        ├── sftp/                    # SFTP manager + local filesystem helpers
        ├── tunnel/                  # Port forwarding manager
        ├── vault/                   # AES-256-GCM / Argon2id crypto
        ├── db/                      # SQLite schema, models, backup/restore
        └── commands/                # Tauri command handlers
```

## Development

### Prerequisites
- [Rust](https://www.rust-lang.org/tools/install) (via `rustup`)
- [Bun](https://bun.sh/) (or Node.js + npm)
- Linux build dependencies:
  ```bash
  sudo apt install -y pkg-config build-essential \
    libwebkit2gtk-4.1-dev libssl-dev \
    libayatana-appindicator3-dev librsvg2-dev
  ```

### Run in dev mode
```bash
bun install
bun run tauri dev
```

### Build for production
```bash
bun run tauri build              # all configured bundle targets
bun run tauri build --bundles deb  # Debian package only
```

The built package will be under `src-tauri/target/release/bundle/`.

### Install the .deb (Linux)
```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/Termimus_<version>_amd64.deb
```

## Data & Security

- Local database: `~/.config/termimus/termimus.db`
- All SSH passwords and private keys are encrypted with AES-256-GCM before being written to disk; the master password never leaves memory and is never stored.
- Host key fingerprints (SHA256) are remembered on first connect and verified on every subsequent connection to protect against MITM attacks.
- Use the **Key Vault** tab in-app to export an encrypted backup or restore one on a new machine.

## License

Private project — no license specified.

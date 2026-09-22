# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Termimus — a self-hosted SSH/server manager desktop app (Termius clone), built with **Tauri v2 + Rust backend + React frontend**. See `README.md` for the full feature list and user-facing docs.

## Stack & Layout

- **Frontend**: React 19 + TypeScript + Vite, Tailwind CSS v4, Zustand for state, `@xterm/xterm` for the terminal.
  - `src/components/<domain>/` — UI grouped by feature (hosts, terminal, sftp, tunnels, snippets, vault, layout).
  - `src/stores/` — one Zustand store per domain (`useHostStore`, `useSessionStore`, `useSftpStore`, `useTunnelStore`, `useSnippetStore`, `useVaultStore`, `useKnownHostsStore`, `usePingStore`).
  - `src/lib/api.ts` — the only place that calls `invoke(...)`; every Tauri command has a typed wrapper here. Add new commands here, not ad-hoc `invoke` calls in components.
  - `src/lib/format.ts` — shared formatting helpers (bytes, dates, paths).
- **Backend**: Rust in `src-tauri/src/`.
  - `ssh/` — SSH session manager (`russh`), PTY streaming, host key verification (`SshClientHandler`).
  - `sftp/` — SFTP manager (`russh-sftp`) + local filesystem helpers.
  - `tunnel/` — local port forwarding (`channel_open_direct_tcpip`).
  - `vault/` — AES-256-GCM encryption + Argon2id key derivation. Master password/derived key lives only in memory (`VaultManager`), never persisted.
  - `db/` — SQLite via `rusqlite`. `models.rs` has all row structs; `mod.rs` has the `Database` struct with one method per query. Schema lives in `init_tables()`.
  - `commands/mod.rs` — every `#[tauri::command]` handler, plus `AppState` (holds `Arc<Database>`, `VaultManager`, `SessionManager`, `SftpManager`, `TunnelManager`). Register every new command in `src-tauri/src/lib.rs`'s `generate_handler!` list too.

## Conventions

- **Every SSH-family connection (terminal, SFTP, tunnel) must go through `SshClientHandler`** with `db: Arc<Database>` passed in, so Trust-On-First-Use host key verification and MITM protection apply uniformly. Don't construct a bare `russh::client::connect` without it.
- **Credentials are never stored or transmitted as plaintext.** `Credential.ciphertext`/`nonce` are AES-256-GCM output; encrypt/decrypt only through `VaultManager`. The vault must be unlocked (`state.vault.is_unlocked()`) before touching secrets.
- **New Tauri commands**: add the `#[tauri::command]` fn in `commands/mod.rs`, add it to `generate_handler![...]` in `lib.rs`, then add a typed wrapper in `src/lib/api.ts`. All three steps are required or the command silently won't be callable from the frontend.
- **New DB tables**: add the `CREATE TABLE IF NOT EXISTS` to `init_tables()` in `db/mod.rs`, add the row struct to `models.rs`, add CRUD methods to `Database`. If the table should be portable, also wire it into `BackupBundle`/`export_backup_bundle`/`import_backup_bundle`.
- **Terminal visibility**: never hide the terminal container with `display: none`. Use `visibility: hidden` + `pointerEvents: none` (see `App.tsx`, `XtermView.tsx`) — `display: none` collapses the container to 0×0, which makes `ResizeObserver`/`FitAddon` compute a bogus tiny size and corrupts remote curses apps (htop, vim) via a bad SIGWINCH. Any resize call must guard against near-zero `cols`/`rows` (frontend guards in `XtermView.tsx`, backend guard in `ssh/mod.rs`'s resize handler).
- **Styling**: Tailwind v4 utility classes with CSS variables defined in `src/index.css` (`--canvas`, `--surface-*`, `--primary`, `--text-*`, etc. — the "Terminal Obsidian" palette). Reuse these variables; don't hardcode hex colors in components.
- **Fonts**: Inter for UI text, JetBrains Mono/Fira Code for anything monospace (IPs, ports, commands, code). Loaded via Google Fonts in `index.html`.
- Window is frameless (`decorations: false`); the custom titlebar/window controls live in `src/components/layout/Header.tsx` — don't reintroduce native window chrome.

## Verification

- Frontend: `bun run build` (runs `tsc` + `vite build`) — must pass with zero TypeScript errors before considering a frontend change done.
- Backend: `cd src-tauri && cargo check` — must compile clean (treat new warnings as things to fix, not ignore).
- There is no test suite yet; manual verification via `bun run tauri dev` is the norm. If you add non-trivial backend logic (crypto, parsing, DB migrations), consider adding `#[cfg(test)]` unit tests in the same file.
- Full production build: `bun run tauri build --bundles deb` (Linux). Slow (multi-minute Rust compile) — don't run it for routine changes, only when explicitly asked to produce a release artifact.

## Git

- Commit only when asked. Stage specific files, not `git add .`, when unrelated changes are present in the working tree (this repo occasionally has loose reference/design files at the root — don't sweep those into unrelated commits).
- Attribution lines for commits/PRs are specified by the harness system reminder, not this file.

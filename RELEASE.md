# Release Guide

This document defines the standards, rules, and step-by-step procedures for publishing a new release of the **Termimus** desktop app and the **Sync Server** container image.

---

## 1. Versioning Standard (Semantic Versioning)

Termimus follows the **SemVer (`vMAJOR.MINOR.PATCH`)** standard:

| Change Type | Version Bump | Example | When to Use |
|---|---|---|---|
| Breaking change | MAJOR | `v2.0.0` | Database schema migration, encryption format changes, API removal |
| New feature | MINOR | `v0.2.0` | Adding a new view, new Tauri command, new sync protocol feature |
| Bug fix / patch | PATCH | `v0.1.2` | UI fix, crash fix, security patch, placeholder text |

> ⚠️ **Golden Rule**: All release tags **must** be prefixed with a lowercase **`v`** (e.g. `v0.1.1`, not `0.1.1`).

---

## 2. Pre-Release Checklist (Required Before Tagging)

Before creating a Git release tag, verify that the version number is **identical in all 4 files**:

### Files to Update

**`package.json`**
```json
"version": "X.Y.Z"
```

**`src-tauri/Cargo.toml`**
```toml
[package]
version = "X.Y.Z"
```

**`src-tauri/tauri.conf.json`**
```json
"version": "X.Y.Z"
```

**`README.md`** — update the version badge and component version table:
```markdown
![version](https://img.shields.io/badge/release-vX.Y.Z-...)

| Desktop Client | `vX.Y.Z` |
| Sync Server    | `vX.Y.Z` |
```

### Local Build Verification

Run these commands before tagging to confirm there are no compilation errors:

```bash
# 1. Rust backend check
cd src-tauri && cargo check && cd ..

# 2. Frontend TypeScript + Vite build
bun run build

# 3. Go sync server build
cd server && go build ./... && cd ..
```

All three must pass with zero errors before proceeding.

---

## 3. Release Procedure

### Step 1 — Commit & Push to `main`

Ensure the working tree is clean and all version bump commits are on `main`:

```bash
git checkout main
git add .
git commit -m "chore: bump version to X.Y.Z"
git push origin main
```

### Step 2 — Create & Push the Git Tag

Create an annotated tag with a short feature summary, then push it to GitHub:

```bash
git tag -a vX.Y.Z -m "Termimus vX.Y.Z: <short description>"
git push origin vX.Y.Z
```

> ✅ Pushing a tag is what triggers the automated CI/CD builds. Do not push the tag before all version files are synced.

---

## 4. Automated CI/CD (What Happens After Pushing a Tag)

Two GitHub Actions workflows run automatically and in parallel:

### A. Desktop App Build (`.github/workflows/release.yml`)

Three virtual machines run simultaneously using `tauri-apps/tauri-action@v1` (Node.js 22):

| Runner | Tauri Args | Output Artifacts |
|---|---|---|
| `ubuntu-22.04` | `--bundles deb,appimage` | `.deb` (Debian/Ubuntu) · `.AppImage` (portable, all distros) |
| `macos-latest` | `--target universal-apple-darwin` | `.dmg` — Universal binary (Intel `x86_64` + Apple Silicon `arm64`) |
| `windows-latest` | `--bundles msi,nsis` | `.msi` (Windows Installer) · `.exe` (NSIS setup executable) |

> ⏳ Estimated build time: **12–20 minutes** (native Rust compilation on each platform).

### B. Docker Image Build (`.github/workflows/docker.yml`)
Builds a multi-architecture container (`linux/amd64` + `linux/arm64`) for the Go sync server and publishes to GitHub Container Registry:

| Tag | Description |
|---|---|
| `:vX.Y.Z` | Exact version tag (permanent, safe for production pinning) |
| `:X.Y` | Minor version alias |
| `:latest` | Always points to the latest stable release |
| `:edge` | Built from every `main` branch push (not from tags) |

> ⏳ Estimated build time: **1–3 minutes**.

---

## 5. Publishing the Draft Release on GitHub

Because `releaseDraft: true` is set in the workflow, all installer files are attached automatically to a **Draft Release** — the release is **not publicly visible** until you manually publish it.

### Steps to Publish

1. Open the **Actions** tab and wait for the **"Build and Release Desktop App"** workflow to show a green ✅ across all three platforms:
   `https://github.com/itsmefdil/termimus-ssh/actions`

2. Open the **Releases** tab:
   `https://github.com/itsmefdil/termimus-ssh/releases`

3. You will see a **Draft** release titled `Termimus vX.Y.Z` with all installer files already attached (`.deb`, `.AppImage`, `.dmg`, `.msi`, `.exe`).

4. Click **Edit** (pencil icon) on the draft:
   - Fill in or adjust the release notes.
   - **Do not delete the attached installer files.**

5. Click the green **Publish release** button.

> ⚠️ **Important**: Do **not** click "Draft a new release" manually when a tag build is in progress. The manually-created draft will not have the installer files from the automated build attached.

---

## 6. Release Notes Template

When editing and publishing the draft release on GitHub, use this format:

```markdown
## What's New in vX.Y.Z

### ✨ Highlights
- Feature or fix description
- Feature or fix description

### 📥 Download Installers

| Platform | File | Notes |
|---|---|---|
| Linux | `.deb` / `.AppImage` | Attach below |
| macOS | `.dmg` | Universal binary (Intel + Apple Silicon) |
| Windows | `.msi` / `.exe` | Attach below |

### 🐳 Self-Hosted Sync Server (Docker)
```bash
docker run -d \
  --name termimus-sync \
  -p 8080:8080 \
  -v termimus_data:/data \
  -e TERMIMUS_AUTH_TOKEN="your-secure-token" \
  ghcr.io/itsmefdil/termimus-sync:vX.Y.Z
```
```

---

## 7. Troubleshooting & Rollback

### If a CI Build Fails
1. Open the failing workflow run in the **Actions** tab.
2. Click the failing job to read the error log.
3. Fix the issue on `main`, then delete and recreate the tag.

### Deleting a Tag That Was Pushed by Mistake

```bash
# Delete the local tag
git tag -d vX.Y.Z

# Delete the tag on GitHub
git push origin --delete vX.Y.Z
```

After fixing the code, recreate and re-push the tag.

### Hotfix Flow (Urgent Patch After a Public Release)

```bash
# Create a hotfix branch from the release tag
git checkout -b hotfix/vX.Y.Z+1 vX.Y.Z

# Apply the fix, commit, then merge back to main
git checkout main
git merge hotfix/vX.Y.Z+1 --no-ff

# Bump PATCH version in all 4 files, then push a new tag
git tag -a vX.Y.(Z+1) -m "Termimus vX.Y.(Z+1): hotfix for <issue>"
git push origin main vX.Y.(Z+1)
```

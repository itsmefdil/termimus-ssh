import { invoke } from "@tauri-apps/api/core";

export interface Host {
  id: string;
  folder_id?: string | null;
  label: string;
  address: string;
  port: number;
  username: string;
  auth_method: "password" | "private_key" | "agent";
  credential_id?: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface HostInput {
  folder_id?: string | null;
  label: string;
  address: string;
  port: number;
  username: string;
  auth_method: "password" | "private_key" | "agent";
  secret?: string;
  passphrase?: string;
  tags: string[];
}

export interface Folder {
  id: string;
  name: string;
  parent_id?: string | null;
  created_at: string;
}

export interface VaultStatus {
  is_initialized: boolean;
  is_unlocked: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified?: number | null;
  permissions?: number | null;
}

export interface PortForwardRule {
  id: string;
  host_id: string;
  label: string;
  forward_type: "local" | "remote" | "dynamic";
  local_address: string;
  local_port: number;
  remote_address: string;
  remote_port: number;
  created_at: string;
}

export interface PortForwardInput {
  host_id: string;
  label: string;
  forward_type: "local" | "remote" | "dynamic";
  local_address: string;
  local_port: number;
  remote_address: string;
  remote_port: number;
}

export interface Snippet {
  id: string;
  title: string;
  command: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SnippetInput {
  title: string;
  command: string;
  tags: string[];
}

export interface PingResult {
  host_id: string;
  latency_ms?: number | null;
  online: boolean;
}

export interface KnownHost {
  address: string;
  port: number;
  key_type: string;
  fingerprint: string;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ImportSummary {
  folders: number;
  credentials: number;
  hosts: number;
  port_forwards: number;
  snippets: number;
  known_hosts: number;
  vault_meta_restored: boolean;
}

export const api = {
  // Vault
  getVaultStatus: () => invoke<VaultStatus>("vault_status"),
  setupVault: (password: string) => invoke<void>("vault_setup", { password }),
  unlockVault: (password: string) => invoke<boolean>("vault_unlock", { password }),
  lockVault: () => invoke<void>("vault_lock"),

  // Hosts
  listHosts: () => invoke<Host[]>("host_list"),
  saveHost: (input: HostInput, hostId?: string) =>
    invoke<Host>("host_save", { input, hostId: hostId ?? null }),
  deleteHost: (id: string) => invoke<void>("host_delete", { id }),

  // Folders
  listFolders: () => invoke<Folder[]>("folder_list"),
  saveFolder: (name: string, parentId?: string) =>
    invoke<Folder>("folder_save", { name, parentId: parentId ?? null }),
  deleteFolder: (id: string) => invoke<void>("folder_delete", { id }),

  // SSH Sessions
  connectSsh: (
    hostId: string,
    sessionId: string,
    cols: number,
    rows: number,
  ) => invoke<void>("ssh_connect", { hostId, sessionId, cols, rows }),
  writeSsh: (sessionId: string, data: number[]) =>
    invoke<void>("ssh_write", { sessionId, data }),
  resizeSsh: (sessionId: string, cols: number, rows: number) =>
    invoke<void>("ssh_resize", { sessionId, cols, rows }),
  disconnectSsh: (sessionId: string) =>
    invoke<void>("ssh_disconnect", { sessionId }),

  // SFTP Remote
  connectSftp: (hostId: string, sessionId: string) =>
    invoke<string>("sftp_connect", { hostId, sessionId }),
  listSftp: (sessionId: string, path: string) =>
    invoke<FileEntry[]>("sftp_list", { sessionId, path }),
  mkdirSftp: (sessionId: string, path: string) =>
    invoke<void>("sftp_mkdir", { sessionId, path }),
  deleteSftp: (sessionId: string, path: string, isDir: boolean) =>
    invoke<void>("sftp_delete", { sessionId, path, isDir }),
  renameSftp: (sessionId: string, oldPath: string, newPath: string) =>
    invoke<void>("sftp_rename", { sessionId, oldPath, newPath }),
  uploadSftp: (sessionId: string, localPath: string, remotePath: string) =>
    invoke<void>("sftp_upload", { sessionId, localPath, remotePath }),
  downloadSftp: (sessionId: string, remotePath: string, localPath: string) =>
    invoke<void>("sftp_download", { sessionId, remotePath, localPath }),
  disconnectSftp: (sessionId: string) =>
    invoke<void>("sftp_disconnect", { sessionId }),
  readSftpFile: (sessionId: string, path: string) =>
    invoke<string>("sftp_read_file", { sessionId, path }),
  writeSftpFile: (sessionId: string, path: string, content: string) =>
    invoke<void>("sftp_write_file", { sessionId, path, content }),

  // Local Filesystem
  getLocalHomeDir: () => invoke<string>("local_home_dir"),
  listLocal: (path?: string) => invoke<FileEntry[]>("local_list", { path: path ?? null }),
  mkdirLocal: (path: string) => invoke<void>("local_mkdir", { path }),
  deleteLocal: (path: string, isDir: boolean) =>
    invoke<void>("local_delete", { path, isDir }),
  readLocalFile: (path: string) =>
    invoke<string>("local_read_file", { path }),
  writeLocalFile: (path: string, content: string) =>
    invoke<void>("local_write_file", { path, content }),

  // Port Forwarding / Tunnels
  listTunnelRules: () => invoke<PortForwardRule[]>("tunnel_rule_list"),
  saveTunnelRule: (input: PortForwardInput, ruleId?: string) =>
    invoke<PortForwardRule>("tunnel_rule_save", { input, ruleId: ruleId ?? null }),
  deleteTunnelRule: (id: string) => invoke<void>("tunnel_rule_delete", { id }),
  startTunnel: (ruleId: string) => invoke<void>("tunnel_start", { ruleId }),
  stopTunnel: (ruleId: string) => invoke<void>("tunnel_stop", { ruleId }),
  listActiveTunnels: () => invoke<string[]>("tunnel_active_list"),

  // Snippets
  listSnippets: () => invoke<Snippet[]>("snippet_list"),
  saveSnippet: (input: SnippetInput, snippetId?: string) =>
    invoke<Snippet>("snippet_save", { input, snippetId: snippetId ?? null }),
  deleteSnippet: (id: string) => invoke<void>("snippet_delete", { id }),

  // Ping / Latency
  pingHost: (address: string, port: number) =>
    invoke<number | null>("ping_host", { address, port }),
  pingHosts: () => invoke<PingResult[]>("ping_hosts"),

  // Known Hosts / MITM Verification
  listKnownHosts: () => invoke<KnownHost[]>("known_host_list"),
  deleteKnownHost: (address: string, port: number) =>
    invoke<void>("known_host_delete", { address, port }),

  // Backup & Restore
  exportBackup: () => invoke<string>("backup_export"),
  importBackup: (backupJson: string, replaceAll: boolean) =>
    invoke<ImportSummary>("backup_import", { backupJson, replaceAll }),
};

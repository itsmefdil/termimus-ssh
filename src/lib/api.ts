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
};

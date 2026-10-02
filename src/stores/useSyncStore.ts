import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, ImportSummary } from "../lib/api";
import { useHostStore } from "./useHostStore";
import { useKeychainStore } from "./useKeychainStore";
import { useSnippetStore } from "./useSnippetStore";
import { useTunnelStore } from "./useTunnelStore";
import { useKnownHostsStore } from "./useKnownHostsStore";
import { useWorkspaceStore } from "./useWorkspaceStore";

export interface ConnectedDevice {
  id: string;
  name: string;
  last_sync_at: string;
  created_at: string;
}

interface SyncState {
  serverUrl: string;
  authToken: string;
  syncPassword: string;
  deviceName: string;
  deviceId: string;
  autoSync: boolean;
  lastSyncAt: string | null;
  latestServerVersion: number | null;
  syncStatus: "idle" | "syncing" | "connected" | "error";
  lastError: string | null;

  setServerUrl: (url: string) => void;
  setAuthToken: (token: string) => void;
  setSyncPassword: (pw: string) => void;
  setDeviceName: (name: string) => void;
  getDeviceId: () => string;
  setAutoSync: (enabled: boolean) => void;

  testConnection: () => Promise<{ ok: boolean; version?: string; revision?: number; error?: string }>;
  push: () => Promise<number>;
  pull: () => Promise<ImportSummary>;
  getDevices: () => Promise<ConnectedDevice[]>;
  triggerAutoPush: (delayMs?: number) => void;
}

let autoPushTimer: ReturnType<typeof setTimeout> | null = null;

function getDefaultDeviceName() {
  const platform = navigator.userAgent.includes("Linux")
    ? "Linux"
    : navigator.userAgent.includes("Mac")
    ? "macOS"
    : "Desktop";
  return `Termimus ${platform}`;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      serverUrl: "",
      authToken: "",
      syncPassword: "",
      deviceName: getDefaultDeviceName(),
      deviceId:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      autoSync: false,
      lastSyncAt: null,
      latestServerVersion: null,
      syncStatus: "idle",
      lastError: null,

      setServerUrl: (url) => set({ serverUrl: url.trim().replace(/\/+$/, "") }),
      setAuthToken: (token) => set({ authToken: token.trim() }),
      setSyncPassword: (pw) => set({ syncPassword: pw }),
      setDeviceName: (name) => set({ deviceName: name.trim() }),
      getDeviceId: () => {
        let id = get().deviceId;
        if (!id) {
          id =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          set({ deviceId: id });
        }
        return id;
      },
      setAutoSync: (autoSync) => {
        if (autoSync && !get().syncPassword.trim()) {
          set({ lastError: "Please set a Sync Passphrase before enabling Live Sync to ensure end-to-end encryption." });
          return;
        }
        set({ autoSync });
      },

      testConnection: async () => {
        const { serverUrl, authToken } = get();
        if (!serverUrl) {
          return { ok: false, error: "Server URL is required" };
        }

        try {
          const res = await fetch(`${serverUrl}/health`);
          if (!res.ok) {
            return { ok: false, error: `Server returned HTTP ${res.status}` };
          }
          const health = await res.json();

          // Check sync status with auth
          const headers: HeadersInit = {};
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const statusRes = await fetch(`${serverUrl}/api/v1/sync/status`, { headers });
          if (!statusRes.ok) {
            if (statusRes.status === 401) {
              return {
                ok: false,
                error: "Authentication failed: invalid or missing Auth Token (configured via TERMIMUS_AUTH_TOKEN on server)",
              };
            }
            return { ok: false, error: `Sync endpoint returned HTTP ${statusRes.status}` };
          }

          const statusData = await statusRes.json();
          set({
            syncStatus: "connected",
            lastError: null,
            latestServerVersion: statusData.latest_version ?? 0,
          });

          return {
            ok: true,
            version: health.version,
            revision: statusData.latest_version,
          };
        } catch (e) {
          const errMsg = String(e);
          set({ syncStatus: "error", lastError: errMsg });
          return { ok: false, error: errMsg };
        }
      },

      push: async () => {
        const { serverUrl, authToken, syncPassword, deviceName, getDeviceId } = get();
        if (!serverUrl) throw new Error("Server URL is not configured");

        const cleanPassword = syncPassword.trim();
        if (!cleanPassword) {
          throw new Error("Sync Passphrase is required. Termimus enforces zero-knowledge E2EE encryption before uploading to the relay.");
        }

        const deviceId = getDeviceId();
        set({ syncStatus: "syncing", lastError: null });

        try {
          // Export full database into an encrypted envelope using the sync password
          const encryptedBlob = await api.exportBackup(cleanPassword);

          const headers: HeadersInit = { "Content-Type": "application/json" };
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const res = await fetch(`${serverUrl}/api/v1/sync/bundle`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              device_id: deviceId,
              device_name: deviceName,
              encrypted_blob: encryptedBlob,
            }),
          });

          if (!res.ok) {
            if (res.status === 401) {
              throw new Error("Authentication failed: invalid or missing Auth Token (configured via TERMIMUS_AUTH_TOKEN on server)");
            }
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Server returned HTTP ${res.status}`);
          }

          const data = await res.json();
          const now = new Date().toISOString();

          set({
            syncStatus: "connected",
            lastSyncAt: now,
            latestServerVersion: data.version,
            lastError: null,
          });

          return data.version;
        } catch (e) {
          const msg = String(e);
          set({ syncStatus: "error", lastError: msg });
          throw e;
        }
      },

      pull: async () => {
        const { serverUrl, authToken, syncPassword } = get();
        if (!serverUrl) throw new Error("Server URL is not configured");

        set({ syncStatus: "syncing", lastError: null });

        try {
          const headers: HeadersInit = {};
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }

          const res = await fetch(`${serverUrl}/api/v1/sync/bundle`, { headers });
          if (!res.ok) {
            if (res.status === 401) {
              throw new Error("Authentication failed: invalid or missing Auth Token (configured via TERMIMUS_AUTH_TOKEN on server)");
            }
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody.error || `Server returned HTTP ${res.status}`);
          }

          const data = await res.json();
          const encryptedBlob = data.encrypted_blob;
          if (!encryptedBlob) {
            throw new Error("No sync data found on server");
          }

          const cleanPassword = syncPassword.trim();
          if (!cleanPassword) {
            throw new Error("Sync Passphrase is required to decrypt the incoming sync bundle.");
          }

          // Import and merge into local database safely (replace_all = false preserves TOFU known hosts)
          const summary = await api.importBackup(
            encryptedBlob,
            false,
            cleanPassword
          );

          // Refresh UI stores after data import
          useHostStore.getState().refresh();
          useKeychainStore.getState().refresh();
          useSnippetStore.getState().refresh();
          useTunnelStore.getState().refresh();
          useKnownHostsStore.getState().refresh();
          useWorkspaceStore.getState().refresh();

          const now = new Date().toISOString();
          set({
            syncStatus: "connected",
            lastSyncAt: now,
            latestServerVersion: data.version,
            lastError: null,
          });

          return summary;
        } catch (e) {
          const msg = String(e);
          set({ syncStatus: "error", lastError: msg });
          throw e;
        }
      },

      getDevices: async () => {
        const { serverUrl, authToken } = get();
        if (!serverUrl) return [];
        try {
          const headers: HeadersInit = {};
          if (authToken) {
            headers["Authorization"] = `Bearer ${authToken}`;
          }
          const res = await fetch(`${serverUrl}/api/v1/sync/devices`, { headers });
          if (!res.ok) return [];
          const data = await res.json();
          return (data.devices as ConnectedDevice[]) || [];
        } catch {
          return [];
        }
      },

      triggerAutoPush: (delayMs = 2000) => {
        const { autoSync, serverUrl, syncPassword } = get();
        if (!autoSync || !serverUrl || !syncPassword.trim()) {
          return;
        }
        if (autoPushTimer) {
          clearTimeout(autoPushTimer);
        }
        autoPushTimer = setTimeout(async () => {
          autoPushTimer = null;
          try {
            if (get().syncStatus === "syncing") {
              return;
            }
            await get().push();
          } catch (e) {
            console.warn("[AutoSync] Push failed:", e);
          }
        }, delayMs);
      },
    }),
    {
      name: "termimus_sync_config",
    }
  )
);

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

      setServerUrl: (url) => set({ serverUrl: url }),
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
        const cleanUrl = serverUrl.trim().replace(/\/+$/, "");
        if (!cleanUrl) {
          return { ok: false, error: "Server URL is required" };
        }

        try {
          const res = await api.syncTestConnection(cleanUrl, authToken);
          if (res.ok) {
            set({
              syncStatus: "connected",
              lastError: null,
              latestServerVersion: res.revision ?? 0,
            });
            return {
              ok: true,
              version: res.serverVersion,
              revision: res.revision,
            };
          }
          const errMsg = res.error || "Connection failed";
          set({ syncStatus: "error", lastError: errMsg });
          return { ok: false, error: errMsg };
        } catch (e) {
          const errMsg = String(e);
          set({ syncStatus: "error", lastError: errMsg });
          return { ok: false, error: errMsg };
        }
      },

      push: async () => {
        const { serverUrl, authToken, syncPassword, deviceName, getDeviceId } = get();
        const cleanUrl = serverUrl.trim().replace(/\/+$/, "");
        if (!cleanUrl) throw new Error("Server URL is not configured");

        const cleanPassword = syncPassword.trim();
        if (!cleanPassword) {
          throw new Error("Sync Passphrase is required. Termimus enforces zero-knowledge E2EE encryption before uploading to the relay.");
        }

        const deviceId = getDeviceId();
        set({ syncStatus: "syncing", lastError: null });

        try {
          // Native Rust HTTP push: bypasses WebKitGTK active mixed-content and CORS blocks entirely
          const version = await api.syncPush(
            cleanUrl,
            cleanPassword,
            deviceId,
            deviceName,
            authToken
          );

          const now = new Date().toISOString();
          set({
            syncStatus: "connected",
            lastSyncAt: now,
            latestServerVersion: version,
            lastError: null,
          });

          return version;
        } catch (e) {
          const msg = String(e);
          set({ syncStatus: "error", lastError: msg });
          throw e;
        }
      },

      pull: async () => {
        const { serverUrl, authToken, syncPassword } = get();
        const cleanUrl = serverUrl.trim().replace(/\/+$/, "");
        if (!cleanUrl) throw new Error("Server URL is not configured");

        set({ syncStatus: "syncing", lastError: null });

        try {
          // Native Rust HTTP pull: bypasses WebKitGTK mixed-content and CORS blocks entirely
          const summary = await api.syncPull(cleanUrl, syncPassword, authToken);

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
        const cleanUrl = serverUrl.trim().replace(/\/+$/, "");
        if (!cleanUrl) return [];
        try {
          return await api.syncGetDevices(cleanUrl, authToken);
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

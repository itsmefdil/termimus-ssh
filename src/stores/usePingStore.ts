import { create } from "zustand";
import { api } from "../lib/api";

export interface HostPingStatus {
  latencyMs: number | null;
  online: boolean;
  checking: boolean;
  lastCheckedAt: number;
}

interface PingState {
  statusByHostId: Record<string, HostPingStatus>;
  isPinging: boolean;
  pingAll: () => Promise<void>;
}

export const usePingStore = create<PingState>((set, get) => ({
  statusByHostId: {},
  isPinging: false,

  pingAll: async () => {
    if (get().isPinging) return;
    set({ isPinging: true });

    try {
      const results = await api.pingHosts();
      const now = Date.now();
      set((state) => {
        const next = { ...state.statusByHostId };
        for (const r of results) {
          next[r.host_id] = {
            latencyMs: r.latency_ms ?? null,
            online: r.online,
            checking: false,
            lastCheckedAt: now,
          };
        }
        return { statusByHostId: next };
      });
    } catch (e) {
      console.error("Failed to ping hosts:", e);
    } finally {
      set({ isPinging: false });
    }
  },
}));

import { create } from "zustand";
import { api, KnownHost } from "../lib/api";

interface KnownHostsState {
  knownHosts: KnownHost[];
  isLoading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  resetKnownHost: (address: string, port: number) => Promise<void>;
}

export const useKnownHostsStore = create<KnownHostsState>((set, get) => ({
  knownHosts: [],
  isLoading: false,
  error: null,

  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const knownHosts = await api.listKnownHosts();
      set({ knownHosts, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  resetKnownHost: async (address: string, port: number) => {
    await api.deleteKnownHost(address, port);
    await get().refresh();
  },
}));

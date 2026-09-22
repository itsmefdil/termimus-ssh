import { create } from "zustand";
import { api } from "../lib/api";

interface VaultState {
  isInitialized: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setup: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
}

export const useVaultStore = create<VaultState>((set) => ({
  isInitialized: false,
  isUnlocked: false,
  isLoading: true,
  error: null,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const status = await api.getVaultStatus();
      set({
        isInitialized: status.is_initialized,
        isUnlocked: status.is_unlocked,
        isLoading: false,
        error: null,
      });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  setup: async (password: string) => {
    set({ error: null });
    try {
      await api.setupVault(password);
      set({ isInitialized: true, isUnlocked: true });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  unlock: async (password: string) => {
    set({ error: null });
    try {
      await api.unlockVault(password);
      set({ isUnlocked: true });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  lock: async () => {
    await api.lockVault();
    set({ isUnlocked: false });
  },
}));

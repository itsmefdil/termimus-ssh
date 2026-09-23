import { create } from "zustand";
import { api } from "../lib/api";
import { useSettingsStore } from "./useSettingsStore";

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

      // If vault is initialized but locked, attempt silent unlock via OS keyring
      // before surfacing the password modal to the user.
      if (status.is_initialized && !status.is_unlocked) {
        const { useOsKeyring } = useSettingsStore.getState();
        if (useOsKeyring) {
          try {
            const unlocked = await api.unlockVaultKeyring();
            if (unlocked) {
              set({ isInitialized: true, isUnlocked: true, isLoading: false, error: null });
              return;
            }
          } catch {
            // Keyring unavailable or entry missing — fall through to password modal.
          }
        }
      }

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

      // Auto-save to keyring if the user has it enabled.
      const { useOsKeyring } = useSettingsStore.getState();
      if (useOsKeyring) {
        try {
          await api.saveVaultKeyring();
        } catch {
          // Non-fatal — keyring save failure shouldn't block vault setup.
        }
      }
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

      // Refresh keyring entry after a successful manual unlock.
      const { useOsKeyring } = useSettingsStore.getState();
      if (useOsKeyring) {
        try {
          await api.saveVaultKeyring();
        } catch {
          // Non-fatal.
        }
      }
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

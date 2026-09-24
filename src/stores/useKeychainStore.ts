import { create } from "zustand";
import {
  api,
  KeychainItem,
  KeychainKeyInput,
  KeychainIdentityInput,
} from "../lib/api";

interface KeychainState {
  items: KeychainItem[];
  isLoading: boolean;
  searchQuery: string;

  isKeyModalOpen: boolean;
  editingKey: KeychainItem | null;

  isIdentityModalOpen: boolean;
  editingIdentity: KeychainItem | null;

  refresh: () => Promise<void>;
  saveKey: (input: KeychainKeyInput, itemId?: string) => Promise<KeychainItem>;
  saveIdentity: (input: KeychainIdentityInput, itemId?: string) => Promise<KeychainItem>;
  deleteItem: (id: string) => Promise<void>;

  setSearchQuery: (query: string) => void;
  openCreateKeyModal: () => void;
  openEditKeyModal: (item: KeychainItem) => void;
  closeKeyModal: () => void;

  openCreateIdentityModal: () => void;
  openEditIdentityModal: (item: KeychainItem) => void;
  closeIdentityModal: () => void;
}

export const useKeychainStore = create<KeychainState>((set, get) => ({
  items: [],
  isLoading: false,
  searchQuery: "",

  isKeyModalOpen: false,
  editingKey: null,

  isIdentityModalOpen: false,
  editingIdentity: null,

  refresh: async () => {
    // Only flash isLoading when items are empty to avoid UI flicker
    if (get().items.length === 0) {
      set({ isLoading: true });
    }
    try {
      const items = await api.listKeychain();
      set({ items, isLoading: false });
    } catch (e) {
      console.error("Failed to load Keychain:", e);
      set({ isLoading: false });
    }
  },

  saveKey: async (input, itemId) => {
    const item = await api.saveKeychainKey(input, itemId);
    await get().refresh();
    return item;
  },

  saveIdentity: async (input, itemId) => {
    const item = await api.saveKeychainIdentity(input, itemId);
    await get().refresh();
    return item;
  },

  deleteItem: async (id) => {
    await api.deleteKeychainItem(id);
    await get().refresh();
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  openCreateKeyModal: () => set({ isKeyModalOpen: true, editingKey: null }),
  openEditKeyModal: (item) => set({ isKeyModalOpen: true, editingKey: item }),
  closeKeyModal: () => set({ isKeyModalOpen: false, editingKey: null }),

  openCreateIdentityModal: () =>
    set({ isIdentityModalOpen: true, editingIdentity: null }),
  openEditIdentityModal: (item) =>
    set({ isIdentityModalOpen: true, editingIdentity: item }),
  closeIdentityModal: () =>
    set({ isIdentityModalOpen: false, editingIdentity: null }),
}));

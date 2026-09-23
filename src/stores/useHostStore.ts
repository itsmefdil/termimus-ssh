import { create } from "zustand";
import { api, Host, HostInput, Folder } from "../lib/api";

interface HostState {
  hosts: Host[];
  folders: Folder[];
  isLoading: boolean;
  selectedTag: string | null;
  searchQuery: string;
  isHostModalOpen: boolean;
  editingHost: Host | null;

  isFolderModalOpen: boolean;
  editingFolder: Folder | null;

  refresh: () => Promise<void>;
  saveHost: (input: HostInput, hostId?: string) => Promise<void>;
  deleteHost: (id: string) => Promise<void>;

  saveFolder: (name: string, parentId?: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  openCreateModal: () => void;
  openEditModal: (host: Host) => void;
  closeHostModal: () => void;

  openCreateFolderModal: () => void;
  openEditFolderModal: (folder: Folder) => void;
  closeFolderModal: () => void;
}

export const useHostStore = create<HostState>((set, get) => ({
  hosts: [],
  folders: [],
  isLoading: false,
  selectedTag: null,
  searchQuery: "",
  isHostModalOpen: false,
  editingHost: null,

  isFolderModalOpen: false,
  editingFolder: null,

  refresh: async () => {
    set({ isLoading: true });
    try {
      const [hosts, folders] = await Promise.all([
        api.listHosts(),
        api.listFolders(),
      ]);
      set({ hosts, folders, isLoading: false });
    } catch (e) {
      console.error("Failed to load hosts:", e);
      set({ isLoading: false });
    }
  },

  saveHost: async (input: HostInput, hostId?: string) => {
    await api.saveHost(input, hostId);
    await get().refresh();
  },

  deleteHost: async (id: string) => {
    await api.deleteHost(id);
    await get().refresh();
  },

  saveFolder: async (name: string, parentId?: string) => {
    await api.saveFolder(name, parentId);
    await get().refresh();
  },

  deleteFolder: async (id: string) => {
    await api.deleteFolder(id);
    await get().refresh();
  },

  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  openCreateModal: () => set({ isHostModalOpen: true, editingHost: null }),
  openEditModal: (host) => set({ isHostModalOpen: true, editingHost: host }),
  closeHostModal: () => set({ isHostModalOpen: false, editingHost: null }),

  openCreateFolderModal: () => set({ isFolderModalOpen: true, editingFolder: null }),
  openEditFolderModal: (folder) => set({ isFolderModalOpen: true, editingFolder: folder }),
  closeFolderModal: () => set({ isFolderModalOpen: false, editingFolder: null }),
}));

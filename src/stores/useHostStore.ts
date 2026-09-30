import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { api, Host, HostInput, Folder } from "../lib/api";

interface HostState {
  hosts: Host[];
  folders: Folder[];
  isLoading: boolean;
  selectedTag: string | null;
  searchQuery: string;
  isHostModalOpen: boolean;
  editingHost: Host | null;
  defaultFolderId: string | null;

  isFolderModalOpen: boolean;
  editingFolder: Folder | null;

  refresh: () => Promise<void>;
  updateHostOsIcon: (hostId: string, osIcon: string) => void;
  saveHost: (input: HostInput, hostId?: string) => Promise<void>;
  deleteHost: (id: string) => Promise<void>;

  saveFolder: (name: string, parentId?: string, id?: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  openCreateModal: (folderId?: string) => void;
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
  defaultFolderId: null,

  isFolderModalOpen: false,
  editingFolder: null,

  refresh: async () => {
    // Only flash isLoading when we have no cached data to show
    if (get().hosts.length === 0 && get().folders.length === 0) {
      set({ isLoading: true });
    }
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

  updateHostOsIcon: (hostId: string, osIcon: string) => {
    set((state) => ({
      hosts: state.hosts.map((h) =>
        h.id === hostId ? { ...h, os_icon: osIcon } : h
      ),
    }));
  },

  saveHost: async (input: HostInput, hostId?: string) => {
    await api.saveHost(input, hostId);
    await get().refresh();
  },

  deleteHost: async (id: string) => {
    await api.deleteHost(id);
    await get().refresh();
  },

  saveFolder: async (name: string, parentId?: string, id?: string) => {
    await api.saveFolder(name, parentId, id);
    await get().refresh();
  },

  deleteFolder: async (id: string) => {
    await api.deleteFolder(id);
    await get().refresh();
  },

  setSelectedTag: (tag) => set({ selectedTag: tag }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  openCreateModal: (folderId?: string) =>
    set({ isHostModalOpen: true, editingHost: null, defaultFolderId: folderId ?? null }),
  openEditModal: (host) =>
    set({ isHostModalOpen: true, editingHost: host, defaultFolderId: null }),
  closeHostModal: () =>
    set({ isHostModalOpen: false, editingHost: null, defaultFolderId: null }),

  openCreateFolderModal: () => set({ isFolderModalOpen: true, editingFolder: null }),
  openEditFolderModal: (folder) => set({ isFolderModalOpen: true, editingFolder: folder }),
  closeFolderModal: () => set({ isFolderModalOpen: false, editingFolder: null }),
}));

// Subscribe to OS detection events emitted by the Rust backend after
// each successful SSH login — update the host's icon in the store
// immediately without a full refresh.
listen<{ host_id: string; os_icon: string }>("host-os-detected", (event) => {
  const { host_id, os_icon } = event.payload;
  useHostStore.getState().updateHostOsIcon(host_id, os_icon);
}).catch((e) => console.error("Failed to listen host-os-detected:", e));

import { create } from "zustand";
import { api, Snippet, SnippetInput } from "../lib/api";

interface SnippetState {
  snippets: Snippet[];
  isLoading: boolean;
  error: string | null;
  isModalOpen: boolean;
  editingSnippet: Snippet | null;
  isSidebarOpen: boolean;

  refresh: () => Promise<void>;
  saveSnippet: (input: SnippetInput, snippetId?: string) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  openCreateModal: () => void;
  openEditModal: (snippet: Snippet) => void;
  closeModal: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useSnippetStore = create<SnippetState>((set, get) => ({
  snippets: [],
  isLoading: false,
  error: null,
  isModalOpen: false,
  editingSnippet: null,
  isSidebarOpen: (() => {
    try {
      return localStorage.getItem("termimus_snippet_sidebar_open") === "true";
    } catch {
      return false;
    }
  })(),

  refresh: async () => {
    if (get().snippets.length === 0) {
      set({ isLoading: true, error: null });
    }
    try {
      const snippets = await api.listSnippets();
      set({ snippets, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  saveSnippet: async (input, snippetId) => {
    await api.saveSnippet(input, snippetId);
    await get().refresh();
  },

  deleteSnippet: async (id: string) => {
    await api.deleteSnippet(id);
    await get().refresh();
  },

  openCreateModal: () => set({ isModalOpen: true, editingSnippet: null }),
  openEditModal: (snippet) => set({ isModalOpen: true, editingSnippet: snippet }),
  closeModal: () => set({ isModalOpen: false, editingSnippet: null }),

  toggleSidebar: () => {
    set((state) => {
      const next = !state.isSidebarOpen;
      try {
        localStorage.setItem("termimus_snippet_sidebar_open", String(next));
      } catch {
        // ignore
      }
      return { isSidebarOpen: next };
    });
  },

  setSidebarOpen: (open: boolean) => {
    try {
      localStorage.setItem("termimus_snippet_sidebar_open", String(open));
    } catch {
      // ignore
    }
    set({ isSidebarOpen: open });
  },
}));

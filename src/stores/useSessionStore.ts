import { create } from "zustand";
import { api, Host } from "../lib/api";

export interface SshTab {
  id: string; // session_id
  hostId: string;
  hostLabel: string;
  hostAddress: string;
  connected: boolean;
  connecting: boolean;
  error?: string;
}

interface SessionState {
  tabs: SshTab[];
  activeTabId: string | null;
  openSession: (host: Host) => Promise<string>;
  closeSession: (sessionId: string) => Promise<void>;
  setActiveTab: (sessionId: string) => void;
  setSessionConnected: (sessionId: string, connected: boolean) => void;
  setSessionError: (sessionId: string, error: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  tabs: [],
  activeTabId: null,

  openSession: async (host: Host) => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newTab: SshTab = {
      id: sessionId,
      hostId: host.id,
      hostLabel: host.label,
      hostAddress: `${host.username}@${host.address}`,
      connected: false,
      connecting: true,
    };

    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: sessionId,
    }));

    return sessionId;
  },

  closeSession: async (sessionId: string) => {
    try {
      await api.disconnectSsh(sessionId);
    } catch (e) {
      console.warn("Failed to disconnect cleanly:", e);
    }

    set((state) => {
      const remainingTabs = state.tabs.filter((t) => t.id !== sessionId);
      let nextActiveId = state.activeTabId;

      if (state.activeTabId === sessionId) {
        nextActiveId = remainingTabs.length > 0 ? remainingTabs[remainingTabs.length - 1].id : null;
      }

      return {
        tabs: remainingTabs,
        activeTabId: nextActiveId,
      };
    });
  },

  setActiveTab: (sessionId: string) => set({ activeTabId: sessionId }),

  setSessionConnected: (sessionId: string, connected: boolean) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === sessionId ? { ...t, connected, connecting: false } : t
      ),
    }));
  },

  setSessionError: (sessionId: string, error: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === sessionId ? { ...t, error, connecting: false } : t
      ),
    }));
  },
}));

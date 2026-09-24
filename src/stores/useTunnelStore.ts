import { create } from "zustand";
import { api, PortForwardRule, PortForwardInput } from "../lib/api";

interface TunnelState {
  rules: PortForwardRule[];
  activeRuleIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  isModalOpen: boolean;
  editingRule: PortForwardRule | null;
  startingRuleId: string | null;

  refresh: () => Promise<void>;
  saveRule: (input: PortForwardInput, ruleId?: string) => Promise<void>;
  deleteRule: (id: string) => Promise<void>;
  toggleTunnel: (rule: PortForwardRule) => Promise<void>;
  openCreateModal: () => void;
  openEditModal: (rule: PortForwardRule) => void;
  closeModal: () => void;
}

export const useTunnelStore = create<TunnelState>((set, get) => ({
  rules: [],
  activeRuleIds: new Set(),
  isLoading: false,
  error: null,
  isModalOpen: false,
  editingRule: null,
  startingRuleId: null,

  refresh: async () => {
    if (get().rules.length === 0) {
      set({ isLoading: true, error: null });
    }
    try {
      const [rules, active] = await Promise.all([
        api.listTunnelRules(),
        api.listActiveTunnels(),
      ]);
      set({ rules, activeRuleIds: new Set(active), isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  saveRule: async (input, ruleId) => {
    await api.saveTunnelRule(input, ruleId);
    await get().refresh();
  },

  deleteRule: async (id: string) => {
    const { activeRuleIds } = get();
    if (activeRuleIds.has(id)) {
      await api.stopTunnel(id).catch(() => {});
    }
    await api.deleteTunnelRule(id);
    await get().refresh();
  },

  toggleTunnel: async (rule: PortForwardRule) => {
    const { activeRuleIds } = get();
    const isActive = activeRuleIds.has(rule.id);
    set({ startingRuleId: rule.id, error: null });

    try {
      if (isActive) {
        await api.stopTunnel(rule.id);
      } else {
        await api.startTunnel(rule.id);
      }
      await get().refresh();
    } catch (e) {
      set({ error: `Tunnel error: ${String(e)}` });
    } finally {
      set({ startingRuleId: null });
    }
  },

  openCreateModal: () => set({ isModalOpen: true, editingRule: null }),
  openEditModal: (rule) => set({ isModalOpen: true, editingRule: rule }),
  closeModal: () => set({ isModalOpen: false, editingRule: null }),
}));

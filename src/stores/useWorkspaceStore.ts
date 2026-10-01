import { create } from "zustand";
import {
  api,
  PresetLayoutType,
  PresetNode,
  WorkspacePreset,
  WorkspacePresetInput,
} from "../lib/api";

export type { PresetLayoutType, PresetNode, WorkspacePreset, WorkspacePresetInput };

export function getPaneCountForLayout(layout: PresetLayoutType): number {
  switch (layout) {
    case "split-vertical":
    case "split-horizontal":
      return 2;
    case "grid-4":
      return 4;
    case "split-1-2":
    case "split-2-1":
    case "triple-column":
      return 3;
    default:
      return 2;
  }
}

export function getLayoutMeta(layout: PresetLayoutType): {
  label: string;
  panes: number;
  description: string;
} {
  switch (layout) {
    case "split-vertical":
      return {
        label: "Side by Side (1×2)",
        panes: 2,
        description: "Two terminals split vertically left and right",
      };
    case "split-horizontal":
      return {
        label: "Top & Bottom (2×1)",
        panes: 2,
        description: "Two terminals split horizontally top and bottom",
      };
    case "grid-4":
      return {
        label: "2×2 Quad Grid (4)",
        panes: 4,
        description: "Four balanced terminal panes in a 2x2 grid",
      };
    case "split-1-2":
      return {
        label: "1 Large + 2 Stacked",
        panes: 3,
        description: "One primary terminal on left, two stacked on right",
      };
    case "split-2-1":
      return {
        label: "2 Stacked + 1 Wide",
        panes: 3,
        description: "Two terminals side-by-side on top, one wide on bottom",
      };
    case "triple-column":
      return {
        label: "Triple Column (1×3)",
        panes: 3,
        description: "Three parallel vertical columns side-by-side",
      };
  }
}

interface WorkspaceState {
  presets: WorkspacePreset[];
  isLoading: boolean;
  error: string | null;
  isModalOpen: boolean;
  editingPreset: WorkspacePreset | null;

  refresh: () => Promise<void>;
  openCreateModal: (initialPreset?: Partial<WorkspacePreset>) => void;
  openEditModal: (preset: WorkspacePreset) => void;
  closeModal: () => void;
  savePreset: (
    preset: WorkspacePresetInput,
    id?: string
  ) => Promise<string>;
  deletePreset: (id: string) => Promise<void>;
  duplicatePreset: (id: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  presets: [],
  isLoading: false,
  error: null,
  isModalOpen: false,
  editingPreset: null,

  refresh: async () => {
    if (get().presets.length === 0) {
      set({ isLoading: true, error: null });
    }
    try {
      let presets = await api.listWorkspacePresets();

      // One-time automatic migration from legacy localStorage to SQLite
      if (presets.length === 0) {
        try {
          const raw = localStorage.getItem("termimus_workspace_presets");
          if (raw) {
            const parsed = JSON.parse(raw);
            const legacyPresets: WorkspacePreset[] = parsed?.state?.presets || [];
            if (Array.isArray(legacyPresets) && legacyPresets.length > 0) {
              for (const p of legacyPresets) {
                await api.saveWorkspacePreset(
                  {
                    name: p.name,
                    description: p.description,
                    layout: p.layout,
                    nodes: p.nodes,
                    broadcastOnLaunch: p.broadcastOnLaunch,
                  },
                  p.id
                );
              }
              localStorage.removeItem("termimus_workspace_presets");
              presets = await api.listWorkspacePresets();
            }
          }
        } catch {
          // Non-fatal legacy migration fallback
        }
      }

      set({ presets, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: String(e) });
    }
  },

  openCreateModal: (initialPreset) => {
    const dummy: WorkspacePreset = {
      id: "",
      name: initialPreset?.name || "",
      description: initialPreset?.description || "",
      layout: initialPreset?.layout || "split-vertical",
      nodes: initialPreset?.nodes || [],
      broadcastOnLaunch: initialPreset?.broadcastOnLaunch || false,
      createdAt: "",
      updatedAt: "",
    };
    set({ isModalOpen: true, editingPreset: dummy });
  },

  openEditModal: (preset) => {
    set({ isModalOpen: true, editingPreset: preset });
  },

  closeModal: () => {
    set({ isModalOpen: false, editingPreset: null });
  },

  savePreset: async (input, id) => {
    const saved = await api.saveWorkspacePreset(input, id);
    set({ isModalOpen: false, editingPreset: null });
    await get().refresh();
    return saved.id;
  },

  deletePreset: async (id: string) => {
    await api.deleteWorkspacePreset(id);
    await get().refresh();
  },

  duplicatePreset: async (id: string) => {
    const preset = get().presets.find((p) => p.id === id);
    if (!preset) return;
    await api.saveWorkspacePreset({
      name: `${preset.name} (Copy)`,
      description: preset.description,
      layout: preset.layout,
      nodes: preset.nodes,
      broadcastOnLaunch: preset.broadcastOnLaunch,
    });
    await get().refresh();
  },
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PresetLayoutType =
  | "split-vertical"   // 2 panes: Left & Right (1x2)
  | "split-horizontal" // 2 panes: Top & Bottom (2x1)
  | "grid-4"           // 4 panes: 2x2 Quad Grid
  | "split-1-2"        // 3 panes: 1 Left, 2 Right Stacked
  | "split-2-1"        // 3 panes: 2 Top Stacked, 1 Bottom Wide
  | "triple-column";   // 3 panes: 3 Columns Side-by-Side

export interface PresetNode {
  paneIndex: number; // 0, 1, 2, 3
  hostId: string;
  label?: string; // Optional custom pane label override
}

export interface WorkspacePreset {
  id: string;
  name: string;
  description?: string;
  layout: PresetLayoutType;
  nodes: PresetNode[];
  broadcastOnLaunch?: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  isModalOpen: boolean;
  editingPreset: WorkspacePreset | null;

  openCreateModal: (initialPreset?: Partial<WorkspacePreset>) => void;
  openEditModal: (preset: WorkspacePreset) => void;
  closeModal: () => void;
  savePreset: (
    preset: Omit<WorkspacePreset, "id" | "createdAt" | "updatedAt">,
    id?: string
  ) => string;
  deletePreset: (id: string) => void;
  duplicatePreset: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      presets: [],
      isModalOpen: false,
      editingPreset: null,

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

      savePreset: (input, id) => {
        const now = new Date().toISOString();
        if (id) {
          // Update existing
          set((state) => ({
            presets: state.presets.map((p) =>
              p.id === id
                ? {
                    ...p,
                    ...input,
                    updatedAt: now,
                  }
                : p
            ),
            isModalOpen: false,
            editingPreset: null,
          }));
          return id;
        }

        // Create brand new
        const newId = `preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newPreset: WorkspacePreset = {
          ...input,
          id: newId,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          presets: [newPreset, ...state.presets],
          isModalOpen: false,
          editingPreset: null,
        }));

        return newId;
      },

      deletePreset: (id) => {
        set((state) => ({
          presets: state.presets.filter((p) => p.id !== id),
        }));
      },

      duplicatePreset: (id) => {
        const preset = get().presets.find((p) => p.id === id);
        if (!preset) return;
        const now = new Date().toISOString();
        const copy: WorkspacePreset = {
          ...preset,
          id: `preset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: `${preset.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          presets: [copy, ...state.presets],
        }));
      },
    }),
    {
      name: "termimus_workspace_presets",
    }
  )
);

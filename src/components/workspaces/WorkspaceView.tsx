import { useState, useMemo } from "react";
import {
  Layers,
  Plus,
  Search,
  BookmarkPlus,
  Server,
  Zap,
} from "lucide-react";
import {
  useWorkspaceStore,
  WorkspacePreset,
} from "../../stores/useWorkspaceStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useHostStore } from "../../stores/useHostStore";
import { getAllLeafPanes } from "../../lib/layoutTree";
import { launchWorkspacePreset } from "../../lib/workspaceLauncher";
import { WorkspaceCard } from "./WorkspaceCard";
import { WorkspaceModal } from "./WorkspaceModal";

interface WorkspaceViewProps {
  onOpenTerminal: () => void;
}

export function WorkspaceView({ onOpenTerminal }: WorkspaceViewProps) {
  const {
    presets,
    openCreateModal,
    openEditModal,
    duplicatePreset,
    deletePreset,
  } = useWorkspaceStore();

  const { groups, activeGroupId, tabs } = useSessionStore();
  const { hosts } = useHostStore();

  const [searchQuery, setSearchQuery] = useState("");

  // Check if current active group in terminal has multiple panes
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeLeafPanes = activeGroup ? getAllLeafPanes(activeGroup.rootPane) : [];
  const canSaveActiveSplit = activeLeafPanes.length >= 2;

  // Filter presets based on search query
  const filteredPresets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return presets;

    return presets.filter((p) => {
      const nameMatch = p.name.toLowerCase().includes(q);
      const descMatch = (p.description || "").toLowerCase().includes(q);
      const hostMatch = p.nodes.some((n) => {
        const host = hosts.find((h) => h.id === n.hostId);
        return (
          host &&
          (host.label.toLowerCase().includes(q) ||
            host.address.toLowerCase().includes(q) ||
            host.username.toLowerCase().includes(q))
        );
      });
      return nameMatch || descMatch || hostMatch;
    });
  }, [presets, searchQuery, hosts]);

  // Handle launching a preset
  const handleLaunchPreset = async (preset: WorkspacePreset) => {
    const success = await launchWorkspacePreset(preset);
    if (success) {
      onOpenTerminal();
    }
  };

  // 1-Click capture of active split screen
  const handleSaveActiveSplit = () => {
    if (!activeGroup || activeLeafPanes.length < 2) return;

    // Detect layout type by pane count
    let layoutType: WorkspacePreset["layout"] = "split-vertical";
    if (activeLeafPanes.length === 2) {
      // Check if root split is row or column
      layoutType =
        activeGroup.rootPane.type === "split" && activeGroup.rootPane.direction === "column"
          ? "split-horizontal"
          : "split-vertical";
    } else if (activeLeafPanes.length === 4) {
      layoutType = "grid-4";
    } else if (activeLeafPanes.length === 3) {
      layoutType = "split-1-2";
    }

    const capturedNodes = activeLeafPanes.map((pane, idx) => {
      const tab = tabs.find((t) => t.id === pane.activeTabId);
      return {
        paneIndex: idx,
        hostId: tab ? tab.hostId : hosts[0]?.id || "",
        label: tab ? tab.hostLabel : undefined,
      };
    });

    openCreateModal({
      name: `Active Cluster (${activeLeafPanes.length} Nodes)`,
      description: "Saved from active split screen terminal layout",
      layout: layoutType,
      nodes: capturedNodes,
      broadcastOnLaunch: useSessionStore.getState().isGroupBroadcastActive(activeGroup.id),
    });
  };

  // Quick Starter Preset Generator for new users
  const handleCreateStarterPreset = (
    layout: WorkspacePreset["layout"],
    title: string
  ) => {
    if (hosts.length === 0) return;
    const required = layout === "grid-4" ? 4 : layout === "split-1-2" ? 3 : 2;
    const nodes = Array.from({ length: required }).map((_, idx) => ({
      paneIndex: idx,
      hostId: hosts[idx % hosts.length]?.id || hosts[0].id,
    }));

    openCreateModal({
      name: title,
      layout,
      nodes,
      broadcastOnLaunch: false,
    });
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--canvas)] text-[var(--text-primary)]">
      {/* Top Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface-container)]/40 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] shadow-sm">
                <Layers size={18} />
              </div>
              <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
                Workspaces & Layout Presets
              </h1>
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Save multi-server cluster layouts and launch interconnected split screens in 1-click
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canSaveActiveSplit && (
              <button
                onClick={handleSaveActiveSplit}
                title="Capture currently open terminal split panes as a reusable preset"
                className="flex items-center gap-1.5 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/10 px-3.5 py-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/20 transition-all shadow-sm"
              >
                <BookmarkPlus size={14} />
                <span>Save Active Split ({activeLeafPanes.length})</span>
              </button>
            )}

            <button
              onClick={() => openCreateModal()}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-black shadow-md transition-all hover:bg-[var(--primary)]/90 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>New Preset</span>
            </button>
          </div>
        </div>

        {/* Filter and Overview Metrics */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search presets or servers..."
                className="h-8 w-56 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] pl-8 pr-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
            <span>{presets.length} Presets saved</span>
            <span>•</span>
            <span>{hosts.length} Available hosts</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6">
        {filteredPresets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-container)] text-[var(--primary)] shadow-sm mb-3">
              <Layers size={26} />
            </div>
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              {searchQuery ? "No matching workspace presets" : "No Workspace Presets yet"}
            </h2>
            <p className="mt-1 max-w-sm text-xs text-[var(--text-muted)]">
              {searchQuery
                ? "Try searching for a different keyword or reset the filter"
                : "Create custom split layouts for multi-server operations, web/database pairs, and microservice clusters."}
            </p>

            {!searchQuery && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  onClick={() => openCreateModal()}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-black shadow-md hover:bg-[var(--primary)]/90 transition-colors"
                >
                  <Plus size={14} />
                  <span>Create First Preset</span>
                </button>

                {hosts.length > 0 && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                      Or start from a popular template:
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() =>
                          handleCreateStarterPreset("split-vertical", "Dual Server Cluster")
                        }
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Zap size={12} className="text-[var(--primary)]" />
                        <span>Side by Side (1×2)</span>
                      </button>

                      <button
                        onClick={() =>
                          handleCreateStarterPreset("split-1-2", "Web + DB + Worker (3)")
                        }
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Server size={12} className="text-[var(--primary)]" />
                        <span>1 Large + 2 Stacked (3)</span>
                      </button>

                      <button
                        onClick={() =>
                          handleCreateStarterPreset("grid-4", "Quad Microservices (4)")
                        }
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:border-[var(--primary)] hover:text-[var(--text-primary)] transition-colors"
                      >
                        <Layers size={12} className="text-[var(--primary)]" />
                        <span>2×2 Quad Grid (4)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPresets.map((preset) => (
              <WorkspaceCard
                key={preset.id}
                preset={preset}
                onLaunch={handleLaunchPreset}
                onEdit={openEditModal}
                onDuplicate={duplicatePreset}
                onDelete={deletePreset}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preset Create / Edit Modal */}
      <WorkspaceModal />
    </div>
  );
}

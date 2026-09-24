import { useEffect } from "react";
import { Terminal as TerminalIcon, Minimize2, Radio, Unlink, Layers, BookmarkPlus } from "lucide-react";
import { useSessionStore } from "../../stores/useSessionStore";
import { useWorkspaceStore, WorkspacePreset } from "../../stores/useWorkspaceStore";
import { findPaneById, getAllLeafPanes } from "../../lib/layoutTree";
import { PaneContainer } from "./PaneContainer";
import { PaneView } from "./PaneView";

interface TerminalWorkspaceProps {
  visible: boolean;
  onOpenWorkspaces?: () => void;
}

export function TerminalWorkspace({ visible, onOpenWorkspaces }: TerminalWorkspaceProps) {
  const {
    tabs,
    rootPane,
    activeGroupId,
    maximizedPaneId,
    toggleMaximizePane,
    isDraggingTab,
    draggedTabId,
    pointerPos,
    updateDragPos,
    endDragTab,
    isGroupBroadcastActive,
    toggleGroupBroadcast,
  } = useSessionStore();

  // Global pointer tracking for tab drag-and-drop
  useEffect(() => {
    if (!isDraggingTab) return;

    const handlePointerMove = (e: PointerEvent) => {
      updateDragPos(e.clientX, e.clientY);
    };

    const handlePointerUp = () => {
      endDragTab();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDraggingTab, updateDragPos, endDragTab]);

  // Handle ESC key to exit maximized pane
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && maximizedPaneId) {
        toggleMaximizePane(maximizedPaneId);
      }
      // Alt+B toggles input broadcast mode on the active group
      if (e.altKey && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleGroupBroadcast(activeGroupId || undefined);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maximizedPaneId, toggleMaximizePane, activeGroupId, toggleGroupBroadcast]);

  const draggedTab = draggedTabId ? tabs.find((t) => t.id === draggedTabId) : null;
  const maximizedPane =
    rootPane && maximizedPaneId ? findPaneById(rootPane, maximizedPaneId) : null;

  const isBroadcast = isGroupBroadcastActive(activeGroupId || undefined);
  const leafPanes = rootPane ? getAllLeafPanes(rootPane) : [];
  const connectedLeafCount = leafPanes.filter((l) => {
    const tab = tabs.find((t) => t.id === l.activeTabId);
    return tab && tab.connected;
  }).length;

  const handleSaveCurrentSplit = () => {
    if (leafPanes.length < 2) return;
    let layoutType: WorkspacePreset["layout"] = "split-vertical";
    if (leafPanes.length === 2) {
      layoutType =
        rootPane?.type === "split" && rootPane.direction === "column"
          ? "split-horizontal"
          : "split-vertical";
    } else if (leafPanes.length === 4) {
      layoutType = "grid-4";
    } else if (leafPanes.length === 3) {
      layoutType = "split-1-2";
    }

    const capturedNodes = leafPanes.map((pane, idx) => {
      const tab = tabs.find((t) => t.id === pane.activeTabId);
      return {
        paneIndex: idx,
        hostId: tab ? tab.hostId : "",
        label: tab ? tab.hostLabel : undefined,
      };
    });

    useWorkspaceStore.getState().openCreateModal({
      name: `Active Cluster (${leafPanes.length} Nodes)`,
      layout: layoutType,
      nodes: capturedNodes,
      broadcastOnLaunch: isBroadcast,
    });
  };

  return (
    <div
      className="absolute inset-0 select-none"
      style={{
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
        zIndex: visible ? 10 : 0,
      }}
    >
      {tabs.length === 0 || !rootPane ? (
        <div className="flex h-full flex-col items-center justify-center text-center text-[var(--text-muted)] gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-container)] text-[var(--text-muted)] border border-[var(--border)]">
            <TerminalIcon size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">No Active Terminal Sessions</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Select a host to connect or launch a multi-server Workspace Preset
            </p>
          </div>
          {onOpenWorkspaces && (
            <button
              onClick={onOpenWorkspaces}
              className="mt-1 flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-semibold text-black hover:bg-[var(--primary)]/90 transition-all shadow-sm active:scale-95"
            >
              <Layers size={13} />
              <span>Open Workspaces</span>
            </button>
          )}
        </div>
      ) : maximizedPane ? (
        // Maximized Single Pane Mode
        <div className="relative flex h-full w-full flex-col overflow-hidden">
          <div className="flex items-center justify-between bg-[var(--surface-container)] px-3 py-1 text-xs text-[var(--primary)] border-b border-[var(--primary)]/30">
            <span className="font-mono text-[11px] font-medium">
              Pane Maximized — Press ESC or click Restore to exit
            </span>
            <button
              onClick={() => toggleMaximizePane(maximizedPane.id)}
              className="flex items-center gap-1 rounded bg-[var(--primary)]/15 px-2 py-0.5 text-xs text-[var(--primary)] hover:bg-[var(--primary)]/25 transition-colors"
            >
              <Minimize2 size={12} />
              <span>Restore Split</span>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PaneView pane={maximizedPane} visible={visible} />
          </div>
        </div>
      ) : (
        // Standard Multi-Terminal Split Tree
        <div className="relative flex h-full w-full flex-col overflow-hidden">
          {isBroadcast && leafPanes.length > 1 && (
            <div className="flex shrink-0 items-center justify-between bg-[var(--primary)]/10 px-3 py-1 text-xs text-[var(--primary)] border-b border-[var(--primary)]/30 backdrop-blur-sm z-20">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <Radio size={12} className="animate-pulse text-[var(--primary)] shrink-0" />
                <span className="font-semibold uppercase tracking-wider">Interconnection Active:</span>
                <span className="text-[var(--text-secondary)]">
                  Keystrokes are mirrored to {connectedLeafCount || leafPanes.length} split terminals
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveCurrentSplit}
                  className="flex items-center gap-1 rounded bg-[var(--surface-container)] px-2 py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition-colors"
                  title="Save this split screen as a Workspace Preset"
                >
                  <BookmarkPlus size={11} />
                  <span>Save Preset</span>
                </button>
                <span className="text-[10px] text-[var(--text-muted)] font-mono hidden md:inline">
                  Alt+B
                </span>
                <button
                  onClick={() => toggleGroupBroadcast(activeGroupId || undefined)}
                  className="flex items-center gap-1 rounded bg-[var(--primary)]/20 px-2 py-0.5 text-xs text-[var(--primary)] hover:bg-[var(--primary)] hover:text-black font-medium transition-colors"
                >
                  <Unlink size={11} />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <PaneContainer node={rootPane} visible={visible} />
          </div>
        </div>
      )}

      {/* Floating Drag Badge that follows the cursor during tab drag */}
      {isDraggingTab && draggedTab && (
        <div
          className="fixed pointer-events-none z-50 flex items-center gap-2 rounded-lg bg-[var(--surface-high)] px-3 py-1.5 text-xs font-mono font-medium text-[var(--primary)] shadow-2xl border border-[var(--primary)] ring-2 ring-[var(--primary)]/20 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${pointerPos.x + 12}px`,
            top: `${pointerPos.y + 12}px`,
          }}
        >
          <TerminalIcon size={13} className="text-[var(--primary)]" />
          <span className="truncate max-w-[140px]">{draggedTab.hostLabel}</span>
          <span className="text-[10px] text-[var(--text-muted)]">(Drag to split)</span>
        </div>
      )}
    </div>
  );
}

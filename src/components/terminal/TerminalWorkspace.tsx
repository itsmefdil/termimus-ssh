import { useEffect } from "react";
import { Terminal as TerminalIcon, Minimize2 } from "lucide-react";
import { useSessionStore } from "../../stores/useSessionStore";
import { findPaneById } from "../../lib/layoutTree";
import { PaneContainer } from "./PaneContainer";
import { PaneView } from "./PaneView";

interface TerminalWorkspaceProps {
  visible: boolean;
}

export function TerminalWorkspace({ visible }: TerminalWorkspaceProps) {
  const {
    tabs,
    rootPane,
    maximizedPaneId,
    toggleMaximizePane,
    isDraggingTab,
    draggedTabId,
    pointerPos,
    updateDragPos,
    endDragTab,
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
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [maximizedPaneId, toggleMaximizePane]);

  const draggedTab = draggedTabId ? tabs.find((t) => t.id === draggedTabId) : null;
  const maximizedPane =
    rootPane && maximizedPaneId ? findPaneById(rootPane, maximizedPaneId) : null;

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
        <div className="flex h-full items-center justify-center text-center text-[var(--text-muted)]">
          <div>
            <p className="text-sm font-medium">No open terminal</p>
            <p className="text-xs mt-1">Select a host to connect via SSH</p>
          </div>
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
        <PaneContainer node={rootPane} visible={visible} />
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

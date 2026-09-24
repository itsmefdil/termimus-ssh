import {
  Columns2,
  Rows2,
  Maximize2,
  Minimize2,
  X,
  Loader2,
} from "lucide-react";
import { PaneLeaf } from "../../lib/layoutTree";
import { useSessionStore } from "../../stores/useSessionStore";
import { useHostStore } from "../../stores/useHostStore";
import { XtermView } from "./XtermView";
import { DropZoneOverlay } from "./DropZoneOverlay";

interface PaneViewProps {
  pane: PaneLeaf;
  visible?: boolean;
}

export function PaneView({ pane, visible = true }: PaneViewProps) {
  const {
    tabs,
    rootPane,
    activePaneId,
    maximizedPaneId,
    focusPane,
    setPaneTab,
    closeSession,
    toggleMaximizePane,
    splitPane,
    startDragTab,
    openSession,
  } = useSessionStore();

  const hosts = useHostStore((s) => s.hosts);
  const isFocused = activePaneId === pane.id;
  const isMaximized = maximizedPaneId === pane.id;

  // The pane header is only shown when the workspace is actually split into multiple panes.
  // When there's only 1 pane (or when a pane is maximized), the top window Header acts as the sole tab bar,
  // preventing double/duplicate tab UI and maximizing terminal vertical space.
  const isSplit = rootPane?.type === "split" && !maximizedPaneId;

  const activeTab = tabs.find((t) => t.id === pane.activeTabId);
  const paneTabs = pane.tabIds
    .map((id) => tabs.find((t) => t.id === id))
    .filter(Boolean);

  const handlePointerDownTab = (
    e: React.PointerEvent<HTMLDivElement>,
    tabId: string
  ) => {
    if (e.button !== 0) return; // Only primary button

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - e.clientX;
      const dy = moveEvent.clientY - e.clientY;
      if (Math.hypot(dx, dy) > 5) {
        startDragTab(tabId, pane.id, moveEvent.clientX, moveEvent.clientY);
        cleanup();
      }
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  const handleSplitRight = async () => {
    if (!activeTab) return;
    // If pane has another tab, split that tab off to the right
    const otherTabId = pane.tabIds.find((id) => id !== pane.activeTabId);
    if (otherTabId) {
      splitPane(pane.id, otherTabId, "row", "second");
      return;
    }

    // Otherwise, duplicate current session to the same host in a right split
    const host = hosts.find((h) => h.id === activeTab.hostId);
    if (host) {
      const newSessionId = await openSession(host, false);
      splitPane(pane.id, newSessionId, "row", "second");
    }
  };

  const handleSplitDown = async () => {
    if (!activeTab) return;
    // If pane has another tab, split that tab off down
    const otherTabId = pane.tabIds.find((id) => id !== pane.activeTabId);
    if (otherTabId) {
      splitPane(pane.id, otherTabId, "column", "second");
      return;
    }

    // Otherwise, duplicate current session to the same host in a down split
    const host = hosts.find((h) => h.id === activeTab.hostId);
    if (host) {
      const newSessionId = await openSession(host, false);
      splitPane(pane.id, newSessionId, "column", "second");
    }
  };

  return (
    <div
      onClick={() => focusPane(pane.id)}
      className={`relative flex h-full w-full flex-col overflow-hidden bg-[var(--canvas)] transition-all ${
        isSplit
          ? isFocused
            ? "ring-1 ring-[var(--primary)]/70 shadow-sm"
            : "ring-1 ring-[var(--border)]/40 hover:ring-[var(--border)]"
          : ""
      }`}
    >
      {/* Pane Header — Only rendered when screen is split into multiple panes */}
      {isSplit && (
        <div
          className={`flex h-6.5 w-full shrink-0 select-none items-center justify-between border-b px-2 text-xs transition-colors ${
            isFocused
              ? "border-[var(--primary)]/30 bg-[var(--surface-container)]"
              : "border-[var(--border)] bg-[var(--canvas)]"
          }`}
        >
          {/* Left: Server info (or mini-tabs if multiple sessions docked in this single pane) */}
          <div className="flex h-full flex-1 items-center gap-1.5 overflow-x-auto py-0.5 min-w-0">
            {paneTabs.length > 1 ? (
              paneTabs.map((tab) => {
                if (!tab) return null;
                const isActiveInPane = tab.id === pane.activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPaneTab(pane.id, tab.id);
                      focusPane(pane.id);
                    }}
                    onPointerDown={(e) => handlePointerDownTab(e, tab.id)}
                    title="Drag to split screen or dock"
                    className={`group flex h-5 max-w-[150px] cursor-grab active:cursor-grabbing items-center gap-1.5 rounded px-2 text-[11px] font-mono transition-colors ${
                      isActiveInPane
                        ? isFocused
                          ? "bg-[var(--surface-high)] text-[var(--primary)] font-medium"
                          : "bg-[var(--surface-container)] text-[var(--text-primary)] font-medium"
                        : "text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {tab.connecting ? (
                      <Loader2 size={10} className="animate-spin text-[var(--primary)] shrink-0" />
                    ) : (
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          tab.connected ? "bg-[var(--primary)]" : "bg-[var(--danger)]"
                        }`}
                      />
                    )}
                    <span className="truncate">{tab.hostLabel}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        closeSession(tab.id);
                      }}
                      title="Close tab"
                      className="ml-auto rounded p-0.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-white hover:bg-[var(--danger)]/80 transition-all"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })
            ) : (
              <div
                onPointerDown={(e) => activeTab && handlePointerDownTab(e, activeTab.id)}
                title="Drag to move or split pane"
                className="flex items-center gap-2 cursor-grab active:cursor-grabbing font-mono text-[11px] truncate select-none"
              >
                {activeTab?.connecting ? (
                  <Loader2 size={11} className="animate-spin text-[var(--primary)] shrink-0" />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      activeTab?.connected ? "bg-[var(--primary)]" : "bg-[var(--danger)]"
                    }`}
                  />
                )}
                <span className="font-medium text-[var(--text-primary)] truncate">
                  {activeTab?.hostLabel || "Terminal"}
                </span>
                <span className="text-[10px] text-[var(--text-muted)] truncate hidden sm:inline">
                  {activeTab?.hostAddress}
                </span>
              </div>
            )}
          </div>

          {/* Right: Quick Split & Window Controls */}
          <div className="flex items-center gap-0.5 pl-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSplitRight();
              }}
              title="Split Right (Columns)"
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--primary)] transition-colors"
            >
              <Columns2 size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSplitDown();
              }}
              title="Split Down (Rows)"
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--primary)] transition-colors"
            >
              <Rows2 size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMaximizePane(pane.id);
              }}
              title={isMaximized ? "Restore Split View" : "Maximize Pane"}
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-[var(--primary)] transition-colors"
            >
              {isMaximized ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activeTab) {
                  closeSession(activeTab.id);
                }
              }}
              title="Close Active Terminal"
              className="flex h-5 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--danger)] hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Terminal Viewport Area */}
      <div className="relative flex-1 overflow-hidden">
        {pane.tabIds.map((tabId) => {
          const tab = tabs.find((t) => t.id === tabId);
          if (!tab) return null;
          const isTabActive = tab.id === pane.activeTabId;

          return (
            <XtermView
              key={tab.id}
              sessionId={tab.id}
              hostId={tab.hostId}
              visible={visible && isTabActive}
            />
          );
        })}

        {/* Drop Zone Overlay (Split Indicators) when a tab is dragged */}
        <DropZoneOverlay paneId={pane.id} />
      </div>
    </div>
  );
}

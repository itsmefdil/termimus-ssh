import { useEffect, useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Braces,
  Plus,
  X,
  Loader2,
  Minus,
  Square,
  Copy,
  Radio,
  Cloud,
  Columns2,
  Rows2,
  ArrowRightToLine,
  XCircle,
  CopyPlus,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useShallow } from "zustand/react/shallow";
import { useSessionStore, SshTab } from "../../stores/useSessionStore";
import { useSnippetStore } from "../../stores/useSnippetStore";
import { useSyncStore } from "../../stores/useSyncStore";
import { useHostStore } from "../../stores/useHostStore";
import { getAllSessionIdsInTree, getAllLeafPanes } from "../../lib/layoutTree";
import { QuickConnectModal } from "./QuickConnectModal";

const appWindow = getCurrentWindow();

function checkIsMac(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (window.location.search.includes("platform=mac")) return true;
  if (window.location.search.includes("platform=win")) return false;
  try {
    if (localStorage.getItem("termimus_preview_platform") === "mac") return true;
    if (localStorage.getItem("termimus_preview_platform") === "win") return false;
  } catch {
    // ignore
  }
  return /Macintosh|Mac OS X/i.test(navigator.userAgent);
}

interface HeaderProps {
  onSelectTab?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onOpenSyncSettings?: () => void;
  isTerminalActive?: boolean;
}

export function Header({
  onSelectTab,
  onToggleSidebar,
  isSidebarCollapsed,
  onOpenSyncSettings,
  isTerminalActive,
}: HeaderProps) {
  const {
    tabs,
    groups,
    activeGroupId,
    setActiveGroup,
    closeGroup,
    startDragTab,
    isDraggingTab,
    draggedTabId,
    reorderGroups,
    broadcastGroupIds,
  } = useSessionStore(
    useShallow((s) => ({
      tabs: s.tabs,
      groups: s.groups,
      activeGroupId: s.activeGroupId,
      setActiveGroup: s.setActiveGroup,
      closeGroup: s.closeGroup,
      startDragTab: s.startDragTab,
      isDraggingTab: s.isDraggingTab,
      draggedTabId: s.draggedTabId,
      reorderGroups: s.reorderGroups,
      broadcastGroupIds: s.broadcastGroupIds,
    }))
  );

  const isSnippetSidebarOpen = useSnippetStore((s) => s.isSidebarOpen);
  const toggleSnippetSidebar = useSnippetStore((s) => s.toggleSidebar);

  const [isMaximized, setIsMaximized] = useState(false);
  const [isQuickConnectOpen, setIsQuickConnectOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    groupId?: string;
  } | null>(null);
  const isMac = checkIsMac();

  const handleTabContextMenu = (e: React.MouseEvent, groupId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 300);
    setTabContextMenu({ x, y, groupId });
  };

  useEffect(() => {
    if (!tabContextMenu) return;
    const handleClose = () => setTabContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTabContextMenu(null);
    };
    window.addEventListener("pointerdown", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [tabContextMenu]);

  const targetGroup = tabContextMenu?.groupId
    ? groups.find((g) => g.id === tabContextMenu.groupId)
    : null;

  const targetPrimaryTab = targetGroup
    ? getAllSessionIdsInTree(targetGroup.rootPane)
        .map((id) => tabs.find((t) => t.id === id))
        .find(Boolean)
    : null;

  const targetHost = targetPrimaryTab
    ? useHostStore.getState().hosts.find((h) => h.id === targetPrimaryTab.hostId)
    : null;

  const isTargetBroadcast = targetGroup
    ? broadcastGroupIds.includes(targetGroup.id)
    : false;

  const handleDuplicateTab = async () => {
    if (!targetHost) return;
    await useSessionStore.getState().openSession(targetHost, true);
    onSelectTab?.();
    setTabContextMenu(null);
  };

  const handleSplitRightTab = async () => {
    if (!targetHost || !targetGroup) return;
    setActiveGroup(targetGroup.id);
    onSelectTab?.();
    const leaves = getAllLeafPanes(targetGroup.rootPane);
    if (leaves[0]) {
      const newSid = await useSessionStore.getState().openSession(targetHost, false);
      useSessionStore.getState().splitPane(leaves[0].id, newSid, "row", "second");
    }
    setTabContextMenu(null);
  };

  const handleSplitDownTab = async () => {
    if (!targetHost || !targetGroup) return;
    setActiveGroup(targetGroup.id);
    onSelectTab?.();
    const leaves = getAllLeafPanes(targetGroup.rootPane);
    if (leaves[0]) {
      const newSid = await useSessionStore.getState().openSession(targetHost, false);
      useSessionStore.getState().splitPane(leaves[0].id, newSid, "column", "second");
    }
    setTabContextMenu(null);
  };

  const handleToggleBroadcast = () => {
    if (!targetGroup) return;
    useSessionStore.getState().toggleGroupBroadcast(targetGroup.id);
    setTabContextMenu(null);
  };

  const handleCloseTab = () => {
    if (!targetGroup) return;
    closeGroup(targetGroup.id);
    setTabContextMenu(null);
  };

  const handleCloseOtherTabs = () => {
    if (!targetGroup) return;
    groups.forEach((g) => {
      if (g.id !== targetGroup.id) closeGroup(g.id);
    });
    setTabContextMenu(null);
  };

  const handleCloseTabsToRight = () => {
    if (!targetGroup) return;
    const idx = groups.findIndex((g) => g.id === targetGroup.id);
    if (idx !== -1) {
      groups.slice(idx + 1).forEach((g) => closeGroup(g.id));
    }
    setTabContextMenu(null);
  };

  const handleCloseAllTabs = () => {
    groups.forEach((g) => closeGroup(g.id));
    setTabContextMenu(null);
  };

  useEffect(() => {
    const updateWindowState = async () => {
      try {
        const [maximized, fullscreen] = await Promise.all([
          appWindow.isMaximized(),
          appWindow.isFullscreen(),
        ]);
        setIsMaximized(maximized || fullscreen);
      } catch {
        // ignore
      }
    };

    updateWindowState();
    const unlistenPromise = appWindow.onResized(() => {
      updateWindowState();
    });

    // Global Ctrl+K / Cmd+K listener
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsQuickConnectOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown);

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  async function handleMinimize() {
    try {
      await appWindow.minimize();
    } catch {
      // ignore
    }
  }

  async function handleToggleMaximize() {
    try {
      const isFs = await appWindow.isFullscreen();
      if (isFs) {
        await appWindow.setFullscreen(false);
      } else {
        await appWindow.toggleMaximize();
      }
    } catch {
      // ignore
    }
  }

  async function handleClose() {
    try {
      await appWindow.close();
    } catch {
      // ignore
    }
  }

  const handlePointerDownTab = (
    e: React.PointerEvent<HTMLDivElement>,
    tabId: string
  ) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let hasStartedDrag = false;

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!hasStartedDrag && Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY) > 5) {
        hasStartedDrag = true;
        startDragTab(tabId, null, moveEv.clientX, moveEv.clientY);
        onSelectTab?.(); // switch to terminal workspace so drop zones appear
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

  return (
    <>
      <QuickConnectModal
        isOpen={isQuickConnectOpen}
        onClose={() => setIsQuickConnectOpen(false)}
        onConnect={onSelectTab}
      />

      <header
        data-tauri-drag-region="deep"
        className="flex h-9 w-full select-none items-center bg-[var(--canvas)] border-b border-[var(--border)]"
      >
        {isMac ? (
          <>
            {/* SVG Gradients for Retina/HD macOS Window Controls */}
            <svg width="0" height="0" className="absolute pointer-events-none">
              <defs>
                <linearGradient id="mac-grad-close" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6159" />
                  <stop offset="100%" stopColor="#E0443E" />
                </linearGradient>
                <linearGradient id="mac-grad-min" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FFBD2E" />
                  <stop offset="100%" stopColor="#DEA123" />
                </linearGradient>
                <linearGradient id="mac-grad-max" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#28C940" />
                  <stop offset="100%" stopColor="#1B9A31" />
                </linearGradient>
              </defs>
            </svg>

            {/* macOS Window Controls (Traffic Lights) */}
            <div
              data-tauri-drag-region="false"
              className="group/traffic flex items-center gap-2 pl-3.5 pr-3 shrink-0"
            >
              {/* Close (Red) */}
              <button
                onClick={handleClose}
                title="Close"
                className="relative flex h-3 w-3 items-center justify-center rounded-full focus:outline-none active:brightness-90 transition"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className="h-3 w-3 overflow-visible pointer-events-none"
                  shapeRendering="geometricPrecision"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="5.75"
                    fill="url(#mac-grad-close)"
                    stroke="rgba(0, 0, 0, 0.2)"
                    strokeWidth="0.5"
                  />
                  <g
                    className="opacity-0 group-hover/traffic:opacity-100 transition-opacity"
                    stroke="#4C0000"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  >
                    <line x1="3.75" y1="3.75" x2="8.25" y2="8.25" />
                    <line x1="8.25" y1="3.75" x2="3.75" y2="8.25" />
                  </g>
                </svg>
              </button>

              {/* Minimize (Yellow) */}
              <button
                onClick={handleMinimize}
                title="Minimize"
                className="relative flex h-3 w-3 items-center justify-center rounded-full focus:outline-none active:brightness-90 transition"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className="h-3 w-3 overflow-visible pointer-events-none"
                  shapeRendering="geometricPrecision"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="5.75"
                    fill="url(#mac-grad-min)"
                    stroke="rgba(0, 0, 0, 0.2)"
                    strokeWidth="0.5"
                  />
                  <line
                    x1="3.25"
                    y1="6"
                    x2="8.75"
                    y2="6"
                    className="opacity-0 group-hover/traffic:opacity-100 transition-opacity"
                    stroke="#5C4300"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>

              {/* Maximize / Zoom (Green) */}
              <button
                onClick={handleToggleMaximize}
                title={isMaximized ? "Restore" : "Zoom"}
                className="relative flex h-3 w-3 items-center justify-center rounded-full focus:outline-none active:brightness-90 transition"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  className="h-3 w-3 overflow-visible pointer-events-none"
                  shapeRendering="geometricPrecision"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="5.75"
                    fill="url(#mac-grad-max)"
                    stroke="rgba(0, 0, 0, 0.2)"
                    strokeWidth="0.5"
                  />
                  {isMaximized ? (
                    <path
                      d="M4 4L8 8 M6.5 4H4V6.5 M5.5 8H8V5.5"
                      className="opacity-0 group-hover/traffic:opacity-100 transition-opacity"
                      stroke="#004D11"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : (
                    <path
                      d="M8 4L4 8 M5.5 4H8V6.5 M6.5 8H4V5.5"
                      className="opacity-0 group-hover/traffic:opacity-100 transition-opacity"
                      stroke="#004D11"
                      strokeWidth="1.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </button>
            </div>

            {/* Brand Logo & Sidebar Toggle Button */}
            <div className="flex h-full items-center gap-1 pr-1 shrink-0">
              <img
                src="/logo.png"
                alt="Termimus"
                title="Termimus"
                className="h-5 w-5 rounded object-contain pointer-events-none"
              />
              <button
                data-tauri-drag-region="false"
                onClick={onToggleSidebar}
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen size={15} />
                ) : (
                  <PanelLeftClose size={15} />
                )}
              </button>
            </div>
          </>
        ) : (
          /* Windows / Linux: Brand Logo & Sidebar Toggle Button on Far Left */
          <div className="flex h-full items-center gap-1 pl-2.5 pr-1 shrink-0">
            <img
              src="/logo.png"
              alt="Termimus"
              title="Termimus"
              className="h-5 w-5 rounded object-contain pointer-events-none"
            />
            <button
              data-tauri-drag-region="false"
              onClick={onToggleSidebar}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors"
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen size={15} />
              ) : (
                <PanelLeftClose size={15} />
              )}
            </button>
          </div>
        )}

        <div className="h-4 w-[1px] bg-[var(--border)] shrink-0 mx-1" />

        {/* Tabs Row (Each tab represents a Workspace / Split Screen Group) */}
        <div
          data-tauri-drag-region
          onContextMenu={(e) => handleTabContextMenu(e)}
          className={`flex h-full ${
            isMac ? "max-w-[calc(100%-120px)]" : "max-w-[calc(100%-180px)]"
          } shrink-0 items-center gap-1 overflow-x-auto px-1`}
        >
          {groups.map((group) => {
            const sessionIds = getAllSessionIdsInTree(group.rootPane);
            const groupTabs = sessionIds
              .map((id) => tabs.find((t) => t.id === id))
              .filter(Boolean) as SshTab[];

            if (groupTabs.length === 0) return null;

            const isActive = group.id === activeGroupId;
            const primaryTab = groupTabs[0];
            const count = groupTabs.length;

            const isConnecting = groupTabs.some((t) => t.connecting);
            const isConnected = groupTabs.every((t) => t.connected);

            // e.g. "Web Server (2)" when split into 2 terminals!
            const displayLabel =
              count > 1 ? `${primaryTab.hostLabel} (${count})` : primaryTab.hostLabel;

            return (
              <div
                key={group.id}
                data-tauri-drag-region="false"
                onContextMenu={(e) => handleTabContextMenu(e, group.id)}
                onClick={() => {
                  setActiveGroup(group.id);
                  onSelectTab?.();
                }}
                onPointerDown={(e) => handlePointerDownTab(e, primaryTab.id)}
                onPointerEnter={() => {
                  if (isDraggingTab && draggedTabId) {
                    const sourceGroup = groups.find((g) =>
                      getAllSessionIdsInTree(g.rootPane).includes(draggedTabId)
                    );
                    if (sourceGroup && sourceGroup.id !== group.id) {
                      reorderGroups(sourceGroup.id, group.id);
                    }
                  }
                }}
                title={
                  count > 1
                    ? `${displayLabel} — ${count} terminals in split screen. Drag to split or reorder.`
                    : "Drag to split screen or reorder"
                }
                className={`group flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-mono min-w-[120px] max-w-[210px] cursor-grab active:cursor-grabbing transition-colors ${
                  isActive
                    ? "bg-[var(--surface-high)] text-[var(--primary)] font-medium border-b border-[var(--primary)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
                }`}
              >
                {isConnecting ? (
                  <Loader2 size={11} className="animate-spin text-[var(--primary)] shrink-0" />
                ) : (
                  <span
                    className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      isConnected ? "bg-[var(--primary)]" : "bg-[var(--danger)]"
                    }`}
                  />
                )}
                <span className="truncate">{displayLabel}</span>
                {broadcastGroupIds.includes(group.id) && (
                  <span title="Input Broadcast Active (Interconnected)" className="flex items-center">
                    <Radio
                      size={11}
                      className="text-[var(--primary)] animate-pulse shrink-0"
                    />
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeGroup(group.id);
                  }}
                  title="Close tab group"
                  className="ml-auto rounded p-0.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--text-primary)] transition-opacity"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

          {/* Plus '+' Button: Clean & Seamless */}
          <button
            data-tauri-drag-region="false"
            onClick={() => setIsQuickConnectOpen(true)}
            title={`New connection / Quick connect (${isMac ? "⌘K" : "Ctrl+K"})`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Drag region filler */}
        <div data-tauri-drag-region className="h-full flex-1 cursor-default" />

        {/* Snippets Right Sidebar Collapse/Expand Toggle Button (Visible when Terminal is active) */}
        {isTerminalActive && (
          <button
            data-tauri-drag-region="false"
            onClick={toggleSnippetSidebar}
            title={
              isSnippetSidebarOpen
                ? "Collapse snippets sidebar (Alt+S)"
                : "Expand snippets sidebar (Alt+S)"
            }
            className={`flex h-7 items-center gap-1.5 rounded-md px-2 mr-1 text-[11px] font-mono transition-colors ${
              isSnippetSidebarOpen
                ? "text-[var(--primary)] bg-[var(--primary)]/15 border border-[var(--primary)]/30 font-medium"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)]"
            }`}
          >
            <Braces size={13} className={isSnippetSidebarOpen ? "text-[var(--primary)]" : ""} />
            <span className="hidden sm:inline">Snippets</span>
            {isSnippetSidebarOpen ? (
              <PanelRightClose size={13} className="opacity-70" />
            ) : (
              <PanelRightOpen size={13} className="opacity-70" />
            )}
          </button>
        )}

        {/* Sync Status Indicator */}
        <HeaderSyncIndicator onOpenSyncSettings={onOpenSyncSettings} />

        {/* Windows / Linux Window Controls (Omitted on macOS) */}
        {!isMac && (
          <div data-tauri-drag-region="false" className="flex h-full items-stretch shrink-0">
            <button
              onClick={handleMinimize}
              title="Minimize"
              className="flex w-11 items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={handleToggleMaximize}
              title={isMaximized ? "Restore" : "Maximize"}
              className="flex w-11 items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors"
            >
              {isMaximized ? <Copy size={12} /> : <Square size={12} />}
            </button>
            <button
              onClick={handleClose}
              title="Close"
              className="flex w-11 items-center justify-center text-[var(--text-muted)] hover:bg-[var(--danger)] hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </header>

      {/* Top Bar Tabs Right-Click Context Menu */}
      {tabContextMenu && (
        <div
          className="fixed z-50 min-w-[210px] rounded-xl border border-[var(--border)] bg-[var(--surface-high)]/95 p-1 text-xs text-[var(--text-primary)] shadow-2xl backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-75"
          style={{ left: `${tabContextMenu.x}px`, top: `${tabContextMenu.y}px` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {targetGroup ? (
            <>
              {/* Duplicate Tab */}
              <button
                onClick={handleDuplicateTab}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <CopyPlus size={13} />
                  <span>Duplicate Tab</span>
                </div>
              </button>

              {/* Split Screen Right */}
              <button
                onClick={handleSplitRightTab}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Columns2 size={13} />
                  <span>Split Screen (Right)</span>
                </div>
              </button>

              {/* Split Screen Down */}
              <button
                onClick={handleSplitDownTab}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Rows2 size={13} />
                  <span>Split Screen (Down)</span>
                </div>
              </button>

              {/* Toggle Input Broadcast Sync */}
              <button
                onClick={handleToggleBroadcast}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Radio size={13} className={isTargetBroadcast ? "animate-pulse" : ""} />
                  <span>{isTargetBroadcast ? "Disconnect Input Sync" : "Sync All Panes"}</span>
                </div>
                <span className="text-[10px] font-mono text-[var(--text-muted)] group-hover:text-black/70">
                  Alt+B
                </span>
              </button>

              <div className="my-1 h-[1px] bg-[var(--border)]" />

              {/* Close Tab */}
              <button
                onClick={handleCloseTab}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--danger)] hover:text-white transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <X size={13} />
                  <span>Close Tab</span>
                </div>
              </button>

              {/* Close Other Tabs */}
              {groups.length > 1 && (
                <button
                  onClick={handleCloseOtherTabs}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <XCircle size={13} />
                    <span>Close Other Tabs</span>
                  </div>
                </button>
              )}

              {/* Close Tabs to the Right */}
              {groups.findIndex((g) => g.id === targetGroup.id) < groups.length - 1 && (
                <button
                  onClick={handleCloseTabsToRight}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <ArrowRightToLine size={13} />
                    <span>Close Tabs to the Right</span>
                  </div>
                </button>
              )}

              <div className="my-1 h-[1px] bg-[var(--border)]" />
            </>
          ) : null}

          {/* New Connection / Quick Connect */}
          <button
            onClick={() => {
              setIsQuickConnectOpen(true);
              setTabContextMenu(null);
            }}
            className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
          >
            <div className="flex items-center gap-2">
              <Plus size={13} />
              <span>New Connection</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)] group-hover:text-black/70">
              {isMac ? "⌘K" : "Ctrl+K"}
            </span>
          </button>

          {/* Close All Tabs (when clicking empty space and tabs exist) */}
          {!targetGroup && groups.length > 0 && (
            <button
              onClick={handleCloseAllTabs}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-[var(--danger)] hover:text-white transition-colors group"
            >
              <div className="flex items-center gap-2">
                <XCircle size={13} />
                <span>Close All Tabs</span>
              </div>
            </button>
          )}
        </div>
      )}
    </>
  );
}

function HeaderSyncIndicator({ onOpenSyncSettings }: { onOpenSyncSettings?: () => void }) {
  const syncStatus = useSyncStore((s) => s.syncStatus);
  const serverUrl = useSyncStore((s) => s.serverUrl);
  const latestServerVersion = useSyncStore((s) => s.latestServerVersion);
  const lastError = useSyncStore((s) => s.lastError);

  if (!serverUrl) return null;

  return (
    <button
      data-tauri-drag-region="false"
      onClick={onOpenSyncSettings}
      title={
        syncStatus === "syncing"
          ? "Syncing data with relay..."
          : syncStatus === "connected"
          ? `Relay Connected (Rev #${latestServerVersion ?? 0}) • Click to open Sync Settings`
          : syncStatus === "error"
          ? `Sync Error: ${lastError ?? "Connection failed"} • Click to check settings`
          : "Sync Relay Configured • Click to open Sync Settings"
      }
      className={`flex h-7 items-center gap-1.5 rounded-md px-2 mr-1 text-[11px] font-mono transition-colors ${
        syncStatus === "syncing"
          ? "text-[var(--primary)] bg-[var(--primary)]/10"
          : syncStatus === "connected"
          ? "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)]"
          : syncStatus === "error"
          ? "text-[var(--danger)] bg-[var(--danger)]/10"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-container)]"
      }`}
    >
      {syncStatus === "syncing" ? (
        <Loader2 size={13} className="animate-spin text-[var(--primary)]" />
      ) : syncStatus === "connected" ? (
        <div className="relative flex items-center justify-center">
          <Cloud size={14} className="text-[var(--primary)]" />
          <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
        </div>
      ) : syncStatus === "error" ? (
        <div className="relative flex items-center justify-center">
          <Cloud size={14} className="text-[var(--danger)]" />
          <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
        </div>
      ) : (
        <Cloud size={14} className="opacity-60" />
      )}
      <span className="hidden xl:inline text-[10px] uppercase font-semibold tracking-wider">
        {syncStatus === "syncing" ? "Syncing" : syncStatus === "connected" ? "Synced" : syncStatus === "error" ? "Sync Err" : "Sync"}
      </span>
    </button>
  );
}

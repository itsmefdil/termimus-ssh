import { useEffect, useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  X,
  Loader2,
  Minus,
  Square,
  Copy,
  Radio,
} from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSessionStore, SshTab } from "../../stores/useSessionStore";
import { getAllSessionIdsInTree } from "../../lib/layoutTree";
import { QuickConnectModal } from "./QuickConnectModal";

const appWindow = getCurrentWindow();

interface HeaderProps {
  onSelectTab?: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export function Header({ onSelectTab, onToggleSidebar, isSidebarCollapsed }: HeaderProps) {
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
  } = useSessionStore();

  const [isMaximized, setIsMaximized] = useState(false);
  const [isQuickConnectOpen, setIsQuickConnectOpen] = useState(false);

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized).catch(() => {});
    const unlistenPromise = appWindow.onResized(() => {
      appWindow.isMaximized().then(setIsMaximized).catch(() => {});
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
      await appWindow.toggleMaximize();
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
        {/* Brand Logo & Sidebar Toggle Button */}
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

        <div className="h-4 w-[1px] bg-[var(--border)] shrink-0 mx-1" />

        {/* Tabs Row (Each tab represents a Workspace / Split Screen Group) */}
        <div
          data-tauri-drag-region
          className="flex h-full max-w-[calc(100%-180px)] shrink-0 items-center gap-1 overflow-x-auto px-1"
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
            title="New connection / Quick connect (Ctrl+K)"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Drag region filler */}
        <div data-tauri-drag-region className="h-full flex-1 cursor-default" />

        {/* Window Controls */}
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
      </header>
    </>
  );
}

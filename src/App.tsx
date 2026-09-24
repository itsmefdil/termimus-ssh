import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { useVaultStore } from "./stores/useVaultStore";
import { useHostStore } from "./stores/useHostStore";
import { useSessionStore } from "./stores/useSessionStore";
import { useSnippetStore } from "./stores/useSnippetStore";
import { useTunnelStore } from "./stores/useTunnelStore";
import { Sidebar, ActiveTab } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { ResizeHandles } from "./components/layout/ResizeHandles";
import { HostList } from "./components/hosts/HostList";
import { HostModal } from "./components/hosts/HostModal";
import { VaultModal } from "./components/vault/VaultModal";
import { TerminalWorkspace } from "./components/terminal/TerminalWorkspace";
import { WorkspaceView } from "./components/workspaces/WorkspaceView";
import { SftpView } from "./components/sftp/SftpView";
import { TunnelView } from "./components/tunnels/TunnelView";
import { SnippetView } from "./components/snippets/SnippetView";
import { KeychainView } from "./components/keychain/KeychainView";
import { ConfirmModal } from "./components/layout/ConfirmModal";
import { SettingsView } from "./components/settings/SettingsView";
import { useKeychainStore } from "./stores/useKeychainStore";
import { useAutoLock } from "./hooks/useAutoLock";

// Helper component for native-feel stacked views:
// Keeps views mounted in the DOM once visited, switching visibility in 0ms
// with zero unmount cost, zero redundant IPC fetches, and perfect scroll/input preservation.
function PageView({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{
        visibility: active ? "visible" : "hidden",
        pointerEvents: active ? "auto" : "none",
        zIndex: active ? 5 : 0,
      }}
    >
      {children}
    </div>
  );
}

// Below this window width, the sidebar auto-collapses to give the main
// content area enough room (independent of the user's manual toggle).
const AUTO_COLLAPSE_WIDTH = 820;

function App() {
  const [activeNav, setActiveNav] = useState<ActiveTab>("hosts");
  const [visitedTabs, setVisitedTabs] = useState<Set<ActiveTab>>(() => new Set(["hosts"]));
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("termimus_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [isNarrowWindow, setIsNarrowWindow] = useState(
    () => window.innerWidth < AUTO_COLLAPSE_WIDTH
  );

  const { isUnlocked, refresh: refreshVault } = useVaultStore();
  const { refresh: refreshHosts } = useHostStore();
  const { refresh: refreshKeychain } = useKeychainStore();
  const { activeTabId, activeGroupId } = useSessionStore();

  const handleNavChange = useCallback((tab: ActiveTab) => {
    setActiveNav(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  // Active auto-lock watcher based on user settings (idle timer, focus loss, on-close).
  useAutoLock();

  // Enforce small minimum window size (480x360) so users can snap/tile to half screen
  // on sub-1080p displays (e.g. 1366x768 half is 683px, 1280x800 half is 640px).
  useEffect(() => {
    getCurrentWindow()
      .setMinSize(new LogicalSize(480, 360))
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  useEffect(() => {
    if (isUnlocked) {
      // Preload all domain data in parallel on unlock so sidebar badges and tabs
      // are instantly available with zero spinner delay.
      refreshHosts();
      refreshKeychain();
      useSnippetStore.getState().refresh();
      useTunnelStore.getState().refresh();
    }
  }, [isUnlocked, refreshHosts, refreshKeychain]);

  useEffect(() => {
    try {
      localStorage.setItem("termimus_sidebar_collapsed", String(isSidebarCollapsed));
    } catch {
      // ignore
    }
  }, [isSidebarCollapsed]);

  // Auto-collapse the sidebar once the window gets too narrow, so the main
  // content area (terminal, SFTP panes, etc) always keeps usable width.
  useEffect(() => {
    function handleWindowResize() {
      setIsNarrowWindow(window.innerWidth < AUTO_COLLAPSE_WIDTH);
    }
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  // When a new tab/group is opened, automatically switch to the terminal view
  useEffect(() => {
    if (activeGroupId || activeTabId) {
      handleNavChange("terminal");
    }
  }, [activeGroupId, activeTabId, handleNavChange]);

  const showTerminal = activeNav === "terminal";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--canvas)] text-[var(--text-primary)]">
      {/* Invisible edge/corner handles restoring OS resize cursors on this frameless window */}
      <ResizeHandles />

      {/* Top Unified Frameless Window Bar (Termius-style: Menu + Tabs + Window Controls) */}
      <Header
        onSelectTab={() => handleNavChange("terminal")}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Obsidian Sidebar — collapses if the user toggled it manually,
            or automatically once the window is too narrow to fit it comfortably. */}
        <Sidebar
          activeNav={activeNav}
          onNavChange={handleNavChange}
          isCollapsed={isSidebarCollapsed || isNarrowWindow}
        />

        {/* Viewport Content Area */}
        <main className="relative flex flex-1 overflow-hidden bg-[var(--canvas)]">
          {/* Terminal sessions stay mounted and retain their layout geometry (never collapse to 0x0),
              preventing bogus SIGWINCH resize events (which breaks htop/curses TUIs). */}
          <TerminalWorkspace
            visible={showTerminal}
            onOpenWorkspaces={() => handleNavChange("workspaces")}
          />

          {/* Lazy-mounted Native-Grade Keep-Alive Views:
              Each view is mounted on first visit and preserved across tab switches.
              Switches happen in 0ms (1 frame), scroll positions are remembered,
              and inputs/folder drill-downs stay intact. */}
          {visitedTabs.has("workspaces") && (
            <PageView active={activeNav === "workspaces"}>
              <WorkspaceView onOpenTerminal={() => handleNavChange("terminal")} />
            </PageView>
          )}

          {visitedTabs.has("hosts") && (
            <PageView active={activeNav === "hosts"}>
              <HostList
                onOpenSftp={() => handleNavChange("sftp")}
                onOpenTunnels={() => handleNavChange("tunnels")}
              />
            </PageView>
          )}

          {visitedTabs.has("sftp") && (
            <PageView active={activeNav === "sftp"}>
              <SftpView />
            </PageView>
          )}

          {visitedTabs.has("keychain") && (
            <PageView active={activeNav === "keychain"}>
              <KeychainView />
            </PageView>
          )}

          {visitedTabs.has("tunnels") && (
            <PageView active={activeNav === "tunnels"}>
              <TunnelView />
            </PageView>
          )}

          {visitedTabs.has("snippets") && (
            <PageView active={activeNav === "snippets"}>
              <SnippetView />
            </PageView>
          )}

          {visitedTabs.has("settings") && (
            <PageView active={activeNav === "settings"}>
              <SettingsView />
            </PageView>
          )}
        </main>
      </div>

      {/* Vault Setup/Unlock Modal */}
      <VaultModal />

      {/* Host Create/Edit Modal */}
      <HostModal onOpenKeychain={() => handleNavChange("keychain")} />

      {/* App-wide Delete & Action Confirmation Modal */}
      <ConfirmModal />
    </div>
  );
}

export default App;

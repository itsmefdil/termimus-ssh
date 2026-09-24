import { useEffect, useState } from "react";
import { useVaultStore } from "./stores/useVaultStore";
import { useHostStore } from "./stores/useHostStore";
import { useSessionStore } from "./stores/useSessionStore";
import { Sidebar, ActiveTab } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { ResizeHandles } from "./components/layout/ResizeHandles";
import { HostList } from "./components/hosts/HostList";
import { HostModal } from "./components/hosts/HostModal";
import { VaultModal } from "./components/vault/VaultModal";
import { TerminalWorkspace } from "./components/terminal/TerminalWorkspace";
import { SftpView } from "./components/sftp/SftpView";
import { TunnelView } from "./components/tunnels/TunnelView";
import { SnippetView } from "./components/snippets/SnippetView";
import { KeychainView } from "./components/keychain/KeychainView";
import { ConfirmModal } from "./components/layout/ConfirmModal";
import { SettingsView } from "./components/settings/SettingsView";
import { useKeychainStore } from "./stores/useKeychainStore";
import { useAutoLock } from "./hooks/useAutoLock";

// Below this window width, the sidebar auto-collapses to give the main
// content area enough room (independent of the user's manual toggle).
const AUTO_COLLAPSE_WIDTH = 820;

function App() {
  const [activeNav, setActiveNav] = useState<ActiveTab>("hosts");
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

  // Active auto-lock watcher based on user settings (idle timer, focus loss, on-close).
  useAutoLock();

  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  useEffect(() => {
    if (isUnlocked) {
      refreshHosts();
      refreshKeychain();
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
      setActiveNav("terminal");
    }
  }, [activeGroupId, activeTabId]);

  const showTerminal = activeNav === "terminal";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--canvas)] text-[var(--text-primary)]">
      {/* Invisible edge/corner handles restoring OS resize cursors on this frameless window */}
      <ResizeHandles />

      {/* Top Unified Frameless Window Bar (Termius-style: Menu + Tabs + Window Controls) */}
      <Header
        onSelectTab={() => setActiveNav("terminal")}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Obsidian Sidebar — collapses if the user toggled it manually,
            or automatically once the window is too narrow to fit it comfortably. */}
        <Sidebar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          isCollapsed={isSidebarCollapsed || isNarrowWindow}
        />

        {/* Viewport Content Area */}
        <main className="relative flex flex-1 overflow-hidden bg-[var(--canvas)]">
          {/* Terminal sessions stay mounted and retain their layout geometry (never collapse to 0x0),
              preventing bogus SIGWINCH resize events (which breaks htop/curses TUIs). */}
          <TerminalWorkspace visible={showTerminal} />

          {activeNav === "hosts" && (
            <HostList
              onOpenSftp={() => setActiveNav("sftp")}
              onOpenTunnels={() => setActiveNav("tunnels")}
            />
          )}

          {activeNav === "sftp" && <SftpView />}

          {activeNav === "keychain" && <KeychainView />}

          {activeNav === "tunnels" && <TunnelView />}

          {activeNav === "snippets" && <SnippetView />}

          {activeNav === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Vault Setup/Unlock Modal */}
      <VaultModal />

      {/* Host Create/Edit Modal */}
      <HostModal onOpenKeychain={() => setActiveNav("keychain")} />

      {/* App-wide Delete & Action Confirmation Modal */}
      <ConfirmModal />
    </div>
  );
}

export default App;

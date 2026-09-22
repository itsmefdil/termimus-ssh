import { useEffect, useState } from "react";
import { useVaultStore } from "./stores/useVaultStore";
import { useHostStore } from "./stores/useHostStore";
import { useSessionStore } from "./stores/useSessionStore";
import { Sidebar, ActiveTab } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { HostList } from "./components/hosts/HostList";
import { HostModal } from "./components/hosts/HostModal";
import { VaultModal } from "./components/vault/VaultModal";
import { XtermView } from "./components/terminal/XtermView";
import { SftpView } from "./components/sftp/SftpView";
import { TunnelView } from "./components/tunnels/TunnelView";
import { SnippetView } from "./components/snippets/SnippetView";
import { VaultOverview } from "./components/vault/VaultOverview";

function App() {
  const [activeNav, setActiveNav] = useState<ActiveTab>("hosts");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("termimus_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const { isUnlocked, refresh: refreshVault } = useVaultStore();
  const { refresh: refreshHosts } = useHostStore();
  const { tabs, activeTabId } = useSessionStore();

  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  useEffect(() => {
    if (isUnlocked) {
      refreshHosts();
    }
  }, [isUnlocked, refreshHosts]);

  useEffect(() => {
    try {
      localStorage.setItem("termimus_sidebar_collapsed", String(isSidebarCollapsed));
    } catch {
      // ignore
    }
  }, [isSidebarCollapsed]);

  // When a new tab is opened, automatically switch to the terminal view
  useEffect(() => {
    if (activeTabId) {
      setActiveNav("terminal");
    }
  }, [activeTabId]);

  const showTerminal = activeNav === "terminal";

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--canvas)] text-[var(--text-primary)]">
      {/* Top Unified Frameless Window Bar (Termius-style: Menu + Tabs + Window Controls) */}
      <Header
        onSelectTab={() => setActiveNav("terminal")}
        onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        isSidebarCollapsed={isSidebarCollapsed}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Obsidian Sidebar */}
        <Sidebar
          activeNav={activeNav}
          onNavChange={setActiveNav}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Viewport Content Area */}
        <main className="relative flex flex-1 overflow-hidden bg-[var(--canvas)]">
          {/* Terminal sessions stay mounted and retain their layout geometry (never collapse to 0x0),
              preventing bogus SIGWINCH resize events (which breaks htop/curses TUIs). */}
          <div
            className="absolute inset-0"
            style={{
              visibility: showTerminal ? "visible" : "hidden",
              pointerEvents: showTerminal ? "auto" : "none",
              zIndex: showTerminal ? 10 : 0,
            }}
          >
            {tabs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-[var(--text-muted)]">
                <div>
                  <p className="text-sm font-medium">No open terminal</p>
                  <p className="text-xs mt-1">Select a host to connect via SSH</p>
                </div>
              </div>
            ) : (
              tabs.map((tab) => (
                <XtermView
                  key={tab.id}
                  sessionId={tab.id}
                  hostId={tab.hostId}
                  visible={showTerminal && tab.id === activeTabId}
                />
              ))
            )}
          </div>

          {activeNav === "hosts" && (
            <HostList
              onOpenSftp={() => setActiveNav("sftp")}
              onOpenTunnels={() => setActiveNav("tunnels")}
            />
          )}

          {activeNav === "sftp" && <SftpView />}

          {activeNav === "tunnels" && <TunnelView />}

          {activeNav === "snippets" && <SnippetView />}

          {activeNav === "vault" && <VaultOverview />}
        </main>
      </div>

      {/* Vault Setup/Unlock Modal */}
      <VaultModal />

      {/* Host Create/Edit Modal */}
      <HostModal />
    </div>
  );
}

export default App;

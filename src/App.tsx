import { useState, useEffect } from "react";
import {
  Server,
  FolderTree,
  Key,
  Terminal,
  ArrowLeftRight,
  Settings,
  Lock,
} from "lucide-react";
import { useVaultStore } from "./stores/useVaultStore";
import { useHostStore } from "./stores/useHostStore";
import { useSessionStore } from "./stores/useSessionStore";
import { HostList } from "./components/hosts/HostList";
import { HostModal } from "./components/hosts/HostModal";
import { VaultModal } from "./components/vault/VaultModal";
import { TabBar } from "./components/terminal/TabBar";
import { XtermView } from "./components/terminal/XtermView";
import { SftpView } from "./components/sftp/SftpView";

type ActiveTab = "hosts" | "sftp" | "tunnels" | "vault" | "snippets";

const NAV_ITEMS: { icon: typeof Server; label: string; id: ActiveTab }[] = [
  { icon: Server, label: "Hosts", id: "hosts" },
  { icon: FolderTree, label: "SFTP", id: "sftp" },
  { icon: ArrowLeftRight, label: "Port Forwarding", id: "tunnels" },
  { icon: Key, label: "Vault", id: "vault" },
  { icon: Terminal, label: "Snippets", id: "snippets" },
];

function App() {
  const [activeNav, setActiveNav] = useState<ActiveTab>("hosts");
  const { isUnlocked, refresh: refreshVault, lock: lockVault } = useVaultStore();
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
      {/* Vault Setup/Unlock Modal */}
      <VaultModal />

      {/* Host Create/Edit Modal */}
      <HostModal />

      {/* Left Icon Rail */}
      <aside className="flex w-14 flex-col items-center gap-1 border-r border-[var(--border)] bg-[var(--sidebar)] py-3">
        {NAV_ITEMS.map(({ icon: Icon, label, id }) => {
          const active = activeNav === id;
          return (
            <button
              key={id}
              onClick={() => setActiveNav(id)}
              title={label}
              className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--card)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon size={18} />
            </button>
          );
        })}
        <div className="mt-auto flex flex-col gap-1">
          {isUnlocked && (
            <button
              onClick={lockVault}
              title="Lock Vault"
              className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--card)] hover:text-[var(--warning)]"
            >
              <Lock size={18} />
            </button>
          )}
          <button
            title="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--card)] hover:text-[var(--text-primary)]"
          >
            <Settings size={18} />
          </button>
        </div>
      </aside>

      {/* Conditional Content based on Active Nav */}
      {activeNav === "sftp" ? (
        <div className="flex flex-1 overflow-hidden">
          <SftpView />
        </div>
      ) : (
        <>
          {/* Host Explorer Sidebar */}
          <HostList />

          {/* Main Terminal Area */}
          <main className="flex flex-1 flex-col overflow-hidden bg-[var(--background)]">
            <TabBar />

            <div className="relative flex-1 overflow-hidden">
              {tabs.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center text-[var(--text-muted)]">
                    <Terminal size={44} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No open terminal</p>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Select a host from the sidebar to connect via SSH
                    </p>
                  </div>
                </div>
              ) : (
                tabs.map((tab) => (
                  <XtermView
                    key={tab.id}
                    sessionId={tab.id}
                    hostId={tab.hostId}
                    visible={tab.id === activeTabId}
                  />
                ))
              )}
            </div>
          </main>
        </>
      )}
    </div>
  );
}

export default App;

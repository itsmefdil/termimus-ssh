import { useState, useEffect } from "react";
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
import { KeyRound, ShieldCheck, Lock } from "lucide-react";

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

  // When a tab is opened, automatically switch to hosts view to display terminal
  useEffect(() => {
    if (activeTabId && tabs.length > 0) {
      setActiveNav("hosts");
    }
  }, [activeTabId, tabs.length]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--canvas)] text-[var(--text-primary)]">
      {/* Vault Setup/Unlock Modal */}
      <VaultModal />

      {/* Host Create/Edit Modal */}
      <HostModal />

      {/* Left Obsidian Sidebar */}
      <Sidebar activeNav={activeNav} onNavChange={setActiveNav} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <Header />

        {/* Viewport Switching */}
        <main className="flex flex-1 overflow-hidden bg-[var(--canvas)]">
          {activeNav === "sftp" ? (
            <SftpView />
          ) : activeNav === "tunnels" ? (
            <TunnelView />
          ) : activeNav === "snippets" ? (
            <SnippetView />
          ) : activeNav === "vault" ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
              <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-low)] p-6 shadow-xl">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--tertiary)]/15 text-[var(--tertiary)]">
                  <KeyRound size={24} />
                </div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  Zero-Knowledge Security Vault
                </h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  All passwords and SSH private keys are locally protected with Argon2id key derivation and AES-256-GCM encryption.
                </p>
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] p-3 text-left font-mono text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Vault Status:</span>
                    <span className="text-[var(--primary)] font-semibold flex items-center gap-1">
                      <ShieldCheck size={14} /> Unlocked & Active
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Cipher:</span>
                    <span className="text-[var(--text-primary)]">AES-256-GCM (96-bit nonce)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Key Derivation:</span>
                    <span className="text-[var(--text-primary)]">Argon2id (16-byte OS salt)</span>
                  </div>
                </div>
                <button
                  onClick={lockVault}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--surface-high)] py-2 text-xs font-semibold text-[var(--warning)] hover:bg-[var(--surface-highest)] transition-colors"
                >
                  <Lock size={14} /> Lock Vault Now
                </button>
              </div>
            </div>
          ) : (
            // Default "hosts" view: If active session is selected, render terminal; otherwise render Host Explorer
            tabs.length > 0 && activeTabId ? (
              <div className="relative flex-1 overflow-hidden bg-[var(--canvas)]">
                {tabs.map((tab) => (
                  <XtermView
                    key={tab.id}
                    sessionId={tab.id}
                    hostId={tab.hostId}
                    visible={tab.id === activeTabId}
                  />
                ))}
              </div>
            ) : (
              <HostList
                onOpenSftp={() => setActiveNav("sftp")}
                onOpenTunnels={() => setActiveNav("tunnels")}
              />
            )
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

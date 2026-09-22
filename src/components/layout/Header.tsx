import { useState } from "react";
import { Zap, Search, User, X, Loader2 } from "lucide-react";
import { useSessionStore } from "../../stores/useSessionStore";
import { useHostStore } from "../../stores/useHostStore";
import { Host } from "../../lib/api";

interface HeaderProps {
  onSelectTab?: () => void;
}

export function Header({ onSelectTab }: HeaderProps) {
  const { tabs, activeTabId, setActiveTab, closeSession, openSession } = useSessionStore();
  const { hosts } = useHostStore();
  const [quickInput, setQuickInput] = useState("");

  async function handleQuickConnect(e: React.FormEvent) {
    e.preventDefault();
    const val = quickInput.trim();
    if (!val) return;

    // Pattern: [username@]hostname[:port]
    let username = "root";
    let address = val;
    let port = 22;

    if (address.includes("@")) {
      const parts = address.split("@");
      username = parts[0];
      address = parts[1];
    }
    if (address.includes(":")) {
      const parts = address.split(":");
      address = parts[0];
      port = parseInt(parts[1], 10) || 22;
    }

    // Check if matching host exists in DB
    const existing = hosts.find(
      (h) => h.address.toLowerCase() === address.toLowerCase() && h.port === port
    );

    if (existing) {
      await openSession(existing);
    } else {
      // Temporary ad-hoc host session
      const tempHost: Host = {
        id: `temp-${Date.now()}`,
        label: `${username}@${address}`,
        address,
        port,
        username,
        auth_method: "password",
        tags: ["quick"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await openSession(tempHost);
    }

    setQuickInput("");
  }

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-[var(--border)] bg-[var(--canvas)] px-3 gap-3">
      {/* Active Terminal Tabs */}
      <div className="flex flex-1 items-center gap-1 overflow-x-auto py-1 max-w-2xl">
        {tabs.length === 0 ? (
          <span className="text-xs text-[var(--text-muted)] font-mono pl-1">
            No active terminal sessions
          </span>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  onSelectTab?.();
                }}
                className={`group flex items-center gap-1.5 rounded-t-lg px-2.5 py-1 text-xs font-mono min-w-[150px] max-w-[220px] cursor-pointer transition-colors border-b ${
                  isActive
                    ? "border-[var(--primary)] bg-[var(--surface-high)] text-[var(--primary)] font-medium"
                    : "border-transparent bg-[var(--surface-low)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)]"
                }`}
              >
                {tab.connecting ? (
                  <Loader2 size={12} className="animate-spin text-[var(--primary)] shrink-0" />
                ) : (
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      tab.connected ? "bg-[var(--primary)]" : "bg-[var(--text-muted)]"
                    }`}
                  />
                )}
                <span className="truncate">{tab.hostLabel}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSession(tab.id);
                  }}
                  className="ml-auto rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Right Controls: Quick Connect & Search */}
      <div className="flex items-center gap-2 shrink-0">
        <form onSubmit={handleQuickConnect} className="relative flex items-center">
          <Zap size={14} className="absolute left-2.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Quick connect (user@host:port)..."
            className="h-8 w-60 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] pl-7 pr-2.5 text-xs font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
          />
        </form>

        <div className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-2 text-xs text-[var(--text-muted)]">
          <Search size={14} />
          <span>Search</span>
          <kbd className="rounded border border-[var(--border)] bg-[var(--surface-high)] px-1 py-0.2 text-[10px] font-mono text-[var(--text-secondary)]">
            Ctrl+K
          </kbd>
        </div>

        <div className="h-4 w-[1px] bg-[var(--border)]" />

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)]">
          <User size={16} />
        </div>
      </div>
    </header>
  );
}

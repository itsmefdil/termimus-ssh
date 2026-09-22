import { X, Terminal as TerminalIcon, Loader2 } from "lucide-react";
import { useSessionStore } from "../../stores/useSessionStore";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeSession } = useSessionStore();

  if (tabs.length === 0) {
    return (
      <div className="flex h-10 items-center border-b border-[var(--border)] bg-[var(--card)] px-3">
        <span className="text-xs text-[var(--text-muted)]">No active session</span>
      </div>
    );
  }

  return (
    <div className="flex h-10 items-center overflow-x-auto border-b border-[var(--border)] bg-[var(--card)] px-1">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`group flex h-8 max-w-[200px] cursor-pointer items-center gap-2 rounded-t-md px-3 text-xs transition-colors ${
              isActive
                ? "bg-[var(--background)] text-[var(--text-primary)] font-medium border-t-2 border-[var(--accent)]"
                : "text-[var(--text-muted)] hover:bg-[var(--sidebar)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab.connecting ? (
              <Loader2 size={13} className="animate-spin text-[var(--accent)] shrink-0" />
            ) : (
              <TerminalIcon
                size={13}
                className={`shrink-0 ${
                  tab.connected ? "text-[var(--success)]" : "text-[var(--danger)]"
                }`}
              />
            )}
            <span className="truncate">{tab.hostLabel}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeSession(tab.id);
              }}
              className="ml-auto rounded p-0.5 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

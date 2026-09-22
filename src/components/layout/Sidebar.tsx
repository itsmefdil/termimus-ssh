import {
  Server,
  Terminal,
  FolderOpen,
  Braces,
  Waypoints,
  KeyRound,
  Settings,
  CloudCheck,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useHostStore } from "../../stores/useHostStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useSnippetStore } from "../../stores/useSnippetStore";
import { useTunnelStore } from "../../stores/useTunnelStore";

export type ActiveTab = "hosts" | "terminal" | "sftp" | "tunnels" | "vault" | "snippets";

interface SidebarProps {
  activeNav: ActiveTab;
  onNavChange: (tab: ActiveTab) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ activeNav, onNavChange, isCollapsed, onToggleCollapsed }: SidebarProps) {
  const { isUnlocked, lock: lockVault } = useVaultStore();
  const { hosts } = useHostStore();
  const { tabs } = useSessionStore();
  const { snippets } = useSnippetStore();
  const { activeRuleIds } = useTunnelStore();

  const navItems: {
    icon: typeof Server;
    label: string;
    id: ActiveTab;
    badge?: string | number;
    badgeDot?: boolean;
  }[] = [
    { icon: Server, label: "Hosts", id: "hosts", badge: hosts.length || undefined },
    { icon: Terminal, label: "Terminal Sessions", id: "terminal", badge: tabs.length || undefined },
    { icon: FolderOpen, label: "SFTP Browser", id: "sftp" },
    { icon: Braces, label: "Snippets & Scripts", id: "snippets", badge: snippets.length || undefined },
    { icon: Waypoints, label: "Port Forwarding", id: "tunnels", badgeDot: activeRuleIds.size > 0 },
    { icon: KeyRound, label: "Key Vault", id: "vault" },
  ];

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--canvas)] transition-all duration-200 select-none ${
        isCollapsed ? "w-[64px] items-center" : "w-56"
      }`}
    >
      {/* Navigation Items */}
      <nav
        className={`flex flex-1 flex-col w-full overflow-y-auto ${
          isCollapsed ? "items-center gap-2.5 px-2 pt-3 pb-1" : "gap-1 px-2.5 pt-3 pb-1"
        }`}
      >
        {navItems.map(({ icon: Icon, label, id, badge, badgeDot }, idx) => {
          const active = activeNav === id;
          return isCollapsed ? (
            <button
              key={`${id}-${idx}`}
              onClick={() => onNavChange(id)}
              title={label}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                active
                  ? "bg-[var(--surface-high)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon size={20} className="shrink-0" />
              {badge !== undefined && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--surface-highest)] px-1 font-mono text-[9px] text-[var(--primary)] border border-[var(--border)] shadow-sm">
                  {badge}
                </span>
              )}
              {badgeDot && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--secondary)] animate-pulse" />
              )}
            </button>
          ) : (
            <button
              key={`${id}-${idx}`}
              onClick={() => onNavChange(id)}
              className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                active
                  ? "border-l-2 border-[var(--primary)] bg-[var(--surface-high)] text-[var(--primary)] font-semibold"
                  : "border-l-2 border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon
                  size={16}
                  className={
                    active
                      ? "text-[var(--primary)] shrink-0"
                      : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0"
                  }
                />
                <span className="text-[13px] truncate">{label}</span>
              </span>
              {badge !== undefined && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono shrink-0 ${
                    active
                      ? "bg-[var(--surface-highest)] text-[var(--text-secondary)]"
                      : "bg-[var(--surface-container)] text-[var(--text-muted)]"
                  }`}
                >
                  {badge}
                </span>
              )}
              {badgeDot && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)] shrink-0" />
              )}
            </button>
          );
        })}

        {/* Bottom Actions: Settings & Expand/Collapse Toggle */}
        <div
          className={`w-full mt-auto flex flex-col pt-2 ${
            isCollapsed ? "items-center gap-2" : "gap-1"
          }`}
        >
          {isCollapsed ? (
            <>
              <button
                title="Settings & Sync"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={onToggleCollapsed}
                title="Expand sidebar"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--primary)] transition-colors"
              >
                <PanelLeftOpen size={20} />
              </button>
            </>
          ) : (
            <>
              <button className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]">
                <Settings
                  size={16}
                  className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0"
                />
                <span className="text-[13px] truncate">Settings & Sync</span>
              </button>
              <button
                onClick={onToggleCollapsed}
                className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
              >
                <PanelLeftClose
                  size={16}
                  className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0"
                />
                <span className="text-[13px] truncate">Collapse Sidebar</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Footer: Vault Status */}
      <div
        className={`border-t border-[var(--border)] bg-[var(--surface-low)] w-full ${
          isCollapsed ? "flex flex-col items-center py-2.5 gap-2 px-2" : "p-2.5 flex flex-col gap-1.5"
        }`}
      >
        {isCollapsed ? (
          <>
            <span
              title={isUnlocked ? "Vault Unlocked (AES-256 E2E)" : "Vault Locked"}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-container)] transition-colors"
            >
              <CloudCheck
                size={19}
                className={isUnlocked ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}
              />
              {isUnlocked && (
                <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
              )}
            </span>
            {isUnlocked && (
              <button
                onClick={lockVault}
                title="Lock Vault"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--warning)] hover:bg-[var(--surface-container)] transition-colors"
              >
                <Lock size={15} />
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 truncate">
                <CloudCheck
                  size={14}
                  className={
                    isUnlocked
                      ? "text-[var(--primary)] shrink-0"
                      : "text-[var(--text-muted)] shrink-0"
                  }
                />
                <span className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                  {isUnlocked ? "Vault Unlocked" : "Vault Locked"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isUnlocked && (
                  <button
                    onClick={lockVault}
                    title="Lock vault"
                    className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--warning)] transition-colors"
                  >
                    <Lock size={13} />
                  </button>
                )}
                {isUnlocked && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between px-1 font-mono text-[10px] text-[var(--text-muted)]">
              <span>E2E AES-256 Encrypted</span>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

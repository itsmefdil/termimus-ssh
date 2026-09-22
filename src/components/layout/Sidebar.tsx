import { useState, useEffect } from "react";
import {
  Server,
  Terminal,
  FolderOpen,
  Braces,
  Waypoints,
  KeyRound,
  Settings,
  Plus,
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
}

export function Sidebar({ activeNav, onNavChange }: SidebarProps) {
  const { isUnlocked, lock: lockVault } = useVaultStore();
  const { hosts, openCreateModal: openHostModal } = useHostStore();
  const { tabs } = useSessionStore();
  const { snippets } = useSnippetStore();
  const { activeRuleIds } = useTunnelStore();

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem("termimus_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("termimus_sidebar_collapsed", String(isCollapsed));
    } catch {
      // ignore
    }
  }, [isCollapsed]);

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
      className={`flex h-full flex-col border-r border-[var(--border)] bg-[var(--canvas)] transition-all duration-200 select-none ${
        isCollapsed ? "w-14 items-center" : "w-60"
      }`}
    >
      {/* Brand Header */}
      <div
        className={`flex h-14 items-center border-b border-[var(--border)] ${
          isCollapsed ? "justify-center px-0 w-full" : "justify-between px-3.5 w-full"
        }`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/logo.png"
            alt="Termimus"
            title="Termimus"
            className="h-7 w-7 rounded-md object-contain shrink-0 cursor-pointer"
            onClick={() => isCollapsed && setIsCollapsed(false)}
          />
          {!isCollapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
              Termimus
            </span>
          )}
        </div>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        >
          {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* New Connection Button */}
      <div className={`p-2 w-full ${isCollapsed ? "flex justify-center" : ""}`}>
        {isCollapsed ? (
          <button
            onClick={openHostModal}
            title="New Connection"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)] shadow-sm"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
        ) : (
          <button
            onClick={openHostModal}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-2 text-[13px] font-semibold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)] shadow-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>New Connection</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className={`flex flex-col gap-0.5 px-2 w-full ${isCollapsed ? "items-center" : ""}`}>
        {navItems.map(({ icon: Icon, label, id, badge, badgeDot }, idx) => {
          const active = activeNav === id;
          return isCollapsed ? (
            <button
              key={`${id}-${idx}`}
              onClick={() => onNavChange(id)}
              title={label}
              className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                active
                  ? "bg-[var(--surface-high)] text-[var(--primary)] shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon size={18} />
              {badge !== undefined && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--surface-highest)] px-1 font-mono text-[9px] text-[var(--primary)] border border-[var(--border)]">
                  {badge}
                </span>
              )}
              {badgeDot && (
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-[var(--secondary)]" />
              )}
            </button>
          ) : (
            <button
              key={`${id}-${idx}`}
              onClick={() => onNavChange(id)}
              className={`group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
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

        {isCollapsed ? (
          <button
            title="Settings & Sync"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Settings size={18} />
          </button>
        ) : (
          <button className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]">
            <Settings
              size={16}
              className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0"
            />
            <span className="text-[13px] truncate">Settings & Sync</span>
          </button>
        )}
      </nav>

      {/* Footer: Vault Status */}
      <div
        className={`mt-auto flex flex-col border-t border-[var(--border)] bg-[var(--surface-low)] w-full ${
          isCollapsed ? "items-center py-2.5 px-0 gap-2" : "gap-1.5 p-2.5"
        }`}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <span
              title={isUnlocked ? "Vault Unlocked (AES-256 E2E)" : "Vault Locked"}
              className="relative flex items-center justify-center"
            >
              <CloudCheck
                size={16}
                className={isUnlocked ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}
              />
              {isUnlocked && (
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
              )}
            </span>
            {isUnlocked && (
              <button
                onClick={lockVault}
                title="Lock vault"
                className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--warning)] transition-colors"
              >
                <Lock size={14} />
              </button>
            )}
          </div>
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

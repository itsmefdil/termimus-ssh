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

  const navItems: { icon: typeof Server; label: string; id: ActiveTab; badge?: string | number; badgeDot?: boolean }[] = [
    { icon: Server, label: "Hosts", id: "hosts", badge: hosts.length || undefined },
    { icon: Terminal, label: "Terminal Sessions", id: "terminal", badge: tabs.length || undefined },
    { icon: FolderOpen, label: "SFTP Browser", id: "sftp" },
    { icon: Braces, label: "Snippets & Scripts", id: "snippets", badge: snippets.length || undefined },
    { icon: Waypoints, label: "Port Forwarding", id: "tunnels", badgeDot: activeRuleIds.size > 0 },
    { icon: KeyRound, label: "Key Vault", id: "vault" },
  ];

  return (
    <aside className="flex h-full w-60 flex-col border-r border-[var(--border)] bg-[var(--canvas)]">
      {/* Brand Header */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[var(--border)] px-3.5">
        <img src="/logo.png" alt="Termimus" className="h-7 w-7 rounded-md object-contain" />
        <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
          Termimus
        </span>
      </div>

      {/* New Connection Button */}
      <div className="p-2.5">
        <button
          onClick={openHostModal}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] py-2 text-[13px] font-semibold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)]"
        >
          <Plus size={16} strokeWidth={2.5} />
          New Connection
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-2">
        {navItems.map(({ icon: Icon, label, id, badge, badgeDot }, idx) => {
          const active = activeNav === id;
          return (
            <button
              key={`${id}-${idx}`}
              onClick={() => onNavChange(id)}
              className={`group flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors ${
                active
                  ? "border-l-2 border-[var(--primary)] bg-[var(--surface-high)] text-[var(--primary)] font-semibold"
                  : "border-l-2 border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="flex items-center gap-2.5">
                <Icon size={16} className={active ? "text-[var(--primary)]" : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"} />
                <span className="text-[13px]">{label}</span>
              </span>
              {badge !== undefined && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                    active
                      ? "bg-[var(--surface-highest)] text-[var(--text-secondary)]"
                      : "bg-[var(--surface-container)] text-[var(--text-muted)]"
                  }`}
                >
                  {badge}
                </span>
              )}
              {badgeDot && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--secondary)]" />
              )}
            </button>
          );
        })}
        <button
          className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
        >
          <Settings size={16} className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
          <span className="text-[13px]">Settings & Sync</span>
        </button>
      </nav>

      {/* Footer: Vault Status */}
      <div className="mt-auto flex flex-col gap-1.5 border-t border-[var(--border)] bg-[var(--surface-low)] p-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <CloudCheck size={14} className={isUnlocked ? "text-[var(--primary)]" : "text-[var(--text-muted)]"} />
            <span className="text-[11px] font-semibold text-[var(--text-primary)]">
              {isUnlocked ? "Vault Unlocked" : "Vault Locked"}
            </span>
          </div>
          {isUnlocked && (
            <button
              onClick={lockVault}
              title="Lock vault"
              className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--warning)]"
            >
              <Lock size={13} />
            </button>
          )}
          {isUnlocked && <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />}
        </div>
        <div className="flex items-center justify-between px-1 font-mono text-[10px] text-[var(--text-muted)]">
          <span>E2E AES-256 Encrypted</span>
        </div>
      </div>
    </aside>
  );
}

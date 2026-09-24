import {
  Server,
  Layers,
  FolderOpen,
  Braces,
  Waypoints,
  KeyRound,
  Settings,
  CloudCheck,
  Lock,
} from "lucide-react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useHostStore } from "../../stores/useHostStore";
import { useSnippetStore } from "../../stores/useSnippetStore";
import { useTunnelStore } from "../../stores/useTunnelStore";
import { useKeychainStore } from "../../stores/useKeychainStore";
import { useWorkspaceStore } from "../../stores/useWorkspaceStore";

export type ActiveTab = "hosts" | "workspaces" | "terminal" | "sftp" | "keychain" | "tunnels" | "snippets" | "settings";

interface SidebarProps {
  activeNav: ActiveTab;
  onNavChange: (tab: ActiveTab) => void;
  isCollapsed: boolean;
}

// Snappy desktop transition curve for responsive sidebar collapse
const TRANSITION = "duration-150 ease-out";

export function Sidebar({ activeNav, onNavChange, isCollapsed }: SidebarProps) {
  const { isUnlocked, lock: lockVault } = useVaultStore();
  const { hosts } = useHostStore();
  const { snippets } = useSnippetStore();
  const { activeRuleIds } = useTunnelStore();
  const { items: keychainItems } = useKeychainStore();
  const { presets } = useWorkspaceStore();

  const navItems: {
    icon: typeof Server;
    label: string;
    id: ActiveTab;
    badge?: string | number;
    badgeDot?: boolean;
  }[] = [
    { icon: Server, label: "Hosts", id: "hosts", badge: hosts.length || undefined },
    { icon: KeyRound, label: "Keychain", id: "keychain", badge: keychainItems.length || undefined },
    { icon: Layers, label: "Workspaces", id: "workspaces", badge: presets.length || undefined },
    { icon: FolderOpen, label: "SFTP Browser", id: "sftp" },
    { icon: Braces, label: "Snippets & Scripts", id: "snippets", badge: snippets.length || undefined },
    { icon: Waypoints, label: "Port Forwarding", id: "tunnels", badgeDot: activeRuleIds.size > 0 },
  ];

  return (
    <aside
      className={`flex h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--canvas)] select-none transition-[width] ${TRANSITION} ${
        isCollapsed ? "w-[64px]" : "w-56"
      }`}
    >
      {/* Navigation Items */}
      <nav className="flex flex-1 flex-col w-full overflow-y-auto gap-1 px-3 pt-3 pb-1">
        {navItems.map(({ icon: Icon, label, id, badge, badgeDot }, idx) => {
          const active = activeNav === id;
          return (
            <button
              key={`${id}-${idx}`}
              onClick={() => onNavChange(id)}
              title={isCollapsed ? label : undefined}
              className={`group relative flex h-10 w-full items-center rounded-xl transition-colors text-left overflow-hidden ${
                active
                  ? "bg-[var(--surface-high)] text-[var(--primary)] font-semibold shadow-sm"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors ${
                    active
                      ? "text-[var(--primary)]"
                      : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                  }`}
                />
              </div>
              <span
                className={`flex-1 text-left truncate text-[13px] font-medium transition-opacity ${TRANSITION} ${
                  isCollapsed ? "opacity-0" : "opacity-100"
                }`}
              >
                {label}
              </span>
              {(badge !== undefined || badgeDot) && (
                <div
                  className={`flex shrink-0 items-center pr-2.5 transition-opacity ${TRANSITION} ${
                    isCollapsed ? "opacity-0" : "opacity-100"
                  }`}
                >
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
                </div>
              )}
              {isCollapsed && badgeDot && (
                <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-[var(--secondary)]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Pinned Bottom Section: Settings & Vault Status (Always visible, never cut off) */}
      <div className="shrink-0 flex flex-col w-full border-t border-[var(--border)] bg-[var(--surface-low)]">
        {/* Settings Action */}
        <div className="w-full px-3 pt-2 pb-1">
          <button
            onClick={() => onNavChange("settings")}
            title={isCollapsed ? "Settings" : undefined}
            className={`group relative flex h-10 w-full items-center rounded-xl transition-colors text-left overflow-hidden ${
              activeNav === "settings"
                ? "bg-[var(--surface-high)] text-[var(--primary)] font-semibold shadow-sm"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center">
              <Settings
                size={18}
                className={`shrink-0 transition-colors ${
                  activeNav === "settings"
                    ? "text-[var(--primary)]"
                    : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                }`}
              />
            </div>
            <span
              className={`flex-1 text-left truncate text-[13px] font-medium transition-opacity ${TRANSITION} ${
                isCollapsed ? "opacity-0 hidden" : "opacity-100"
              }`}
            >
              Settings
            </span>
          </button>
        </div>

        {/* Vault Status Footer */}
        <div className="w-full px-3 pb-2 pt-1">
          <div className="flex h-8 w-full items-center justify-between">
            <div className="flex min-w-0 items-center">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--surface-container)] cursor-default transition-colors">
                <CloudCheck
                  size={18}
                  className={isUnlocked ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}
                />
                {isUnlocked && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
                )}
              </div>
              <span
                className={`ml-2 text-[11px] font-semibold text-[var(--text-primary)] truncate transition-opacity ${TRANSITION} ${
                  isCollapsed ? "opacity-0 hidden" : "opacity-100"
                }`}
              >
                {isUnlocked ? "Vault Unlocked" : "Vault Locked"}
              </span>
            </div>
            {!isCollapsed && isUnlocked && (
              <button
                onClick={lockVault}
                title="Lock vault"
                className="shrink-0 rounded p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--warning)]"
              >
                <Lock size={13} />
              </button>
            )}
          </div>
          <div
            className={`overflow-hidden whitespace-nowrap px-1 font-mono text-[10px] text-[var(--text-muted)] transition-opacity ${TRANSITION} ${
              isCollapsed ? "opacity-0 h-0 hidden" : "opacity-100 h-4 mt-0.5"
            }`}
          >
            <span>E2E AES-256 Encrypted</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

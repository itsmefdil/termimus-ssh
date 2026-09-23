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
} from "lucide-react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useHostStore } from "../../stores/useHostStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useSnippetStore } from "../../stores/useSnippetStore";
import { useTunnelStore } from "../../stores/useTunnelStore";
import { useKeychainStore } from "../../stores/useKeychainStore";

export type ActiveTab = "hosts" | "terminal" | "sftp" | "keychain" | "tunnels" | "snippets" | "settings";

interface SidebarProps {
  activeNav: ActiveTab;
  onNavChange: (tab: ActiveTab) => void;
  isCollapsed: boolean;
}

// Single timing shared by the sidebar width and every label/badge fade inside
// it, so the whole collapse/expand reads as one smooth motion instead of the
// content snapping to a different layout mid-transition.
const TRANSITION = "duration-250 ease-in-out";

export function Sidebar({ activeNav, onNavChange, isCollapsed }: SidebarProps) {
  const { isUnlocked, lock: lockVault } = useVaultStore();
  const { hosts } = useHostStore();
  const { tabs } = useSessionStore();
  const { snippets } = useSnippetStore();
  const { activeRuleIds } = useTunnelStore();
  const { items: keychainItems } = useKeychainStore();

  const navItems: {
    icon: typeof Server;
    label: string;
    id: ActiveTab;
    badge?: string | number;
    badgeDot?: boolean;
  }[] = [
    { icon: Server, label: "Hosts", id: "hosts", badge: hosts.length || undefined },
    { icon: KeyRound, label: "Keychain", id: "keychain", badge: keychainItems.length || undefined },
    { icon: Terminal, label: "Terminal Sessions", id: "terminal", badge: tabs.length || undefined },
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
      <nav className="flex flex-1 flex-col w-full overflow-y-auto gap-1 px-2.5 pt-3 pb-1">
        {navItems.map(({ icon: Icon, label, id, badge, badgeDot }, idx) => {
          const active = activeNav === id;
          return (
            <button
              key={`${id}-${idx}`}
              onClick={() => onNavChange(id)}
              title={isCollapsed ? label : undefined}
              className={`group flex items-center rounded-lg py-2 text-left transition-colors ${
                isCollapsed ? "justify-center px-0" : "justify-between px-2.5"
              } ${
                active
                  ? "bg-[var(--surface-high)] text-[var(--primary)] font-semibold shadow-md shadow-[var(--primary)]/10"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <Icon
                  size={16}
                  className={`shrink-0 ${
                    active
                      ? "text-[var(--primary)]"
                      : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                  }`}
                />
                <span
                  className={`overflow-hidden whitespace-nowrap text-[13px] transition-[width,opacity] ${TRANSITION} ${
                    isCollapsed ? "w-0 opacity-0" : "w-[130px] opacity-100"
                  }`}
                >
                  {label}
                </span>
              </span>
              {(badge !== undefined || badgeDot) && (
                <span
                  className={`flex shrink-0 items-center overflow-hidden transition-[width,opacity] ${TRANSITION} ${
                    isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100"
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
                </span>
              )}
            </button>
          );
        })}

        {/* Bottom Actions: Settings */}
        <div className="w-full mt-auto flex flex-col gap-1 pt-2 border-t border-[var(--border)]/50">
          <button
            onClick={() => onNavChange("settings")}
            title={isCollapsed ? "Settings" : undefined}
            className={`group flex items-center rounded-lg py-2 text-left transition-colors ${
              isCollapsed ? "justify-center px-0" : "justify-start gap-2.5 px-2.5"
            } ${
              activeNav === "settings"
                ? "bg-[var(--surface-high)] text-[var(--primary)] font-semibold shadow-md shadow-[var(--primary)]/10"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Settings
              size={16}
              className={`shrink-0 ${
                activeNav === "settings"
                  ? "text-[var(--primary)]"
                  : "text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
              }`}
            />
            <span
              className={`overflow-hidden whitespace-nowrap text-[13px] transition-[width,opacity] ${TRANSITION} ${
                isCollapsed ? "w-0 opacity-0" : "w-[130px] opacity-100"
              }`}
            >
              Settings
            </span>
          </button>
        </div>
      </nav>

      {/* Footer: Vault Status */}
      <div
        className={`w-full border-t border-[var(--border)] bg-[var(--surface-low)] transition-all ${TRANSITION} ${
          isCollapsed ? "flex flex-col items-center gap-2 py-2.5 px-2" : "flex flex-col gap-1.5 p-2.5"
        }`}
      >
        <div
          className={`flex w-full items-center ${
            isCollapsed ? "justify-center" : "justify-between px-1"
          }`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
              <CloudCheck
                size={isCollapsed ? 19 : 14}
                className={`transition-[width,height] ${TRANSITION} ${
                  isUnlocked ? "text-[var(--primary)]" : "text-[var(--text-muted)]"
                }`}
              />
              {isUnlocked && (
                <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
              )}
            </span>
            <span
              className={`overflow-hidden whitespace-nowrap text-[11px] font-semibold text-[var(--text-primary)] transition-[width,opacity] ${TRANSITION} ${
                isCollapsed ? "w-0 opacity-0" : "w-[110px] opacity-100"
              }`}
            >
              {isUnlocked ? "Vault Unlocked" : "Vault Locked"}
            </span>
          </div>
          {isUnlocked && (
            <button
              onClick={lockVault}
              title="Lock vault"
              className={`shrink-0 rounded text-[var(--text-muted)] transition-colors hover:text-[var(--warning)] ${
                isCollapsed ? "p-0.5" : "p-0.5"
              }`}
            >
              <Lock size={isCollapsed ? 15 : 13} />
            </button>
          )}
        </div>
        <div
          className={`overflow-hidden whitespace-nowrap px-1 font-mono text-[10px] text-[var(--text-muted)] transition-[height,opacity] ${TRANSITION} ${
            isCollapsed ? "h-0 opacity-0" : "h-4 opacity-100"
          }`}
        >
          <span>E2E AES-256 Encrypted</span>
        </div>
      </div>
    </aside>
  );
}

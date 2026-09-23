import { Archive, Lock, ShieldCheck } from "lucide-react";
import { BackupRestoreSection } from "../vault/BackupRestoreSection";
import { useVaultStore } from "../../stores/useVaultStore";

// ─── section wrapper ────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Archive;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-[var(--border)]">
        <Icon size={15} className="text-[var(--text-muted)]" />
        <div>
          <h3 className="text-xs font-semibold text-[var(--text-primary)]">{title}</h3>
          {description && (
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── main view ──────────────────────────────────────────────────────────────
export function SettingsView() {
  const { isUnlocked, lock: lockVault } = useVaultStore();

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--canvas)] p-6">
      <div className="mx-auto w-full max-w-3xl space-y-8">

        {/* Page header */}
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Settings</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Application preferences, security options and backup management.
          </p>
        </div>

        {/* ── Security & Vault ───────────────────────────────────────────────── */}
        <Section
          icon={Lock}
          title="Vault"
          description="AES-256-GCM encrypted credential store. Master password never leaves this device."
        >
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-low)] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  isUnlocked
                    ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                    : "bg-[var(--surface-container)] text-[var(--text-muted)]"
                }`}
              >
                <Lock size={16} />
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--text-primary)]">
                  {isUnlocked ? "Vault is unlocked" : "Vault is locked"}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {isUnlocked
                    ? "Credentials are accessible. Lock when you step away."
                    : "Unlock to access SSH keys and passwords."}
                </p>
              </div>
            </div>
            {isUnlocked && (
              <button
                onClick={lockVault}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-high)] px-3 py-1.5 text-xs font-semibold text-[var(--warning)] hover:bg-[var(--surface-highest)] transition-colors"
              >
                <Lock size={13} />
                Lock Vault
              </button>
            )}
          </div>
        </Section>

        {/* ── TOFU Known Hosts ──────────────────────────────────────────────── */}
        <Section
          icon={ShieldCheck}
          title="Trusted Host Keys"
          description="Server fingerprints trusted on first connection. A mismatch aborts the connection to protect against MITM attacks."
        >
          <KnownHostsTable />
        </Section>

        {/* ── Backup & Restore ─────────────────────────────────────────────── */}
        <Section
          icon={Archive}
          title="Backup &amp; Restore"
          description="Export all hosts, snippets, tunnels and encrypted credentials. Optionally protect the entire file with a passphrase."
        >
          <BackupRestoreSection />
        </Section>

      </div>
    </div>
  );
}

// ─── known-hosts inline sub-component ───────────────────────────────────────
import { useEffect } from "react";
import { useKnownHostsStore } from "../../stores/useKnownHostsStore";
import { useConfirmStore } from "../../stores/useConfirmStore";
import { Server, RotateCw, Trash2, AlertTriangle } from "lucide-react";

function KnownHostsTable() {
  const { knownHosts, isLoading, refresh, resetKnownHost } = useKnownHostsStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  function handleReset(address: string, port: number) {
    useConfirmStore.getState().confirm({
      title: "Reset Trusted Host Key",
      message: `Reset trusted host key for ${address}:${port}? Termimus will accept the server's new key on your next connection (Trust On First Use).`,
      confirmLabel: "Reset Key",
      isDanger: false,
      onConfirm: async () => {
        await resetKnownHost(address, port);
      },
    });
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-low)] overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
        <span className="text-[11px] text-[var(--text-muted)]">
          {knownHosts.length} trusted host{knownHosts.length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => refresh()}
          disabled={isLoading}
          title="Refresh"
          className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-white transition-colors"
        >
          <RotateCw size={13} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {knownHosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center text-[var(--text-muted)]">
          <Server size={30} className="mb-2 opacity-30" />
          <p className="text-xs font-medium text-[var(--text-primary)]">No trusted hosts yet</p>
          <p className="text-[11px] mt-0.5 max-w-xs">
            Server fingerprints appear here after your first SSH connection.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-container)] text-[10px] uppercase font-mono text-[var(--text-muted)] border-b border-[var(--border)]">
              <tr>
                <th className="py-2 pl-4">Server</th>
                <th className="py-2 px-2">Key Type</th>
                <th className="py-2 px-2">SHA256 Fingerprint</th>
                <th className="py-2 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/40 font-mono">
              {knownHosts.map((kh) => (
                <tr
                  key={`${kh.address}:${kh.port}`}
                  className="hover:bg-[var(--surface-container)]/50 transition-colors"
                >
                  <td className="py-2.5 pl-4 font-semibold text-[var(--text-primary)]">
                    {kh.address}:{kh.port}
                  </td>
                  <td className="py-2.5 px-2 text-[var(--secondary)]">{kh.key_type}</td>
                  <td className="py-2.5 px-2 text-[11px] text-[var(--primary)] truncate max-w-xs">
                    {kh.fingerprint}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <button
                      onClick={() => handleReset(kh.address, kh.port)}
                      title="Reset host key"
                      className="inline-flex items-center gap-1 rounded bg-[var(--danger)]/10 px-2 py-1 text-[11px] text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors border border-[var(--danger)]/20"
                    >
                      <Trash2 size={11} />
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MITM warning footer */}
      <div className="flex items-start gap-2 border-t border-[var(--border)] bg-[var(--surface-container)]/30 px-4 py-2.5 text-[11px] text-[var(--text-secondary)]">
        <AlertTriangle size={13} className="shrink-0 mt-0.5 text-[var(--warning)]" />
        <span>
          If a server's fingerprint changes unexpectedly, Termimus aborts the connection with a security alert.
          Only reset a key if you intentionally reinstalled or replaced that server.
        </span>
      </div>
    </div>
  );
}

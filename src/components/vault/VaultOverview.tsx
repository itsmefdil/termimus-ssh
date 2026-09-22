import { useEffect } from "react";
import {
  KeyRound,
  ShieldCheck,
  Lock,
  Server,
  Trash2,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useKnownHostsStore } from "../../stores/useKnownHostsStore";
import { BackupRestoreSection } from "./BackupRestoreSection";

export function VaultOverview() {
  const { lock: lockVault } = useVaultStore();
  const { knownHosts, isLoading, refresh, resetKnownHost } = useKnownHostsStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleReset(address: string, port: number) {
    if (
      confirm(
        `Reset trusted key for ${address}:${port}? Termimus will accept the new key on your next connection.`
      )
    ) {
      await resetKnownHost(address, port);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--canvas)] p-6">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header & Vault Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-low)] p-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--tertiary)]/15 text-[var(--tertiary)] shrink-0">
              <KeyRound size={26} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Zero-Knowledge Security Vault
              </h2>
              <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-lg">
                Your SSH passwords, private keys, and server fingerprints are locally encrypted with AES-256-GCM.
                Host identification is strictly verified to shield you against Man-in-the-Middle (MITM) attacks.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-mono">
                <span className="rounded bg-[var(--primary)]/15 px-2 py-0.5 text-[var(--primary)] border border-[var(--primary)]/30">
                  AES-256-GCM
                </span>
                <span className="rounded bg-[var(--surface-container)] px-2 py-0.5 text-[var(--text-secondary)] border border-[var(--border)]">
                  Argon2id KDF
                </span>
                <span className="rounded bg-[var(--surface-container)] px-2 py-0.5 text-[var(--text-secondary)] border border-[var(--border)]">
                  TOFU MITM Shield
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
            <button
              onClick={lockVault}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--surface-high)] px-3.5 py-2 text-xs font-semibold text-[var(--warning)] hover:bg-[var(--surface-highest)] transition-colors border border-[var(--border)]"
            >
              <Lock size={14} /> Lock Vault
            </button>
          </div>
        </div>

        {/* Known Hosts Verification Section */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-low)] p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <ShieldCheck size={18} className="text-[var(--primary)]" />
                Trusted Known Hosts & Key Fingerprints
              </h3>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                Public key fingerprints remembered from previous successful SSH connections.
              </p>
            </div>

            <button
              onClick={() => refresh()}
              disabled={isLoading}
              title="Refresh known hosts"
              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-white transition-colors"
            >
              <RotateCw size={15} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {knownHosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--text-muted)]">
              <Server size={36} className="mb-2 opacity-30" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                No trusted hosts recorded yet
              </p>
              <p className="text-xs mt-1 max-w-sm">
                When you connect to an SSH server for the first time, its public key fingerprint is safely stored here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-container)] text-[10px] uppercase font-mono text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <th className="py-2 pl-3">Server Address</th>
                    <th className="py-2 px-2">Key Type</th>
                    <th className="py-2 px-2">SHA256 Fingerprint</th>
                    <th className="py-2 pr-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/40 font-mono">
                  {knownHosts.map((kh) => (
                    <tr
                      key={`${kh.address}:${kh.port}`}
                      className="hover:bg-[var(--surface-container)]/50 transition-colors"
                    >
                      <td className="py-2.5 pl-3 font-semibold text-[var(--text-primary)]">
                        {kh.address}:{kh.port}
                      </td>
                      <td className="py-2.5 px-2 text-[var(--secondary)]">
                        {kh.key_type}
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-[var(--primary)] truncate max-w-xs">
                        {kh.fingerprint}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <button
                          onClick={() => handleReset(kh.address, kh.port)}
                          title="Reset host key (if server reinstalled)"
                          className="inline-flex items-center gap-1 rounded bg-[var(--danger)]/10 px-2 py-1 text-[11px] text-[var(--danger)] hover:bg-[var(--danger)]/20 transition-colors border border-[var(--danger)]/20"
                        >
                          <Trash2 size={12} />
                          <span>Reset</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-container)]/40 p-3 text-[11px] text-[var(--text-secondary)]">
            <AlertTriangle size={15} className="text-[var(--warning)] shrink-0" />
            <span>
              If an attacker attempts to spoof your server or redirect your DNS, Termimus will immediately abort the connection with a security alert.
            </span>
          </div>
        </div>

        {/* Encrypted Backup & Restore Section */}
        <BackupRestoreSection />
      </div>
    </div>
  );
}

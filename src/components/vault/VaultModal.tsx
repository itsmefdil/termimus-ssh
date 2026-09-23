import { useState } from "react";
import { Lock, ShieldCheck, KeyRound } from "lucide-react";
import { useVaultStore } from "../../stores/useVaultStore";
import { useConfirmStore } from "../../stores/useConfirmStore";
import { api } from "../../lib/api";

export function VaultModal() {
  const { isInitialized, isUnlocked, setup, unlock, refresh, error } = useVaultStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (isUnlocked) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (!isInitialized) {
      if (password.length < 6) {
        setLocalError("Master password must be at least 6 characters");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match");
        return;
      }
      setSubmitting(true);
      try {
        await setup(password);
      } catch (err) {
        setLocalError(String(err));
      } finally {
        setSubmitting(false);
      }
    } else {
      setSubmitting(true);
      try {
        await unlock(password);
      } catch (err) {
        setLocalError(String(err));
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
            {isInitialized ? <Lock size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div>
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {isInitialized ? "Unlock Termimus Vault" : "Create Master Password"}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {isInitialized
                ? "Enter your master password to decrypt your credentials."
                : "Your master password protects all SSH keys and secrets with zero-knowledge AES-256."}
            </p>
          </div>
        </div>

        {(localError || error) && (
          <div className="mb-4 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-2.5 text-xs text-[var(--danger)]">
            {localError || error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              Master Password
            </label>
            <div className="relative">
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
              />
              <KeyRound
                size={16}
                className="absolute left-3 top-2.5 text-[var(--text-muted)]"
              />
            </div>
          </div>

          {!isInitialized && (
            <div>
              <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
                Confirm Master Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 pl-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                />
                <KeyRound
                  size={16}
                  className="absolute left-3 top-2.5 text-[var(--text-muted)]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {submitting
              ? "Verifying..."
              : isInitialized
              ? "Unlock Vault"
              : "Create Vault"}
          </button>

          {isInitialized && (
            <div className="pt-2 text-center border-t border-[var(--border)]/50">
              <button
                type="button"
                onClick={() => {
                  useConfirmStore.getState().confirm({
                    title: "Reset Master Password & Vault?",
                    message:
                      "Forgot your master password? You can reset the vault to start fresh. WARNING: All stored credentials, passwords, and SSH keys will be permanently deleted.",
                    confirmLabel: "Reset Vault",
                    isDanger: true,
                    onConfirm: async () => {
                      await api.resetVault();
                      await refresh();
                    },
                  });
                }}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors underline"
              >
                Forgot Master Password? Reset Vault
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

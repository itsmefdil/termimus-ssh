import { useState, useEffect } from "react";
import { X, Server, Key, Lock } from "lucide-react";
import { useHostStore } from "../../stores/useHostStore";
import { HostInput } from "../../lib/api";

export function HostModal() {
  const { isHostModalOpen, editingHost, closeHostModal, saveHost, folders } =
    useHostStore();

  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authMethod, setAuthMethod] = useState<"password" | "private_key">("password");
  const [secret, setSecret] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingHost) {
      setLabel(editingHost.label);
      setAddress(editingHost.address);
      setPort(editingHost.port);
      setUsername(editingHost.username);
      setAuthMethod(
        editingHost.auth_method === "private_key" ? "private_key" : "password"
      );
      setTagInput(editingHost.tags.join(", "));
      setFolderId(editingHost.folder_id ?? "");
      setSecret("");
      setPassphrase("");
    } else {
      setLabel("");
      setAddress("");
      setPort(22);
      setUsername("root");
      setAuthMethod("password");
      setSecret("");
      setPassphrase("");
      setTagInput("");
      setFolderId("");
    }
    setError(null);
  }, [editingHost, isHostModalOpen]);

  if (!isHostModalOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!address.trim()) {
      setError("Address (IP or hostname) is required");
      return;
    }
    if (!username.trim()) {
      setError("Username is required");
      return;
    }

    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const input: HostInput = {
      label: label.trim() || address.trim(),
      address: address.trim(),
      port: Number(port) || 22,
      username: username.trim(),
      auth_method: authMethod,
      secret: secret.trim() ? secret : undefined,
      passphrase: passphrase.trim() ? passphrase : undefined,
      tags,
      folder_id: folderId || null,
    };

    setSubmitting(true);
    try {
      await saveHost(input, editingHost?.id);
      closeHostModal();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editingHost ? "Edit Host" : "New Host"}
            </h2>
          </div>
          <button
            onClick={closeHostModal}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-2.5 text-xs text-[var(--danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Label / Display Name
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Production Web 01"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Folder
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="">No folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Address / Hostname *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="192.168.1.100 or server.example.com"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Port
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Username *
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Authentication
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setAuthMethod("password")}
                  className={`flex-1 rounded py-1.5 text-xs font-medium transition ${
                    authMethod === "password"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--background)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white"
                  }`}
                >
                  <Lock size={12} className="inline mr-1" /> Password
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod("private_key")}
                  className={`flex-1 rounded py-1.5 text-xs font-medium transition ${
                    authMethod === "private_key"
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--background)] text-[var(--text-muted)] border border-[var(--border)] hover:text-white"
                  }`}
                >
                  <Key size={12} className="inline mr-1" /> Key PEM
                </button>
              </div>
            </div>
          </div>

          {authMethod === "password" ? (
            <div>
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Password {editingHost && "(leave blank to keep unchanged)"}
              </label>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Server password..."
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-medium text-[var(--text-muted)]">
                  Private Key (OpenSSH or RSA PEM format){" "}
                  {editingHost && "(leave blank to keep unchanged)"}
                </label>
                <textarea
                  rows={4}
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                  className="w-full font-mono rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-[var(--text-muted)]">
                  Passphrase (if key is encrypted)
                </label>
                <input
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Key passphrase..."
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block font-medium text-[var(--text-muted)]">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="vps, homelab, docker, production"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={closeHostModal}
              className="rounded-md px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {submitting ? "Saving..." : editingHost ? "Update Host" : "Save Host"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

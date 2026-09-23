import { useState, useEffect } from "react";
import { X, Key, Upload, Sparkles, Copy, Check } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useKeychainStore } from "../../stores/useKeychainStore";
import { api, KeychainKeyInput } from "../../lib/api";

export function KeyModal() {
  const { isKeyModalOpen, editingKey, closeKeyModal, saveKey } =
    useKeychainStore();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [keyType, setKeyType] = useState<"ed25519" | "rsa" | "ecdsa-p256">(
    "ed25519"
  );
  const [privateKeyPem, setPrivateKeyPem] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (editingKey) {
      setName(editingKey.name);
      setUsername(editingKey.username ?? "");
      setPublicKey(editingKey.public_key);
      setFingerprint(editingKey.fingerprint);
      const kt = editingKey.key_type.toLowerCase();
      if (kt.includes("rsa")) setKeyType("rsa");
      else if (kt.includes("ecdsa")) setKeyType("ecdsa-p256");
      else setKeyType("ed25519");
      setPrivateKeyPem("");
      setPassphrase("");
    } else {
      setName("");
      setUsername("");
      setKeyType("ed25519");
      setPrivateKeyPem("");
      setPassphrase("");
      setPublicKey("");
      setFingerprint("");
    }
    setError(null);
  }, [editingKey, isKeyModalOpen]);

  // Derive public key whenever PEM or passphrase changes
  useEffect(() => {
    if (!privateKeyPem.trim()) {
      if (!editingKey) {
        setPublicKey("");
        setFingerprint("");
      }
      return;
    }

    let cancelled = false;
    api
      .derivePublicKey(
        privateKeyPem,
        passphrase.trim() ? passphrase : undefined
      )
      .then((pub) => {
        if (!cancelled) {
          setPublicKey(pub);
        }
      })
      .catch(() => {
        if (!cancelled && !editingKey) {
          setPublicKey("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [privateKeyPem, passphrase, editingKey]);

  const isPublicKeyOnly =
    privateKeyPem.trim().startsWith("ssh-") ||
    privateKeyPem.trim().startsWith("ecdsa-") ||
    privateKeyPem.trim().startsWith("sk-");

  if (!isKeyModalOpen) return null;

  async function handleImportKeyFile() {
    setError(null);
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        title: "Select SSH Private Key",
        filters: [
          {
            name: "SSH Private Key",
            extensions: ["pem", "key", "id_rsa", "id_ed25519", "id_ecdsa", "*"],
          },
        ],
      });

      if (!selected || typeof selected !== "string") return;

      const content = await api.readLocalFile(selected);
      setPrivateKeyPem(content);

      // Auto-fill name from filename if empty
      if (!name.trim()) {
        const parts = selected.split(/[\/\\]/);
        const fileName = parts[parts.length - 1] || "imported_key";
        setName(fileName);
      }
    } catch (err) {
      setError(`Failed to read key file: ${err}`);
    }
  }

  async function handleGenerateKeyPair() {
    setError(null);
    try {
      const comment = username.trim()
        ? `${username.trim()}@termimus`
        : name.trim() || "termimus-key";
      const res = await api.generateKeyPair(keyType, comment);
      setPrivateKeyPem(res.private_key_pem);
      setPublicKey(res.public_key_openssh);
      setPassphrase("");
      if (!name.trim()) {
        setName(keyType === "ed25519" ? "id_ed25519" : "id_rsa");
      }
    } catch (err) {
      setError(`Key generation failed: ${err}`);
    }
  }

  async function handleCopyPublicKey() {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(`Failed to copy: ${err}`);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Key name is required");
      return;
    }

    if (!editingKey && !privateKeyPem.trim()) {
      setError("Private key is required");
      return;
    }

    const input: KeychainKeyInput = {
      name: name.trim(),
      key_type: keyType.toUpperCase(),
      private_key_pem: privateKeyPem.trim(),
      public_key: publicKey.trim(),
      fingerprint: fingerprint.trim(),
      passphrase: passphrase.trim() ? passphrase : undefined,
      username: username.trim() ? username.trim() : undefined,
    };

    setSubmitting(true);
    try {
      await saveKey(input, editingKey?.id);
      closeKeyModal();
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
            <Key size={18} className="text-[var(--primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editingKey ? "Edit SSH Key" : "New SSH Key"}
            </h2>
          </div>
          <button
            onClick={closeKeyModal}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Key Label / Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. fadil, ai-care, production-key"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Default Username (optional)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. root, ubuntu"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="font-medium text-[var(--text-muted)]">
                Private Key (OpenSSH/RSA PEM) or Public Key{" "}
                {editingKey && "(leave blank to keep unchanged)"}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleImportKeyFile}
                  className="flex items-center gap-1 rounded bg-[var(--surface-high)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--surface-highest)] border border-[var(--border)] transition"
                  title="Import key from local file"
                >
                  <Upload size={11} /> Import File
                </button>
                <button
                  type="button"
                  onClick={handleGenerateKeyPair}
                  className="flex items-center gap-1 rounded bg-[var(--primary)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/25 border border-[var(--primary)]/30 transition"
                  title="Generate a new key pair"
                >
                  <Sparkles size={11} /> Generate Key
                </button>
              </div>
            </div>

            {/* Algorithm selector */}
            <div className="mb-2 flex items-center gap-2 rounded-md bg-[var(--surface-low)] p-1.5 border border-[var(--border)] text-[11px]">
              <span className="text-[var(--text-muted)]">Algorithm:</span>
              <select
                value={keyType}
                onChange={(e) =>
                  setKeyType(e.target.value as "ed25519" | "rsa" | "ecdsa-p256")
                }
                className="rounded bg-[var(--surface-container)] px-2 py-0.5 text-xs text-[var(--text-primary)] border border-[var(--border)] focus:outline-none"
              >
                <option value="ed25519">Ed25519 (Recommended, fast & secure)</option>
                <option value="rsa">RSA 4096-bit (Broad compatibility)</option>
                <option value="ecdsa-p256">ECDSA NIST-P256</option>
              </select>
            </div>

            <textarea
              rows={4}
              value={privateKeyPem}
              onChange={(e) => setPrivateKeyPem(e.target.value)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const text = await file.text();
                  setPrivateKeyPem(text);
                }
              }}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY----- or ssh-rsa / ssh-ed25519 AAAAC3... (paste private key or public key)"
              className="w-full font-mono rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--primary)] focus:outline-none"
            />

            {isPublicKeyOnly && (
              <div className="mt-2 rounded-md border border-[var(--secondary)]/30 bg-[var(--secondary)]/10 p-2 text-[11px] text-[var(--secondary)]">
                <strong>Public Key detected:</strong> This key will be saved to Keychain as a public key for reference and copying. (Note: logging in directly to servers requires the private key).
              </div>
            )}
          </div>

          {!isPublicKeyOnly && (
            <div>
              <label className="mb-1 block font-medium text-[var(--text-muted)]">
                Passphrase (if key is encrypted)
              </label>
              <input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Key passphrase..."
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          )}

          {/* Public Key Display / Copy Box */}
          {publicKey && (
            <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--surface-low)] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Key size={13} className="text-[var(--primary)]" />
                  <span className="font-semibold text-xs text-[var(--text-primary)]">
                    Public Key (OpenSSH)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyPublicKey}
                  className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition ${
                    copied
                      ? "bg-[var(--success)] text-black font-semibold"
                      : "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] font-semibold"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={12} /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copy Public Key
                    </>
                  )}
                </button>
              </div>
              <div className="rounded bg-[var(--canvas)] p-2 font-mono text-[11px] text-[var(--text-primary)] select-all break-all border border-[var(--border)] max-h-16 overflow-y-auto">
                {publicKey}
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Place this public key in the server's{" "}
                <code className="rounded bg-[var(--surface-high)] px-1 py-0.5 text-[var(--text-primary)]">
                  ~/.ssh/authorized_keys
                </code>{" "}
                to allow authentication.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={closeKeyModal}
              className="rounded-md px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {submitting ? "Saving..." : editingKey ? "Update Key" : "Save Key to Keychain"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

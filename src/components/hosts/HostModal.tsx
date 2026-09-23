import { useState, useEffect } from "react";
import {
  X,
  Key,
  Lock,
  Copy,
  Check,
  KeyRound,
  UserCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { useHostStore } from "../../stores/useHostStore";
import { useKeychainStore } from "../../stores/useKeychainStore";
import { api, HostInput } from "../../lib/api";

interface HostModalProps {
  onOpenKeychain?: () => void;
}

export function HostModal({ onOpenKeychain }: HostModalProps = {}) {
  const { isHostModalOpen, editingHost, closeHostModal, saveHost, folders } =
    useHostStore();
  const { items: keychainItems } = useKeychainStore();

  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState("root");
  const [authMethod, setAuthMethod] = useState<"password" | "private_key">("password");
  const [secret, setSecret] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keychain selection
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // Password reveal (Termius-style): masked by default, fetched lazily and
  // shown in plain text only when the user clicks the eye icon.
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Only actual private keys can authenticate an SSH session — a Keychain
  // item saved from a public key (ssh-rsa/ssh-ed25519 ...) has no private
  // key material and would fail to connect, so it's excluded here.
  const availableKeys = keychainItems.filter((i) => i.kind === "private_key");
  const availableIdentities = keychainItems.filter((i) => i.kind === "password");

  const selectedKeyItem = availableKeys.find(
    (k) => k.id === selectedCredentialId
  );
  const selectedIdentityItem = availableIdentities.find(
    (i) => i.id === selectedCredentialId
  );

  useEffect(() => {
    setShowPassword(false);
    if (editingHost) {
      setLabel(editingHost.label);
      setAddress(editingHost.address);
      setPort(editingHost.port);
      setUsername(editingHost.username);
      const isPrivateKey = editingHost.auth_method === "private_key";
      setAuthMethod(isPrivateKey ? "private_key" : "password");
      setTagInput(editingHost.tags.join(", "));
      setFolderId(editingHost.folder_id ?? "");

      const isKeychain = keychainItems.some(
        (i) => i.id === editingHost.credential_id
      );
      setSelectedCredentialId(isKeychain ? (editingHost.credential_id ?? "") : "");

      setSecret("");

      // Eagerly load saved password for existing hosts
      if (!isPrivateKey) {
        setPasswordLoading(true);
        api
          .getHostPassword(editingHost.id)
          .then((pwd) => {
            setSecret(pwd);
          })
          .catch((err) => {
            console.warn("Could not load host password:", err);
          })
          .finally(() => {
            setPasswordLoading(false);
          });
      }
    } else {
      setLabel("");
      setAddress("");
      setPort(22);
      setUsername("root");
      setAuthMethod("password");
      setSelectedCredentialId("");
      setSecret("");
      setTagInput("");
      setFolderId("");
    }
    setError(null);
  }, [editingHost, isHostModalOpen]);

  // When a keychain item is selected, update default username if not set
  function handleSelectCredential(id: string) {
    setSelectedCredentialId(id);
    setShowPassword(false);
    if (!id || id === "custom") return;

    const item = keychainItems.find((k) => k.id === id);
    if (item?.username && (!username.trim() || username === "root")) {
      setUsername(item.username);
    }
  }

  // Termius-style reveal: the password field stays masked and empty until the
  // user clicks the eye icon, which lazily decrypts and fills in the real
  // value on first click (either the host's own saved password, or the
  // selected Keychain identity's password).
  async function handleTogglePassword() {
    if (showPassword) {
      setShowPassword(false);
      return;
    }

    if (!secret) {
      setPasswordLoading(true);
      setError(null);
      try {
        const value = selectedCredentialId
          ? await api.getCredentialSecret(selectedCredentialId)
          : editingHost
          ? await api.getHostPassword(editingHost.id)
          : "";
        setSecret(value);
      } catch (err) {
        setError(String(err));
        setPasswordLoading(false);
        return;
      }
      setPasswordLoading(false);
    }
    setShowPassword(true);
  }

  // Close modal on Escape key press
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isHostModalOpen) {
        closeHostModal();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHostModalOpen, closeHostModal]);

  if (!isHostModalOpen) return null;

  async function handleCopyPublicKey(keyText?: string | null) {
    if (!keyText) return;
    try {
      await navigator.clipboard.writeText(keyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(`Failed to copy to clipboard: ${err}`);
    }
  }

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

    if (authMethod === "private_key" && !selectedCredentialId) {
      setError("Please select an SSH key from Keychain");
      return;
    }

    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const credentialIdToSave =
      authMethod === "private_key"
        ? selectedCredentialId
        : selectedCredentialId || null;

    setSubmitting(true);
    try {
      const input: HostInput = {
        label: label.trim() || address.trim(),
        address: address.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        auth_method: authMethod,
        credential_id: credentialIdToSave,
        secret:
          authMethod === "password"
            ? selectedCredentialId
              ? undefined
              : secret
              ? secret
              : undefined
            : undefined,
        passphrase: undefined,
        tags,
        folder_id: folderId || null,
      };

      await saveHost(input, editingHost?.id);
      closeHostModal();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) closeHostModal();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-4xl rounded-2xl border border-[var(--border)] bg-[var(--surface-low)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between border-b border-[var(--border)] pb-3.5">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {editingHost ? "Edit Host" : "New Host"}
          </h2>
          <button
            type="button"
            onClick={closeHostModal}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-2.5 text-xs text-[var(--danger)]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* LEFT COLUMN: GENERAL & CONNECTION */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                General & Connection
              </h3>

              <div>
                <label className="mb-1.5 block font-medium text-[var(--text-muted)]">
                  Label / Display Name
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Production Web 01"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--primary)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-[var(--text-muted)]">
                  Group / Folder
                </label>
                <select
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                >
                  <option value="">No group (Ungrouped)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className="mb-1.5 block font-medium text-[var(--text-muted)]">
                    Address / Hostname *
                  </label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="192.168.1.100 or server.example.com"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--primary)] focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block font-medium text-[var(--text-muted)]">
                    Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-[var(--text-muted)]">
                  Username *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. root or ubuntu"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-[var(--text-muted)]">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="vps, homelab, docker, production"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--primary)] focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* RIGHT COLUMN: AUTHENTICATION */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Authentication
              </h3>

              <div>
                <label className="mb-1.5 block font-medium text-[var(--text-muted)]">
                  Auth Method
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod("password");
                      if (selectedKeyItem) setSelectedCredentialId("");
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                      authMethod === "password"
                        ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                        : "bg-[var(--surface-container)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-white hover:bg-[var(--surface-high)]"
                    }`}
                  >
                    <Lock size={13} /> Password
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMethod("private_key");
                      if (selectedIdentityItem) setSelectedCredentialId("");
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                      authMethod === "private_key"
                        ? "bg-[var(--primary)] text-[var(--on-primary)] shadow-sm"
                        : "bg-[var(--surface-container)] text-[var(--text-secondary)] border border-[var(--border)] hover:text-white hover:bg-[var(--surface-high)]"
                    }`}
                  >
                    <Key size={13} /> Key PEM
                  </button>
                </div>
              </div>

              {authMethod === "password" ? (
                <div className="space-y-3 pt-1">
                  {/* Keychain Identity Selector */}
                  {availableIdentities.length > 0 && (
                    <div>
                      <label className="mb-1.5 flex items-center justify-between font-medium text-[var(--text-muted)]">
                        <span className="flex items-center gap-1.5">
                          <UserCheck size={12} className="text-[var(--tertiary)]" />
                          Keychain Identity
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          Reusable credentials
                        </span>
                      </label>
                      <select
                        value={selectedCredentialId}
                        onChange={(e) => handleSelectCredential(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                      >
                        <option value="">-- Custom one-off password --</option>
                        {availableIdentities.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} {item.username ? `(${item.username})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!selectedIdentityItem && (
                    <div>
                      <label className="mb-1.5 block font-medium text-[var(--text-muted)]">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={secret}
                          onChange={(e) => {
                            setSecret(e.target.value);
                            setShowPassword(true);
                          }}
                          disabled={passwordLoading}
                          placeholder={passwordLoading ? "Loading..." : "Server password..."}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 pr-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--primary)] focus:outline-none transition-colors disabled:opacity-60"
                        />
                        <button
                          type="button"
                          onClick={handleTogglePassword}
                          disabled={passwordLoading}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
                          title={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {/* Keychain Key Dropdown */}
                  <div>
                    <label className="mb-1.5 flex items-center justify-between font-medium text-[var(--text-muted)]">
                      <span className="flex items-center gap-1.5">
                        <KeyRound size={13} className="text-[var(--primary)]" />
                        Keychain Key
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        Select from Keychain
                      </span>
                    </label>
                    <select
                      value={selectedCredentialId}
                      onChange={(e) => handleSelectCredential(e.target.value)}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none transition-colors"
                    >
                      <option value="">
                        {availableKeys.length > 0
                          ? "-- Select an SSH key from Keychain --"
                          : "-- No SSH keys in Keychain --"}
                      </option>
                      {availableKeys.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.key_type || "KEY"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* If a Keychain key is selected: show preview & copy pubkey button */}
                  {selectedKeyItem ? (
                    <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--surface-container)] p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--secondary)]/15 text-[var(--secondary)]">
                            <Key size={14} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[var(--text-primary)]">
                              {selectedKeyItem.name}
                            </p>
                            <p className="text-[10px] text-[var(--text-muted)]">
                              Type {selectedKeyItem.key_type || "SSH"}
                              {selectedKeyItem.username && ` · ${selectedKeyItem.username}`}
                            </p>
                          </div>
                        </div>

                        {selectedKeyItem.public_key && (
                          <button
                            type="button"
                            onClick={() => handleCopyPublicKey(selectedKeyItem.public_key)}
                            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                              copied
                                ? "bg-[var(--success)] text-black"
                                : "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)]"
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
                        )}
                      </div>

                      {selectedKeyItem.public_key && (
                        <div className="rounded-lg bg-[var(--canvas)] p-2 font-mono text-[11px] text-[var(--text-primary)] select-all break-all border border-[var(--border)] max-h-16 overflow-y-auto">
                          {selectedKeyItem.public_key}
                        </div>
                      )}

                      <p className="text-[11px] text-[var(--text-muted)]">
                        This host will authenticate using the{" "}
                        <strong className="text-[var(--text-primary)]">
                          {selectedKeyItem.name}
                        </strong>{" "}
                        private key from your Keychain.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-container)]/40 p-4 text-center">
                      <KeyRound size={22} className="mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        {availableKeys.length > 0
                          ? "Select an SSH key from Keychain above"
                          : "No SSH keys found in Keychain"}
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-relaxed">
                        To add, generate, or import SSH private keys, manage them in the{" "}
                        <strong className="text-[var(--text-primary)]">Keychain</strong> menu.
                      </p>
                      {onOpenKeychain && (
                        <button
                          type="button"
                          onClick={() => {
                            closeHostModal();
                            onOpenKeychain();
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)]/15 px-3 py-1.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--primary)]/25 border border-[var(--primary)]/30 transition-colors"
                        >
                          <KeyRound size={13} />
                          <span>Go to Keychain</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={closeHostModal}
              className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-high)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--primary)] px-5 py-2 text-xs font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50 shadow-sm"
            >
              {submitting ? "Saving..." : editingHost ? "Update Host" : "Save Host"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  X,
  Server,
  Key,
  Lock,
  Upload,
  Sparkles,
  Copy,
  Check,
  KeyRound,
  UserCheck,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useHostStore } from "../../stores/useHostStore";
import { useKeychainStore } from "../../stores/useKeychainStore";
import { api, HostInput } from "../../lib/api";

export function HostModal() {
  const { isHostModalOpen, editingHost, closeHostModal, saveHost, folders } =
    useHostStore();
  const { items: keychainItems, saveKey: saveKeychainKey } =
    useKeychainStore();

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

  // Keychain selection
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [saveToKeychain, setSaveToKeychain] = useState(false);
  const [keychainSaveName, setKeychainSaveName] = useState("");

  // Private key helpers: import from disk, generate new pair, derive/copy public key
  const [keyAlgorithm, setKeyAlgorithm] = useState<
    "ed25519" | "rsa" | "ecdsa-p256"
  >("ed25519");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [publicKeyLoading, setPublicKeyLoading] = useState(false);
  const [publicKeyError, setPublicKeyError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Only actual private keys can authenticate an SSH session — a Keychain
  // item saved from a public key (ssh-rsa/ssh-ed25519 ...) has no private
  // key material and would fail to connect, so it's excluded here.
  const availableKeys = keychainItems.filter((i) => i.kind === "private_key");
  const availableIdentities = keychainItems.filter((i) => i.kind === "password");

  const isPublicKeyPasted =
    Boolean(secret.trim()) &&
    (secret.trim().startsWith("ssh-") ||
      secret.trim().startsWith("ecdsa-") ||
      secret.trim().startsWith("sk-"));

  const selectedKeyItem = availableKeys.find(
    (k) => k.id === selectedCredentialId
  );
  const selectedIdentityItem = availableIdentities.find(
    (i) => i.id === selectedCredentialId
  );

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
      setSelectedCredentialId(editingHost.credential_id ?? "");
      setSecret("");
      setPassphrase("");
      setSaveToKeychain(false);
      setKeychainSaveName("");
      setPublicKey(null);
      setPublicKeyError(null);
    } else {
      setLabel("");
      setAddress("");
      setPort(22);
      setUsername("root");
      setAuthMethod("password");
      setSelectedCredentialId("");
      setSecret("");
      setPassphrase("");
      setTagInput("");
      setFolderId("");
      setSaveToKeychain(false);
      setKeychainSaveName("");
      setPublicKey(null);
      setPublicKeyError(null);
    }
    setError(null);
  }, [editingHost, isHostModalOpen]);

  // When a keychain item is selected, update default username if not set
  function handleSelectCredential(id: string) {
    setSelectedCredentialId(id);
    if (!id || id === "custom") return;

    const item = keychainItems.find((k) => k.id === id);
    if (item?.username && (!username.trim() || username === "root")) {
      setUsername(item.username);
    }
  }

  // Automatically derive the OpenSSH public key whenever the user pastes/types
  // a private key, changes passphrase, or loads one from disk.
  useEffect(() => {
    if (authMethod !== "private_key" || selectedCredentialId || !secret.trim()) {
      if (!selectedCredentialId) {
        setPublicKey(null);
        setPublicKeyError(null);
      }
      return;
    }

    let cancelled = false;
    setPublicKeyLoading(true);

    api
      .derivePublicKey(secret, passphrase.trim() ? passphrase : undefined)
      .then((pub) => {
        if (!cancelled) {
          setPublicKey(pub);
          setPublicKeyError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPublicKey(null);
          setPublicKeyError(String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setPublicKeyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authMethod, secret, passphrase, selectedCredentialId]);

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
      setSecret(content);
      setSelectedCredentialId("");

      const parts = selected.split(/[\/\\]/);
      const fileName = parts[parts.length - 1];
      if (fileName) {
        setKeychainSaveName(fileName);
      }
    } catch (err) {
      setError(`Failed to read key file: ${err}`);
    }
  }

  async function handleGenerateKeyPair() {
    setError(null);
    try {
      const comment = `${username.trim() || "root"}@${address.trim() || "termimus"}`;
      const res = await api.generateKeyPair(keyAlgorithm, comment);
      setSecret(res.private_key_pem);
      setPublicKey(res.public_key_openssh);
      setPublicKeyError(null);
      setPassphrase("");
      setSelectedCredentialId("");
      setKeychainSaveName(label.trim() || `${address.trim() || "server"}-key`);
    } catch (err) {
      setError(`Key generation failed: ${err}`);
    }
  }

  async function handleCopyPublicKey(keyText?: string | null) {
    const toCopy = keyText || publicKey;
    if (!toCopy) return;
    try {
      await navigator.clipboard.writeText(toCopy);
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

    if (
      authMethod === "private_key" &&
      !selectedCredentialId &&
      isPublicKeyPasted
    ) {
      setError(
        "This looks like a Public Key (starts with ssh-rsa/ssh-ed25519). SSH login needs the Private Key instead — the file that starts with '-----BEGIN ... PRIVATE KEY-----', usually named id_rsa or id_ed25519 (without the .pub extension)."
      );
      return;
    }

    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    let credentialIdToSave: string | null = selectedCredentialId || null;

    setSubmitting(true);
    try {
      // If user checked "Also save to Keychain", create the keychain item first
      if (
        authMethod === "private_key" &&
        !selectedCredentialId &&
        saveToKeychain &&
        secret.trim()
      ) {
        const keyName =
          keychainSaveName.trim() || label.trim() || `${address.trim()}-key`;
        const item = await saveKeychainKey({
          name: keyName,
          key_type: keyAlgorithm.toUpperCase(),
          private_key_pem: secret.trim(),
          public_key: publicKey?.trim() || "",
          fingerprint: "",
          passphrase: passphrase.trim() ? passphrase : undefined,
          username: username.trim() || undefined,
        });
        credentialIdToSave = item.id;
      }

      const input: HostInput = {
        label: label.trim() || address.trim(),
        address: address.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        auth_method: authMethod,
        credential_id: credentialIdToSave,
        secret: credentialIdToSave ? undefined : secret.trim() ? secret : undefined,
        passphrase: passphrase.trim() ? passphrase : undefined,
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
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Server size={18} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editingHost ? "Edit Host" : "New Host"}
            </h2>
          </div>
          <button
            type="button"
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
                  onClick={() => {
                    setAuthMethod("password");
                    if (selectedKeyItem) setSelectedCredentialId("");
                  }}
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
                  onClick={() => {
                    setAuthMethod("private_key");
                    if (selectedIdentityItem) setSelectedCredentialId("");
                  }}
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
            <div className="space-y-3">
              {/* Keychain Identity Selector */}
              {availableIdentities.length > 0 && (
                <div>
                  <label className="mb-1 flex items-center justify-between font-medium text-[var(--text-muted)]">
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
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
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

              {!selectedCredentialId && (
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
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Keychain Key Dropdown */}
              <div>
                <label className="mb-1 flex items-center justify-between font-medium text-[var(--text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <KeyRound size={13} className="text-[var(--primary)]" />
                    Keychain Key
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)]">
                    Termius-style saved keys
                  </span>
                </label>
                <select
                  value={selectedCredentialId}
                  onChange={(e) => handleSelectCredential(e.target.value)}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                >
                  <option value="">
                    {availableKeys.length > 0
                      ? "-- Select a saved key from Keychain --"
                      : "-- No keys in Keychain (enter below) --"}
                  </option>
                  {availableKeys.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.key_type || "KEY"})
                    </option>
                  ))}
                  <option value="">+ Paste or generate custom one-off key...</option>
                </select>
              </div>

              {/* If a Keychain key is selected: show preview & copy pubkey button */}
              {selectedKeyItem ? (
                <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--surface-low)] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--secondary)]/15 text-[var(--secondary)]">
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
                    )}
                  </div>

                  {selectedKeyItem.public_key && (
                    <div className="rounded bg-[var(--canvas)] p-2 font-mono text-[11px] text-[var(--text-primary)] select-all break-all border border-[var(--border)] max-h-14 overflow-y-auto">
                      {selectedKeyItem.public_key}
                    </div>
                  )}
                  {selectedKeyItem.kind === "public_key" ? (
                    <p className="text-[11px] text-[var(--warning)]">
                      <strong>Public Key only:</strong> Direct SSH login requires the matching private key on this machine or via SSH Agent. You can copy this public key to the remote server's <code>~/.ssh/authorized_keys</code>.
                    </p>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      This host will authenticate using the{" "}
                      <strong>{selectedKeyItem.name}</strong> private key from your Keychain.
                    </p>
                  )}
                </div>
              ) : (
                /* Custom Key Entry / Import / Generator */
                <>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="font-medium text-[var(--text-muted)]">
                        Private Key (OpenSSH or RSA PEM){" "}
                        {editingHost && "(leave blank to keep unchanged)"}
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
                          title="Generate new SSH key pair"
                        >
                          <Sparkles size={11} /> Generate Key
                        </button>
                      </div>
                    </div>

                    {/* Generator algorithm selector bar */}
                    <div className="mb-2 flex items-center gap-2 rounded-md bg-[var(--surface-low)] p-1.5 border border-[var(--border)] text-[11px]">
                      <span className="text-[var(--text-muted)]">Algorithm:</span>
                      <select
                        value={keyAlgorithm}
                        onChange={(e) =>
                          setKeyAlgorithm(
                            e.target.value as "ed25519" | "rsa" | "ecdsa-p256"
                          )
                        }
                        className="rounded bg-[var(--surface-container)] px-2 py-0.5 text-xs text-[var(--text-primary)] border border-[var(--border)] focus:outline-none"
                      >
                        <option value="ed25519">Ed25519 (Recommended, fast & modern)</option>
                        <option value="rsa">RSA 4096-bit (Maximum compatibility)</option>
                        <option value="ecdsa-p256">ECDSA NIST-P256</option>
                      </select>
                    </div>

                    <textarea
                      rows={4}
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={async (e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) {
                          const text = await file.text();
                          setSecret(text);
                        }
                      }}
                      placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;... (paste PEM, import file, or click 'Generate Key')"
                      className="w-full font-mono rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
                    />

                    {isPublicKeyPasted && (
                      <div className="mt-2 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/15 p-2.5 text-xs text-[var(--danger)] leading-relaxed">
                        <strong>Public Key detected:</strong> You pasted a public key (starts with <code>ssh-rsa</code>/<code>ssh-ed25519</code>). To connect via SSH, you must provide your matching <strong>Private Key</strong> (starts with <code>-----BEGIN ... PRIVATE KEY-----</code>, usually found in <code>~/.ssh/id_rsa</code> or <code>~/.ssh/id_ed25519</code> without <code>.pub</code>).
                      </div>
                    )}
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

                  {/* Public Key Display / Copy Card */}
                  {publicKeyLoading && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-2 text-xs text-[var(--text-muted)] animate-pulse flex items-center gap-2">
                      <Key size={13} className="text-[var(--text-muted)]" />
                      <span>Deriving OpenSSH public key...</span>
                    </div>
                  )}

                  {publicKey && !publicKeyLoading && (
                    <div className="rounded-lg border border-[var(--primary)]/30 bg-[var(--surface-low)] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Key size={13} className="text-[var(--primary)]" />
                          <span className="font-semibold text-xs text-[var(--text-primary)]">
                            Public Key (OpenSSH Format)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPublicKey()}
                          className={`flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition ${
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
                        Paste this public key into the server's{" "}
                        <code className="rounded bg-[var(--surface-high)] px-1 py-0.5 text-[var(--text-primary)]">
                          ~/.ssh/authorized_keys
                        </code>{" "}
                        file to allow login with this key.
                      </p>
                    </div>
                  )}

                  {publicKeyError && secret.trim() && (
                    <div className="rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-2 text-[11px] text-[var(--warning)]">
                      Could not derive public key. If the key is passphrase-protected, enter the passphrase above.
                    </div>
                  )}

                  {/* Option to also save custom key to Keychain */}
                  {secret.trim() && (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-low)] p-2.5 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                        <input
                          type="checkbox"
                          checked={saveToKeychain}
                          onChange={(e) => setSaveToKeychain(e.target.checked)}
                          className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                        />
                        <span>Also save this key to Keychain for reuse</span>
                      </label>
                      {saveToKeychain && (
                        <div className="pl-5 pt-1">
                          <input
                            type="text"
                            value={keychainSaveName}
                            onChange={(e) => setKeychainSaveName(e.target.value)}
                            placeholder="Keychain key label (e.g. prod-key)..."
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface-container)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
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

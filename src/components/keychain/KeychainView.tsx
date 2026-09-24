import { useState, useMemo, useCallback, memo } from "react";
import {
  KeyRound,
  Plus,
  Search,
  Key,
  UserCheck,
  Copy,
  Check,
  Pencil,
  Trash2,
} from "lucide-react";
import { useKeychainStore } from "../../stores/useKeychainStore";
import { useConfirmStore } from "../../stores/useConfirmStore";
import { KeychainItem } from "../../lib/api";
import { KeyModal } from "./KeyModal";
import { IdentityModal } from "./IdentityModal";

export function KeychainView() {
  const {
    items,
    isLoading,
    searchQuery,
    setSearchQuery,
    openCreateKeyModal,
    openEditKeyModal,
    openCreateIdentityModal,
    openEditIdentityModal,
    deleteItem,
  } = useKeychainStore();

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const query = searchQuery.trim().toLowerCase();

  const { keys, identities } = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.key_type.toLowerCase().includes(query) ||
        (item.username ?? "").toLowerCase().includes(query)
      );
    });

    return {
      keys: filtered.filter((i) => i.kind === "private_key" || i.kind === "public_key"),
      identities: filtered.filter((i) => i.kind === "password"),
    };
  }, [items, query]);

  const handleCopyPublicKey = useCallback(async (item: KeychainItem) => {
    if (!item.public_key) return;
    try {
      await navigator.clipboard.writeText(item.public_key);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((prev) => (prev === item.id ? null : prev)), 2000);
    } catch (err) {
      console.error("Failed to copy public key:", err);
    }
  }, []);

  const handleDelete = useCallback(
    (item: KeychainItem) => {
      useConfirmStore.getState().confirm({
        title: item.kind === "password" ? "Delete Identity" : "Delete Key",
        message: `Are you sure you want to delete "${item.name}" from your Keychain? Any hosts using this credential will need a new one assigned. This action cannot be undone.`,
        confirmLabel: "Delete",
        isDanger: true,
        onConfirm: async () => {
          await deleteItem(item.id);
        },
      });
    },
    [deleteItem]
  );

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--canvas)] p-5 select-none">
      {/* Header */}
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5">
          <KeyRound size={20} className="text-[var(--primary)]" />
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            Keychain
          </h1>
          <span className="rounded-md bg-[var(--surface-container)] px-2 py-0.5 text-xs font-mono text-[var(--text-muted)]">
            {items.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keys & identities..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-container)] py-1.5 pl-8 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
            />
          </div>
          <button
            onClick={openCreateKeyModal}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)]"
          >
            <Plus size={14} strokeWidth={2.5} /> New Key
          </button>
          <button
            onClick={openCreateIdentityModal}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-high)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] transition hover:bg-[var(--surface-highest)]"
          >
            <Plus size={14} strokeWidth={2.5} /> New Identity
          </button>
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--text-muted)]">
          Loading Keychain...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center text-[var(--text-muted)] py-16">
          <KeyRound size={40} className="mb-2 opacity-30" />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No keys or identities saved yet
          </p>
          <p className="text-xs mt-1 max-w-sm">
            Save SSH keys and password identities here once, then pick them
            from a dropdown whenever you add or edit a host.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={openCreateKeyModal}
              className="rounded-lg bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)]"
            >
              Add Your First Key
            </button>
            <button
              onClick={openCreateIdentityModal}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-high)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-highest)]"
            >
              Add Identity
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Keys Section */}
          <div className="mb-6">
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Keys {keys.length > 0 && `(${keys.length})`}
            </h2>
            {keys.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No SSH keys match your search.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {keys.map((item) => (
                  <KeyCard
                    key={item.id}
                    item={item}
                    isCopied={copiedId === item.id}
                    onCopy={handleCopyPublicKey}
                    onEdit={openEditKeyModal}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Identities Section */}
          <div>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Identities {identities.length > 0 && `(${identities.length})`}
            </h2>
            {identities.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">
                No saved identities match your search.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {identities.map((item) => (
                  <IdentityCard
                    key={item.id}
                    item={item}
                    onEdit={openEditIdentityModal}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
      <KeyModal />
      <IdentityModal />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMOIZED KEY CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface KeyCardProps {
  item: KeychainItem;
  isCopied: boolean;
  onCopy: (item: KeychainItem) => void;
  onEdit: (item: KeychainItem) => void;
  onDelete: (item: KeychainItem) => void;
}

const KeyCard = memo(function KeyCard({
  item,
  isCopied,
  onCopy,
  onEdit,
  onDelete,
}: KeyCardProps) {
  return (
    <div className="group relative rounded-xl border border-[var(--border)] bg-[var(--surface-container)] p-3.5 transition-colors hover:border-[var(--primary)]/40 shadow-xs">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary)]/15 text-[var(--secondary)]">
          <Key size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">
              {item.name}
            </p>
            {item.kind === "public_key" && (
              <span className="rounded bg-[var(--surface-high)] px-1.5 py-0.5 text-[9px] font-mono text-[var(--secondary)] border border-[var(--secondary)]/30">
                PUB
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Type {item.key_type || "Unknown"}
            {item.username && ` · ${item.username}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 border-t border-[var(--border)] pt-2.5">
        <button
          onClick={() => onCopy(item)}
          disabled={!item.public_key}
          title="Copy public key"
          className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
            isCopied
              ? "bg-[var(--success)] text-black font-semibold"
              : "bg-[var(--surface-high)] text-[var(--text-primary)] hover:bg-[var(--surface-highest)]"
          }`}
        >
          {isCopied ? (
            <>
              <Check size={11} /> Copied
            </>
          ) : (
            <>
              <Copy size={11} /> Copy Key
            </>
          )}
        </button>
        <button
          onClick={() => onEdit(item)}
          title="Edit"
          className="flex items-center justify-center rounded-md bg-[var(--surface-high)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-highest)] hover:text-[var(--text-primary)]"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(item)}
          title="Delete"
          className="flex items-center justify-center rounded-md bg-[var(--surface-high)] p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)] transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// MEMOIZED IDENTITY CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface IdentityCardProps {
  item: KeychainItem;
  onEdit: (item: KeychainItem) => void;
  onDelete: (item: KeychainItem) => void;
}

const IdentityCard = memo(function IdentityCard({
  item,
  onEdit,
  onDelete,
}: IdentityCardProps) {
  return (
    <div className="group relative rounded-xl border border-[var(--border)] bg-[var(--surface-container)] p-3.5 transition-colors hover:border-[var(--primary)]/40 shadow-xs">
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--tertiary)]/15 text-[var(--tertiary)]">
          <UserCheck size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">
            {item.name}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Auth password
            {item.username && ` · ${item.username}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1.5 border-t border-[var(--border)] pt-2.5">
        <button
          onClick={() => onEdit(item)}
          title="Edit"
          className="flex items-center justify-center rounded-md bg-[var(--surface-high)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-highest)] hover:text-[var(--text-primary)]"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(item)}
          title="Delete"
          className="flex items-center justify-center rounded-md bg-[var(--surface-high)] p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)] transition-colors"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
});

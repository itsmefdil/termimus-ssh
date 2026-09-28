import { useEffect, useMemo, useState, useCallback, memo } from "react";
import {
  Terminal,
  Plus,
  Play,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
} from "lucide-react";
import { useSnippetStore } from "../../stores/useSnippetStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useConfirmStore } from "../../stores/useConfirmStore";
import { Snippet } from "../../lib/api";

export function SnippetView() {
  const {
    snippets,
    isLoading,
    error,
    refresh,
    deleteSnippet,
    openCreateModal,
    openEditModal,
  } = useSnippetStore();
  const { tabs, activeTabId, sendTextToActiveSession } = useSessionStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [runFeedback, setRunFeedback] = useState<{ id: string; ok: boolean } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "snippet" | "background";
    snippet?: Snippet;
  } | null>(null);

  const [copyToast, setCopyToast] = useState<string | null>(null);

  const showCopyToast = useCallback((msg: string) => {
    setCopyToast(msg);
    setTimeout(() => {
      setCopyToast((prev) => (prev === msg ? null : prev));
    }, 1800);
  }, []);

  const handleSnippetContextMenu = useCallback((e: React.MouseEvent, snippet: Snippet) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 250);
    setContextMenu({ x, y, type: "snippet", snippet });
  }, []);

  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 150);
    setContextMenu({ x, y, type: "background" });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

  useEffect(() => {
    // Only refresh if snippets empty; otherwise preloaded on unlock
    if (snippets.length === 0) {
      refresh();
    }
  }, [snippets.length, refresh]);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const hasActiveTerminal = Boolean(activeTab?.connected);

  const filteredSnippets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return snippets;
    return snippets.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [snippets, searchQuery]);

  const handleRun = useCallback(
    async (snippetId: string, command: string) => {
      const ok = await sendTextToActiveSession(command);
      setRunFeedback({ id: snippetId, ok });
      setTimeout(() => setRunFeedback((prev) => (prev?.id === snippetId ? null : prev)), 2000);
    },
    [sendTextToActiveSession]
  );

  const handleDelete = useCallback(
    (id: string, snippetTitle?: string) => {
      useConfirmStore.getState().confirm({
        title: "Delete Snippet",
        message: `Are you sure you want to delete ${snippetTitle ? `"${snippetTitle}"` : "this snippet"}? This action cannot be undone.`,
        confirmLabel: "Delete Snippet",
        isDanger: true,
        onConfirm: async () => {
          await deleteSnippet(id);
        },
      });
    },
    [deleteSnippet]
  );

  return (
    <div
      onContextMenu={handleBackgroundContextMenu}
      className="flex h-full w-full flex-col overflow-hidden bg-[var(--canvas)] p-4 select-none"
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Terminal size={18} className="text-[var(--accent)]" />
            Snippets Library
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {hasActiveTerminal
              ? `Commands run into: ${activeTab?.hostLabel}`
              : "Open an active terminal session to run snippets"}
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--accent-hover)]"
        >
          <Plus size={14} /> New Snippet
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search snippets by title, command, or tag..."
          className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!hasActiveTerminal && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
          <AlertCircle size={14} className="shrink-0" />
          <span>No connected terminal session. Open one from the Hosts tab to run snippets.</span>
        </div>
      )}

      {/* Snippet List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && snippets.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
            <Loader2 size={16} className="animate-spin mr-2 text-[var(--accent)]" />
            Loading snippets...
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center text-center text-[var(--text-muted)]">
            <Terminal size={38} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">
              {snippets.length === 0 ? "No snippets yet" : "No snippets match your search"}
            </p>
            {snippets.length === 0 && (
              <>
                <p className="text-xs mt-1 max-w-sm">
                  Save your favorite commands and run them instantly on any connected server.
                </p>
                <button
                  onClick={openCreateModal}
                  className="mt-4 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--border)]"
                >
                  Add First Snippet
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSnippets.map((snippet) => (
              <SnippetCard
                key={snippet.id}
                snippet={snippet}
                hasActiveTerminal={hasActiveTerminal}
                isRunSuccess={runFeedback?.id === snippet.id && runFeedback.ok}
                onRun={handleRun}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onContextMenu={handleSnippetContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[210px] rounded-xl border border-[var(--border)] bg-[var(--surface-high)]/95 p-1 text-xs text-[var(--text-primary)] shadow-2xl backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-75"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "snippet" && contextMenu.snippet ? (
            <>
              {/* Run in Terminal */}
              <button
                onClick={() => {
                  handleRun(contextMenu.snippet!.id, contextMenu.snippet!.command);
                  setContextMenu(null);
                }}
                disabled={!hasActiveTerminal}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group disabled:opacity-40 disabled:pointer-events-none"
              >
                <Play size={13} />
                <span>Run in Active Terminal</span>
              </button>

              <div className="my-1 h-[1px] bg-[var(--border)]" />

              {/* Copy Command */}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(contextMenu.snippet!.command);
                  showCopyToast("Copied command");
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
              >
                <Copy size={13} />
                <span>Copy Command</span>
              </button>

              {/* Edit Snippet */}
              <button
                onClick={() => {
                  openEditModal(contextMenu.snippet!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
              >
                <Pencil size={13} />
                <span>Edit Snippet</span>
              </button>

              <div className="my-1 h-[1px] bg-[var(--border)]" />

              {/* Delete Snippet */}
              <button
                onClick={() => {
                  handleDelete(contextMenu.snippet!.id, contextMenu.snippet!.title);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--danger)] hover:text-white transition-colors group"
              >
                <Trash2 size={13} />
                <span>Delete Snippet</span>
              </button>
            </>
          ) : (
            <>
              {/* New Snippet */}
              <button
                onClick={() => {
                  openCreateModal();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <Plus size={13} />
                <span>New Snippet</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Copy Toast Notification */}
      {copyToast && (
        <div className="fixed top-11 right-3.5 z-50 flex items-center gap-2 rounded-lg border border-[var(--primary)]/40 bg-[var(--surface-high)]/95 px-3 py-1.5 text-xs font-mono font-medium text-[var(--primary)] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none">
          <Check size={13} className="text-[var(--primary)] shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMOIZED SNIPPET CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface SnippetCardProps {
  snippet: Snippet;
  hasActiveTerminal: boolean;
  isRunSuccess: boolean;
  onRun: (id: string, command: string) => void;
  onEdit: (snippet: Snippet) => void;
  onDelete: (id: string, title?: string) => void;
  onContextMenu?: (e: React.MouseEvent, snippet: Snippet) => void;
}

const SnippetCard = memo(function SnippetCard({
  snippet,
  hasActiveTerminal,
  isRunSuccess,
  onRun,
  onEdit,
  onDelete,
  onContextMenu,
}: SnippetCardProps) {
  const isSecret = snippet.tags.some((t) => t.toLowerCase() === "secret");
  const [isRevealed, setIsRevealed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const displayTags = snippet.tags.filter((t) => t.toLowerCase() !== "secret");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.command);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div
      onContextMenu={(e) => onContextMenu?.(e, snippet)}
      className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--border)]/80 transition-colors shadow-xs"
    >
      <div className="flex min-w-0 items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)]">
            {snippet.title}
          </h3>
          {isSecret && (
            <span
              title="Secret snippet: command text is masked by default"
              className="flex items-center gap-1 rounded bg-[var(--warning)]/15 border border-[var(--warning)]/30 px-1.5 py-0.5 text-[9px] font-mono text-[var(--warning)] font-semibold shrink-0"
            >
              <Lock size={9} />
              <span>SECRET</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isSecret && (
            <button
              onClick={() => setIsRevealed((prev) => !prev)}
              title={isRevealed ? "Hide secret command" : "Reveal secret command"}
              className={`rounded p-1 transition-colors ${
                isRevealed
                  ? "text-[var(--warning)] bg-[var(--warning)]/15"
                  : "text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
              }`}
            >
              {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
          <button
            onClick={handleCopy}
            title={isCopied ? "Copied!" : "Copy command"}
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white transition-colors"
          >
            {isCopied ? <Check size={13} className="text-[var(--success)]" /> : <Copy size={13} />}
          </button>
          <button
            onClick={() => onEdit(snippet)}
            title="Edit snippet"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(snippet.id, snippet.title)}
            title="Delete snippet"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)] transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="mb-3 max-h-24 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-2.5">
        {isSecret && !isRevealed ? (
          <div className="font-sans text-xs tracking-widest text-[var(--text-muted)] font-bold select-none py-1">
            ••••••••••••••••••••••••••••
          </div>
        ) : (
          <pre className="text-[11px] font-mono text-[var(--text-primary)] whitespace-pre-wrap break-all select-text">
            {snippet.command}
          </pre>
        )}
      </div>

      {displayTags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {displayTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-[var(--background)] border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => onRun(snippet.id, snippet.command)}
        disabled={!hasActiveTerminal}
        className={`mt-auto flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
          isRunSuccess
            ? "bg-[var(--success)]/15 text-[var(--success)]"
            : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
        } disabled:opacity-40`}
      >
        {isRunSuccess ? (
          <>
            <CheckCircle2 size={13} />
            <span>Sent to terminal</span>
          </>
        ) : (
          <>
            <Play size={12} />
            <span>Run in Active Terminal</span>
          </>
        )}
      </button>
    </div>
  );
});

import { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";
import { useSnippetStore } from "../../stores/useSnippetStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useConfirmStore } from "../../stores/useConfirmStore";
import { SnippetModal } from "./SnippetModal";

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

  useEffect(() => {
    refresh();
  }, [refresh]);

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

  async function handleRun(snippetId: string, command: string) {
    const ok = await sendTextToActiveSession(command);
    setRunFeedback({ id: snippetId, ok });
    setTimeout(() => setRunFeedback(null), 2000);
  }

  function handleDelete(id: string, snippetTitle?: string) {
    useConfirmStore.getState().confirm({
      title: "Delete Snippet",
      message: `Are you sure you want to delete ${snippetTitle ? `"${snippetTitle}"` : "this snippet"}? This action cannot be undone.`,
      confirmLabel: "Delete Snippet",
      isDanger: true,
      onConfirm: async () => {
        await deleteSnippet(id);
      },
    });
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--background)] p-4">
      <SnippetModal />

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
            {filteredSnippets.map((snippet) => {
              const feedback = runFeedback?.id === snippet.id ? runFeedback : null;
              return (
                <div
                  key={snippet.id}
                  className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 hover:border-[var(--border)]/80 transition-colors"
                >
                  <div className="flex min-w-0 items-center justify-between mb-2">
                    <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--text-primary)] pr-2">
                      {snippet.title}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(snippet)}
                        title="Edit snippet"
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(snippet.id, snippet.title)}
                        title="Delete snippet"
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)] transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <pre className="mb-3 max-h-24 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-2.5 text-[11px] font-mono text-[var(--text-primary)] whitespace-pre-wrap break-all">
                    {snippet.command}
                  </pre>

                  {snippet.tags.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1">
                      {snippet.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-[var(--background)] border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => handleRun(snippet.id, snippet.command)}
                    disabled={!hasActiveTerminal}
                    className={`mt-auto flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                      feedback?.ok
                        ? "bg-[var(--success)]/15 text-[var(--success)]"
                        : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                    } disabled:opacity-40`}
                  >
                    {feedback?.ok ? (
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}

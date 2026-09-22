import { useState, useEffect } from "react";
import { X, Terminal } from "lucide-react";
import { useSnippetStore } from "../../stores/useSnippetStore";
import { SnippetInput } from "../../lib/api";

export function SnippetModal() {
  const { isModalOpen, editingSnippet, closeModal, saveSnippet } = useSnippetStore();

  const [title, setTitle] = useState("");
  const [command, setCommand] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingSnippet) {
      setTitle(editingSnippet.title);
      setCommand(editingSnippet.command);
      setTagInput(editingSnippet.tags.join(", "));
    } else {
      setTitle("");
      setCommand("");
      setTagInput("");
    }
    setError(null);
  }, [editingSnippet, isModalOpen]);

  if (!isModalOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!command.trim()) {
      setError("Command script is required");
      return;
    }

    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const input: SnippetInput = {
      title: title.trim(),
      command: command.trim(),
      tags,
    };

    setSubmitting(true);
    try {
      await saveSnippet(input, editingSnippet?.id);
      closeModal();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-[var(--accent)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              {editingSnippet ? "Edit Snippet" : "New Snippet"}
            </h2>
          </div>
          <button
            onClick={closeModal}
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
          <div>
            <label className="mb-1 block font-medium text-[var(--text-muted)]">
              Snippet Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Docker Restart, Check Disk Usage, Update Packages"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-muted)]">
              Command / Script *
            </label>
            <textarea
              required
              rows={6}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g.&#10;sudo apt update && sudo apt upgrade -y&#10;docker compose down && docker compose up -d"
              className="w-full font-mono rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-[var(--text-muted)]">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="docker, sysadmin, ubuntu, maintenance"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/50 focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-md px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {submitting ? "Saving..." : editingSnippet ? "Update Snippet" : "Save Snippet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

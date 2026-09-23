import { useState } from "react";
import {
  Folder,
  File,
  CornerLeftUp,
  RotateCw,
  FolderPlus,
  Trash2,
  Loader2,
  FileCode,
} from "lucide-react";
import { FileEntry } from "../../lib/api";
import { formatBytes, formatDate, parentPath } from "../../lib/format";

interface FilePaneProps {
  title: string;
  subtitle?: string;
  path: string;
  entries: FileEntry[];
  loading: boolean;
  selectedFile: FileEntry | null;
  onSelect: (entry: FileEntry | null) => void;
  onNavigate: (path: string) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteItem: (entry: FileEntry) => Promise<void>;
  onRefresh: () => void;
  onOpenFile?: (entry: FileEntry) => void;
  disabled?: boolean;
}

export function FilePane({
  title,
  subtitle,
  path,
  entries,
  loading,
  selectedFile,
  onSelect,
  onNavigate,
  onCreateFolder,
  onDeleteItem,
  onRefresh,
  onOpenFile,
  disabled = false,
}: FilePaneProps) {
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  async function handleCreateFolderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await onCreateFolder(newFolderName.trim());
    setNewFolderName("");
    setIsCreatingFolder(false);
  }

  async function handleDeleteClick(e: React.MouseEvent, entry: FileEntry) {
    e.stopPropagation();
    if (confirm(`Delete ${entry.name}?`)) {
      await onDeleteItem(entry);
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--sidebar)]">
      {/* Pane Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[var(--text-primary)]">
            {title}
          </div>
          {subtitle && (
            <div className="truncate text-[10px] text-[var(--text-muted)]">
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigate(parentPath(path))}
            disabled={disabled || path === "/" || !path}
            title="Go up"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white disabled:opacity-30"
          >
            <CornerLeftUp size={14} />
          </button>
          <button
            onClick={() => setIsCreatingFolder((v) => !v)}
            disabled={disabled}
            title="New folder"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white disabled:opacity-30"
          >
            <FolderPlus size={14} />
          </button>
          <button
            onClick={onRefresh}
            disabled={disabled || loading}
            title="Refresh"
            className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white disabled:opacity-30"
          >
            <RotateCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Path Breadcrumb Bar */}
      <div className="border-b border-[var(--border)] bg-[var(--background)] px-3 py-1 text-[11px] font-mono text-[var(--text-muted)] truncate">
        {path || "/"}
      </div>

      {/* New Folder Inline Form */}
      {isCreatingFolder && (
        <form
          onSubmit={handleCreateFolderSubmit}
          className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] p-2"
        >
          <input
            type="text"
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name..."
            className="flex-1 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-[var(--accent)] px-2.5 py-1 text-xs text-white"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingFolder(false)}
            className="text-xs text-[var(--text-muted)] hover:text-white"
          >
            Cancel
          </button>
        </form>
      )}

      {/* File Table */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
            <Loader2 size={18} className="animate-spin mr-2 text-[var(--accent)]" />
            Loading files...
          </div>
        ) : disabled ? (
          <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
            Not connected
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
            Empty directory
          </div>
        ) : (
          <table className="w-full table-fixed text-left text-xs">
            <thead className="sticky top-0 bg-[var(--sidebar)] text-[10px] uppercase text-[var(--text-muted)] border-b border-[var(--border)]">
              <tr>
                <th className="py-1.5 pl-3">Name</th>
                <th className="py-1.5 pr-2 w-20 text-right">Size</th>
                <th className="py-1.5 pr-3 w-32 text-right">Modified</th>
                <th className="py-1.5 pr-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isSelected = selectedFile?.path === entry.path;
                return (
                  <tr
                    key={entry.path}
                    onClick={() => onSelect(entry)}
                    onDoubleClick={() => {
                      if (entry.is_dir) {
                        onNavigate(entry.path);
                      } else {
                        onOpenFile?.(entry);
                      }
                    }}
                    className={`group cursor-pointer select-none transition-colors border-b border-[var(--border)]/30 ${
                      isSelected
                        ? "bg-[var(--accent)]/20 text-[var(--text-primary)]"
                        : "hover:bg-[var(--card)] text-[var(--text-primary)]"
                    }`}
                  >
                    <td className="py-1.5 pl-3 flex min-w-0 items-center gap-2">
                      {entry.is_dir ? (
                        <Folder
                          size={14}
                          className="shrink-0 text-[var(--accent)]"
                        />
                      ) : (
                        <File
                          size={14}
                          className="shrink-0 text-[var(--text-muted)]"
                        />
                      )}
                      <span className="truncate">{entry.name}</span>
                    </td>
                    <td className="py-1.5 pr-2 text-right text-[11px] text-[var(--text-muted)]">
                      {entry.is_dir ? "-" : formatBytes(entry.size)}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-[11px] text-[var(--text-muted)]">
                      {formatDate(entry.modified)}
                    </td>
                    <td className="py-1.5 pr-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!entry.is_dir && onOpenFile && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenFile(entry);
                            }}
                            title="Edit file"
                            className="rounded p-0.5 text-[var(--text-muted)] opacity-0 hover:text-[var(--primary)] hover:bg-[var(--border)] group-hover:opacity-100 hover:opacity-100 transition-opacity"
                          >
                            <FileCode size={13} />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteClick(e, entry)}
                          title="Delete"
                          className="rounded p-0.5 text-[var(--text-muted)] opacity-0 hover:text-[var(--danger)] hover:bg-[var(--border)] group-hover:opacity-100 hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

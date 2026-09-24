import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Server,
  Loader2,
  AlertCircle,
  Unplug,
} from "lucide-react";
import { useSftpStore } from "../../stores/useSftpStore";
import { useHostStore } from "../../stores/useHostStore";
import { FilePane } from "./FilePane";
import { FileEditorModal } from "./FileEditorModal";
import { FileEntry } from "../../lib/api";

export function SftpView() {
  const { hosts } = useHostStore();
  const [editingFile, setEditingFile] = useState<{ file: FileEntry; isRemote: boolean } | null>(
    null
  );
  const {
    remoteHost,
    remoteSessionId,
    remotePath,
    remoteEntries,
    remoteLoading,
    selectedRemoteFile,
    localPath,
    localEntries,
    localLoading,
    selectedLocalFile,
    transferring,
    transferMessage,
    error,
    initLocal,
    navigateLocal,
    selectLocalFile,
    createLocalFolder,
    deleteLocalItem,
    connectRemote,
    navigateRemote,
    selectRemoteFile,
    createRemoteFolder,
    deleteRemoteItem,
    disconnectRemote,
    uploadSelected,
    downloadSelected,
  } = useSftpStore();

  useEffect(() => {
    initLocal();
  }, [initLocal]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--canvas)] p-3">
      {/* Top SFTP Control Bar */}
      <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-[var(--accent)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Remote Server:
            </span>
          </div>
          <select
            value={remoteHost?.id ?? ""}
            onChange={(e) => {
              const host = hosts.find((h) => h.id === e.target.value);
              if (host) connectRemote(host);
            }}
            disabled={remoteLoading || transferring}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none transition-colors cursor-pointer disabled:opacity-50"
          >
            <option value="">Select a host to connect...</option>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label} ({h.username}@{h.address})
              </option>
            ))}
          </select>

          {remoteSessionId && (
            <button
              onClick={disconnectRemote}
              title="Disconnect SFTP"
              className="flex items-center gap-1 rounded bg-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-white"
            >
              <Unplug size={12} /> Disconnect
            </button>
          )}
        </div>

        {/* Transfer Status Banner */}
        {transferring && (
          <div className="flex items-center gap-2 text-xs text-[var(--accent)]">
            <Loader2 size={14} className="animate-spin" />
            <span>{transferMessage}</span>
          </div>
        )}
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dual Pane + Center Transfer Buttons */}
      <div className="flex min-h-0 flex-1 gap-2 overflow-hidden">
        {/* Left Pane: Local Files */}
        <FilePane
          title="Local Machine"
          subtitle={localPath}
          path={localPath}
          entries={localEntries}
          loading={localLoading}
          selectedFile={selectedLocalFile}
          onSelect={selectLocalFile}
          onNavigate={navigateLocal}
          onCreateFolder={createLocalFolder}
          onDeleteItem={deleteLocalItem}
          onRefresh={() => navigateLocal(localPath)}
          onOpenFile={(entry) => setEditingFile({ file: entry, isRemote: false })}
        />

        {/* Center Transfer Buttons */}
        <div className="flex shrink-0 flex-col items-center justify-center gap-2 px-1">
          <button
            onClick={uploadSelected}
            disabled={
              !selectedLocalFile ||
              selectedLocalFile.is_dir ||
              !remoteSessionId ||
              transferring
            }
            title={
              selectedLocalFile && !selectedLocalFile.is_dir
                ? `Upload "${selectedLocalFile.name}" to remote`
                : "Select a local file to upload"
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white shadow-md transition hover:bg-[var(--accent-hover)] disabled:opacity-20"
          >
            <ArrowRight size={16} />
          </button>

          <button
            onClick={downloadSelected}
            disabled={
              !selectedRemoteFile ||
              selectedRemoteFile.is_dir ||
              !remoteSessionId ||
              transferring
            }
            title={
              selectedRemoteFile && !selectedRemoteFile.is_dir
                ? `Download "${selectedRemoteFile.name}" to local`
                : "Select a remote file to download"
            }
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--accent)] text-white shadow-md transition hover:bg-[var(--accent-hover)] disabled:opacity-20"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        {/* Right Pane: Remote Server Files */}
        <FilePane
          title={remoteHost ? remoteHost.label : "Remote Server"}
          subtitle={
            remoteHost
              ? `${remoteHost.username}@${remoteHost.address}`
              : "No connection"
          }
          path={remotePath}
          entries={remoteEntries}
          loading={remoteLoading}
          selectedFile={selectedRemoteFile}
          onSelect={selectRemoteFile}
          onNavigate={navigateRemote}
          onCreateFolder={createRemoteFolder}
          onDeleteItem={deleteRemoteItem}
          onRefresh={() => navigateRemote(remotePath)}
          onOpenFile={(entry) => setEditingFile({ file: entry, isRemote: true })}
          disabled={!remoteSessionId}
        />
      </div>

      {/* In-App SFTP File Editor Modal */}
      {editingFile && (
        <FileEditorModal
          file={editingFile.file}
          isRemote={editingFile.isRemote}
          sessionId={remoteSessionId}
          onClose={() => setEditingFile(null)}
          onSaved={() => {
            if (editingFile.isRemote) {
              navigateRemote(remotePath);
            } else {
              navigateLocal(localPath);
            }
          }}
        />
      )}
    </div>
  );
}

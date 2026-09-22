import { useRef, useState } from "react";
import {
  DownloadCloud,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Archive,
} from "lucide-react";
import { api, ImportSummary } from "../../lib/api";

export function BackupRestoreSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const json = await api.exportBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `termimus-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Export failed: ${String(e)}`);
    } finally {
      setExporting(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImportSummary(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setPendingImportJson(text);
    };
    reader.onerror = () => {
      setError("Failed to read the selected file");
    };
    reader.readAsText(file);

    // Reset input so selecting the same file again re-triggers onChange
    e.target.value = "";
  }

  async function handleConfirmImport(replaceAll: boolean) {
    if (!pendingImportJson) return;

    setImporting(true);
    setError(null);
    try {
      const summary = await api.importBackup(pendingImportJson, replaceAll);
      setImportSummary(summary);
      setPendingImportJson(null);
    } catch (e) {
      setError(`Import failed: ${String(e)}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-low)] p-6 shadow-xl">
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-4 mb-4">
        <Archive size={18} className="text-[var(--secondary)]" />
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            Encrypted Backup & Restore
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Export all hosts, folders, snippets, tunnels, and trusted keys into a single portable file.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          <AlertTriangle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {importSummary && (
        <div className="mb-4 rounded-md border border-[var(--success)]/30 bg-[var(--success)]/10 px-3 py-2.5 text-xs text-[var(--success)]">
          <div className="flex items-center gap-2 font-semibold mb-1.5">
            <CheckCircle2 size={14} />
            Backup restored successfully
          </div>
          <div className="grid grid-cols-3 gap-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
            <span>Hosts: {importSummary.hosts}</span>
            <span>Folders: {importSummary.folders}</span>
            <span>Credentials: {importSummary.credentials}</span>
            <span>Snippets: {importSummary.snippets}</span>
            <span>Tunnels: {importSummary.port_forwards}</span>
            <span>Known Hosts: {importSummary.known_hosts}</span>
          </div>
          {importSummary.vault_meta_restored && (
            <p className="mt-1.5 text-[11px] text-[var(--warning)]">
              Vault master password was also restored from the backup file.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Export */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container)]/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DownloadCloud size={16} className="text-[var(--primary)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Export Backup
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-3">
            Downloads a JSON file with everything encrypted at rest (AES-256-GCM ciphertext). Store it somewhere safe.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] py-2 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)] transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <DownloadCloud size={13} />
            )}
            <span>{exporting ? "Exporting..." : "Download Backup"}</span>
          </button>
        </div>

        {/* Import */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-container)]/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <UploadCloud size={16} className="text-[var(--secondary)]" />
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Restore from File
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)] mb-3">
            Select a Termimus backup file to merge or replace your current data.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-high)] py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-highest)] transition-colors disabled:opacity-50"
          >
            <UploadCloud size={13} />
            <span>Choose Backup File...</span>
          </button>
        </div>
      </div>

      {/* Confirm Import Mode Dialog */}
      {pendingImportJson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface-low)] p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={18} className="text-[var(--warning)]" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Choose Restore Mode
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mb-4">
              How should this backup be applied to your current data?
            </p>

            <div className="space-y-2 mb-4">
              <button
                onClick={() => handleConfirmImport(false)}
                disabled={importing}
                className="w-full text-left rounded-lg border border-[var(--border)] bg-[var(--surface-container)] p-3 hover:border-[var(--primary)]/50 transition-colors disabled:opacity-50"
              >
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  Merge (Recommended)
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Adds new items and updates existing ones by ID. Nothing is deleted.
                </div>
              </button>

              <button
                onClick={() => handleConfirmImport(true)}
                disabled={importing}
                className="w-full text-left rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/5 p-3 hover:border-[var(--danger)]/60 transition-colors disabled:opacity-50"
              >
                <div className="text-xs font-semibold text-[var(--danger)]">
                  Replace All
                </div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Deletes all current hosts, folders, snippets, and tunnels before restoring.
                </div>
              </button>
            </div>

            <button
              onClick={() => setPendingImportJson(null)}
              disabled={importing}
              className="w-full rounded-lg px-3 py-2 text-xs text-[var(--text-muted)] hover:bg-[var(--surface-container)] hover:text-white transition-colors"
            >
              Cancel
            </button>

            {importing && (
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[var(--primary)]">
                <Loader2 size={14} className="animate-spin" />
                Restoring backup...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

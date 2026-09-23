import { useState, useMemo } from "react";
import {
  Server,
  Plug,
  Terminal as TerminalIcon,
  AlertCircle,
  RotateCw,
  Pencil,
  Copy,
  Check,
  X,
} from "lucide-react";
import { Host } from "../../lib/api";
import { useHostStore } from "../../stores/useHostStore";
import { useSessionStore } from "../../stores/useSessionStore";

export interface ConnectionLog {
  timestamp: string;
  step: number;
  message: string;
  isError: boolean;
}

interface ConnectionProgressProps {
  sessionId: string;
  host?: Host | null;
  logs: ConnectionLog[];
  currentStep: number; // 1 to 5 (5 is ready)
  error: string | null;
  onRetry: () => void;
  onClose: () => void;
}

export function ConnectionProgress({
  host,
  logs,
  currentStep,
  error,
  onRetry,
  onClose,
}: ConnectionProgressProps) {
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);
  const { openEditModal } = useHostStore();
  const { closeSession, activeTabId } = useSessionStore();

  const isFailed = Boolean(error);

  // Pick OS / distro badge or stylish server badge based on label or address
  const osType = useMemo(() => {
    const text = `${host?.label || ""} ${host?.tags.join(" ") || ""}`.toLowerCase();
    if (text.includes("debian")) return "debian";
    if (text.includes("ubuntu")) return "ubuntu";
    if (text.includes("alpine")) return "alpine";
    if (text.includes("centos") || text.includes("rhel") || text.includes("rocky"))
      return "redhat";
    return "linux";
  }, [host]);

  async function handleCopyLog() {
    const text = logs
      .map(
        (l) =>
          `[${new Date(l.timestamp).toLocaleTimeString()}] ${l.isError ? "ERROR: " : ""}${l.message}`
      )
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || error || "No logs available");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  // Calculate progress percentage:
  // Step 1: 15% (connecting)
  // Step 2: 45% (host key)
  // Step 3: 75% (authenticating)
  // Step 4: 90% (opening pty/shell)
  // Step 5: 100% (ready)
  const progressPercent = useMemo(() => {
    if (isFailed) return 50;
    switch (currentStep) {
      case 1:
        return 20;
      case 2:
        return 50;
      case 3:
        return 75;
      case 4:
        return 90;
      case 5:
        return 100;
      default:
        return 15;
    }
  }, [currentStep, isFailed]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0d1117] p-6 text-[var(--text-primary)] select-none">
      {/* Centered Termius-style Card Container */}
      <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header: Badge, Host details, Show Logs Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {/* OS / Server Badge */}
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-transform duration-300 ${
                osType === "debian"
                  ? "bg-[#d70a53] text-white shadow-[#d70a53]/20"
                  : osType === "ubuntu"
                  ? "bg-[#e95420] text-white shadow-[#e95420]/20"
                  : osType === "alpine"
                  ? "bg-[#0d597f] text-white shadow-[#0d597f]/20"
                  : "bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]/30"
              }`}
            >
              {osType === "debian" ? (
                // Debian swirl glyph
                <svg viewBox="0 0 100 100" className="h-7 w-7 fill-current">
                  <path d="M50 15c-18 0-33 13-35 31-2 15 6 29 20 35 15 6 32 1 40-12 9-14 4-33-9-42-12-8-29-5-38 6-7 9-5 22 4 29 8 5 18 3 24-4 4-5 3-12-2-16-4-3-10-2-13 2" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
                </svg>
              ) : (
                <Server size={24} />
              )}
            </div>

            {/* Host Name & Address */}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-white">
                {host?.label || "Remote Server"}
              </h2>
              <p className="truncate font-mono text-xs text-[var(--text-muted)]">
                SSH {host?.address || "server"}:{host?.port || 22}
              </p>
            </div>
          </div>

          {/* Show Logs Toggle Button */}
          <button
            onClick={() => setShowLogs((prev) => !prev)}
            className="rounded-xl border border-[var(--border)] bg-[#21262d] px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#30363d] shadow-sm"
          >
            {showLogs || isFailed ? "Hide logs" : "Show logs"}
          </button>
        </div>

        {/* Process Tree: Horizontal Connecting Line & Stage Nodes (Termius-style) */}
        <div className="relative py-2">
          {/* Background Track */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[3px] rounded-full bg-[#21262d]" />

          {/* Active Progress Fill */}
          <div
            className={`absolute left-6 top-1/2 -translate-y-1/2 h-[3px] rounded-full transition-all duration-500 ${
              isFailed ? "bg-[var(--danger)]" : "bg-[#38bdf8]"
            }`}
            style={{ width: `calc(${progressPercent}% - 24px)` }}
          />

          {/* Stage Nodes */}
          <div className="relative flex items-center justify-between">
            {/* Start Node: Plug / Socket */}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-all duration-300 ${
                isFailed && currentStep === 1
                  ? "bg-[var(--danger)] ring-4 ring-[var(--danger)]/25"
                  : "bg-[#38bdf8] ring-4 ring-[#38bdf8]/20"
              }`}
            >
              <Plug size={15} />
            </div>

            {/* End Node: Terminal Shell */}
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-all duration-300 ${
                isFailed
                  ? "bg-[var(--danger)] ring-4 ring-[var(--danger)]/25"
                  : currentStep >= 5
                  ? "bg-[#38bdf8] ring-4 ring-[#38bdf8]/20"
                  : "bg-[#21262d] text-[var(--text-muted)] border border-[#30363d]"
              }`}
            >
              {isFailed ? (
                <AlertCircle size={15} />
              ) : (
                <TerminalIcon size={15} />
              )}
            </div>
          </div>
        </div>

        {/* Current status line */}
        <div className="text-center">
          <p
            className={`text-xs font-medium transition-colors ${
              isFailed ? "text-[var(--danger)] font-semibold" : "text-[var(--text-secondary)]"
            }`}
          >
            {isFailed
              ? error
              : logs.length > 0
              ? logs[logs.length - 1].message
              : `Connecting to ${host?.address || "server"}...`}
          </p>
        </div>

        {/* Logs Console in the Center (Auto-shown on failure or when user toggles 'Show logs') */}
        {(showLogs || isFailed) && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Connection Log
              </span>
              <button
                onClick={handleCopyLog}
                className="flex items-center gap-1 rounded bg-[#21262d] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)] hover:text-white border border-[var(--border)] transition"
              >
                {copied ? (
                  <>
                    <Check size={11} className="text-[var(--success)]" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={11} /> Copy Log
                  </>
                )}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-xl border border-[var(--border)] bg-[#05070a] p-3 font-mono text-[11px] leading-relaxed shadow-inner">
              {logs.length === 0 ? (
                <p className="text-[var(--text-muted)]">No logs yet...</p>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 ${
                      log.isError
                        ? "text-[var(--danger)] font-semibold"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <span className="shrink-0 text-[var(--text-muted)]/60">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="break-all">{log.message}</span>
                  </div>
                ))
              )}
              {isFailed && !logs.some((l) => l.message === error) && (
                <div className="flex items-start gap-2 text-[var(--danger)] font-semibold pt-1">
                  <span className="shrink-0 text-[var(--danger)]/60">
                    {new Date().toLocaleTimeString()}
                  </span>
                  <span className="break-all">{error}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons on Failure */}
        {isFailed && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={onRetry}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] shadow-md"
            >
              <RotateCw size={13} /> Retry
            </button>

            {host && (
              <button
                onClick={() => openEditModal(host)}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[#21262d] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#30363d]"
              >
                <Pencil size={13} /> Edit Host
              </button>
            )}

            <button
              onClick={() => {
                if (activeTabId) closeSession(activeTabId);
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[#21262d] px-3.5 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:text-white"
            >
              <X size={13} /> Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

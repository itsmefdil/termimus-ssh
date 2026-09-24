import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { api } from "../../lib/api";
import { useSessionStore } from "../../stores/useSessionStore";
import { useHostStore } from "../../stores/useHostStore";
import { ConnectionProgress, ConnectionLog } from "./ConnectionProgress";

interface XtermViewProps {
  sessionId: string;
  hostId: string;
  visible: boolean;
}

interface SshProgressEvent {
  step: number;
  step_name: string;
  message: string;
  timestamp: string;
  is_error: boolean;
}

interface TerminalSessionEntry {
  term: Terminal;
  fitAddon: FitAddon;
  element: HTMLDivElement;
  hasConnected: boolean;
  unlistenFns: Array<() => void>;
  dataDisposable: { dispose: () => void };
  lastSize: { cols: number; rows: number };
}

// Module-level persistent pool of active xterm instances.
// Keeps active SSH sessions, PTY streams, and terminal buffers alive across
// React layout reconciliations (splitting, moving tabs, un-splitting, resizing).
const terminalPool = new Map<string, TerminalSessionEntry>();

/**
 * Cleanly disposes a terminal session when a tab is explicitly closed.
 */
export function disposeTerminalSession(sessionId: string) {
  const entry = terminalPool.get(sessionId);
  if (!entry) return;

  try {
    entry.dataDisposable.dispose();
  } catch {
    // ignore
  }

  entry.unlistenFns.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });

  try {
    entry.term.dispose();
  } catch {
    // ignore
  }

  terminalPool.delete(sessionId);
}

export function XtermView({ sessionId, hostId, visible }: XtermViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastSizeRef = useRef<{ cols: number; rows: number }>({ cols: 0, rows: 0 });

  const setConnected = useSessionStore((s) => s.setSessionConnected);
  const setError = useSessionStore((s) => s.setSessionError);
  const closeSession = useSessionStore((s) => s.closeSession);
  const host = useHostStore((s) => s.hosts.find((h) => h.id === hostId));

  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const startConnection = useCallback(
    (cols: number, rows: number) => {
      setConnectionError(null);
      setIsConnected(false);
      setCurrentStep(1);
      setLogs([
        {
          step: 1,
          message: `Initiating connection to ${host?.address || "server"}...`,
          timestamp: new Date().toISOString(),
          isError: false,
        },
      ]);

      api
        .connectSsh(hostId, sessionId, cols, rows)
        .then(() => {
          setIsConnected(true);
          setConnected(sessionId, true);
          setConnectionError(null);
        })
        .catch((e) => {
          const errStr = String(e);
          setConnectionError(errStr);
          setError(sessionId, errStr);
          termRef.current?.write(`\r\n\x1b[31mFailed to connect: ${errStr}\x1b[0m\r\n`);
        });
    },
    [hostId, sessionId, host, setConnected, setError]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let entry = terminalPool.get(sessionId);

    if (entry) {
      // Reuse existing terminal instance without reconnecting SSH!
      termRef.current = entry.term;
      fitAddonRef.current = entry.fitAddon;
      lastSizeRef.current = entry.lastSize;
      setIsConnected(true);

      if (entry.element.parentElement !== containerRef.current) {
        containerRef.current.appendChild(entry.element);
      }
    } else {
      // Create new terminal instance
      const domWrapper = document.createElement("div");
      domWrapper.className = "w-full h-full";
      containerRef.current.appendChild(domWrapper);

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: "bar",
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
        fontSize: 13.5,
        lineHeight: 1.35,
        letterSpacing: 0,
        scrollback: 5000,
        theme: {
          background: "#0a0e14",
          foreground: "#f0f6fc",
          cursor: "#00d2b4",
          cursorAccent: "#0a0e14",
          selectionBackground: "#00d2b433",
          black: "#161b22",
          red: "#f85149",
          green: "#3fb950",
          yellow: "#e3b341",
          blue: "#38bdf8",
          magenta: "#cbacff",
          cyan: "#2adec0",
          white: "#f0f6fc",
          brightBlack: "#6e7681",
          brightRed: "#ff7b72",
          brightGreen: "#56d364",
          brightYellow: "#e3b341",
          brightBlue: "#79c0ff",
          brightMagenta: "#d2a8ff",
          brightCyan: "#56d4dd",
          brightWhite: "#f0f6fc",
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(domWrapper);

      let initialCols = 80;
      let initialRows = 24;
      try {
        if (containerRef.current.clientWidth >= 100 && containerRef.current.clientHeight >= 100) {
          fitAddon.fit();
          initialCols = Math.max(term.cols, 20);
          initialRows = Math.max(term.rows, 5);
        }
      } catch {
        // fallback
      }

      lastSizeRef.current = { cols: initialCols, rows: initialRows };
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Keystroke forwarding
      const dataDisposable = term.onData((data) => {
        const bytes = Array.from(new TextEncoder().encode(data));
        api.writeSsh(sessionId, bytes).catch((e) => console.error("ssh_write failed:", e));
      });

      // Stream listeners
      const unlistenFns: Array<() => void> = [];
      listen<number[]>(`ssh-data-${sessionId}`, (event) => {
        const bytes = new Uint8Array(event.payload);
        term.write(bytes);
      }).then((unlisten) => unlistenFns.push(unlisten));

      listen<string>(`ssh-closed-${sessionId}`, () => {
        setConnected(sessionId, false);
        setIsConnected(false);
        term.write("\r\n\x1b[31m[Connection closed]\x1b[0m\r\n");
      }).then((unlisten) => unlistenFns.push(unlisten));

      listen<SshProgressEvent>(`ssh-progress-${sessionId}`, (event) => {
        const p = event.payload;
        setCurrentStep(p.step);
        setLogs((prev) => [
          ...prev,
          {
            step: p.step,
            message: p.message,
            timestamp: p.timestamp,
            isError: p.is_error,
          },
        ]);
        if (p.is_error) {
          setConnectionError(p.message);
        }
      }).then((unlisten) => unlistenFns.push(unlisten));

      entry = {
        term,
        fitAddon,
        element: domWrapper,
        hasConnected: true,
        unlistenFns,
        dataDisposable,
        lastSize: { cols: initialCols, rows: initialRows },
      };
      terminalPool.set(sessionId, entry);

      startConnection(initialCols, initialRows);
    }

    // Resize observer guarding cols >= 20 and rows >= 5
    const handleResize = () => {
      if (!containerRef.current || !termRef.current || !fitAddonRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      if (width < 100 || height < 100) return;

      try {
        fitAddonRef.current.fit();
        const cols = termRef.current.cols;
        const rows = termRef.current.rows;

        if (cols >= 20 && rows >= 5) {
          if (
            lastSizeRef.current.cols !== cols ||
            lastSizeRef.current.rows !== rows
          ) {
            lastSizeRef.current = { cols, rows };
            if (entry) {
              entry.lastSize = { cols, rows };
            }
            api.resizeSsh(sessionId, cols, rows).catch(() => {});
          }
        }
      } catch {
        // ignore fit during layout animation
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      // Remove wrapper from container so it can be re-appended on next mount if moved
      if (entry && containerRef.current && entry.element.parentElement === containerRef.current) {
        containerRef.current.removeChild(entry.element);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // When tab becomes visible again after switching from another tab or view
  useEffect(() => {
    if (!visible || !termRef.current || !fitAddonRef.current || !containerRef.current) return;

    const timer = setTimeout(() => {
      if (!containerRef.current || !termRef.current || !fitAddonRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      if (width < 100 || height < 100) return;

      try {
        fitAddonRef.current.fit();
        const cols = termRef.current.cols;
        const rows = termRef.current.rows;
        if (cols >= 20 && rows >= 5) {
          if (
            lastSizeRef.current.cols !== cols ||
            lastSizeRef.current.rows !== rows
          ) {
            lastSizeRef.current = { cols, rows };
            const entry = terminalPool.get(sessionId);
            if (entry) entry.lastSize = { cols, rows };
            api.resizeSsh(sessionId, cols, rows).catch(() => {});
          }
        }
        termRef.current.refresh(0, termRef.current.rows - 1);
        termRef.current.focus();
      } catch {
        // ignore
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [visible, sessionId]);

  const handleRetry = () => {
    const cols = lastSizeRef.current.cols || 80;
    const rows = lastSizeRef.current.rows || 24;
    startConnection(cols, rows);
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        visibility: visible ? "visible" : "hidden",
        pointerEvents: visible ? "auto" : "none",
        zIndex: visible ? 10 : 0,
      }}
    >
      {/* Terminal Viewport */}
      <div ref={containerRef} className="absolute inset-0 p-2" />

      {/* Termius-Style Connection Progress & Process Tree Overlay */}
      {(!isConnected || connectionError) && (
        <ConnectionProgress
          sessionId={sessionId}
          host={host}
          logs={logs}
          currentStep={currentStep}
          error={connectionError}
          onRetry={handleRetry}
          onClose={() => closeSession(sessionId)}
        />
      )}
    </div>
  );
}

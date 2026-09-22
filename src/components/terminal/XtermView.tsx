import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { listen } from "@tauri-apps/api/event";
import { api } from "../../lib/api";
import { useSessionStore } from "../../stores/useSessionStore";

interface XtermViewProps {
  sessionId: string;
  hostId: string;
  visible: boolean;
}

export function XtermView({ sessionId, hostId, visible }: XtermViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const setConnected = useSessionStore((s) => s.setSessionConnected);
  const setError = useSessionStore((s) => s.setSessionError);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
      fontSize: 14,
      theme: {
        background: "#0f1117",
        foreground: "#e6edf3",
        cursor: "#3b82f6",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    try {
      term.loadAddon(new WebglAddon());
    } catch {
      // WebGL not supported in this environment — xterm falls back to canvas rendering.
    }

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Forward keystrokes to backend
    const dataDisposable = term.onData((data) => {
      const bytes = Array.from(new TextEncoder().encode(data));
      api.writeSsh(sessionId, bytes).catch((e) => console.error("ssh_write failed:", e));
    });

    // Listen for backend -> frontend data stream
    const unlistenPromises = [
      listen<number[]>(`ssh-data-${sessionId}`, (event) => {
        const bytes = new Uint8Array(event.payload);
        term.write(bytes);
      }),
      listen<string>(`ssh-closed-${sessionId}`, () => {
        setConnected(sessionId, false);
        term.write("\r\n\x1b[31m[Connection closed]\x1b[0m\r\n");
      }),
    ];

    // Kick off the actual SSH connection
    const { cols, rows } = term;
    api
      .connectSsh(hostId, sessionId, cols, rows)
      .then(() => setConnected(sessionId, true))
      .catch((e) => {
        setError(sessionId, String(e));
        term.write(`\r\n\x1b[31mFailed to connect: ${String(e)}\x1b[0m\r\n`);
      });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      api.resizeSsh(sessionId, term.cols, term.rows).catch(() => {});
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      dataDisposable.dispose();
      resizeObserver.disconnect();
      Promise.all(unlistenPromises).then((fns) => fns.forEach((fn) => fn()));
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (visible && fitAddonRef.current) {
      fitAddonRef.current.fit();
    }
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full p-2"
      style={{ display: visible ? "block" : "none" }}
    />
  );
}

import { useEffect } from "react";
import {
  ArrowLeftRight,
  Plus,
  Play,
  Square,
  Pencil,
  Trash2,
  Server,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useTunnelStore } from "../../stores/useTunnelStore";
import { useHostStore } from "../../stores/useHostStore";
import { TunnelModal } from "./TunnelModal";

export function TunnelView() {
  const {
    rules,
    activeRuleIds,
    isLoading,
    error,
    startingRuleId,
    refresh,
    toggleTunnel,
    openCreateModal,
    openEditModal,
    deleteRule,
  } = useTunnelStore();

  const { hosts } = useHostStore();

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleDelete(ruleId: string) {
    if (confirm("Delete this port forwarding rule?")) {
      await deleteRule(ruleId);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-[var(--background)] p-4">
      <TunnelModal />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ArrowLeftRight size={18} className="text-[var(--accent)]" />
            Port Forwarding / SSH Tunnels
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Forward local ports through secure SSH tunnels to remote services.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[var(--accent-hover)]"
        >
          <Plus size={14} /> New Tunnel
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Rules List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && rules.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-xs text-[var(--text-muted)]">
            <Loader2 size={16} className="animate-spin mr-2 text-[var(--accent)]" />
            Loading rules...
          </div>
        ) : rules.length === 0 ? (
          <div className="flex h-60 flex-col items-center justify-center text-center text-[var(--text-muted)]">
            <ArrowLeftRight size={38} className="mb-2 opacity-30" />
            <p className="text-sm font-medium">No port forwarding rules yet</p>
            <p className="text-xs mt-1 max-w-sm">
              Create a rule to access remote databases, APIs, or web servers via localhost.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--border)]"
            >
              Add First Rule
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rules.map((rule) => {
              const host = hosts.find((h) => h.id === rule.host_id);
              const isActive = activeRuleIds.has(rule.id);
              const isBusy = startingRuleId === rule.id;

              return (
                <div
                  key={rule.id}
                  className={`flex flex-col rounded-xl border p-4 transition-all ${
                    isActive
                      ? "border-[var(--success)]/40 bg-[var(--success)]/5 shadow-md shadow-[var(--success)]/5"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border)]/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          isActive
                            ? "bg-[var(--success)] animate-pulse"
                            : "bg-[var(--text-muted)]/40"
                        }`}
                      />
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {rule.label}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(rule)}
                        disabled={isActive}
                        title="Edit rule"
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white disabled:opacity-30"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        disabled={isActive}
                        title="Delete rule"
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)] disabled:opacity-30"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Endpoint Routing Diagram */}
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-2.5 text-xs mb-3 space-y-1 font-mono">
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>Local:</span>
                      <span className="text-[var(--accent)] font-semibold">
                        {rule.local_address}:{rule.local_port}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span>Target:</span>
                      <span className="text-[var(--text-primary)]">
                        {rule.remote_address}:{rule.remote_port}
                      </span>
                    </div>
                  </div>

                  {/* Via Host */}
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mb-4">
                    <Server size={12} className="shrink-0" />
                    <span className="truncate">
                      via {host ? host.label : "Unknown host"}
                    </span>
                  </div>

                  {/* Toggle Button */}
                  <div className="mt-auto pt-2 border-t border-[var(--border)]/50">
                    <button
                      onClick={() => toggleTunnel(rule)}
                      disabled={isBusy}
                      className={`flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                        isActive
                          ? "bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25"
                          : "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
                      } disabled:opacity-50`}
                    >
                      {isBusy ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>{isActive ? "Stopping..." : "Connecting..."}</span>
                        </>
                      ) : isActive ? (
                        <>
                          <Square size={12} />
                          <span>Stop Tunnel</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} />
                          <span>Start Tunnel</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

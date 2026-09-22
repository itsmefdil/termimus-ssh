import { useMemo } from "react";
import { Plus, Server, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useHostStore } from "../../stores/useHostStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { Host } from "../../lib/api";

export function HostList() {
  const {
    hosts,
    searchQuery,
    setSearchQuery,
    openCreateModal,
    openEditModal,
    deleteHost,
  } = useHostStore();
  const openSession = useSessionStore((s) => s.openSession);

  const filteredHosts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter(
      (h) =>
        h.label.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q) ||
        h.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [hosts, searchQuery]);

  async function handleConnect(host: Host) {
    await openSession(host);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirm("Delete this host? This cannot be undone.")) {
      await deleteHost(id);
    }
  }

  return (
    <section className="flex w-72 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
        <h1 className="text-sm font-semibold">Termimus</h1>
        <button
          onClick={openCreateModal}
          title="Add new host"
          className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--card)] hover:text-white"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="p-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Quick connect... (Ctrl+K)"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filteredHosts.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-[var(--text-muted)]">
            {hosts.length === 0
              ? "No hosts yet. Add your first server to get started."
              : "No hosts match your search."}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filteredHosts.map((host) => (
              <li key={host.id} className="group">
                <button
                  onClick={() => handleConnect(host)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-[var(--card)]"
                >
                  <Server size={15} className="shrink-0 text-[var(--text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                      {host.label}
                    </div>
                    <div className="truncate text-xs text-[var(--text-muted)]">
                      {host.username}@{host.address}:{host.port}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(host);
                      }}
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
                    >
                      <Pencil size={13} />
                    </span>
                    <span
                      onClick={(e) => handleDelete(e, host.id)}
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)]"
                    >
                      <Trash2 size={13} />
                    </span>
                    <ChevronRight size={14} className="text-[var(--text-muted)]" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

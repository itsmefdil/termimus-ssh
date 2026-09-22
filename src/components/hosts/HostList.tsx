import { useState, useMemo } from "react";
import {
  Server,
  Terminal,
  FolderOpen,
  Waypoints,
  Pencil,
  Trash2,
  Plus,
  KeyRound,
  AlertTriangle,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Folder as FolderIcon,
} from "lucide-react";
import { useHostStore } from "../../stores/useHostStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTunnelStore } from "../../stores/useTunnelStore";
import { useSftpStore } from "../../stores/useSftpStore";
import { FolderModal } from "./FolderModal";
import { Host, Folder } from "../../lib/api";

interface HostListProps {
  onOpenSftp: () => void;
  onOpenTunnels: () => void;
}

export function HostList({ onOpenSftp, onOpenTunnels }: HostListProps) {
  const {
    hosts,
    folders,
    searchQuery,
    setSearchQuery,
    openCreateModal,
    openEditModal,
    deleteHost,
    openCreateFolderModal,
    openEditFolderModal,
    deleteFolder,
    collapsedFolderIds,
    toggleFolderCollapse,
  } = useHostStore();

  const { tabs, openSession } = useSessionStore();
  const { activeRuleIds } = useTunnelStore();
  const { connectRemote } = useSftpStore();

  const [selectedTag, setSelectedTag] = useState<string>("All");

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    hosts.forEach((h) => h.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [hosts]);

  const filteredHosts = useMemo(() => {
    let list = hosts;
    if (selectedTag !== "All") {
      list = list.filter((h) => h.tags.includes(selectedTag));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (h) =>
          h.label.toLowerCase().includes(q) ||
          h.address.toLowerCase().includes(q) ||
          h.username.toLowerCase().includes(q) ||
          h.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [hosts, selectedTag, searchQuery]);

  // Group hosts by folder
  const groupedSections = useMemo(() => {
    const sections: {
      folder: Folder | null;
      items: Host[];
    }[] = [];

    // Registered folders
    folders.forEach((folder) => {
      const items = filteredHosts.filter((h) => h.folder_id === folder.id);
      sections.push({ folder, items });
    });

    // Ungrouped hosts (no folder or orphan folder)
    const folderIdSet = new Set(folders.map((f) => f.id));
    const ungrouped = filteredHosts.filter(
      (h) => !h.folder_id || !folderIdSet.has(h.folder_id)
    );

    if (ungrouped.length > 0 || folders.length === 0) {
      sections.push({ folder: null, items: ungrouped });
    }

    return sections;
  }, [folders, filteredHosts]);

  async function handleSftpClick(host: Host) {
    onOpenSftp();
    await connectRemote(host);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirm("Delete this host? This cannot be undone.")) {
      await deleteHost(id);
    }
  }

  async function handleDeleteFolder(e: React.MouseEvent, folderId: string, folderName: string) {
    e.stopPropagation();
    if (confirm(`Delete group "${folderName}"? Hosts inside will not be deleted.`)) {
      await deleteFolder(folderId);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[var(--canvas)] p-4">
      {/* Folder create/edit modal */}
      <FolderModal />

      {/* Top Stat Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <div className="bg-[var(--surface-low)] p-3 rounded-xl flex items-center justify-between border border-[var(--border)]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              Total Managed Hosts
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-semibold text-[var(--text-primary)]">
                {hosts.length}
              </span>
              <span className="font-mono text-[11px] text-[var(--primary)]">
                {folders.length} groups
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-high)] flex items-center justify-center text-[var(--primary)]">
            <Server size={16} />
          </div>
        </div>

        <div className="bg-[var(--surface-low)] p-3 rounded-xl flex items-center justify-between border border-[var(--border)]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              Active Tunnels & SSH
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-semibold text-[var(--primary)]">
                {tabs.length + activeRuleIds.size}
              </span>
              {(tabs.length > 0 || activeRuleIds.size > 0) && (
                <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
              )}
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-high)] flex items-center justify-center text-[var(--primary)]">
            <Terminal size={16} />
          </div>
        </div>

        <div className="bg-[var(--surface-low)] p-3 rounded-xl flex items-center justify-between border border-[var(--border)]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              Linked Secrets
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-semibold text-[var(--tertiary)]">
                {hosts.filter((h) => h.credential_id).length}
              </span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">Encrypted</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-high)] flex items-center justify-center text-[var(--tertiary)]">
            <KeyRound size={16} />
          </div>
        </div>

        <div className="bg-[var(--surface-low)] p-3 rounded-xl flex items-center justify-between border border-[var(--border)]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
              System Health
            </span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-lg font-semibold text-[var(--success)]">100%</span>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">All Online</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[var(--surface-high)] flex items-center justify-center text-[var(--success)]">
            <AlertTriangle size={16} />
          </div>
        </div>
      </div>

      {/* Operational Control Header */}
      <div className="bg-[var(--surface-low)] p-3 rounded-xl border border-[var(--border)] flex flex-col md:flex-row gap-2.5 justify-between items-stretch md:items-center mb-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          {/* Search bar */}
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter host, IP, label, port..."
              className="w-full bg-[var(--surface-container)] text-[var(--text-primary)] font-mono text-xs pl-3 pr-3 py-1.5 rounded-lg border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] placeholder:text-[var(--text-muted)]"
            />
          </div>

          {/* Tag filters */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            <button
              onClick={() => setSelectedTag("All")}
              className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-colors flex items-center gap-1 ${
                selectedTag === "All"
                  ? "bg-[var(--surface-high)] text-[var(--primary)] font-semibold border border-[var(--primary)]/30"
                  : "bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              <span>All</span>
              {selectedTag === "All" && (
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
              )}
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-2.5 py-1 text-xs font-mono rounded-lg transition-colors ${
                  selectedTag === tag
                    ? "bg-[var(--surface-high)] text-[var(--primary)] font-semibold border border-[var(--primary)]/30"
                    : "bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons: New Group & New Host */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openCreateFolderModal}
            className="flex items-center gap-1.5 bg-[var(--surface-high)] hover:bg-[var(--surface-highest)] text-[var(--text-primary)] text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--border)] transition-colors"
          >
            <FolderPlus size={14} />
            <span>New Group</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--on-primary)] font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>New Host</span>
          </button>
        </div>
      </div>

      {/* Host Groups Inventory */}
      {filteredHosts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center text-[var(--text-muted)] py-16">
          <Server size={40} className="mb-2 opacity-30" />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {hosts.length === 0 ? "No servers configured yet" : "No hosts match your filter"}
          </p>
          <p className="text-xs mt-1 max-w-sm">
            Add a server to start SSH sessions, transfer files via SFTP, and forward private ports.
          </p>
          {hosts.length === 0 && (
            <div className="flex gap-2 mt-4">
              <button
                onClick={openCreateFolderModal}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-high)] px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-highest)]"
              >
                Create Group
              </button>
              <button
                onClick={openCreateModal}
                className="rounded-lg bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)]"
              >
                Add Your First Host
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groupedSections.map((section) => {
            const folderKey = section.folder?.id ?? "ungrouped";
            const isCollapsed = collapsedFolderIds.has(folderKey);
            const folderName = section.folder ? section.folder.name : "Ungrouped Servers";

            return (
              <div
                key={folderKey}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface-low)]/50 p-3.5 transition-all"
              >
                {/* Group Header */}
                <div
                  onClick={() => toggleFolderCollapse(folderKey)}
                  className="flex items-center justify-between cursor-pointer py-1 select-none group"
                >
                  <div className="flex items-center gap-2.5">
                    <button className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors">
                      {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <FolderIcon size={16} className="text-[var(--primary)]" />
                    <span className="text-sm font-semibold tracking-tight text-[var(--text-primary)]">
                      {folderName}
                    </span>
                    <span className="rounded bg-[var(--surface-container)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-muted)] border border-[var(--border)]">
                      {section.items.length} {section.items.length === 1 ? "Host" : "Hosts"}
                    </span>
                  </div>

                  {section.folder && (
                    <div
                      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => openEditFolderModal(section.folder!)}
                        title="Rename Group"
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteFolder(e, section.folder!.id, section.folder!.name)}
                        title="Delete Group"
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)]"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Group Host Cards Grid */}
                {!isCollapsed && (
                  <div className="mt-3">
                    {section.items.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-xs text-[var(--text-muted)]">
                        No hosts in this group yet. Edit a host to assign it here.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {section.items.map((host) => {
                          const isConnected = tabs.some((t) => t.hostId === host.id);
                          return (
                            <div
                              key={host.id}
                              className="group relative flex flex-col justify-between rounded-xl border border-[var(--border)] bg-[var(--surface-low)] p-3.5 hover:border-[var(--primary)]/60 transition-all shadow-sm"
                            >
                              <div>
                                {/* Card Header: Status + Label */}
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`h-2 w-2 rounded-full shrink-0 ${
                                        isConnected
                                          ? "bg-[var(--primary)] animate-pulse"
                                          : "bg-[var(--success)]"
                                      }`}
                                    />
                                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                                      {host.label}
                                    </h3>
                                  </div>

                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => openEditModal(host)}
                                      title="Edit host"
                                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--border)] hover:text-white"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <button
                                      onClick={(e) => handleDelete(e, host.id)}
                                      title="Delete host"
                                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--danger)]/20 hover:text-[var(--danger)]"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {/* Body: Monospace address & info */}
                                <div className="space-y-1 mb-3 font-mono text-xs text-[var(--text-secondary)]">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-[var(--text-primary)] font-medium">
                                      {host.username}@{host.address}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                                    <span className="text-[var(--secondary)]">Port {host.port}</span>
                                    <span>•</span>
                                    <span className="text-[var(--tertiary)]">{host.auth_method}</span>
                                  </div>
                                </div>

                                {/* Tags */}
                                {host.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {host.tags.map((tag) => (
                                      <span
                                        key={tag}
                                        className="rounded bg-[var(--surface-container)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-secondary)] border border-[var(--border)]"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Card Action Buttons */}
                              <div className="flex items-center gap-1.5 pt-2.5 border-t border-[var(--border)]/60">
                                <button
                                  onClick={() => openSession(host)}
                                  className="flex-1 flex items-center justify-center gap-1 rounded-md bg-[var(--primary)]/15 text-[var(--primary)] py-1.5 text-xs font-semibold hover:bg-[var(--primary)] hover:text-[var(--on-primary)] transition-colors"
                                >
                                  <Terminal size={12} />
                                  <span>SSH</span>
                                </button>
                                <button
                                  onClick={() => handleSftpClick(host)}
                                  title="Open SFTP"
                                  className="flex items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-container)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white hover:bg-[var(--border)] transition-colors"
                                >
                                  <FolderOpen size={12} />
                                  <span>SFTP</span>
                                </button>
                                <button
                                  onClick={onOpenTunnels}
                                  title="Port Forwarding"
                                  className="flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-container)] px-2 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--secondary)] hover:bg-[var(--border)] transition-colors"
                                >
                                  <Waypoints size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

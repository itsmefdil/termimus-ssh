import { useState, useMemo, useEffect } from "react";
import {
  Server,
  Terminal,
  FolderOpen,
  Waypoints,
  Pencil,
  Trash2,
  Plus,
  FolderPlus,
  LayoutGrid,
  ArrowLeft,
  Search,
  MoreVertical,
} from "lucide-react";
import { useHostStore } from "../../stores/useHostStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useSftpStore } from "../../stores/useSftpStore";
import { usePingStore } from "../../stores/usePingStore";
import { useConfirmStore } from "../../stores/useConfirmStore";
import { FolderModal } from "./FolderModal";
import { Host, Folder } from "../../lib/api";
import { DistroBadge } from "./DistroBadge";

const PING_INTERVAL_MS = 20000;

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
  } = useHostStore();

  const { openSession } = useSessionStore();
  const { connectRemote } = useSftpStore();
  const { pingAll, statusByHostId } = usePingStore();

  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeMenuHostId, setActiveMenuHostId] = useState<string | null>(null);

  // Background ping check
  useEffect(() => {
    if (hosts.length > 0) {
      pingAll();
      const interval = setInterval(pingAll, PING_INTERVAL_MS);
      return () => clearInterval(interval);
    }
  }, [hosts.length, pingAll]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    hosts.forEach((h) => h.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [hosts]);

  // Filter hosts by tag and search query
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

  // Sort hosts by "terakhir di buka" (most recently opened / connected first)
  const sortedRecentHosts = useMemo(() => {
    return [...filteredHosts].sort((a, b) => {
      const timeA = a.last_connected_at || a.created_at || a.updated_at;
      const timeB = b.last_connected_at || b.created_at || b.updated_at;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }, [filteredHosts]);

  // Map each folder to its host count
  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    hosts.forEach((h) => {
      if (h.folder_id) {
        map.set(h.folder_id, (map.get(h.folder_id) || 0) + 1);
      }
    });
    return map;
  }, [hosts]);

  // Active folder object if drilled down
  const activeFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return folders.find((f) => f.id === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  // Hosts inside the currently selected group
  const hostsInActiveFolder = useMemo(() => {
    if (!selectedFolderId) return [];
    return filteredHosts.filter((h) => h.folder_id === selectedFolderId);
  }, [filteredHosts, selectedFolderId]);

  async function handleConnect(host: Host) {
    await openSession(host);
  }

  async function handleSftpClick(e: React.MouseEvent, host: Host) {
    e.stopPropagation();
    onOpenSftp();
    await connectRemote(host);
  }

  function handleDelete(e: React.MouseEvent, host: Host) {
    e.stopPropagation();
    useConfirmStore.getState().confirm({
      title: "Delete Host",
      message: `Are you sure you want to delete "${host.label}" (${host.username}@${host.address})? This action cannot be undone.`,
      confirmLabel: "Delete Host",
      isDanger: true,
      onConfirm: async () => {
        await deleteHost(host.id);
      },
    });
  }

  function handleDeleteFolder(e: React.MouseEvent, folder: Folder) {
    e.stopPropagation();
    useConfirmStore.getState().confirm({
      title: "Delete Group",
      message: `Are you sure you want to delete the group "${folder.name}"? Hosts inside this group will not be deleted and will move to ungrouped.`,
      confirmLabel: "Delete Group",
      isDanger: true,
      onConfirm: async () => {
        await deleteFolder(folder.id);
        if (selectedFolderId === folder.id) {
          setSelectedFolderId(null);
        }
      },
    });
  }

  return (
    <div
      onClick={() => setActiveMenuHostId(null)}
      className="flex h-full w-full flex-col overflow-y-auto bg-[var(--canvas)] p-5 select-none"
    >
      {/* Folder create/rename modal */}
      <FolderModal />

      {/* Top Search & Actions Bar */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2">
          {/* Search bar */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search host, IP, label, tag..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-container)] py-2 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none transition-colors"
            />
          </div>

          {/* Tag filters (only at root) */}
          {!selectedFolderId && allTags.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 overflow-x-auto py-0.5">
              <button
                onClick={() => setSelectedTag("All")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-mono transition-colors ${
                  selectedTag === "All"
                    ? "bg-[var(--surface-high)] font-semibold text-[var(--primary)] border border-[var(--primary)]/30"
                    : "bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-white"
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-mono transition-colors ${
                    selectedTag === tag
                      ? "bg-[var(--surface-high)] font-semibold text-[var(--primary)] border border-[var(--primary)]/30"
                      : "bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-white"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons: New Group & New Host */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={openCreateFolderModal}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-high)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-highest)] transition-colors shadow-sm"
          >
            <FolderPlus size={14} />
            <span>New Group</span>
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
          >
            <Plus size={15} strokeWidth={2.5} />
            <span>New Host</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: DRILLED DOWN INTO A GROUP */}
      {selectedFolderId && activeFolder ? (
        <div className="space-y-4">
          {/* Breadcrumb Header */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedFolderId(null)}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-high)] hover:text-white transition"
              >
                <ArrowLeft size={13} />
                <span>All Groups</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--text-muted)]">/</span>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0284c7] text-white">
                    <LayoutGrid size={14} />
                  </div>
                  <h2 className="text-base font-semibold text-[var(--text-primary)]">
                    {activeFolder.name}
                  </h2>
                </div>
                <span className="rounded-md bg-[var(--surface-container)] px-2 py-0.5 text-xs font-mono text-[var(--text-muted)] border border-[var(--border)]">
                  {hostsInActiveFolder.length}{" "}
                  {hostsInActiveFolder.length === 1 ? "Host" : "Hosts"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openEditFolderModal(activeFolder)}
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-container)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-white transition"
                title="Rename Group"
              >
                <Pencil size={12} /> Rename
              </button>
              <button
                onClick={(e) => handleDeleteFolder(e, activeFolder)}
                className="flex items-center gap-1 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2.5 py-1 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/20 transition"
                title="Delete Group"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>

          {/* Hosts Inside Group */}
          {hostsInActiveFolder.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--text-muted)]">
              <Server size={36} className="mb-2 opacity-30" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                No hosts in this group yet
              </p>
              <p className="mt-1 text-xs max-w-sm">
                When adding or editing a host, select <strong>{activeFolder.name}</strong> as its folder.
              </p>
              <button
                onClick={openCreateModal}
                className="mt-4 rounded-xl bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)] transition"
              >
                Add Host Here
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {hostsInActiveFolder.map((host) => renderHostCard(host))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: ROOT VIEW (GROUPS ON TOP, RECENT HOSTS BELOW) */
        <div className="space-y-7">
          {/* GROUPS SECTION (Termius style cards) */}
          {folders.length > 0 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Groups
                </h2>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  Click group to view hosts
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {folders.map((folder) => {
                  const count = folderCounts.get(folder.id) || 0;
                  return (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="group relative flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-container)] p-3.5 hover:border-[var(--primary)]/60 transition-all cursor-pointer shadow-sm hover:shadow-md"
                    >
                      {/* Group Icon Badge */}
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0284c7] text-white shadow-md transition-transform duration-200 group-hover:scale-105">
                        <LayoutGrid size={18} />
                      </div>

                      {/* Group Name & Count */}
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                          {folder.name}
                        </h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          {count} {count === 1 ? "Host" : "Hosts"}
                        </p>
                      </div>

                      {/* Quick Edit/Delete icon on hover */}
                      <div
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => openEditFolderModal(folder)}
                          title="Rename"
                          className="rounded p-1 text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-high)]"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteFolder(e, folder)}
                          title="Delete"
                          className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/20"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HOSTS SECTION (Sorted by last opened / connected) */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Hosts
              </h2>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                Ordered by last opened
              </span>
            </div>

            {sortedRecentHosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--text-muted)]">
                <Server size={36} className="mb-2 opacity-30" />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {hosts.length === 0 ? "No servers configured yet" : "No hosts match your filter"}
                </p>
                <p className="mt-1 text-xs max-w-sm">
                  Add a server to start SSH sessions, transfer files via SFTP, and forward ports.
                </p>
                {hosts.length === 0 && (
                  <button
                    onClick={openCreateModal}
                    className="mt-4 rounded-xl bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)] transition"
                  >
                    Add Your First Host
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {sortedRecentHosts.map((host) => renderHostCard(host))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // Termius-style Host Card (Matching Image #18)
  function renderHostCard(host: Host) {
    const isMenuOpen = activeMenuHostId === host.id;
    const ping = statusByHostId[host.id];
    const isOnline = ping ? ping.online : true;

    return (
      <div
        key={host.id}
        onClick={() => handleConnect(host)}
        className="group relative flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-container)] p-3.5 hover:border-[var(--primary)]/60 transition-all cursor-pointer shadow-sm hover:shadow-md select-none"
      >
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          {/* OS Distro Badge (Debian, Ubuntu, Linux, etc.) */}
          <DistroBadge host={host} />

          {/* Host Label & Username */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                {host.label}
              </h3>
              {!isOnline && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)] shrink-0" title="Offline" />
              )}
            </div>
            <p className="truncate text-xs text-[var(--text-muted)] font-mono">
              ssh, {host.username}
            </p>
          </div>
        </div>

        {/* Right Action Menu Button (3 dots) */}
        <div
          className="relative ml-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setActiveMenuHostId(isMenuOpen ? null : host.id)}
            title="Options"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:bg-[var(--surface-high)] hover:text-white transition"
          >
            <MoreVertical size={14} />
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 top-8 z-30 w-36 rounded-xl border border-[var(--border)] bg-[var(--surface-low)] p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  setActiveMenuHostId(null);
                  handleConnect(host);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--primary)] hover:text-[var(--on-primary)] transition"
              >
                <Terminal size={13} />
                <span>Connect SSH</span>
              </button>

              <button
                onClick={(e) => {
                  setActiveMenuHostId(null);
                  handleSftpClick(e, host);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition"
              >
                <FolderOpen size={13} />
                <span>SFTP Files</span>
              </button>

              <button
                onClick={() => {
                  setActiveMenuHostId(null);
                  onOpenTunnels();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition"
              >
                <Waypoints size={13} />
                <span>Tunnels</span>
              </button>

              <button
                onClick={() => {
                  setActiveMenuHostId(null);
                  openEditModal(host);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition"
              >
                <Pencil size={13} />
                <span>Edit Host</span>
              </button>

              <div className="my-1 border-t border-[var(--border)]" />

              <button
                onClick={(e) => {
                  setActiveMenuHostId(null);
                  handleDelete(e, host);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--danger)] hover:bg-[var(--danger)]/20 transition"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}

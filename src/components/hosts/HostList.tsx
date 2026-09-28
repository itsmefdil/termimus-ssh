import { useState, useMemo, useEffect, useCallback, memo } from "react";
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
  Copy,
  RefreshCw,
  Check,
  Loader2,
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
  onOpenTerminal?: () => void;
  onOpenSftp: () => void;
  onOpenTunnels: () => void;
}

export function HostList({ onOpenTerminal, onOpenSftp, onOpenTunnels }: HostListProps) {
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

  const { openSession, tabs } = useSessionStore();
  const { connectRemote } = useSftpStore();
  const { pingAll, statusByHostId } = usePingStore();

  const [selectedTag, setSelectedTag] = useState<string>("All");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeMenuHostId, setActiveMenuHostId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "host" | "folder" | "background";
    host?: Host;
    folder?: Folder;
  } | null>(null);

  const [copyToast, setCopyToast] = useState<string | null>(null);

  const showCopyToast = useCallback((msg: string) => {
    setCopyToast(msg);
    setTimeout(() => {
      setCopyToast((prev) => (prev === msg ? null : prev));
    }, 1800);
  }, []);

  const handleHostContextMenu = useCallback((e: React.MouseEvent, host: Host) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 340);
    setContextMenu({ x, y, type: "host", host });
  }, []);

  const handleFolderContextMenu = useCallback((e: React.MouseEvent, folder: Folder) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y, type: "folder", folder });
  }, []);

  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    setContextMenu({ x, y, type: "background" });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", handleClose);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handleClose);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contextMenu]);

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

  const handleConnect = useCallback(
    async (host: Host) => {
      onOpenTerminal?.();
      await openSession(host);
    },
    [onOpenTerminal, openSession]
  );

  const handleSftpClick = useCallback(
    async (e: React.MouseEvent, host: Host) => {
      e.stopPropagation();
      onOpenSftp();
      await connectRemote(host);
    },
    [onOpenSftp, connectRemote]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, host: Host) => {
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
    },
    [deleteHost]
  );

  const handleDeleteFolder = useCallback(
    (e: React.MouseEvent, folder: Folder) => {
      e.stopPropagation();
      useConfirmStore.getState().confirm({
        title: "Delete Group",
        message: `Are you sure you want to delete the group "${folder.name}"? Hosts inside this group will not be deleted and will move to ungrouped.`,
        confirmLabel: "Delete Group",
        isDanger: true,
        onConfirm: async () => {
          await deleteFolder(folder.id);
          setSelectedFolderId((prev) => (prev === folder.id ? null : prev));
        },
      });
    },
    [deleteFolder]
  );

  const handleToggleMenu = useCallback((hostId: string) => {
    setActiveMenuHostId((prev) => (prev === hostId ? null : hostId));
  }, []);

  return (
    <div
      onClick={() => setActiveMenuHostId(null)}
      onContextMenu={handleBackgroundContextMenu}
      className="flex h-full w-full flex-col overflow-y-auto bg-[var(--canvas)] p-5 select-none"
    >
      {/* Folder create/rename modal */}
      <FolderModal />

      {/* Top Search & Actions Bar */}
      <div className="mb-6 flex flex-col gap-2.5 min-w-0">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex flex-1 items-center gap-2 min-w-0">
            {/* Search bar */}
            <div className="relative min-w-[160px] sm:min-w-[220px] max-w-xs flex-1 shrink-0">
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

            {/* Tag filters (desktop single-row with horizontal scroll) */}
            {!selectedFolderId && allTags.length > 0 && (
              <div className="hidden lg:flex items-center gap-1 overflow-x-auto min-w-0 flex-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button
                  type="button"
                  onClick={() => setSelectedTag("All")}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-mono shrink-0 transition-colors cursor-pointer ${
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
                    type="button"
                    onClick={() => setSelectedTag(tag)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-mono shrink-0 transition-colors cursor-pointer ${
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

          {/* Action Buttons: New Group & New Host (always fully visible, never compressed) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openCreateFolderModal}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-high)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-highest)] transition-colors shadow-sm shrink-0 cursor-pointer"
            >
              <FolderPlus size={14} />
              <span>New Group</span>
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-3.5 py-2 text-xs font-semibold text-[var(--on-primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm shrink-0 cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>New Host</span>
            </button>
          </div>
        </div>

        {/* Tag filters (shown on narrower screens so search & action buttons don't squeeze) */}
        {!selectedFolderId && allTags.length > 0 && (
          <div className="flex lg:hidden items-center gap-1 overflow-x-auto min-w-0 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setSelectedTag("All")}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-mono shrink-0 transition-colors cursor-pointer ${
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
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-mono shrink-0 transition-colors cursor-pointer ${
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
              {hostsInActiveFolder.map((host) => (
                <HostCard
                  key={host.id}
                  host={host}
                  isConnecting={tabs.some((t) => t.hostId === host.id && t.connecting)}
                  isOnline={statusByHostId[host.id]?.online ?? true}
                  isMenuOpen={activeMenuHostId === host.id}
                  onConnect={handleConnect}
                  onToggleMenu={handleToggleMenu}
                  onSftp={handleSftpClick}
                  onTunnels={onOpenTunnels}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onContextMenu={handleHostContextMenu}
                />
              ))}
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
                {folders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    count={folderCounts.get(folder.id) || 0}
                    onSelect={setSelectedFolderId}
                    onEdit={openEditFolderModal}
                    onDelete={handleDeleteFolder}
                    onContextMenu={handleFolderContextMenu}
                  />
                ))}
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
                {sortedRecentHosts.map((host) => (
                  <HostCard
                    key={host.id}
                    host={host}
                    isConnecting={tabs.some((t) => t.hostId === host.id && t.connecting)}
                    isOnline={statusByHostId[host.id]?.online ?? true}
                    isMenuOpen={activeMenuHostId === host.id}
                    onConnect={handleConnect}
                    onToggleMenu={handleToggleMenu}
                    onSftp={handleSftpClick}
                    onTunnels={onOpenTunnels}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    onContextMenu={handleHostContextMenu}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[210px] rounded-xl border border-[var(--border)] bg-[var(--surface-high)]/95 p-1 text-xs text-[var(--text-primary)] shadow-2xl backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-75"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "host" && contextMenu.host ? (
            <>
              {/* Connect SSH */}
              <button
                onClick={() => {
                  handleConnect(contextMenu.host!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <Terminal size={13} />
                <span>Connect SSH</span>
              </button>

              {/* SFTP Browser */}
              <button
                onClick={(e) => {
                  handleSftpClick(e, contextMenu.host!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <FolderOpen size={13} />
                <span>SFTP Files</span>
              </button>

              {/* Port Forwarding */}
              <button
                onClick={() => {
                  onOpenTunnels();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <Waypoints size={13} />
                <span>Port Forwarding</span>
              </button>

              <div className="my-1 h-[1px] bg-[var(--border)]" />

              {/* Copy SSH Command */}
              <button
                onClick={async () => {
                  const port = contextMenu.host!.port || 22;
                  const cmd = `ssh -p ${port} ${contextMenu.host!.username}@${contextMenu.host!.address}`;
                  await navigator.clipboard.writeText(cmd);
                  showCopyToast("Copied SSH command");
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
              >
                <Copy size={13} />
                <span>Copy SSH Command</span>
              </button>

              {/* Copy Address */}
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(contextMenu.host!.address);
                  showCopyToast("Copied host address");
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
              >
                <Copy size={13} />
                <span>Copy Address</span>
              </button>

              <div className="my-1 h-[1px] bg-[var(--border)]" />

              {/* Edit Host */}
              <button
                onClick={() => {
                  openEditModal(contextMenu.host!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
              >
                <Pencil size={13} />
                <span>Edit Host</span>
              </button>

              {/* Delete Host */}
              <button
                onClick={(e) => {
                  handleDelete(e, contextMenu.host!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--danger)] hover:text-white transition-colors group"
              >
                <Trash2 size={13} />
                <span>Delete Host</span>
              </button>
            </>
          ) : contextMenu.type === "folder" && contextMenu.folder ? (
            <>
              {/* Open Group */}
              <button
                onClick={() => {
                  setSelectedFolderId(contextMenu.folder!.id);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <FolderOpen size={13} />
                <span>Open Group</span>
              </button>

              {/* Rename Group */}
              <button
                onClick={() => {
                  openEditFolderModal(contextMenu.folder!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
              >
                <Pencil size={13} />
                <span>Rename Group</span>
              </button>

              <div className="my-1 h-[1px] bg-[var(--border)]" />

              {/* Delete Group */}
              <button
                onClick={(e) => {
                  handleDeleteFolder(e, contextMenu.folder!);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--danger)] hover:text-white transition-colors group"
              >
                <Trash2 size={13} />
                <span>Delete Group</span>
              </button>
            </>
          ) : (
            <>
              {/* Background Empty Area Menu */}
              <button
                onClick={() => {
                  openCreateModal();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--primary)] hover:text-black transition-colors group"
              >
                <Plus size={13} />
                <span>New Host</span>
              </button>

              <button
                onClick={() => {
                  openCreateFolderModal();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
              >
                <FolderPlus size={13} />
                <span>New Group</span>
              </button>

              <div className="my-1 h-[1px] bg-[var(--border)]" />

              <button
                onClick={() => {
                  pingAll();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-[var(--surface-container)] hover:text-[var(--text-primary)] transition-colors group"
              >
                <RefreshCw size={13} />
                <span>Ping All Hosts</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Copy Toast Notification */}
      {copyToast && (
        <div className="fixed top-11 right-3.5 z-50 flex items-center gap-2 rounded-lg border border-[var(--primary)]/40 bg-[var(--surface-high)]/95 px-3 py-1.5 text-xs font-mono font-medium text-[var(--primary)] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-150 pointer-events-none">
          <Check size={13} className="text-[var(--primary)] shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMOIZED FOLDER CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface FolderCardProps {
  folder: Folder;
  count: number;
  onSelect: (folderId: string) => void;
  onEdit: (folder: Folder) => void;
  onDelete: (e: React.MouseEvent, folder: Folder) => void;
  onContextMenu?: (e: React.MouseEvent, folder: Folder) => void;
}

const FolderCard = memo(function FolderCard({
  folder,
  count,
  onSelect,
  onEdit,
  onDelete,
  onContextMenu,
}: FolderCardProps) {
  return (
    <div
      onClick={() => onSelect(folder.id)}
      onContextMenu={(e) => onContextMenu?.(e, folder)}
      className="group relative flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-[var(--surface-container)] p-3.5 hover:border-[var(--primary)]/60 transition-colors cursor-pointer shadow-sm hover:shadow-md"
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
          onClick={() => onEdit(folder)}
          title="Rename"
          className="rounded p-1 text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-high)]"
        >
          <Pencil size={11} />
        </button>
        <button
          onClick={(e) => onDelete(e, folder)}
          title="Delete"
          className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/20"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// MEMOIZED HOST CARD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

interface HostCardProps {
  host: Host;
  isConnecting?: boolean;
  isOnline: boolean;
  isMenuOpen: boolean;
  onConnect: (host: Host) => void;
  onToggleMenu: (hostId: string) => void;
  onSftp: (e: React.MouseEvent, host: Host) => void;
  onTunnels: () => void;
  onEdit: (host: Host) => void;
  onDelete: (e: React.MouseEvent, host: Host) => void;
  onContextMenu?: (e: React.MouseEvent, host: Host) => void;
}

const HostCard = memo(function HostCard({
  host,
  isConnecting,
  isOnline,
  isMenuOpen,
  onConnect,
  onToggleMenu,
  onSftp,
  onTunnels,
  onEdit,
  onDelete,
  onContextMenu,
}: HostCardProps) {
  return (
    <div
      onClick={() => onConnect(host)}
      onContextMenu={(e) => onContextMenu?.(e, host)}
      className="group relative flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-container)] p-3.5 hover:border-[var(--primary)]/60 transition-colors cursor-pointer shadow-sm hover:shadow-md select-none"
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
            {isConnecting ? (
              <span className="flex items-center gap-1 text-[10px] text-[var(--primary)] font-mono font-medium">
                <Loader2 size={10} className="animate-spin text-[var(--primary)] shrink-0" />
                <span>Connecting...</span>
              </span>
            ) : !isOnline ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--danger)] shrink-0" title="Offline" />
            ) : null}
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
          onClick={() => onToggleMenu(host.id)}
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
                onToggleMenu(host.id);
                onConnect(host);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--primary)] hover:text-[var(--on-primary)] transition"
            >
              <Terminal size={13} />
              <span>Connect SSH</span>
            </button>

            <button
              onClick={(e) => {
                onToggleMenu(host.id);
                onSftp(e, host);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition"
            >
              <FolderOpen size={13} />
              <span>SFTP Files</span>
            </button>

            <button
              onClick={() => {
                onToggleMenu(host.id);
                onTunnels();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition"
            >
              <Waypoints size={13} />
              <span>Tunnels</span>
            </button>

            <button
              onClick={() => {
                onToggleMenu(host.id);
                onEdit(host);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--surface-high)] transition"
            >
              <Pencil size={13} />
              <span>Edit Host</span>
            </button>

            <div className="my-1 border-t border-[var(--border)]" />

            <button
              onClick={(e) => {
                onToggleMenu(host.id);
                onDelete(e, host);
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
});

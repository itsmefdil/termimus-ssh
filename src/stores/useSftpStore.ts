import { create } from "zustand";
import { api, FileEntry, Host } from "../lib/api";

interface SftpState {
  // Remote state
  remoteHost: Host | null;
  remoteSessionId: string | null;
  remotePath: string;
  remoteEntries: FileEntry[];
  remoteLoading: boolean;
  selectedRemoteFile: FileEntry | null;

  // Local state
  localPath: string;
  localEntries: FileEntry[];
  localLoading: boolean;
  selectedLocalFile: FileEntry | null;

  // Transfer state
  transferring: boolean;
  transferMessage: string | null;
  error: string | null;

  initLocal: () => Promise<void>;
  navigateLocal: (path: string) => Promise<void>;
  selectLocalFile: (entry: FileEntry | null) => void;
  createLocalFolder: (name: string) => Promise<void>;
  deleteLocalItem: (entry: FileEntry) => Promise<void>;

  connectRemote: (host: Host) => Promise<void>;
  navigateRemote: (path: string) => Promise<void>;
  selectRemoteFile: (entry: FileEntry | null) => void;
  createRemoteFolder: (name: string) => Promise<void>;
  deleteRemoteItem: (entry: FileEntry) => Promise<void>;
  disconnectRemote: () => Promise<void>;

  uploadSelected: () => Promise<void>;
  downloadSelected: () => Promise<void>;
}

export const useSftpStore = create<SftpState>((set, get) => ({
  remoteHost: null,
  remoteSessionId: null,
  remotePath: "/",
  remoteEntries: [],
  remoteLoading: false,
  selectedRemoteFile: null,

  localPath: "",
  localEntries: [],
  localLoading: false,
  selectedLocalFile: null,

  transferring: false,
  transferMessage: null,
  error: null,

  initLocal: async () => {
    set({ localLoading: true, error: null });
    try {
      const home = await api.getLocalHomeDir();
      const entries = await api.listLocal(home);
      set({ localPath: home, localEntries: entries, localLoading: false });
    } catch (e) {
      set({ localLoading: false, error: `Local fs error: ${String(e)}` });
    }
  },

  navigateLocal: async (path: string) => {
    set({ localLoading: true, error: null, selectedLocalFile: null });
    try {
      const entries = await api.listLocal(path);
      set({ localPath: path, localEntries: entries, localLoading: false });
    } catch (e) {
      set({ localLoading: false, error: `Failed to open ${path}: ${String(e)}` });
    }
  },

  selectLocalFile: (entry) => set({ selectedLocalFile: entry }),

  createLocalFolder: async (name: string) => {
    const { localPath, navigateLocal } = get();
    const target = `${localPath.replace(/\/$/, "")}/${name}`;
    await api.mkdirLocal(target);
    await navigateLocal(localPath);
  },

  deleteLocalItem: async (entry: FileEntry) => {
    const { localPath, navigateLocal } = get();
    await api.deleteLocal(entry.path, entry.is_dir);
    await navigateLocal(localPath);
  },

  connectRemote: async (host: Host) => {
    const oldSession = get().remoteSessionId;
    if (oldSession) {
      api.disconnectSftp(oldSession).catch(() => {});
    }

    const sessionId = `sftp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    set({
      remoteLoading: true,
      remoteHost: host,
      remoteSessionId: sessionId,
      error: null,
      selectedRemoteFile: null,
    });

    try {
      const initialPath = await api.connectSftp(host.id, sessionId);
      const entries = await api.listSftp(sessionId, initialPath);
      set({
        remotePath: initialPath,
        remoteEntries: entries,
        remoteLoading: false,
      });
    } catch (e) {
      set({
        remoteLoading: false,
        error: `SFTP Connection failed: ${String(e)}`,
        remoteSessionId: null,
      });
    }
  },

  navigateRemote: async (path: string) => {
    const { remoteSessionId } = get();
    if (!remoteSessionId) return;

    set({ remoteLoading: true, error: null, selectedRemoteFile: null });
    try {
      const entries = await api.listSftp(remoteSessionId, path);
      set({ remotePath: path, remoteEntries: entries, remoteLoading: false });
    } catch (e) {
      set({ remoteLoading: false, error: `Remote list error: ${String(e)}` });
    }
  },

  selectRemoteFile: (entry) => set({ selectedRemoteFile: entry }),

  createRemoteFolder: async (name: string) => {
    const { remoteSessionId, remotePath, navigateRemote } = get();
    if (!remoteSessionId) return;
    const target = `${remotePath.replace(/\/$/, "")}/${name}`;
    await api.mkdirSftp(remoteSessionId, target);
    await navigateRemote(remotePath);
  },

  deleteRemoteItem: async (entry: FileEntry) => {
    const { remoteSessionId, remotePath, navigateRemote } = get();
    if (!remoteSessionId) return;
    await api.deleteSftp(remoteSessionId, entry.path, entry.is_dir);
    await navigateRemote(remotePath);
  },

  disconnectRemote: async () => {
    const { remoteSessionId } = get();
    if (remoteSessionId) {
      await api.disconnectSftp(remoteSessionId);
    }
    set({
      remoteHost: null,
      remoteSessionId: null,
      remoteEntries: [],
      selectedRemoteFile: null,
    });
  },

  uploadSelected: async () => {
    const { selectedLocalFile, remotePath, remoteSessionId, navigateRemote } = get();
    if (!selectedLocalFile || !remoteSessionId) return;

    const targetRemotePath = `${remotePath.replace(/\/$/, "")}/${selectedLocalFile.name}`;
    set({
      transferring: true,
      transferMessage: `Uploading ${selectedLocalFile.name}...`,
      error: null,
    });

    try {
      await api.uploadSftp(remoteSessionId, selectedLocalFile.path, targetRemotePath);
      await navigateRemote(remotePath);
      set({ transferring: false, transferMessage: null });
    } catch (e) {
      set({ transferring: false, transferMessage: null, error: `Upload error: ${String(e)}` });
    }
  },

  downloadSelected: async () => {
    const { selectedRemoteFile, localPath, remoteSessionId, navigateLocal } = get();
    if (!selectedRemoteFile || !remoteSessionId) return;

    const targetLocalPath = `${localPath.replace(/\/$/, "")}/${selectedRemoteFile.name}`;
    set({
      transferring: true,
      transferMessage: `Downloading ${selectedRemoteFile.name}...`,
      error: null,
    });

    try {
      await api.downloadSftp(remoteSessionId, selectedRemoteFile.path, targetLocalPath);
      await navigateLocal(localPath);
      set({ transferring: false, transferMessage: null });
    } catch (e) {
      set({ transferring: false, transferMessage: null, error: `Download error: ${String(e)}` });
    }
  },
}));

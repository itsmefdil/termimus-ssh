import { create } from "zustand";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  onConfirm: () => void | Promise<void>;
}

interface ConfirmState {
  isOpen: boolean;
  options: ConfirmOptions | null;
  confirm: (options: ConfirmOptions) => void;
  close: () => void;
}

/// Global confirmation dialog store, replacing native `window.confirm()` calls
/// with a themed in-app modal. Call `useConfirmStore.getState().confirm({...})`
/// from anywhere (including outside React render, e.g. event handlers) to
/// open it; a single <ConfirmModal /> mounted in App.tsx renders the state.
export const useConfirmStore = create<ConfirmState>((set) => ({
  isOpen: false,
  options: null,
  confirm: (options) => set({ isOpen: true, options }),
  close: () => set({ isOpen: false, options: null }),
}));

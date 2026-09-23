import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AutoLockPolicy =
  | "never"
  | "on_close"
  | "15min"
  | "1hour"
  | "on_focus_loss";

export const AUTO_LOCK_LABELS: Record<AutoLockPolicy, string> = {
  never: "Never (manual lock only)",
  on_close: "When app closes",
  "15min": "After 15 minutes idle",
  "1hour": "After 1 hour idle",
  on_focus_loss: "When app loses focus",
};

interface SettingsState {
  useOsKeyring: boolean;
  autoLockPolicy: AutoLockPolicy;
  setUseOsKeyring: (v: boolean) => void;
  setAutoLockPolicy: (v: AutoLockPolicy) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      useOsKeyring: false,
      autoLockPolicy: "on_close",
      setUseOsKeyring: (v) => set({ useOsKeyring: v }),
      setAutoLockPolicy: (v) => set({ autoLockPolicy: v }),
    }),
    {
      name: "termimus_settings",
    }
  )
);

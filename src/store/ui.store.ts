import { create } from "zustand";

export type ModalType =
  | "address"
  | "walletInfo"
  | "withdraw"
  | "backup"
  | "delete"
  | "seed"
  | "warn-costy-send-message"
  | "utxo-compound";

type UiState = {
  // Settings state
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  setSettingsOpen: (v: boolean) => void;

  // Modal state
  modals: Partial<Record<ModalType, boolean>>;
  openModal: (m: ModalType) => void;
  closeModal: (m: ModalType) => void;
  closeAllModals: () => void;
  isOpen: (m: ModalType) => boolean;
};

export const useUiStore = create<UiState>()((set, get) => ({
  // Settings state
  isSettingsOpen: false,
  toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
  setSettingsOpen: (v) => set({ isSettingsOpen: v }),

  // Modal state
  modals: {},
  openModal: (m: ModalType) =>
    set((s) => ({
      modals: { ...s.modals, [m]: true },
    })),
  closeModal: (m: ModalType) =>
    set((s) => ({
      modals: { ...s.modals, [m]: false },
    })),
  closeAllModals: () => set({ modals: {} }),
  isOpen: (m: ModalType) => !!get().modals[m],
}));

import { create } from "zustand";

type UiState = {
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  setSettingsOpen: (v: boolean) => void;
};

export const useUiStore = create<UiState>()((set) => ({
  isSettingsOpen: false,
  toggleSettings: () => set((s) => ({ isSettingsOpen: !s.isSettingsOpen })),
  setSettingsOpen: (v) => set({ isSettingsOpen: v }),
}));

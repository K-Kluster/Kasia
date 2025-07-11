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
type Theme = "light" | "dark" | "system";

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

  // Theme state
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  getEffectiveTheme: () => "light" | "dark";
};

// Get initial theme from localStorage or default to system
const getInitialTheme = (): Theme => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("kasia-theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  }
  return "system";
};

// Get system preference
const getSystemTheme = (): "light" | "dark" => {
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return "dark";
};

// Apply theme to document
const applyTheme = (effectiveTheme: "light" | "dark") => {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", effectiveTheme);
  }
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

  // Theme state
  theme: getInitialTheme(),
  toggleTheme: () => {
    const currentTheme = get().theme;
    let newTheme: Theme;

    // Cycle: light -> dark -> system -> light
    switch (currentTheme) {
      case "light":
        newTheme = "dark";
        break;
      case "dark":
        newTheme = "system";
        break;
      case "system":
        newTheme = "light";
        break;
      default:
        newTheme = "light";
    }

    set({ theme: newTheme });
    localStorage.setItem("kasia-theme", newTheme);

    const effectiveTheme = get().getEffectiveTheme();
    applyTheme(effectiveTheme);
  },
  setTheme: (theme) => {
    set({ theme });
    localStorage.setItem("kasia-theme", theme);
    const effectiveTheme = get().getEffectiveTheme();
    applyTheme(effectiveTheme);
  },
  getEffectiveTheme: () => {
    const currentTheme = get().theme;
    return currentTheme === "system" ? getSystemTheme() : currentTheme;
  },
}));

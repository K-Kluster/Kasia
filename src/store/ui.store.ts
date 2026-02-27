import { create } from "zustand";
import {
  applyCustomColors,
  resetCustomColors,
  getInitialCustomColors,
  DEFAULT_COLORS,
  type CustomColorPalette,
} from "../config/custom-theme-applier";
import { OneOnOneConversation } from "../types/all";

export type ModalType =
  | "address"
  | "walletInfo"
  | "withdraw"
  | "delete"
  | "seed"
  | "settings"
  | "settings-unlocked"
  | "contact-info-modal"
  | "image"
  | "new-chat"
  | "new-broadcast"
  | "broadcast-participant-info"
  | "qr-scanner"
  | "offchain-handshake"
  | "donation"
  | "confirm";
type Theme = "light" | "dark" | "system" | "custom";

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

  // Custom color palette state
  customColors: CustomColorPalette | null;
  setCustomColors: (colors: CustomColorPalette | null) => void;
  updateCustomColor: (key: keyof CustomColorPalette, value: string) => void;
  resetCustomColors: () => void;

  // Contact Info Modal state
  oneOnOneConversation: OneOnOneConversation | null;
  setOneOnOneConversation: (oooc: OneOnOneConversation | null) => void;

  // image presenter content
  imagePresenterImage: string | null;
  setImagePresenterImage: (image: string | null) => void;

  // QR scanner state
  qrScannerCallback: ((data: string) => void) | null;
  setQrScannerCallback: (callback: ((data: string) => void) | null) => void;

  // Delete wallet modal state
  pendingDeleteWalletId: string | null;
  setPendingDeleteWalletId: (id: string | null) => void;

  // Confirmation modal state
  confirmationConfig: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null;
  setConfirmationConfig: (config: UiState["confirmationConfig"]) => void;
};

// Get initial theme from localStorage or default to system
const getInitialTheme = (): Theme => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("kasia-theme");
    if (
      saved === "light" ||
      saved === "dark" ||
      saved === "system" ||
      saved === "custom"
    ) {
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
    const customColors = get().customColors;
    let newTheme: Theme;

    // Cycle: light -> dark -> system -> (custom if exists) -> light
    switch (currentTheme) {
      case "light":
        newTheme = "dark";
        break;
      case "dark":
        newTheme = "system";
        break;
      case "system":
        newTheme = customColors ? "custom" : "light";
        break;
      case "custom":
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

    // apply custom colors if switching to custom theme
    const customColors = get().customColors;
    if (theme === "custom" && customColors) {
      applyCustomColors(customColors);
    } else if (theme !== "custom") {
      // reset custom colors when switching away from custom theme
      resetCustomColors();
    }
  },
  getEffectiveTheme: () => {
    const currentTheme = get().theme;
    if (currentTheme === "custom") {
      return "dark"; // custom theme uses dark as base
    }
    return currentTheme === "system" ? getSystemTheme() : currentTheme;
  },

  // Custom color palette state
  customColors: getInitialCustomColors(),
  setCustomColors: (colors) => {
    // only save if colors are different from defaults
    const isDifferentFromDefaults =
      colors &&
      Object.keys(colors).some(
        (key) =>
          colors[key as keyof typeof colors] !==
          DEFAULT_COLORS[key as keyof typeof DEFAULT_COLORS]
      );

    if (isDifferentFromDefaults) {
      set({ customColors: colors });
      localStorage.setItem("kasia-custom-colors", JSON.stringify(colors));
      applyCustomColors(colors);
    } else {
      set({ customColors: null });
      localStorage.removeItem("kasia-custom-colors");
      resetCustomColors();
    }
  },
  updateCustomColor: (key, value) => {
    const currentColors = get().customColors;
    if (currentColors) {
      const updatedColors = { ...currentColors, [key]: value };
      // use setCustomColors to check if it's different from defaults
      get().setCustomColors(updatedColors);
    }
  },
  resetCustomColors: () => {
    set({ customColors: null });
    localStorage.removeItem("kasia-custom-colors");
    resetCustomColors();
  },

  // Contact Info Modal state
  oneOnOneConversation: null,
  setOneOnOneConversation: (c) => set({ oneOnOneConversation: c }),

  // image presenter content
  imagePresenterImage: null,
  setImagePresenterImage: (image) => set({ imagePresenterImage: image }),

  // QR scanner state
  qrScannerCallback: null,
  setQrScannerCallback: (callback) => set({ qrScannerCallback: callback }),

  // Delete wallet state
  pendingDeleteWalletId: null,
  setPendingDeleteWalletId: (id) => set({ pendingDeleteWalletId: id }),

  // Confirmation modal state
  confirmationConfig: null,
  setConfirmationConfig: (config) => set({ confirmationConfig: config }),
}));

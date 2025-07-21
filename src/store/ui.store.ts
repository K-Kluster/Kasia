import { create } from "zustand";
import type { Contact } from "../types/all"; // adjust path as needed
import {
  applyCustomColors,
  resetCustomColors,
  getInitialCustomColors,
  DEFAULT_COLORS,
  type CustomColorPalette,
} from "../utils/custom-theme-applier";

export type ModalType =
  | "address"
  | "walletInfo"
  | "withdraw"
  | "backup"
  | "delete"
  | "seed"
  | "warn-costy-send-message"
  | "utxo-compound"
  | "settings"
  | "contact-info-modal";
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
  contactInfoContact: Contact | null;
  setContactInfoContact: (c: Contact | null) => void;
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
  contactInfoContact: null,
  setContactInfoContact: (c) => set({ contactInfoContact: c }),
}));

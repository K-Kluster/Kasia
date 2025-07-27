import { create } from "zustand";
import { Dices, LucideIcon } from "lucide-react";

export interface FeatureFlags {
  gameframe: boolean;
  moreitems: boolean;
}

export interface FeatureFlip {
  id: keyof FeatureFlags;
  label: string;
  desc: string;
  icon: LucideIcon;
}

const defaultFlags: FeatureFlags = {
  gameframe: false,
  moreitems: false,
};

const featureFlips: FeatureFlip[] = [
  // UNCOMMENT BELOW!
  // {
  //   id: "gameframe",
  //   label: "Game Frame",
  //   desc: "This enables external game frame content. NOT IMPLEMENTED - JUST FOR FLAG DEMO.",
  //   icon: Dices,
  // },
  // {
  //   id: "moreitems",
  //   label: "More Items",
  //   desc: "This would be something else!",
  //   icon: Dices,
  //},
];

const useFeatureFlagsStore = create<{
  flags: FeatureFlags;
  flips: FeatureFlip[];
  setFlag: (key: keyof FeatureFlags, value: boolean) => void;
  loadFlags: () => void;
}>((set, get) => ({
  flags: defaultFlags,
  flips: featureFlips,

  setFlag: (key, value) => {
    const updated = { ...get().flags, [key]: value };
    set({ flags: updated });
    localStorage.setItem("kasia-feature-flags", JSON.stringify(updated));
  },

  loadFlags: () => {
    try {
      const stored = JSON.parse(
        localStorage.getItem("kasia-feature-flags") || "{}"
      );
      set({ flags: { ...defaultFlags, ...stored } });
    } catch {
      console.error("Invalid flags in localStorage");
    }
  },
}));

export { useFeatureFlagsStore };

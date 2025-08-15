import { create } from "zustand";
import { Coins, LucideIcon } from "lucide-react";

export enum FeatureFlags {
  CUSTOM_FEE = "customfee",
}

export type FeatureFlagsTable = Record<FeatureFlags, boolean>;

const defaultFeatureFlagsTable: FeatureFlagsTable = {
  [FeatureFlags.CUSTOM_FEE]: false,
};

export interface FeatureDescription {
  label: string;
  desc: string;
  icon: LucideIcon;
}

export type FeatureFlips = Record<FeatureFlags, FeatureDescription>;

const featureFlips: FeatureFlips = {
  [FeatureFlags.CUSTOM_FEE]: {
    label: "Custom Priority Fee",
    desc: "Turn on to set custom priority fee in chat.",
    icon: Coins,
  },
};

const useFeatureFlagsStore = create<{
  flags: FeatureFlagsTable;
  flips: FeatureFlips;
  setFlag: (key: FeatureFlags, value: boolean) => void;
}>((set, get) => {
  // hydrate features here, else take default value
  let initialFlags = defaultFeatureFlagsTable;
  try {
    const stored = JSON.parse(
      localStorage.getItem("kasia-feature-flags") || "{}"
    );
    initialFlags = { ...defaultFeatureFlagsTable, ...stored };
  } catch {
    console.error("Invalid flags in localStorage");
  }

  return {
    flags: initialFlags,
    flips: featureFlips,

    setFlag: (key, value) => {
      const updated = { ...get().flags, [key]: value };
      set({ flags: updated });
      localStorage.setItem("kasia-feature-flags", JSON.stringify(updated));
    },
  };
});

export { useFeatureFlagsStore };

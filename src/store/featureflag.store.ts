import { create } from "zustand";
import { Coins, LucideIcon, Radio, Camera, Shield } from "lucide-react";
import { cameraPermissionService } from "../service/camera-permission-service";
import {
  DEFAULT_PASSWORD_TIMEOUT_MINUTES,
  DEFAULT_PASSWORD_REAUTH_THRESHOLD,
} from "../config/constants";

export enum FeatureFlags {
  BROADCAST = "broadcast",
  CUSTOM_FEE = "customfee",
  ENABLED_CAMERA = "enabledcamera",
  DISABLE_PASSWORD_REAUTH = "disablepasswordreauth",
}

export type FeatureFlagsTable = Record<FeatureFlags, boolean>;

const defaultFeatureFlagsTable: FeatureFlagsTable = {
  [FeatureFlags.BROADCAST]: false,
  [FeatureFlags.CUSTOM_FEE]: false,
  [FeatureFlags.ENABLED_CAMERA]: false,
  [FeatureFlags.DISABLE_PASSWORD_REAUTH]: false,
};

export interface FeatureDescription {
  label: string;
  desc: string;
  icon: LucideIcon;
}

export type FeatureFlips = Record<FeatureFlags, FeatureDescription>;

const featureFlips: FeatureFlips = {
  [FeatureFlags.ENABLED_CAMERA]: {
    label: "Enable Camera Features",
    desc:
      "Camera used for QR Scanning, sending photos." +
      "\nNote: Photos are encrypted but sent on chain.",
    icon: Camera,
  },
  [FeatureFlags.CUSTOM_FEE]: {
    label: "Custom Priority Fee",
    desc: "Turn on to set custom priority fee in chat.",
    icon: Coins,
  },
  [FeatureFlags.BROADCAST]: {
    label: "Broadcasts - Beta Version",
    desc: `Unencrypted open messages.\nCurrently live messages only, no storage.\nReminder: Broadcasts are unencrypted.`,
    icon: Radio,
  },
  [FeatureFlags.DISABLE_PASSWORD_REAUTH]: {
    label: "Disable Password Reauthentication",
    desc: `If you have been signed in for longer than ${DEFAULT_PASSWORD_TIMEOUT_MINUTES} minutes we ask you to re-auth when sending funds over ${(Number(DEFAULT_PASSWORD_REAUTH_THRESHOLD) / 100_000_000).toFixed(0)} KAS. Turning this ON disables that.`,
    icon: Shield,
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

      // clear camera permission if camera feature is disabled
      if (key === FeatureFlags.ENABLED_CAMERA && !value) {
        cameraPermissionService.clearPermission();
      }

      localStorage.setItem("kasia-feature-flags", JSON.stringify(updated));
    },
  };
});

export { useFeatureFlagsStore };

import { create } from "zustand";
import {
  Coins,
  LucideIcon,
  Radio,
  Camera,
  MessageSquareText,
  Image,
  Link,
} from "lucide-react";
import { cameraPermissionService } from "../service/camera-permission-service";

export enum FeatureFlags {
  BROADCAST = "broadcast",
  BROADCAST_IMAGE_LINKS = "broadcast_image_links",
  BROADCAST_LINKS = "broadcast_links",
  CUSTOM_FEE = "customfee",
  ENABLED_CAMERA = "enabledcamera",
  MARKDOWN = "markdown",
}

export type FeatureFlagsTable = Record<FeatureFlags, boolean>;

const defaultFeatureFlagsTable: FeatureFlagsTable = {
  [FeatureFlags.BROADCAST]: false,
  [FeatureFlags.BROADCAST_IMAGE_LINKS]: false,
  [FeatureFlags.BROADCAST_LINKS]: false,
  [FeatureFlags.CUSTOM_FEE]: false,
  [FeatureFlags.ENABLED_CAMERA]: false,
  [FeatureFlags.MARKDOWN]: false,
};

export interface FeatureDescription {
  label: string;
  desc: string;
  icon: LucideIcon;
  parent?: FeatureFlags; // if set, this is a child flag rendered under the closet parent up the list
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
  [FeatureFlags.MARKDOWN]: {
    label: "Send Markdown Messages",
    desc: `Enable markdown formatting for all outgoing messages.\nReminder: Messages will cost slightly more due to markdown formatting`,
    icon: MessageSquareText,
  },
  [FeatureFlags.CUSTOM_FEE]: {
    label: "Custom Priority Fee",
    desc: "Turn on to set custom priority fee in chat.",
    icon: Coins,
  },
  [FeatureFlags.BROADCAST]: {
    label: "Broadcasts - Beta Version",
    desc: `Unencrypted open messages.\nLive messages only, no storage.\nReminder: Broadcasts are unencrypted.`,
    icon: Radio,
  },
  [FeatureFlags.BROADCAST_IMAGE_LINKS]: {
    label: "Broadcasts - Enable Image Links",
    desc: "Allow embedded image links to render.\nWarning: This is unfiltered and potentially contains unwanted content.",
    icon: Image,
    parent: FeatureFlags.BROADCAST,
  },
  [FeatureFlags.BROADCAST_LINKS]: {
    label: "Broadcasts - Enable Links",
    desc: "Make markdown links clickable.\nWarning: Links are dangerous if clicked.",
    icon: Link,
    parent: FeatureFlags.BROADCAST,
  },
};

const useFeatureFlagsStore = create<{
  flags: FeatureFlagsTable;
  flips: FeatureFlips;
  setFlag: (key: FeatureFlags, value: boolean) => void;
  isFlagEnabled: (key: FeatureFlags) => boolean;
}>((set, get) => {
  // hydrate from localStorage
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

      // if disabling a parent flag, also disable all its children
      if (!value) {
        for (const [childKey, childFlip] of Object.entries(featureFlips)) {
          if (childFlip.parent === key) {
            updated[childKey as FeatureFlags] = false;
          }
        }
      }

      set({ flags: updated });

      // clear camera permission if camera feature is disabled
      if (key === FeatureFlags.ENABLED_CAMERA && !value) {
        cameraPermissionService.clearPermission();
      }

      localStorage.setItem("kasia-feature-flags", JSON.stringify(updated));
    },

    isFlagEnabled: (key) => {
      const flip = featureFlips[key];
      // if this flag has a parent, it's only effective if parent is also enabled
      if (flip.parent) {
        return get().flags[flip.parent] && get().flags[key];
      }
      return get().flags[key];
    },
  };
});

export { useFeatureFlagsStore };

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type FeatureFlag = "gif";

// Get feature flags from environment variables
const getEnvFeatures = (): Array<FeatureFlag> => {
  const envFeatures = import.meta.env.VITE_ENABLED_FEATURES;

  if (!envFeatures) {
    // Default features when no env var is set
    return ["gif"];
  }

  if (envFeatures === "none" || envFeatures === "") {
    // Explicitly disable all features
    return [];
  }

  // Parse comma-separated features from env
  return envFeatures
    .split(",")
    .map((f: string) => f.trim())
    .filter((f: string) => f === "gif") as Array<FeatureFlag>;
};

// Features enabled at build time (from .env)
export const buildTimeFeatures = new Set(getEnvFeatures());

// Default runtime features (can be toggled by user)
// Only include features that are enabled at build time
export const defaultRuntimeFeatures: Array<FeatureFlag> =
  Array.from(buildTimeFeatures);

interface FeatureState {
  enabledFeatures: Set<FeatureFlag>;
  isFeatureEnabled: (feature: FeatureFlag) => boolean;
  isFeatureAvailable: (feature: FeatureFlag) => boolean;
  enableFeature: (feature: FeatureFlag) => void;
  disableFeature: (feature: FeatureFlag) => void;
  toggleFeature: (feature: FeatureFlag) => void;
  getAvailableFeatures: () => Array<FeatureFlag>;
}

export const useFeatureStore = create<FeatureState>()(
  persist(
    (set, get) => ({
      enabledFeatures: new Set(defaultRuntimeFeatures),

      isFeatureEnabled: (feature: FeatureFlag) => {
        // Feature must be available at build time AND enabled at runtime
        return (
          buildTimeFeatures.has(feature) && get().enabledFeatures.has(feature)
        );
      },

      isFeatureAvailable: (feature: FeatureFlag) => {
        // Check if feature is available at build time
        return buildTimeFeatures.has(feature);
      },

      enableFeature: (feature: FeatureFlag) => {
        // Can only enable features that are available at build time
        if (!buildTimeFeatures.has(feature)) {
          console.warn(`Feature '${feature}' is not available at build time`);
          return;
        }

        set((state) => ({
          enabledFeatures: new Set([...state.enabledFeatures, feature]),
        }));
      },

      disableFeature: (feature: FeatureFlag) => {
        set((state) => {
          const newFeatures = new Set(state.enabledFeatures);
          newFeatures.delete(feature);
          return { enabledFeatures: newFeatures };
        });
      },

      toggleFeature: (feature: FeatureFlag) => {
        const { isFeatureEnabled, enableFeature, disableFeature } = get();
        if (isFeatureEnabled(feature)) {
          disableFeature(feature);
        } else {
          enableFeature(feature);
        }
      },

      getAvailableFeatures: () => {
        return Array.from(buildTimeFeatures);
      },
    }),
    {
      name: "feature-flags-storage",
      // Only persist runtime toggles, not build-time config
      partialize: (state) => ({ enabledFeatures: state.enabledFeatures }),
    }
  )
);

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

// Helper to ensure we always have a Set
const ensureFeatureSet = (features: unknown): Set<FeatureFlag> => {
  if (features instanceof Set) return features;
  if (Array.isArray(features)) return new Set(features);
  return new Set(defaultRuntimeFeatures);
};

export const useFeatureStore = create<FeatureState>()(
  persist(
    (set, get) => ({
      enabledFeatures: new Set(defaultRuntimeFeatures),

      isFeatureEnabled: (feature: FeatureFlag) => {
        const state = get();
        const features = ensureFeatureSet(state.enabledFeatures);
        return buildTimeFeatures.has(feature) && features.has(feature);
      },

      isFeatureAvailable: (feature: FeatureFlag) => {
        return buildTimeFeatures.has(feature);
      },

      enableFeature: (feature: FeatureFlag) => {
        if (!buildTimeFeatures.has(feature)) {
          console.warn(`Feature '${feature}' is not available at build time`);
          return;
        }

        set((state) => {
          const features = ensureFeatureSet(state.enabledFeatures);
          return {
            enabledFeatures: new Set([...features, feature]),
          };
        });
      },

      disableFeature: (feature: FeatureFlag) => {
        set((state) => {
          const features = ensureFeatureSet(state.enabledFeatures);
          features.delete(feature);
          return { enabledFeatures: features };
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
      // Convert Set to Array for storage
      partialize: (state) => ({
        enabledFeatures: Array.from(state.enabledFeatures),
      }),
      // Convert Array back to Set after rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Ensure enabledFeatures is a Set
          state.enabledFeatures = ensureFeatureSet(state.enabledFeatures);
        }
      },
    }
  )
);

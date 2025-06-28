import { FC } from "react";
import { useFeatureStore, FeatureFlag } from "../store/feature.store";
import clsx from "clsx";

interface FeatureToggleSettingsProps {
  className?: string;
}

const featureDescriptions: Record<
  FeatureFlag,
  { name: string; description: string; thirdParty: string }
> = {
  gif: {
    name: "GIF Picker",
    description: "Search and send GIFs in chat messages",
    thirdParty: "Tenor API",
  },
};

export const FeatureToggleSettings: FC<FeatureToggleSettingsProps> = ({
  className,
}) => {
  const featureStore = useFeatureStore();
  const availableFeatures = featureStore.getAvailableFeatures();

  if (availableFeatures.length === 0) {
    return (
      <div
        className={clsx("p-4 bg-[var(--secondary-bg)] rounded-lg", className)}
      >
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          Third-Party Features
        </h3>
        <p className="text-[var(--text-secondary)] text-sm">
          No third-party features are available in this build. This is likely
          intentional for privacy or self-hosting reasons.
        </p>
      </div>
    );
  }

  return (
    <div className={clsx("p-4 bg-[var(--secondary-bg)] rounded-lg", className)}>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        Third-Party Features
      </h3>
      <p className="text-[var(--text-secondary)] text-sm mb-4">
        These features use external services. You can disable them for privacy
        or if the services are unavailable.
      </p>

      <div className="space-y-3">
        {availableFeatures.map((feature) => {
          const isEnabled = featureStore.isFeatureEnabled(feature);
          const info = featureDescriptions[feature];

          return (
            <div
              key={feature}
              className="flex items-start justify-between p-3 bg-[var(--primary-bg)] rounded-md"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-[var(--text-primary)]">
                    {info.name}
                  </h4>
                  <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    {info.thirdParty}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-secondary)]">
                  {info.description}
                </p>
              </div>

              <button
                onClick={() => featureStore.toggleFeature(feature)}
                className={clsx(
                  "ml-4 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                  isEnabled ? "bg-blue-600" : "bg-gray-200"
                )}
                role="switch"
                aria-checked={isEnabled}
                aria-labelledby={`${feature}-label`}
              >
                <span
                  className={clsx(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
        <p className="text-xs text-yellow-800">
          <strong>Note:</strong> Feature availability is determined at build
          time via environment variables. These toggles only control runtime
          behavior for available features.
        </p>
      </div>
    </div>
  );
};

import { FC, useState, useEffect } from "react";
import { Modal } from "./Common/modal";
import {
  ArrowsUpDownIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { FeeBucket, PriorityFeeConfig, MAX_PRIORITY_FEE } from "../types/all";
import { FeeSource } from "kaspa-wasm";
import clsx from "clsx";
import { useWalletStore } from "../store/wallet.store";
import { Button } from "./Common/Button";

interface PriorityFeeSelectorProps {
  onFeeChange: (fee: PriorityFeeConfig) => void;
  currentFee: PriorityFeeConfig;
  className?: string;
}

interface FeeSettings {
  fee: PriorityFeeConfig;
  isPersistent: boolean;
  selectedBucket?: string; // Track which bucket was selected
}

export const PriorityFeeSelector: FC<PriorityFeeSelectorProps> = ({
  onFeeChange,
  currentFee,
  className = "",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [settings, setSettings] = useState<FeeSettings>({
    fee: { amount: BigInt(0), source: FeeSource.SenderPays }, // Default to 0 fee for Low
    isPersistent: false,
    selectedBucket: "Low", // Default to Low
  });

  // Get fee estimate from wallet store instead of fetching directly
  const feeEstimate = useWalletStore((s) => s.feeEstimate);

  // Load persistent settings on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("priorityFeeSettings");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const fee: PriorityFeeConfig = {
          amount: BigInt(0), // Let WASM calculate the amount
          source: parsed.fee.source,
          feerate: parsed.fee.feerate,
        };
        setSettings({
          fee,
          isPersistent: parsed.isPersistent,
          selectedBucket: parsed.selectedBucket,
        });
        onFeeChange(fee);
      } catch (error) {
        console.error("Failed to load priority fee settings:", error);
      }
    } else {
      // Initialize with Low bucket (0 fee) as default
      const defaultFee = { amount: BigInt(0), source: FeeSource.SenderPays };
      setSettings((prev) => ({
        ...prev,
        fee: defaultFee,
        selectedBucket: "Low",
      }));
      onFeeChange(defaultFee);
    }
  }, [onFeeChange]);

  // Sync settings when currentFee changes externally
  useEffect(() => {
    setSettings((prev) => ({
      ...prev,
      fee: currentFee,
      // Only update selectedBucket if it's not already set
      selectedBucket:
        prev.selectedBucket ||
        (currentFee.amount === BigInt(0) ? "Low" : "Custom"),
    }));
  }, [currentFee]);

  // Get dynamic fee buckets from network data
  const getDynamicFeeBuckets = (): FeeBucket[] => {
    const buckets: FeeBucket[] = [];
    const estimate = feeEstimate?.estimate || {};

    // Low bucket (slowest/cheapest) - should always be 0 priority fee
    buckets.push({
      label: "Low",
      description: "Standard processing time",
      amount: BigInt(0), // Low priority = no additional fee
      feerate: estimate.lowBuckets?.[0]?.feerate || 1,
      estimatedSeconds: estimate.lowBuckets?.[0]?.estimatedSeconds,
    });

    // Normal bucket (medium speed/cost)
    if (estimate.normalBuckets && estimate.normalBuckets.length > 0) {
      const normalBucket = estimate.normalBuckets[0];
      buckets.push({
        label: "Normal",
        description: "Faster during busy times",
        amount: BigInt(0), // Let WASM calculate the amount
        feerate: normalBucket.feerate,
        estimatedSeconds: normalBucket.estimatedSeconds,
      });
    } else {
      buckets.push({
        label: "Normal",
        description: "Faster during busy times",
        amount: BigInt(0),
        feerate: 1, // Default to 1 sompi/gram when no estimate
      });
    }

    // Priority bucket (fastest/most expensive)
    if (estimate.priorityBucket) {
      const priorityBucket = estimate.priorityBucket;
      buckets.push({
        label: "Priority",
        description: "Fastest processing",
        amount: BigInt(0), // Let WASM calculate the amount
        feerate: priorityBucket.feerate,
        estimatedSeconds: priorityBucket.estimatedSeconds,
      });
    } else {
      buckets.push({
        label: "Priority",
        description: "Fastest processing",
        amount: BigInt(0),
        feerate: 1, // Default to 1 sompi/gram when no estimate
      });
    }

    return buckets;
  };

  const handleFeeSelect = (bucket: FeeBucket) => {
    const newFee: PriorityFeeConfig = {
      amount: BigInt(0), // Let WASM calculate the amount
      source: FeeSource.SenderPays,
      feerate: bucket.feerate,
    };

    console.log(
      "Selected fee bucket:",
      bucket.label,
      "Fee rate:",
      bucket.feerate
    );
    setSettings((prev) => ({
      ...prev,
      fee: newFee,
      selectedBucket: bucket.label,
    }));
    onFeeChange(newFee);

    if (settings.isPersistent) {
      savePersistentSettings(newFee, true, bucket.label);
    }

    setIsModalOpen(false);
  };

  const handleCustomFee = () => {
    const kasValue = parseFloat(customAmount);
    if (isNaN(kasValue) || kasValue < 0) return;

    const sompiValue = BigInt(Math.floor(kasValue * 100_000_000));

    if (sompiValue > MAX_PRIORITY_FEE) {
      alert(
        `Priority fee cannot exceed ${
          Number(MAX_PRIORITY_FEE) / 100_000_000
        } KAS`
      );
      return;
    }

    const newFee: PriorityFeeConfig = {
      amount: sompiValue,
      source: FeeSource.SenderPays,
    };

    setSettings((prev) => ({
      ...prev,
      fee: newFee,
      selectedBucket: "Custom",
    }));
    onFeeChange(newFee);

    if (settings.isPersistent) {
      savePersistentSettings(newFee, true, "Custom");
    }

    setIsModalOpen(false);
  };

  const togglePersistence = (isPersistent: boolean) => {
    setSettings((prev) => ({ ...prev, isPersistent }));

    if (isPersistent) {
      savePersistentSettings(settings.fee, true, settings.selectedBucket);
    } else {
      sessionStorage.removeItem("priorityFeeSettings");
    }
  };

  const savePersistentSettings = (
    fee: PriorityFeeConfig,
    isPersistent: boolean,
    selectedBucket?: string
  ) => {
    sessionStorage.setItem(
      "priorityFeeSettings",
      JSON.stringify({
        fee: {
          amount: "0", // Let WASM calculate the amount
          source: fee.source,
          feerate: fee.feerate,
        },
        isPersistent,
        selectedBucket,
      })
    );
  };

  const getCurrentBucketLabel = () => {
    // Use the explicitly selected bucket if available
    if (settings.selectedBucket) {
      return settings.selectedBucket;
    }

    // For custom fees, show the label
    return "Custom";
  };

  const getCurrentBucketColor = () => {
    const bucket = getCurrentBucketLabel();
    switch (bucket) {
      case "Priority":
        return "text-red-400";
      case "Normal":
        return "text-blue-400";
      case "Low":
        return "text-green-400";
      default:
        return "text-[#49EACB]"; // Default green for custom
    }
  };

  const formatTime = (seconds: number | undefined) => {
    if (seconds === undefined || seconds === null) return "";
    const value = Number(seconds);
    if (isNaN(value)) return "";

    if (value < 0.001) {
      return "~0.1s";
    } else if (value < 1) {
      return `~${(value * 1000).toFixed(0)}ms`;
    } else if (value < 60) {
      return `~${value.toFixed(1)}s`;
    } else {
      return `~${Math.round(value / 60)}m`;
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={clsx(
          "flex items-center gap-1 text-sm font-medium",
          getCurrentBucketColor(),
          className
        )}
      >
        <ArrowsUpDownIcon className="h-4 w-4" />
        <span>{getCurrentBucketLabel()}</span>
      </button>

      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <h3 className="text-lg font-medium mb-4">Select Priority Fee</h3>
            <div className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
              <InformationCircleIcon className="h-5 w-5 flex-shrink-0" />
              <p>
                Priority fees help your transaction get processed faster during
                busy times. Higher fees = faster processing.
              </p>
            </div>

            <div className="space-y-2">
              {getDynamicFeeBuckets().map((bucket, index) => (
                <button
                  key={index}
                  onClick={() => handleFeeSelect(bucket)}
                  className={clsx(
                    "cursor-pointer w-full p-4 rounded-lg border text-left transition-colors",
                    "hover:bg-[var(--secondary-bg)] focus:ring-2 focus:ring-blue-500",
                    settings.selectedBucket === bucket.label
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-[var(--border-color)]"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {bucket.label}
                      </div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {bucket.description}
                      </div>
                      {bucket.estimatedSeconds && (
                        <div className="text-xs text-[var(--text-secondary)] mt-1">
                          {formatTime(bucket.estimatedSeconds)}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-mono text-[var(--accent-green)]">
                      {bucket.feerate === 1
                        ? "Base fee"
                        : `${bucket.feerate}x fee rate`}
                    </div>
                  </div>
                </button>
              ))}

              {/* Custom fee option */}
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Custom Fee</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Enter amount in KAS"
                    className="flex-1 px-3 py-2 bg-[var(--input-bg)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button onClick={handleCustomFee} className="!w-fit">
                    Set
                  </Button>
                </div>
              </div>

              {/* Remember choice option */}
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remember-choice"
                  checked={settings.isPersistent}
                  onChange={(e) => togglePersistence(e.target.checked)}
                  className="cursor-pointer rounded border-[var(--border-color)] bg-[var(--input-bg)] text-blue-500 focus:ring-2 focus:ring-blue-500"
                />
                <label
                  htmlFor="remember-choice"
                  className="text-sm text-[var(--text-secondary)]"
                >
                  Remember my choice
                </label>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

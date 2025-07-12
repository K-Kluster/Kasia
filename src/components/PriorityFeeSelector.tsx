import { FC, useState, useEffect, useMemo, useCallback } from "react";
import { Modal } from "./Common/modal";
import { Info, ArrowUpDown } from "lucide-react";
import { FeeBucket, PriorityFeeConfig } from "../types/all";
import { FeeSource } from "kaspa-wasm";
import clsx from "clsx";
import { useWalletStore } from "../store/wallet.store";
import { Button } from "./Common/Button";
import { toast } from "../utils/toast";
import { Input } from "@headlessui/react";
import { DEFAULT_FEE_BUCKETS, MAX_PRIORITY_FEE } from "../config/constants";

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

  const parsedSettings = useMemo(() => {
    const saved = sessionStorage.getItem("priorityFeeSettings");
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      return {
        fee: {
          amount: BigInt(parsed.fee.amount ?? "0"),
          source: parsed.fee.source,
          feerate: parsed.fee.feerate,
        },
        isPersistent: parsed.isPersistent,
        selectedBucket: parsed.selectedBucket,
      };
    } catch {
      console.error("Failed to load priority fee settings");
      return null;
    }
  }, []);

  // Load persistent settings on mount
  useEffect(() => {
    if (parsedSettings) {
      setSettings(parsedSettings);
      if (parsedSettings.selectedBucket === "Custom") {
        setCustomAmount(
          (Number(parsedSettings.fee.amount) / 100_000_000).toString()
        );
      }
      onFeeChange({
        amount: parsedSettings.fee.amount,
        source: parsedSettings.fee.source,
        feerate:
          parsedSettings.selectedBucket === "Custom"
            ? undefined
            : parsedSettings.fee.feerate,
      });
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
  }, [parsedSettings, onFeeChange]);

  // Get dynamic fee buckets from network data
  const dynamicFeeBuckets = useMemo(() => {
    const buckets: FeeBucket[] = [];
    const estimate = feeEstimate?.estimate || null;

    if (!estimate) {
      return DEFAULT_FEE_BUCKETS;
    }

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
  }, [feeEstimate]);

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

  const handleCustomAmountChange = useCallback((value: string) => {
    // Allow decimal numbers
    if (/^\d*\.?\d*$/.test(value)) {
      setCustomAmount(value);
    } else {
      toast.warning("Amount must be a number", 1500);
    }
  }, []);

  const handleCustomFee = () => {
    const kasValue = parseFloat(customAmount);
    if (isNaN(kasValue) || kasValue < 0) return;

    const sompiValue = BigInt(Math.floor(kasValue * 100_000_000));

    if (sompiValue > MAX_PRIORITY_FEE) {
      toast.warning(
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
          amount: fee.amount.toString(),
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
          "flex cursor-pointer items-center gap-1 text-sm font-medium",
          {
            "text-red-400": getCurrentBucketLabel() === "Priority",
            "text-blue-400": getCurrentBucketLabel() === "Normal",
            "text-green-400": getCurrentBucketLabel() === "Low",
            "text-[#49EACB]": !["Priority", "Normal", "Low"].includes(
              getCurrentBucketLabel()
            ),
          },
          className
        )}
      >
        <ArrowUpDown className="h-4 w-4" />
        <span>{getCurrentBucketLabel()}</span>
      </button>

      {isModalOpen && (
        <Modal onClose={() => setIsModalOpen(false)}>
          <div className="space-y-4">
            <h3 className="mb-4 text-lg font-medium">Select Priority Fee</h3>
            <div className="flex items-start gap-2 text-xs text-[var(--text-secondary)] sm:text-sm">
              <Info className="h-5 w-5 flex-shrink-0" />
              <p>
                Priority fees help your transaction get processed faster during
                busy times. Higher fees = faster processing.
              </p>
            </div>

            <div className="space-y-2">
              {dynamicFeeBuckets.map((bucket, index) => (
                <button
                  key={index}
                  onClick={() => handleFeeSelect(bucket)}
                  className={clsx(
                    "w-full cursor-pointer rounded-lg border px-4 py-2 text-left transition-colors sm:py-4",
                    "hover:bg-[var(--primary-bg)] focus:ring-2 focus:ring-blue-500",
                    settings.selectedBucket === bucket.label
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-[var(--border-color)] bg-[var(--primary-bg)]"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">
                        {bucket.label}
                      </div>
                      <div className="text-sm text-[var(--text-secondary)]">
                        {bucket.description}
                      </div>
                      {bucket.estimatedSeconds && (
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">
                          {formatTime(bucket.estimatedSeconds)}
                        </div>
                      )}
                    </div>
                    <div className="font-mono text-sm text-[var(--accent-green)]">
                      {bucket.feerate === 1
                        ? "Base fee"
                        : `${bucket.feerate}x fee rate`}
                    </div>
                  </div>
                </button>
              ))}

              {/* Custom fee option */}
              <div className="mt-4">
                <div className="mb-2 text-sm font-medium">Custom Fee</div>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    placeholder="Enter amount in KAS"
                    className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--input-bg)] px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <Button onClick={handleCustomFee} className="!w-fit">
                    Set
                  </Button>
                </div>
              </div>

              {/* Remember choice option */}
              <div className="my-4 flex items-center gap-2">
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

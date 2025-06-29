import { FC } from "react";
import { formatKasAmount } from "../utils/format";
import { useWalletStore } from "../store/wallet.store";
import { STANDARD_TRANSACTION_MASS } from "../config/constants";

interface FeeBucketsProps {
  inline?: boolean;
}

/**
 * Fee bucket component that displays network fee rate estimates
 */
export const FeeBuckets: FC<FeeBucketsProps> = ({ inline = false }) => {
  // Get fee estimate from wallet store instead of fetching directly
  const feeEstimate = useWalletStore((s) => s.feeEstimate);

  if (!feeEstimate) return null;

  // Get the estimate from the response
  const estimate = feeEstimate.estimate || {};

  const calculateAndFormatFee = (feerate: number = 1) => {
    const feeInSompi = Math.ceil(feerate * STANDARD_TRANSACTION_MASS);
    return formatKasAmount(feeInSompi, true);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 0.001) {
      return "~0.1s";
    } else if (seconds < 1) {
      return `~${(seconds * 1000).toFixed(0)}ms`;
    } else if (seconds < 60) {
      return `~${seconds.toFixed(1)}s`;
    } else {
      return `~${Math.round(seconds / 60)}m`;
    }
  };

  // For inline display, show all three buckets in a compact format
  if (inline) {
    return (
      <div className="m-0 flex items-center gap-2 p-0">
        {estimate.priorityBucket && (
          <div
            className="fee-rate-inline priority"
            title={`Fast - Time: ${formatTime(
              estimate.priorityBucket.estimatedSeconds
            )} - Fee: ${calculateAndFormatFee(
              estimate.priorityBucket.feerate
            )} KAS`}
          >
            <span className="fee-label">P:</span>
            <span className="fee-value">
              {calculateAndFormatFee(estimate.priorityBucket.feerate)}
            </span>
          </div>
        )}
        {estimate.normalBuckets && estimate.normalBuckets.length > 0 && (
          <div
            className="fee-rate-inline normal"
            title={`Normal - Time: ${formatTime(
              estimate.normalBuckets[0]?.estimatedSeconds
            )} - Fee: ${calculateAndFormatFee(
              estimate.normalBuckets[0]?.feerate
            )} KAS`}
          >
            <span className="fee-label">N:</span>
            <span className="fee-value">
              {calculateAndFormatFee(estimate.normalBuckets[0]?.feerate)}
            </span>
          </div>
        )}
        {estimate.lowBuckets && estimate.lowBuckets.length > 0 && (
          <div
            className="fee-rate-inline low"
            title={`Slow - Time: ${formatTime(
              estimate.lowBuckets[0]?.estimatedSeconds
            )} - Fee: ${calculateAndFormatFee(
              estimate.lowBuckets[0]?.feerate
            )} KAS`}
          >
            <span className="fee-label">L:</span>
            <span className="fee-value">
              {calculateAndFormatFee(estimate.lowBuckets[0]?.feerate)}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-white/10">
      <h4 className="mb-2 text-[0.9rem] text-gray-400">Network Fees</h4>

      {estimate.priorityBucket && (
        <div className="mb-1.5 flex items-center justify-between rounded border border-red-500/20 bg-red-500/10 px-2 py-1.5 text-[0.8rem]">
          <div className="font-medium">Fast</div>
          <div className="font-mono text-[0.85rem]">
            {calculateAndFormatFee(estimate.priorityBucket.feerate)} KAS
          </div>
          <div className="text-xs text-gray-400">
            {formatTime(estimate.priorityBucket.estimatedSeconds)}
          </div>
        </div>
      )}

      {estimate.normalBuckets && estimate.normalBuckets.length > 0 && (
        <div className="mb-1.5 flex items-center justify-between rounded border border-blue-500/20 bg-blue-500/10 px-2 py-1.5 text-[0.8rem]">
          <div className="font-medium">Normal</div>
          <div className="font-mono text-[0.85rem]">
            {calculateAndFormatFee(estimate.normalBuckets[0]?.feerate)} KAS
          </div>
          <div className="text-xs text-gray-400">
            {formatTime(estimate.normalBuckets[0]?.estimatedSeconds)}
          </div>
        </div>
      )}

      {estimate.lowBuckets && estimate.lowBuckets.length > 0 && (
        <div className="mb-1.5 flex items-center justify-between rounded border border-green-500/20 bg-green-500/10 px-2 py-1.5 text-[0.8rem]">
          <div className="font-medium">Slow</div>
          <div className="font-mono text-[0.85rem]">
            {calculateAndFormatFee(estimate.lowBuckets[0]?.feerate)} KAS
          </div>
          <div className="text-xs text-gray-400">
            {formatTime(estimate.lowBuckets[0]?.estimatedSeconds)}
          </div>
        </div>
      )}
    </div>
  );
};

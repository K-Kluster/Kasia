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
      <div className="m-0 flex items-center gap-1.5 p-0">
        {estimate.priorityBucket && (
          <div
            className="rounded-3xl border border-red-500/30 bg-red-500/10 px-2 py-1 text-sm font-medium text-red-400"
            title={`Fast - Time: ${formatTime(
              estimate.priorityBucket.estimatedSeconds
            )} - Fee: ${calculateAndFormatFee(
              estimate.priorityBucket.feerate
            )} KAS`}
          >
            <span className="mr-1">Fast:</span>
            <span className="mr-1 font-mono">
              {calculateAndFormatFee(estimate.priorityBucket.feerate)}
            </span>
            <span className="text-red-300">
              {formatTime(estimate.priorityBucket.estimatedSeconds)}
            </span>
          </div>
        )}
        {estimate.normalBuckets && estimate.normalBuckets.length > 0 && (
          <div
            className="rounded-3xl border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-sm font-medium text-blue-400"
            title={`Medium - Time: ${formatTime(
              estimate.normalBuckets[0]?.estimatedSeconds
            )} - Fee: ${calculateAndFormatFee(
              estimate.normalBuckets[0]?.feerate
            )} KAS`}
          >
            <span className="mr-1">Medium:</span>
            <span className="mr-1 font-mono">
              {calculateAndFormatFee(estimate.normalBuckets[0]?.feerate)}
            </span>
            <span className="text-blue-300">
              {formatTime(estimate.normalBuckets[0]?.estimatedSeconds)}
            </span>
          </div>
        )}
        {estimate.lowBuckets && estimate.lowBuckets.length > 0 && (
          <div
            className="rounded-3xl border border-green-500/30 bg-green-500/10 px-2 py-1 text-sm font-medium text-green-400"
            title={`Slow - Time: ${formatTime(
              estimate.lowBuckets[0]?.estimatedSeconds
            )} - Fee: ${calculateAndFormatFee(
              estimate.lowBuckets[0]?.feerate
            )} KAS`}
          >
            <span className="mr-1">Slow:</span>
            <span className="mr-1 font-mono">
              {calculateAndFormatFee(estimate.lowBuckets[0]?.feerate)}
            </span>
            <span className="text-green-300">
              {formatTime(estimate.lowBuckets[0]?.estimatedSeconds)}
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
        <div className="mb-1.5 flex items-center justify-between rounded-3xl border border-red-500/80 bg-red-500/20 px-2 py-1.5 text-[0.8rem]">
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
        <div className="mb-1.5 flex items-center justify-between rounded-3xl border border-blue-500/80 bg-blue-500/20 px-2 py-1.5 text-[0.8rem]">
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
        <div className="mb-1.5 flex items-center justify-between rounded-3xl border border-green-500/80 bg-green-500/20 px-2 py-1.5 text-[0.8rem]">
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

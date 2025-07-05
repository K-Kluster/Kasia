import { FC, useState, useEffect } from "react";
import { DecryptionCache } from "../../utils/decryption-cache";
import clsx from "clsx";
import { useWalletStore } from "../../store/wallet.store";

export const DecryptionCacheDebug: FC = () => {
  const [stats, setStats] = useState({ size: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const address = useWalletStore((s) => s.address);

  useEffect(() => {
    if (!address) return;

    const updateStats = () => {
      setStats(DecryptionCache.getStats(address.toString()));
    };

    // Update stats initially
    updateStats();

    // Update stats every 5 seconds
    const interval = setInterval(updateStats, 5000);

    return () => clearInterval(interval);
  }, [address]);

  const handleClearCache = () => {
    if (!address) return;
    DecryptionCache.clear(address.toString());
    setStats(DecryptionCache.getStats(address.toString()));
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed right-4 bottom-4 rounded-md bg-gray-800 px-3 py-2 text-sm text-white opacity-50 transition-opacity hover:opacity-100"
        title="Show decryption cache debug info"
      >
        Cache Debug
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-4 max-w-xs rounded-lg border border-gray-300 bg-white p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">
          Decryption Cache
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-lg leading-none text-gray-500 hover:text-gray-700"
          title="Hide debug info"
        >
          ×
        </button>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Failed TXs:</span>
          <span className="font-mono text-gray-900">{stats.size}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Status:</span>
          <span className="font-mono text-gray-900">
            {stats.size === 0 ? "Empty" : "Active"}
          </span>
        </div>
      </div>

      <div className="mt-3 border-t border-gray-200 pt-3">
        <button
          onClick={handleClearCache}
          className={clsx(
            "w-full rounded-md px-3 py-2 text-sm transition-colors",
            stats.size > 0
              ? "bg-red-500 text-white hover:bg-red-600"
              : "cursor-not-allowed bg-gray-200 text-gray-500"
          )}
          disabled={stats.size === 0}
          title={
            stats.size > 0
              ? "Clear all cached failed decryptions"
              : "No cached failures to clear"
          }
        >
          Clear Cache ({stats.size})
        </button>
      </div>

      <div className="mt-2 text-xs text-gray-500">
        Cache permanently skips failed decryptions for optimal performance
      </div>
    </div>
  );
};

import { FC, useState, useEffect } from "react";
import { DecryptionCache } from "../../utils/decryption-cache";
import clsx from "clsx";

export const DecryptionCacheDebug: FC = () => {
  const [stats, setStats] = useState({ size: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      setStats(DecryptionCache.getStats());
    };

    // Update stats initially
    updateStats();

    // Update stats every 5 seconds
    const interval = setInterval(updateStats, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    DecryptionCache.clear();
    setStats(DecryptionCache.getStats());
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-md text-sm opacity-50 hover:opacity-100 transition-opacity"
        title="Show decryption cache debug info"
      >
        Cache Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">
          Decryption Cache
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700 text-lg leading-none"
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

      <div className="mt-3 pt-3 border-t border-gray-200">
        <button
          onClick={handleClearCache}
          className={clsx(
            "w-full px-3 py-2 text-sm rounded-md transition-colors",
            stats.size > 0
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
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

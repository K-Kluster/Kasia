/**
 * DecryptionCache - Manages failed decryption attempts to optimize performance
 *
 * This cache permanently stores transaction IDs that have failed decryption to avoid
 * repeatedly attempting to decrypt messages we know will never succeed.
 * Cache entries are only removed when a transaction successfully decrypts (key change scenario).
 */

interface CacheEntry {
  txId: string;
  timestamp: number;
}

interface CacheData {
  [key: string]: {
    entries: CacheEntry[];
    version: number;
  };
}

export class DecryptionCache {
  private static readonly CACHE_KEY = "kasia_failed_decryptions";

  private static cache: Set<string> | null = null;

  /**
   * Initialize the cache from localStorage
   */
  private static initCache(walletAddress: string): Set<string> {
    if (this.cache !== null) return this.cache;

    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as CacheData;
        // Load all entries (no expiry needed)
        const validEntries = data[walletAddress]?.entries || [];

        this.cache = new Set(validEntries.map((e: CacheEntry) => e.txId));
      } else {
        this.cache = new Set();
      }
    } catch (error) {
      console.warn("Failed to load decryption cache:", error);
      this.cache = new Set();
    }

    return this.cache;
  }

  /**
   * Check if a transaction ID has failed decryption before
   */
  static hasFailed(walletAddress: string, txId: string): boolean {
    const cache = this.initCache(walletAddress);
    return cache.has(txId);
  }

  /**
   * Mark a transaction ID as failed decryption
   */
  static markFailed(walletAddress: string, txId: string): void {
    const cache = this.initCache(walletAddress);
    cache.add(txId);
    this.persistCache(walletAddress);
  }

  /**
   * Remove a transaction ID from failed cache (if successful later)
   */
  static markSuccess(walletAddress: string, txId: string): void {
    const cache = this.initCache(walletAddress);
    if (cache.delete(txId)) {
      this.persistCache(walletAddress);
    }
  }

  /**
   * Clear the entire cache
   */
  static clear(walletAddress: string): void {
    this.cache = new Set();

    const data = localStorage.getItem(this.CACHE_KEY);
    if (data) {
      const parsedData = JSON.parse(data);
      delete parsedData[walletAddress];

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(parsedData));
    }
  }

  /**
   * Get cache statistics for debugging/monitoring
   */
  static getStats(walletAddress: string): { size: number } {
    const cache = this.initCache(walletAddress);
    return {
      size: cache.size,
    };
  }

  /**
   * Persist cache to localStorage with timestamps
   */
  private static persistCache(walletAddress: string): void {
    if (!this.cache) return;

    try {
      const walletData = {
        entries: Array.from(this.cache).map((txId) => ({
          txId,
          timestamp: Date.now(),
        })),
        version: 1, // For future cache format migrations
      };

      const data = {
        ...JSON.parse(localStorage.getItem(this.CACHE_KEY) || "{}"),
        [walletAddress]: walletData,
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to persist decryption cache:", error);
    }
  }
}

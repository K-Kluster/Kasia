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
  entries: CacheEntry[];
  version: number;
}

export class DecryptionCache {
  private static readonly CACHE_KEY = "kasia_failed_decryptions";

  private static cache: Set<string> | null = null;

  /**
   * Initialize the cache from localStorage
   */
  private static initCache(): Set<string> {
    if (this.cache !== null) return this.cache;

    try {
      const stored = localStorage.getItem(this.CACHE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as CacheData;
        // Load all entries (no expiry needed)
        const validEntries = data.entries || [];

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
  static hasFailed(txId: string): boolean {
    const cache = this.initCache();
    return cache.has(txId);
  }

  /**
   * Mark a transaction ID as failed decryption
   */
  static markFailed(txId: string): void {
    const cache = this.initCache();
    cache.add(txId);
    this.persistCache();
  }

  /**
   * Remove a transaction ID from failed cache (if successful later)
   */
  static markSuccess(txId: string): void {
    const cache = this.initCache();
    if (cache.delete(txId)) {
      this.persistCache();
    }
  }

  /**
   * Clear the entire cache
   */
  static clear(): void {
    this.cache = new Set();
    localStorage.removeItem(this.CACHE_KEY);
  }

  /**
   * Get cache statistics for debugging/monitoring
   */
  static getStats(): { size: number } {
    const cache = this.initCache();
    return {
      size: cache.size,
    };
  }

  /**
   * Persist cache to localStorage with timestamps
   */
  private static persistCache(): void {
    if (!this.cache) return;

    try {
      const data = {
        entries: Array.from(this.cache).map((txId) => ({
          txId,
          timestamp: Date.now(),
        })),
        version: 1, // For future cache format migrations
      };
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Failed to persist decryption cache:", error);
    }
  }
}

/**
 * DecryptionCache - Manages failed decryption attempts to optimize performance
 *
 * This cache permanently stores transaction IDs that have failed decryption to avoid
 * repeatedly attempting to decrypt messages we know will never succeed.
 * Cache entries are only removed when a transaction successfully decrypts (key change scenario).
 */

import { databaseService } from "./database";

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
   * Initialize the cache from IndexedDB
   */
  private static async initCache(walletAddress: string): Promise<Set<string>> {
    if (this.cache !== null) return this.cache;

    try {
      // Try to get from IndexedDB first
      const dbStats =
        await databaseService.getDecryptionCacheStats(walletAddress);

      if (dbStats.size > 0) {
        // If we have data in IndexedDB, load it
        this.cache = new Set();
        // Note: We don't need to load individual entries since we only check existence
        // The actual cache entries are stored in IndexedDB and checked individually
        console.log(
          `Loaded ${dbStats.size} decryption cache entries from IndexedDB for ${walletAddress}`
        );
      } else {
        // Fallback to localStorage for migration
        const stored = localStorage.getItem(this.CACHE_KEY);
        if (stored) {
          const data = JSON.parse(stored) as CacheData;
          const validEntries = data[walletAddress]?.entries || [];
          this.cache = new Set(validEntries.map((e: CacheEntry) => e.txId));

          // Migrate to IndexedDB
          for (const txId of this.cache) {
            await databaseService.setDecryptionCache(walletAddress, txId);
          }
          console.log(
            `Migrated ${this.cache.size} decryption cache entries to IndexedDB for ${walletAddress}`
          );
        } else {
          this.cache = new Set();
        }
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
  static async hasFailed(
    walletAddress: string,
    txId: string
  ): Promise<boolean> {
    try {
      return await databaseService.getDecryptionCache(walletAddress, txId);
    } catch (error) {
      console.warn(
        "Failed to check decryption cache from IndexedDB, falling back to memory:",
        error
      );
      // Fallback to memory cache
      const cache = await this.initCache(walletAddress);
      return cache.has(txId);
    }
  }

  /**
   * Mark a transaction ID as failed decryption
   */
  static async markFailed(walletAddress: string, txId: string): Promise<void> {
    try {
      await databaseService.setDecryptionCache(walletAddress, txId);

      // Also update memory cache for consistency
      const cache = await this.initCache(walletAddress);
      cache.add(txId);
    } catch (error) {
      console.warn("Failed to persist decryption cache to IndexedDB:", error);
      // Fallback to memory cache only
      const cache = await this.initCache(walletAddress);
      cache.add(txId);
      this.persistCacheToLocalStorage(walletAddress);
    }
  }

  /**
   * Remove a transaction ID from failed cache (if successful later)
   */
  static async markSuccess(walletAddress: string, txId: string): Promise<void> {
    try {
      await databaseService.removeDecryptionCache(walletAddress, txId);

      // Also update memory cache for consistency
      const cache = await this.initCache(walletAddress);
      if (cache.delete(txId)) {
        this.persistCacheToLocalStorage(walletAddress);
      }
    } catch (error) {
      console.warn("Failed to remove decryption cache from IndexedDB:", error);
      // Fallback to memory cache only
      const cache = await this.initCache(walletAddress);
      if (cache.delete(txId)) {
        this.persistCacheToLocalStorage(walletAddress);
      }
    }
  }

  /**
   * Clear the entire cache
   */
  static async clear(walletAddress: string): Promise<void> {
    try {
      await databaseService.clearDecryptionCache(walletAddress);
    } catch (error) {
      console.warn("Failed to clear decryption cache from IndexedDB:", error);
    }

    // Clear memory cache
    this.cache = new Set();

    // Clear localStorage as well
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
  static async getStats(walletAddress: string): Promise<{ size: number }> {
    try {
      return await databaseService.getDecryptionCacheStats(walletAddress);
    } catch (error) {
      console.warn(
        "Failed to get decryption cache stats from IndexedDB:",
        error
      );
      // Fallback to memory cache
      const cache = await this.initCache(walletAddress);
      return { size: cache.size };
    }
  }

  /**
   * Persist cache to localStorage (fallback method)
   */
  private static persistCacheToLocalStorage(walletAddress: string): void {
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
      console.warn(
        "Failed to persist decryption cache to localStorage:",
        error
      );
    }
  }
}

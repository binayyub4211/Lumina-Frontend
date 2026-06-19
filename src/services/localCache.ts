"use client";

/**
 * SessionStorage-based cache for optimistic transaction state recovery.
 * Survives page refreshes but clears on tab close.
 */

const CACHE_PREFIX = "lumina-cache:";

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt?: number;
}

export class LocalCache {
  /**
   * Set a value in sessionStorage with optional TTL
   */
  static set<T>(key: string, value: T, ttlMs?: number): boolean {
    try {
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
      };

      sessionStorage.setItem(
        `${CACHE_PREFIX}${key}`,
        JSON.stringify(entry)
      );
      return true;
    } catch (error) {
      console.error(`Failed to cache key "${key}":`, error);
      return false;
    }
  }

  /**
   * Get a value from sessionStorage, respecting TTL
   */
  static get<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (!raw) return null;

      const entry = JSON.parse(raw) as CacheEntry<T>;

      // Check expiration
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.remove(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      console.error(`Failed to read cache key "${key}":`, error);
      return null;
    }
  }

  /**
   * Remove a specific key from sessionStorage
   */
  static remove(key: string): void {
    try {
      sessionStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (error) {
      console.error(`Failed to remove cache key "${key}":`, error);
    }
  }

  /**
   * Clear all Lumina cache entries
   */
  static clear(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          keys.push(key);
        }
      }

      keys.forEach((key) => sessionStorage.removeItem(key));
    } catch (error) {
      console.error("Failed to clear cache:", error);
    }
  }

  /**
   * Get all keys matching a prefix
   */
  static keys(prefix = ""): string[] {
    try {
      const keys: string[] = [];
      const fullPrefix = `${CACHE_PREFIX}${prefix}`;

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(fullPrefix)) {
          keys.push(key.replace(CACHE_PREFIX, ""));
        }
      }

      return keys;
    } catch {
      return [];
    }
  }

  /**
   * Check if a key exists and is not expired
   */
  static has(key: string): boolean {
    return this.get(key) !== null;
  }
}

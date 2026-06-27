import { LocalCache } from "../localCache";

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};

beforeAll(() => {
  global.sessionStorage = {
    getItem: (key: string) => mockSessionStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockSessionStorage[key] = value;
    },
    removeItem: (key: string) => {
      delete mockSessionStorage[key];
    },
    clear: () => {
      Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
    },
    length: 0,
    key: (index: number) => {
      const keys = Object.keys(mockSessionStorage);
      return keys[index] ?? null;
    },
  } as Storage;
});

beforeEach(() => {
  Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
});

describe("LocalCache", () => {
  describe("set and get", () => {
    it("should set and retrieve a string value", () => {
      const key = "test-key";
      const value = "test-value";

      LocalCache.set(key, value);
      const retrieved = LocalCache.get<string>(key);

      expect(retrieved).toBe(value);
    });

    it("should set and retrieve an object value", () => {
      const key = "test-object";
      const value = { name: "John", age: 30, active: true };

      LocalCache.set(key, value);
      const retrieved = LocalCache.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });

    it("should set and retrieve a number value", () => {
      const key = "test-number";
      const value = 42;

      LocalCache.set(key, value);
      const retrieved = LocalCache.get<number>(key);

      expect(retrieved).toBe(value);
    });

    it("should return null for non-existent key", () => {
      const retrieved = LocalCache.get("non-existent");
      expect(retrieved).toBeNull();
    });
  });

  describe("TTL expiration", () => {
    it("should respect TTL and return null after expiration", () => {
      const key = "expiring-key";
      const value = "expiring-value";
      const ttlMs = 100; // 100ms

      LocalCache.set(key, value, ttlMs);

      // Should be available immediately
      expect(LocalCache.get(key)).toBe(value);

      // Wait for expiration
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(LocalCache.get(key)).toBeNull();
          resolve();
        }, ttlMs + 50);
      });
    });

    it("should not expire without TTL", () => {
      const key = "permanent-key";
      const value = "permanent-value";

      LocalCache.set(key, value);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(LocalCache.get(key)).toBe(value);
          resolve();
        }, 200);
      });
    });
  });

  describe("remove", () => {
    it("should remove a specific key", () => {
      const key = "remove-me";
      const value = "to-be-removed";

      LocalCache.set(key, value);
      expect(LocalCache.get(key)).toBe(value);

      LocalCache.remove(key);
      expect(LocalCache.get(key)).toBeNull();
    });

    it("should not affect other keys when removing", () => {
      LocalCache.set("key1", "value1");
      LocalCache.set("key2", "value2");
      LocalCache.set("key3", "value3");

      LocalCache.remove("key2");

      expect(LocalCache.get("key1")).toBe("value1");
      expect(LocalCache.get("key2")).toBeNull();
      expect(LocalCache.get("key3")).toBe("value3");
    });
  });

  describe("clear", () => {
    it("should clear all cache entries", () => {
      LocalCache.set("key1", "value1");
      LocalCache.set("key2", "value2");
      LocalCache.set("key3", "value3");

      LocalCache.clear();

      expect(LocalCache.get("key1")).toBeNull();
      expect(LocalCache.get("key2")).toBeNull();
      expect(LocalCache.get("key3")).toBeNull();
    });

    it("should not affect non-Lumina keys in sessionStorage", () => {
      // Set a non-Lumina key directly
      sessionStorage.setItem("other-app-key", "other-value");

      LocalCache.set("lumina-key", "lumina-value");

      LocalCache.clear();

      expect(LocalCache.get("lumina-key")).toBeNull();
      expect(sessionStorage.getItem("other-app-key")).toBe("other-value");
    });
  });

  describe("keys", () => {
    it("should return all cache keys", () => {
      LocalCache.set("key1", "value1");
      LocalCache.set("key2", "value2");
      LocalCache.set("key3", "value3");

      const keys = LocalCache.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain("key1");
      expect(keys).toContain("key2");
      expect(keys).toContain("key3");
    });

    it("should return keys matching prefix", () => {
      LocalCache.set("user-1", "John");
      LocalCache.set("user-2", "Jane");
      LocalCache.set("config-1", "setting");

      const userKeys = LocalCache.keys("user-");

      expect(userKeys).toHaveLength(2);
      expect(userKeys).toContain("user-1");
      expect(userKeys).toContain("user-2");
      expect(userKeys).not.toContain("config-1");
    });

    it("should return empty array when no keys exist", () => {
      const keys = LocalCache.keys();
      expect(keys).toEqual([]);
    });
  });

  describe("has", () => {
    it("should return true for existing key", () => {
      LocalCache.set("exists", "value");
      expect(LocalCache.has("exists")).toBe(true);
    });

    it("should return false for non-existent key", () => {
      expect(LocalCache.has("does-not-exist")).toBe(false);
    });

    it("should return false for expired key", () => {
      const key = "expiring";
      LocalCache.set(key, "value", 100);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(LocalCache.has(key)).toBe(false);
          resolve();
        }, 150);
      });
    });
  });

  describe("error handling", () => {
    it("should handle corrupted cache data gracefully", () => {
      // Manually corrupt the cache
      const key = "lumina-cache:corrupted";
      sessionStorage.setItem(key, "not-valid-json{{{");

      const retrieved = LocalCache.get("corrupted");
      expect(retrieved).toBeNull();
    });
  });
});

import { QueryClient } from "@tanstack/react-query";
import { OptimisticTransactionManager } from "../OptimisticTransactionManager";
import type { BalanceDelta, OptimisticSnapshot } from "../OptimisticTransactionManager";

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
    key: () => null,
  } as Storage;
});

beforeEach(() => {
  Object.keys(mockSessionStorage).forEach((key) => delete mockSessionStorage[key]);
});

describe("OptimisticTransactionManager", () => {
  let queryClient: QueryClient;
  let manager: OptimisticTransactionManager;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    manager = new OptimisticTransactionManager(queryClient);
  });

  afterEach(() => {
    manager.clearAllSnapshots();
  });

  describe("applyOptimisticUpdate", () => {
    it("should apply deposit delta within 50ms", () => {
      const queryKey = ["balance", "test"];
      const previousData = {
        rawBalance: 1000000n,
        balance: "1000000",
        formattedBalance: "0.1",
      };

      queryClient.setQueryData(queryKey, previousData);

      const delta: BalanceDelta = {
        amount: 5000000n,
        operation: "deposit",
      };

      const startTime = performance.now();
      const nonce = manager.applyOptimisticUpdate(queryKey, delta, previousData);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(50);
      expect(nonce).toBeTruthy();

      const updatedData: any = queryClient.getQueryData(queryKey);
      expect(updatedData.rawBalance).toBe(6000000n);
    });

    it("should apply withdraw delta correctly", () => {
      const queryKey = ["balance", "test"];
      const previousData = {
        rawBalance: 10000000n,
        balance: "10000000",
        formattedBalance: "1.0",
      };

      queryClient.setQueryData(queryKey, previousData);

      const delta: BalanceDelta = {
        amount: 3000000n,
        operation: "withdraw",
      };

      manager.applyOptimisticUpdate(queryKey, delta, previousData);

      const updatedData: any = queryClient.getQueryData(queryKey);
      expect(updatedData.rawBalance).toBe(7000000n);
    });

    it("should handle negative balance after withdraw", () => {
      const queryKey = ["balance", "test"];
      const previousData = {
        rawBalance: 1000000n,
        balance: "1000000",
        formattedBalance: "0.1",
      };

      queryClient.setQueryData(queryKey, previousData);

      const delta: BalanceDelta = {
        amount: 5000000n,
        operation: "withdraw",
      };

      manager.applyOptimisticUpdate(queryKey, delta, previousData);

      const updatedData: any = queryClient.getQueryData(queryKey);
      expect(updatedData.rawBalance).toBe(-4000000n);
    });
  });

  describe("persistSnapshot and loadSnapshots", () => {
    it("should persist and load snapshots from sessionStorage", () => {
      const snapshot: OptimisticSnapshot = {
        nonce: "test-nonce-123",
        queryKey: ["balance", "test"],
        previousData: { rawBalance: 1000000n },
        delta: { amount: 5000000n, operation: "deposit" },
        timestamp: Date.now(),
        contractId: "CONTRACT123",
        method: "deposit",
        args: [5000000n],
      };

      manager.persistSnapshot(snapshot);

      const loaded = manager.loadSnapshots();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].nonce).toBe("test-nonce-123");
      expect(loaded[0].contractId).toBe("CONTRACT123");
    });

    it("should filter expired snapshots", () => {
      const expiredSnapshot: OptimisticSnapshot = {
        nonce: "expired-nonce",
        queryKey: ["balance", "test"],
        previousData: {},
        delta: { amount: 1000000n, operation: "deposit" },
        timestamp: Date.now() - 10 * 60 * 1000, // 10 minutes ago (expired)
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
      };

      const validSnapshot: OptimisticSnapshot = {
        nonce: "valid-nonce",
        queryKey: ["balance", "test"],
        previousData: {},
        delta: { amount: 1000000n, operation: "deposit" },
        timestamp: Date.now(),
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
      };

      manager.persistSnapshot(expiredSnapshot);
      manager.persistSnapshot(validSnapshot);

      const loaded = manager.loadSnapshots();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].nonce).toBe("valid-nonce");
    });
  });

  describe("removeSnapshot", () => {
    it("should remove specific snapshot by nonce", () => {
      const snapshot1: OptimisticSnapshot = {
        nonce: "nonce-1",
        queryKey: ["balance", "test"],
        previousData: {},
        delta: { amount: 1000000n, operation: "deposit" },
        timestamp: Date.now(),
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
      };

      const snapshot2: OptimisticSnapshot = {
        nonce: "nonce-2",
        queryKey: ["balance", "test"],
        previousData: {},
        delta: { amount: 2000000n, operation: "deposit" },
        timestamp: Date.now(),
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
      };

      manager.persistSnapshot(snapshot1);
      manager.persistSnapshot(snapshot2);

      expect(manager.loadSnapshots()).toHaveLength(2);

      manager.removeSnapshot("nonce-1");

      const remaining = manager.loadSnapshots();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].nonce).toBe("nonce-2");
    });
  });

  describe("rollbackOptimisticUpdate", () => {
    it("should rollback to previous data within 200ms", () => {
      const queryKey = ["balance", "test"];
      const previousData = {
        rawBalance: 1000000n,
        balance: "1000000",
        formattedBalance: "0.1",
      };

      const optimisticData = {
        rawBalance: 6000000n,
        balance: "6000000",
        formattedBalance: "0.6",
      };

      queryClient.setQueryData(queryKey, optimisticData);

      const startTime = performance.now();
      manager.rollbackOptimisticUpdate(queryKey, previousData, "test-nonce");
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(200);

      const rolledBackData: any = queryClient.getQueryData(queryKey);
      expect(rolledBackData.rawBalance).toBe(1000000n);
    });

    it("should remove snapshot after rollback", () => {
      const queryKey = ["balance", "test"];
      const previousData = { rawBalance: 1000000n };

      const snapshot: OptimisticSnapshot = {
        nonce: "rollback-nonce",
        queryKey,
        previousData,
        delta: { amount: 5000000n, operation: "deposit" },
        timestamp: Date.now(),
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
      };

      manager.persistSnapshot(snapshot);
      expect(manager.loadSnapshots()).toHaveLength(1);

      manager.rollbackOptimisticUpdate(queryKey, previousData, "rollback-nonce");

      expect(manager.loadSnapshots()).toHaveLength(0);
    });
  });

  describe("duplicate submission prevention", () => {
    it("should prevent duplicate submissions with same nonce", () => {
      const nonce = "unique-nonce";

      const firstMark = manager.markSubmitting(nonce);
      expect(firstMark).toBe(true);
      expect(manager.isSubmitting(nonce)).toBe(true);

      const secondMark = manager.markSubmitting(nonce);
      expect(secondMark).toBe(false);
    });

    it("should clear submitting flag", () => {
      const nonce = "test-nonce";

      manager.markSubmitting(nonce);
      expect(manager.isSubmitting(nonce)).toBe(true);

      manager.clearSubmitting(nonce);
      expect(manager.isSubmitting(nonce)).toBe(false);
    });
  });

  describe("reconcileOrphanedSnapshots", () => {
    it("should reconcile orphaned snapshots with backend data", async () => {
      const queryKey = ["balance", "test"];
      
      const snapshot: OptimisticSnapshot = {
        nonce: "orphan-nonce",
        queryKey,
        previousData: { rawBalance: 1000000n },
        delta: { amount: 5000000n, operation: "deposit" },
        timestamp: Date.now(),
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
      };

      manager.persistSnapshot(snapshot);

      const backendFetcher = async () => ({
        rawBalance: 3000000n,
      });

      queryClient.setQueryData(queryKey, {
        rawBalance: 6000000n,
        balance: "6000000",
        formattedBalance: "0.6",
      });

      const reconciled = await manager.reconcileOrphanedSnapshots(backendFetcher);

      expect(reconciled).toBe(1);

      const updatedData: any = queryClient.getQueryData(queryKey);
      expect(updatedData.rawBalance).toBe(3000000n);

      expect(manager.loadSnapshots()).toHaveLength(0);
    });
  });
});

import { TransactionQueue } from "../txQueue";
import type { QueuedTransaction } from "../txQueue";

describe("TransactionQueue", () => {
  let queue: TransactionQueue;

  beforeEach(() => {
    queue = new TransactionQueue();
  });

  describe("enqueue", () => {
    it("should add transaction to queue", () => {
      const tx = {
        nonce: "nonce-1",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [1000000n],
        txXdr: "XDR_DATA",
      };

      const result = queue.enqueue(tx);

      expect(result).toBe(true);
      expect(queue.size()).toBe(1);
      expect(queue.get("nonce-1")).toBeDefined();
    });

    it("should prevent duplicate nonce", () => {
      const tx = {
        nonce: "duplicate-nonce",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      };

      const first = queue.enqueue(tx);
      const second = queue.enqueue(tx);

      expect(first).toBe(true);
      expect(second).toBe(false);
      expect(queue.size()).toBe(1);
    });

    it("should initialize transaction with correct defaults", () => {
      const tx = {
        nonce: "test-nonce",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      };

      queue.enqueue(tx);
      const queued = queue.get("test-nonce");

      expect(queued).toBeDefined();
      expect(queued!.status).toBe("queued");
      expect(queued!.retryCount).toBe(0);
      expect(queued!.timestamp).toBeGreaterThan(0);
    });
  });

  describe("get", () => {
    it("should retrieve transaction by nonce", () => {
      const tx = {
        nonce: "get-nonce",
        contractId: "CONTRACT123",
        method: "withdraw",
        args: [500000n],
        txXdr: "XDR_DATA",
      };

      queue.enqueue(tx);
      const retrieved = queue.get("get-nonce");

      expect(retrieved).toBeDefined();
      expect(retrieved!.contractId).toBe("CONTRACT123");
      expect(retrieved!.method).toBe("withdraw");
    });

    it("should return undefined for non-existent nonce", () => {
      const retrieved = queue.get("non-existent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("updateStatus", () => {
    it("should update transaction status", () => {
      queue.enqueue({
        nonce: "update-nonce",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      const result = queue.updateStatus("update-nonce", "submitting");

      expect(result).toBe(true);

      const tx = queue.get("update-nonce");
      expect(tx!.status).toBe("submitting");
    });

    it("should increment retry count when requested", () => {
      queue.enqueue({
        nonce: "retry-nonce",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      queue.updateStatus("retry-nonce", "failed", true);

      const tx = queue.get("retry-nonce");
      expect(tx!.retryCount).toBe(1);
    });

    it("should return false for non-existent transaction", () => {
      const result = queue.updateStatus("non-existent", "failed");
      expect(result).toBe(false);
    });
  });

  describe("remove", () => {
    it("should remove transaction from queue", () => {
      queue.enqueue({
        nonce: "remove-nonce",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      expect(queue.size()).toBe(1);

      const result = queue.remove("remove-nonce");

      expect(result).toBe(true);
      expect(queue.size()).toBe(0);
      expect(queue.get("remove-nonce")).toBeUndefined();
    });

    it("should return false when removing non-existent transaction", () => {
      const result = queue.remove("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("getByStatus", () => {
    it("should return all transactions with specific status", () => {
      queue.enqueue({
        nonce: "pending-1",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      queue.enqueue({
        nonce: "pending-2",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      queue.enqueue({
        nonce: "failed-1",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      queue.updateStatus("failed-1", "failed");

      const queued = queue.getByStatus("queued");
      const failed = queue.getByStatus("failed");

      expect(queued).toHaveLength(2);
      expect(failed).toHaveLength(1);
      expect(failed[0].nonce).toBe("failed-1");
    });
  });

  describe("getAllQueued", () => {
    it("should return queued transactions ordered by timestamp", async () => {
      queue.enqueue({
        nonce: "first",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      queue.enqueue({
        nonce: "second",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      queue.enqueue({
        nonce: "third",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      const queued = queue.getAllQueued();

      expect(queued).toHaveLength(3);
      expect(queued[0].nonce).toBe("first");
      expect(queued[1].nonce).toBe("second");
      expect(queued[2].nonce).toBe("third");
    });

    it("should not include non-queued transactions", () => {
      queue.enqueue({
        nonce: "queued",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      queue.enqueue({
        nonce: "submitted",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      queue.updateStatus("submitted", "submitted");

      const queued = queue.getAllQueued();

      expect(queued).toHaveLength(1);
      expect(queued[0].nonce).toBe("queued");
    });
  });

  describe("shouldRetry", () => {
    it("should allow retry when under limit", () => {
      queue.enqueue({
        nonce: "retry-test",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      expect(queue.shouldRetry("retry-test")).toBe(true);

      queue.updateStatus("retry-test", "queued", true);
      expect(queue.shouldRetry("retry-test")).toBe(true);

      queue.updateStatus("retry-test", "queued", true);
      expect(queue.shouldRetry("retry-test")).toBe(true);
    });

    it("should not allow retry when limit exceeded", () => {
      queue.enqueue({
        nonce: "max-retry",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      // Exceed max retries (3)
      queue.updateStatus("max-retry", "queued", true);
      queue.updateStatus("max-retry", "queued", true);
      queue.updateStatus("max-retry", "queued", true);

      expect(queue.shouldRetry("max-retry")).toBe(false);
    });

    it("should return false for non-existent transaction", () => {
      expect(queue.shouldRetry("non-existent")).toBe(false);
    });
  });

  describe("isTimedOut", () => {
    it("should not timeout immediately", () => {
      queue.enqueue({
        nonce: "timeout-test",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      expect(queue.isTimedOut("timeout-test")).toBe(false);
    });

    it("should return false for non-existent transaction", () => {
      expect(queue.isTimedOut("non-existent")).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all transactions", () => {
      queue.enqueue({
        nonce: "tx-1",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      queue.enqueue({
        nonce: "tx-2",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      expect(queue.size()).toBe(2);

      queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe("processQueue", () => {
    it("should process all queued transactions", async () => {
      queue.enqueue({
        nonce: "process-1",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      queue.enqueue({
        nonce: "process-2",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      const submitter = async (tx: QueuedTransaction) => {
        return { success: true };
      };

      await queue.processQueue(submitter);

      expect(queue.getByStatus("submitted")).toHaveLength(2);
    });

    it("should handle failed submissions", async () => {
      queue.enqueue({
        nonce: "fail-tx",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      const submitter = async (tx: QueuedTransaction) => {
        return { success: false, error: "Network error" };
      };

      await queue.processQueue(submitter);

      const tx = queue.get("fail-tx");
      expect(tx!.status).toBe("queued");
      expect(tx!.retryCount).toBe(1);
    });

    it("should mark as failed after max retries", async () => {
      queue.enqueue({
        nonce: "max-fail",
        contractId: "CONTRACT123",
        method: "deposit",
        args: [],
        txXdr: "XDR_DATA",
      });

      // Pre-set retry count to max
      const tx = queue.get("max-fail");
      if (tx) {
        tx.retryCount = 3;
      }

      const submitter = async (tx: QueuedTransaction) => {
        return { success: false, error: "Network error" };
      };

      await queue.processQueue(submitter);

      expect(queue.get("max-fail")!.status).toBe("failed");
    });
  });
});

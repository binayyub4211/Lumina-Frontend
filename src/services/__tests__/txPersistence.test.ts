import {
  addRecord,
  clearCompleted,
  clearAllRecords,
  loadQueue,
  removeRecord,
  updateRecord,
} from "../txPersistence";
import type { TxRecord } from "../txPersistence";

const STORAGE_KEY = "lumina-tx-queue";

function createMockRecord(
  overrides: Partial<TxRecord> = {},
): TxRecord {
  return {
    idempotencyKey: "test-key-1",
    contractId: "CCJZ5DGASBXALZ3TMRP5OF6O7WF5Q2X6X6O6Y5Y7P5Q3Z6X6O6Y5Y7P5",
    method: "submit_vesting",
    args: [{ amount: "1000", beneficiary: "GA...ABC" }],
    status: "pending",
    createdAt: Date.now(),
    lastCheckedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("txPersistence", () => {
  it("returns empty array when no records exist", () => {
    expect(loadQueue()).toEqual([]);
  });

  it("adds a record and loads it back", () => {
    const record = createMockRecord();
    addRecord(record);

    const loaded = loadQueue();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].idempotencyKey).toBe("test-key-1");
    expect(loaded[0].status).toBe("pending");
  });

  it("persists multiple records", () => {
    const record1 = createMockRecord({ idempotencyKey: "key-1", method: "create_vesting" });
    const record2 = createMockRecord({ idempotencyKey: "key-2", method: "release_funds" });

    addRecord(record1);
    addRecord(record2);

    const loaded = loadQueue();
    expect(loaded).toHaveLength(2);
  });

  it("updates a record by idempotencyKey", () => {
    const record = createMockRecord({ idempotencyKey: "update-key" });
    addRecord(record);

    updateRecord("update-key", {
      status: "confirmed",
      txHash: "abcdef1234567890",
    });

    const loaded = loadQueue();
    expect(loaded[0].status).toBe("confirmed");
    expect(loaded[0].txHash).toBe("abcdef1234567890");
    expect(loaded[0].lastCheckedAt).toBeGreaterThanOrEqual(record.createdAt);
  });

  it("removes a record by idempotencyKey", () => {
    addRecord(createMockRecord({ idempotencyKey: "remove-me" }));
    addRecord(createMockRecord({ idempotencyKey: "keep-me" }));

    removeRecord("remove-me");

    const loaded = loadQueue();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].idempotencyKey).toBe("keep-me");
  });

  it("clears completed records older than maxAge", () => {
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    addRecord(
      createMockRecord({
        idempotencyKey: "old-confirmed",
        status: "confirmed",
        createdAt: oldTimestamp,
      }),
    );
    addRecord(
      createMockRecord({
        idempotencyKey: "old-failed",
        status: "failed",
        createdAt: oldTimestamp,
      }),
    );
    addRecord(
      createMockRecord({
        idempotencyKey: "recent-pending",
        status: "pending",
        createdAt: Date.now(),
      }),
    );

    clearCompleted(24 * 60 * 60 * 1000);

    const loaded = loadQueue();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].idempotencyKey).toBe("recent-pending");
  });

  it("simulates tab crash recovery: records survive full page reload", () => {
    const record = createMockRecord({ idempotencyKey: "crash-recovery-key" });
    addRecord(record);

    const rawBefore = localStorage.getItem(STORAGE_KEY);
    expect(rawBefore).not.toBeNull();

    localStorage.removeItem(STORAGE_KEY);

    const empty = loadQueue();
    expect(empty).toEqual([]);

    localStorage.setItem(STORAGE_KEY, rawBefore!);

    const recovered = loadQueue();
    expect(recovered).toHaveLength(1);
    expect(recovered[0].idempotencyKey).toBe("crash-recovery-key");
  });

  it("clears all records", () => {
    addRecord(createMockRecord({ idempotencyKey: "a" }));
    addRecord(createMockRecord({ idempotencyKey: "b" }));

    clearAllRecords();

    expect(loadQueue()).toEqual([]);
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem(STORAGE_KEY, "not-valid-json");

    const loaded = loadQueue();
    expect(loaded).toEqual([]);
  });
});

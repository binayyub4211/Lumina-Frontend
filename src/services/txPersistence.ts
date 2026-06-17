"use client";

export type TxStatus = "pending" | "confirmed" | "failed" | "unknown";

export interface TxRecord {
  idempotencyKey: string;
  txHash?: string;
  contractId: string;
  method: string;
  args: unknown[];
  status: TxStatus;
  createdAt: number;
  lastCheckedAt: number;
}

const STORAGE_KEY = "lumina-tx-queue";
const SCHEMA_VERSION = 1;

interface PersistedQueue {
  version: number;
  records: TxRecord[];
}

function readRaw(): PersistedQueue | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedQueue;
  } catch {
    return null;
  }
}

function writeRaw(queue: PersistedQueue) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function loadQueue(): TxRecord[] {
  const queue = readRaw();
  if (!queue) return [];

  if (queue.version !== SCHEMA_VERSION) {
    queue.version = SCHEMA_VERSION;
    queue.records = queue.records ?? [];
    writeRaw(queue);
  }

  return queue.records;
}

function persist(records: TxRecord[]) {
  writeRaw({ version: SCHEMA_VERSION, records });
}

export function addRecord(record: TxRecord): void {
  const records = loadQueue();
  records.push(record);
  persist(records);
}

export function updateRecord(idempotencyKey: string, updates: Partial<TxRecord>): void {
  const records = loadQueue();
  const index = records.findIndex((r) => r.idempotencyKey === idempotencyKey);
  if (index === -1) return;
  records[index] = { ...records[index], ...updates, lastCheckedAt: Date.now() };
  persist(records);
}

export function removeRecord(idempotencyKey: string): void {
  const records = loadQueue().filter((r) => r.idempotencyKey !== idempotencyKey);
  persist(records);
}

export function clearCompleted(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
  const records = loadQueue();
  const now = Date.now();
  const filtered = records.filter(
    (r) =>
      !(r.status === "confirmed" || r.status === "failed") ||
      now - r.createdAt <= maxAgeMs,
  );
  persist(filtered);
}

export function clearAllRecords(): void {
  persist([]);
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

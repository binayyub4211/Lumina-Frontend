"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "sentry";
const DB_VERSION = 1;
const STORE_NAME = "offlineQueue";
const MAX_QUEUE_SIZE = 500;
const DEDUPE_WINDOW_MS = 5_000;
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 60_000;
const UPTIME_RESET_MS = 10 * 60_000;
const MAX_RETRY_ATTEMPTS = 5;

export interface ErrorContext {
  component?: string;
  componentStack?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface OfflineErrorRecord {
  id?: number;
  timestamp: number;
  lastSeenAt: number;
  errorHash: string;
  message: string;
  name: string;
  stack?: string;
  component?: string;
  componentStack?: string;
  count: number;
  retryCount: number;
  nextRetryAt: number;
  lastAttemptAt?: number;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

interface SentryOfflineDB extends DBSchema {
  [STORE_NAME]: {
    key: number;
    value: OfflineErrorRecord;
    indexes: {
      "by-timestamp": number;
      "by-nextRetryAt": number;
      "by-errorHash": string;
    };
  };
}

type CaptureOptions = {
  tags?: Record<string, string>;
  contexts?: Record<string, unknown>;
  extra?: Record<string, unknown>;
};

type SentryLike = {
  init?: (options: Record<string, unknown>) => void;
  captureException?: (error: unknown, options?: CaptureOptions) => unknown;
};

declare global {
  interface Window {
    Sentry?: SentryLike;
  }
}

let dbPromise: Promise<IDBPDatabase<SentryOfflineDB>> | null = null;
let onlineSince =
  typeof performance !== "undefined" ? performance.now() : Date.now();

function hasIndexedDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function getDb() {
  if (!hasIndexedDB()) return null;
  if (!dbPromise) {
    dbPromise = openDB<SentryOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("by-timestamp", "timestamp");
          store.createIndex("by-nextRetryAt", "nextRetryAt");
          store.createIndex("by-errorHash", "errorHash");
        }
      },
    });
  }
  return dbPromise;
}

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function now(): number {
  return Date.now();
}

function uptimeMs(): number {
  if (typeof performance === "undefined") return now() - onlineSince;
  return performance.now() - onlineSince;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || String(error),
      stack: error.stack,
    };
  }
  return {
    name: "NonErrorException",
    message: typeof error === "string" ? error : JSON.stringify(error),
    stack: undefined,
  };
}

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== "object") return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, entry]) => `${key}:${stableStringify(entry)}`)
    .join(",")}}`;
}

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function getErrorHash(error: unknown, context: ErrorContext): string {
  const normalized = normalizeError(error);
  return hashString(
    [
      normalized.name,
      normalized.message,
      normalized.stack?.split("\n").slice(0, 5).join("\n") ?? "",
      context.component ?? "",
      context.componentStack ?? "",
      stableStringify(context.extra?.hash ?? ""),
    ].join("|"),
  );
}

function toError(record: OfflineErrorRecord): Error {
  const error = new Error(record.message);
  error.name = record.name;
  if (record.stack) error.stack = record.stack;
  return error;
}

function sentryCapture(error: unknown, context: ErrorContext = {}): boolean {
  const sentry = typeof window !== "undefined" ? window.Sentry : undefined;
  if (!sentry?.captureException) return false;

  sentry.captureException(error, {
    tags: context.tags,
    contexts: {
      react: {
        component: context.component,
        componentStack: context.componentStack,
      },
    },
    extra: context.extra,
  });
  return true;
}

async function enforceCapacity(
  db: IDBPDatabase<SentryOfflineDB>,
): Promise<void> {
  let count = await db.count(STORE_NAME);
  if (count <= MAX_QUEUE_SIZE) return;

  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("by-timestamp");
  let cursor = await index.openCursor();
  while (cursor && count > MAX_QUEUE_SIZE) {
    await cursor.delete();
    count--;
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getQueuedErrorCount(): Promise<number> {
  const db = await getDb();
  return db ? db.count(STORE_NAME) : 0;
}

export async function enqueueError(
  error: unknown,
  context: ErrorContext = {},
): Promise<void> {
  if (isOnline() && sentryCapture(error, context)) return;

  const db = await getDb();
  if (!db) return;

  const createdAt = now();
  const errorHash = getErrorHash(error, context);
  const tx = db.transaction(STORE_NAME, "readwrite");
  const existingRecords = await tx.store
    .index("by-errorHash")
    .getAll(errorHash);
  const duplicate = existingRecords.find(
    (record) =>
      record.component === context.component &&
      record.componentStack === context.componentStack &&
      createdAt - record.lastSeenAt <= DEDUPE_WINDOW_MS,
  );

  if (duplicate?.id != null) {
    await tx.store.put({
      ...duplicate,
      count: duplicate.count + 1,
      lastSeenAt: createdAt,
      timestamp: duplicate.timestamp,
    });
  } else {
    const normalized = normalizeError(error);
    await tx.store.add({
      timestamp: createdAt,
      lastSeenAt: createdAt,
      errorHash,
      message: normalized.message,
      name: normalized.name,
      stack: normalized.stack,
      component: context.component,
      componentStack: context.componentStack,
      count: 1,
      retryCount: 0,
      nextRetryAt: createdAt,
      tags: context.tags,
      extra: context.extra,
    });
  }

  await tx.done;
  await enforceCapacity(db);
}

function nextBackoffDelay(retryCount: number): number {
  if (uptimeMs() >= UPTIME_RESET_MS) {
    return INITIAL_BACKOFF_MS;
  }
  return Math.min(
    INITIAL_BACKOFF_MS * 2 ** Math.max(0, retryCount),
    MAX_BACKOFF_MS,
  );
}

export async function processOfflineQueue(): Promise<void> {
  if (!isOnline()) return;
  const db = await getDb();
  if (!db) return;

  const dueAt = now();
  const tx = db.transaction(STORE_NAME, "readwrite");
  let cursor = await tx.store
    .index("by-nextRetryAt")
    .openCursor(IDBKeyRange.upperBound(dueAt));

  while (cursor) {
    const record = cursor.value;
    if ((record.retryCount ?? 0) >= MAX_RETRY_ATTEMPTS) {
      await cursor.delete();
      cursor = await cursor.continue();
      continue;
    }

    const captured = sentryCapture(toError(record), {
      component: record.component,
      componentStack: record.componentStack,
      tags: record.tags,
      extra: {
        ...record.extra,
        offlineQueuedAt: new Date(record.timestamp).toISOString(),
        offlineReplayCount: record.count,
        offlineRetryCount: record.retryCount,
        errorHash: record.errorHash,
      },
    });

    if (captured) {
      await cursor.delete();
    } else {
      const retryCount = (record.retryCount ?? 0) + 1;
      if (retryCount >= MAX_RETRY_ATTEMPTS) {
        await cursor.delete();
      } else {
        await cursor.update({
          ...record,
          retryCount,
          lastAttemptAt: dueAt,
          nextRetryAt: dueAt + nextBackoffDelay(retryCount),
        });
      }
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}

export function noteConnectivityRestored(): void {
  onlineSince = typeof performance !== "undefined" ? performance.now() : now();
  void processOfflineQueue();
}

export function initSentry(options: Record<string, unknown> = {}): void {
  const sentry = typeof window !== "undefined" ? window.Sentry : undefined;
  sentry?.init?.(options);
}

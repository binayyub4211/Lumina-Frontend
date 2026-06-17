"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * All payloads we persist in IndexedDB share this shape. Versioning the DB
 * gives future migrations a clean runway without losing queued events
 * from older builds of the app while they were offline.
 */
export interface QueuedPayload {
  id?: number;
  url: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  headers: Record<string, string>;
  body: string;
  enqueuedAt: string;
  attempts: number;
  source: string;
}

interface LuminaOfflineDB extends DBSchema {
  "outgoing-requests": {
    key: number;
    value: QueuedPayload;
    indexes: { "by-enqueuedAt": string };
  };
}

const DB_NAME = "lumina-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "outgoing-requests";

let dbPromise: Promise<IDBPDatabase<LuminaOfflineDB>> | null = null;

function hasIndexedDB(): boolean {
  // Works in browsers (window.indexedDB) and in Node when a shim like
  // fake-indexeddb has installed the API on globalThis. We deliberately
  // do NOT guard on `typeof window` so the test suite can use the same
  // module paths via a shim.
  return typeof indexedDB !== "undefined";
}

function getDb() {
  if (!hasIndexedDB()) {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<LuminaOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("by-enqueuedAt", "enqueuedAt");
        }
      },
      blocked() {
        // No-op: the queue is best-effort storage and we never block the UI.
      },
    });
  }
  return dbPromise;
}

/**
 * Queue an outbound request so it can be replayed once the device returns
 * online. Returns the assigned ID, or `null` if IndexedDB is unavailable
 * (e.g. SSR or unsupported browser).
 */
export async function enqueueRequest(
  payload: Omit<QueuedPayload, "id" | "enqueuedAt" | "attempts">,
): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const value: Omit<QueuedPayload, "id"> = {
    ...payload,
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  };

  const tx = db.transaction(STORE_NAME, "readwrite");
  const id = await tx.store.add(value as QueuedPayload);
  await tx.done;
  return id;
}

/**
 * Snapshot the queue, oldest first.
 */
export async function peekQueue(): Promise<QueuedPayload[]> {
  const db = await getDb();
  if (!db) return [];

  const tx = db.transaction(STORE_NAME, "readonly");
  const rows = await tx.store.index("by-enqueuedAt").getAll();
  await tx.done;
  return rows;
}

export async function getQueueSize(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return db.count(STORE_NAME);
}

export async function removeRequest(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(STORE_NAME, id);
}

export interface FlushSummary {
  attempted: number;
  succeeded: number;
  failed: number;
}

/**
 * Replay every queued request in insertion order. A 5xx response counts as
 * a failure so the request stays queued for the next attempt; 4xx counts
 * as success (the server has rejected the payload permanently and there
 * is no value in replaying). Any thrown fetch (e.g. TypeError from
 * `navigator.onLine === false`) short-circuits the loop because it
 * usually indicates the device is still offline.
 */
export async function flushQueue(): Promise<FlushSummary> {
  const items = await peekQueue();
  const summary: FlushSummary = { attempted: items.length, succeeded: 0, failed: 0 };

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
        keepalive: true,
      });
      if (!response.ok && response.status >= 500) {
        summary.failed++;
        return summary;
      }
      if (item.id != null) {
        await removeRequest(item.id);
      }
      summary.succeeded++;
    } catch {
      summary.failed++;
      return summary;
    }
  }

  return summary;
}

/** Drop every queued payload. */
export async function clearQueue(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.clear(STORE_NAME);
}

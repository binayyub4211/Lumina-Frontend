// Lightweight Node test for src/lib/offlineQueue.ts. We do not introduce a
// heavy test runner dep — the project has no test runner configured. The
// script runs against an in-memory `fake-indexeddb` shim and asserts the
// same observable behaviours as the Playwright suite will exercise
// end-to-end. Run with: npx tsx src/lib/__tests__/offlineQueue.test.ts

// The fake-indexeddb `auto` entry installs the shim + IDBKeyRange on
// globalThis. We import it eagerly so the queue module below finds an
// indexedDB implementation when it loads.
import "fake-indexeddb/auto";

import {
  clearQueue,
  enqueueRequest,
  flushQueue,
  getQueueSize,
  peekQueue,
} from "../offlineQueue";

interface FailedTest {
  name: string;
  reason: string;
}

const failures: FailedTest[] = [];

function assert<T>(name: string, expected: T, actual: T) {
  const eq =
    JSON.stringify(expected) === JSON.stringify(actual) ||
    (expected === (actual as unknown));
  if (!eq) {
    failures.push({
      name,
      reason: `expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
    });
    console.error(`  ✗ ${name}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
}

async function withIsolatedQueue(fn: () => Promise<void>) {
  await clearQueue();
  try {
    await fn();
  } finally {
    await clearQueue();
  }
}

async function run() {
  console.log("offlineQueue: enqueue + peek + size");
  await withIsolatedQueue(async () => {
    await enqueueRequest({
      url: "https://example.test/api/x",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
      source: "unit",
    });
    const peek = await peekQueue();
    assert("peek returns queued item", 1, peek.length);
    assert("size reports 1", 1, await getQueueSize());
  });

  console.log("offlineQueue: flush removes only successful entries");
  let nowOnline = true;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (!nowOnline) throw new Error("network down");
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;
    if (url.endsWith("/fail")) {
      return new Response("oops", { status: 503 });
    }
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  try {
    await withIsolatedQueue(async () => {
      await enqueueRequest({
        url: "https://example.test/api/ok",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"a":1}',
        source: "unit",
      });
      await enqueueRequest({
        url: "https://example.test/api/fail",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"a":2}',
        source: "unit",
      });

      const result = await flushQueue();
      assert("flush attempts both", 2, result.attempted);
      assert("first succeeded", 1, result.succeeded);
      assert("second failed and abandoned", 1, result.failed);
      assert("only failed entry kept in queue", 1, await getQueueSize());
    });

    console.log("offlineQueue: flush stops when network is down");
    await withIsolatedQueue(async () => {
      await enqueueRequest({
        url: "https://example.test/api/ok",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        source: "unit",
      });
      nowOnline = false;
      const result = await flushQueue();
      assert("offline flush attempted", 1, result.attempted);
      assert("offline flush succeeds 0", 0, result.succeeded);
      assert("offline flush failed 1", 1, result.failed);
      assert("queue still has the entry", 1, await getQueueSize());
      nowOnline = true;
    });
  } finally {
    globalThis.fetch = realFetch;
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} test failure(s):`);
    for (const f of failures) console.error(` - ${f.name}: ${f.reason}`);
    process.exit(1);
  }
  console.log("\nAll offlineQueue assertions passed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};

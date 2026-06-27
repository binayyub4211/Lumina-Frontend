import assert from "node:assert/strict";
import {
  SHARED_STATE_MAX_BYTES,
  SHARED_STATE_CHANNEL,
  SharedStateSync,
  type SharedStateEnvironment,
  type SharedStateMessage,
} from "../sharedStateSync";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class MemoryBroadcastChannel {
  static channels = new Map<string, Set<MemoryBroadcastChannel>>();

  readonly name: string;
  onmessage: ((event: MessageEvent<SharedStateMessage>) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    const peers = MemoryBroadcastChannel.channels.get(name) ?? new Set();
    peers.add(this);
    MemoryBroadcastChannel.channels.set(name, peers);
  }

  close(): void {
    MemoryBroadcastChannel.channels.get(this.name)?.delete(this);
  }

  postMessage(message: SharedStateMessage): void {
    const peers = MemoryBroadcastChannel.channels.get(this.name) ?? new Set();
    for (const peer of peers) {
      if (peer === this) continue;
      peer.onmessage?.({ data: message } as MessageEvent<SharedStateMessage>);
    }
  }
}

interface TestTimerEnvironment extends SharedStateEnvironment {
  callbacks: Array<() => void>;
}

function createBroadcastEnvironment(storage: Storage): SharedStateEnvironment {
  return {
    BroadcastChannel: MemoryBroadcastChannel as unknown as typeof BroadcastChannel,
    localStorage: storage,
    crypto: { randomUUID: () => `id-${Math.random().toString(36).slice(2)}` },
  };
}

function createPollingEnvironment(storage: Storage): TestTimerEnvironment {
  const environment: TestTimerEnvironment = {
    callbacks: [],
    localStorage: storage,
    setInterval: ((callback: () => void) => {
      environment.callbacks.push(callback);
      return environment.callbacks.length;
    }) as Window["setInterval"],
    clearInterval: (() => undefined) as Window["clearInterval"],
    crypto: { randomUUID: () => `id-${Math.random().toString(36).slice(2)}` },
  };

  return environment;
}

function run(name: string, test: () => void): void {
  try {
    MemoryBroadcastChannel.channels.clear();
    test();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

run("delivers BroadcastChannel wallet changes across tab contexts", () => {
  const storage = new MemoryStorage();
  const first = new SharedStateSync({
    tabId: "tab-a",
    environment: createBroadcastEnvironment(storage),
    now: () => 100,
  });
  const second = new SharedStateSync({
    tabId: "tab-b",
    environment: createBroadcastEnvironment(storage),
    now: () => 100,
  });

  first.start();
  second.start();

  let received: SharedStateMessage | null = null;
  second.subscribe((message) => {
    received = message;
  });

  first.publish("wallet_change", { publicKey: "GALICE" });

  assert.equal(received?.type, "wallet_change");
  assert.deepEqual(received?.payload, { publicKey: "GALICE" });

  first.stop();
  second.stop();
});

run("elects the lowest active tab id as leader", () => {
  const storage = new MemoryStorage();
  const later = new SharedStateSync({
    tabId: "tab-z",
    environment: createBroadcastEnvironment(storage),
    now: () => 1_000,
  });
  const leader = new SharedStateSync({
    tabId: "tab-a",
    environment: createBroadcastEnvironment(storage),
    now: () => 1_000,
  });

  later.start();
  leader.start();

  assert.equal(later.getLeaderTabId(), "tab-a");
  assert.equal(leader.isLeader(), true);

  later.stop();
  leader.stop();
});

run("uses timestamp ordering for last-write-wins wallet state", () => {
  const storage = new MemoryStorage();
  const currentWriter = new SharedStateSync({
    tabId: "tab-current",
    environment: createBroadcastEnvironment(storage),
    now: () => 200,
  });
  const staleWriter = new SharedStateSync({
    tabId: "tab-stale",
    environment: createBroadcastEnvironment(storage),
    now: () => 100,
  });
  const reader = new SharedStateSync({
    tabId: "tab-reader",
    environment: createBroadcastEnvironment(storage),
    now: () => 200,
  });

  currentWriter.start();
  staleWriter.start();
  reader.start();

  const received: string[] = [];
  reader.subscribe((message) => {
    if (message.type === "wallet_change") received.push(message.payload.publicKey ?? "");
  });

  currentWriter.publish("wallet_change", { publicKey: "GNEW" }, 200);
  staleWriter.publish("wallet_change", { publicKey: "GOLD" }, 100);

  assert.deepEqual(received, ["GNEW"]);

  currentWriter.stop();
  staleWriter.stop();
  reader.stop();
});

run("rejects payloads over the 64KB channel contract", () => {
  const sync = new SharedStateSync({
    tabId: "tab-a",
    environment: createBroadcastEnvironment(new MemoryStorage()),
  });
  sync.start();

  assert.throws(() => {
    sync.publish("cache_invalidate", { reason: "x".repeat(SHARED_STATE_MAX_BYTES) });
  }, /exceeds 65536 bytes/);

  sync.stop();
});

run("falls back to localStorage polling without BroadcastChannel", () => {
  const storage = new MemoryStorage();
  const writerEnvironment = createPollingEnvironment(storage);
  const readerEnvironment = createPollingEnvironment(storage);
  const writer = new SharedStateSync({
    tabId: "tab-writer",
    environment: writerEnvironment,
    now: () => 300,
  });
  const reader = new SharedStateSync({
    tabId: "tab-reader",
    environment: readerEnvironment,
    now: () => 300,
  });

  writer.start();
  reader.start();

  let received: SharedStateMessage | null = null;
  reader.subscribe((message) => {
    received = message;
  });

  writer.publish("operation_complete", {
    operationId: "op-1",
    status: "confirmed",
    queryKey: ["GALICE", "soroban", "billing"],
    txHash: "hash-1",
  });
  readerEnvironment.callbacks.forEach((callback) => callback());

  assert.equal(received?.type, "operation_complete");
  assert.deepEqual(received?.payload.queryKey, ["GALICE", "soroban", "billing"]);

  writer.stop();
  reader.stop();
});

console.log(`${SHARED_STATE_CHANNEL} synchronization tests passed`);

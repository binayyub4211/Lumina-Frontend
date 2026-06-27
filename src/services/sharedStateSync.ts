export const SHARED_STATE_CHANNEL = "shared-state";
export const SHARED_STATE_MAX_BYTES = 64 * 1024;

const TAB_REGISTRY_KEY = "lumina:shared-state:tabs";
const STORAGE_MESSAGE_KEY = "lumina:shared-state:message";
const TAB_HEARTBEAT_MS = 1_000;
const TAB_STALE_MS = 3_000;
const STORAGE_POLL_MS = 25;

type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface WalletChangePayload {
  publicKey: string | null;
  generation?: number;
}

export interface CacheInvalidatePayload {
  queryKey?: JsonValue[];
  exact?: boolean;
  reason?: string;
}

export interface OperationCompletePayload {
  operationId: string;
  status: "confirmed" | "pending" | "failed";
  queryKey?: JsonValue[];
  txHash?: string;
}

export interface AuthExpirePayload {
  reason?: string;
}

export type SharedStateMessage =
  | SharedStateEnvelope<"wallet_change", WalletChangePayload>
  | SharedStateEnvelope<"cache_invalidate", CacheInvalidatePayload>
  | SharedStateEnvelope<"operation_complete", OperationCompletePayload>
  | SharedStateEnvelope<"auth_expire", AuthExpirePayload>;

export interface SharedStateEnvelope<
  TType extends SharedStateMessageType,
  TPayload,
> {
  id: string;
  type: TType;
  timestamp: number;
  sourceTabId: string;
  payload: TPayload;
}

export type SharedStateMessageType =
  | "wallet_change"
  | "cache_invalidate"
  | "operation_complete"
  | "auth_expire";

export type SharedStateListener<T extends SharedStateMessage = SharedStateMessage> = (
  message: T,
) => void;

export interface SharedStateEnvironment {
  BroadcastChannel?: typeof BroadcastChannel;
  localStorage?: Storage;
  addEventListener?: Window["addEventListener"];
  removeEventListener?: Window["removeEventListener"];
  setInterval?: Window["setInterval"];
  clearInterval?: Window["clearInterval"];
  crypto?: Pick<Crypto, "randomUUID" | "getRandomValues">;
}

interface TabRegistry {
  [tabId: string]: number;
}

interface OrderedMessageStamp {
  timestamp: number;
  id: string;
}

export interface SharedStateSyncOptions {
  tabId?: string;
  environment?: SharedStateEnvironment;
  now?: () => number;
  pollIntervalMs?: number;
  heartbeatMs?: number;
  staleTabMs?: number;
}

export class SharedStateSync {
  readonly tabId: string;

  private readonly env: SharedStateEnvironment;
  private readonly now: () => number;
  private readonly pollIntervalMs: number;
  private readonly heartbeatMs: number;
  private readonly staleTabMs: number;
  private readonly listeners = new Set<SharedStateListener>();
  private readonly latestByKey = new Map<string, OrderedMessageStamp>();
  private channel: BroadcastChannel | null = null;
  private heartbeatTimer: number | null = null;
  private storagePollTimer: number | null = null;
  private leaderTabId: string | null = null;
  private lastStorageMessageId: string | null = null;
  private started = false;

  constructor(options: SharedStateSyncOptions = {}) {
    this.env = options.environment ?? getBrowserEnvironment();
    this.now = options.now ?? (() => Date.now());
    this.pollIntervalMs = options.pollIntervalMs ?? STORAGE_POLL_MS;
    this.heartbeatMs = options.heartbeatMs ?? TAB_HEARTBEAT_MS;
    this.staleTabMs = options.staleTabMs ?? TAB_STALE_MS;
    this.tabId = options.tabId ?? createTabId(this.env.crypto);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.registerTab();
    this.startLeaderHeartbeat();
    this.startTransport();
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;

    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }

    if (this.heartbeatTimer && this.env.clearInterval) {
      this.env.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.storagePollTimer && this.env.clearInterval) {
      this.env.clearInterval(this.storagePollTimer);
      this.storagePollTimer = null;
    }

    if (this.env.removeEventListener) {
      this.env.removeEventListener("storage", this.handleStorageEvent);
    }

    this.unregisterTab();
    this.listeners.clear();
  }

  subscribe(listener: SharedStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish<T extends SharedStateMessageType>(
    type: T,
    payload: PayloadFor<T>,
    timestamp = this.now(),
  ): SharedStateMessage {
    const message = {
      id: createMessageId(this.env.crypto),
      type,
      timestamp,
      sourceTabId: this.tabId,
      payload,
    } as SharedStateMessage;

    this.assertMessageSize(message);
    this.recordMessageOrder(message);

    if (this.channel) {
      this.channel.postMessage(message);
      return message;
    }

    this.writeStorageMessage(message);
    return message;
  }

  getLeaderTabId(): string | null {
    this.refreshLeader();
    return this.leaderTabId;
  }

  isLeader(): boolean {
    return this.getLeaderTabId() === this.tabId;
  }

  private startTransport(): void {
    if (this.env.BroadcastChannel) {
      this.channel = new this.env.BroadcastChannel(SHARED_STATE_CHANNEL);
      this.channel.onmessage = (event: MessageEvent<SharedStateMessage>) => {
        this.receive(event.data);
      };
      return;
    }

    if (this.env.addEventListener) {
      this.env.addEventListener("storage", this.handleStorageEvent);
    }

    if (this.env.setInterval) {
      this.storagePollTimer = this.env.setInterval(() => {
        this.pollStorageMessage();
      }, this.pollIntervalMs);
    }
  }

  private startLeaderHeartbeat(): void {
    if (!this.env.setInterval) return;
    this.heartbeatTimer = this.env.setInterval(() => {
      this.registerTab();
    }, this.heartbeatMs);
  }

  private registerTab(): void {
    const registry = this.readRegistry();
    registry[this.tabId] = this.now();
    this.writeRegistry(this.pruneRegistry(registry));
    this.refreshLeader();
  }

  private unregisterTab(): void {
    const registry = this.readRegistry();
    delete registry[this.tabId];
    this.writeRegistry(this.pruneRegistry(registry));
    this.refreshLeader();
  }

  private refreshLeader(): void {
    const registry = this.pruneRegistry(this.readRegistry());
    this.writeRegistry(registry);
    const activeTabs = Object.keys(registry).sort();
    this.leaderTabId = activeTabs[0] ?? null;
  }

  private pruneRegistry(registry: TabRegistry): TabRegistry {
    const cutoff = this.now() - this.staleTabMs;
    return Object.fromEntries(
      Object.entries(registry).filter(([, seenAt]) => seenAt >= cutoff),
    );
  }

  private readRegistry(): TabRegistry {
    try {
      const raw = this.env.localStorage?.getItem(TAB_REGISTRY_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as TabRegistry;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeRegistry(registry: TabRegistry): void {
    try {
      this.env.localStorage?.setItem(TAB_REGISTRY_KEY, JSON.stringify(registry));
    } catch {
      // Leader election is best-effort; transport still works without storage.
    }
  }

  private writeStorageMessage(message: SharedStateMessage): void {
    try {
      this.env.localStorage?.setItem(STORAGE_MESSAGE_KEY, JSON.stringify(message));
      this.lastStorageMessageId = message.id;
    } catch {
      // No usable fallback transport.
    }
  }

  private pollStorageMessage(): void {
    try {
      const raw = this.env.localStorage?.getItem(STORAGE_MESSAGE_KEY);
      if (!raw) return;
      const message = JSON.parse(raw) as SharedStateMessage;
      if (message.id === this.lastStorageMessageId) return;
      this.lastStorageMessageId = message.id;
      this.receive(message);
    } catch {
      // Ignore malformed storage messages from other tabs.
    }
  }

  private readonly handleStorageEvent = (event: StorageEvent): void => {
    if (event.key !== STORAGE_MESSAGE_KEY || !event.newValue) return;
    try {
      const message = JSON.parse(event.newValue) as SharedStateMessage;
      this.receive(message);
    } catch {
      // Ignore malformed storage messages from other tabs.
    }
  };

  private receive(message: SharedStateMessage): void {
    if (!isSharedStateMessage(message)) return;
    if (message.sourceTabId === this.tabId) return;
    if (!this.shouldAccept(message)) return;

    for (const listener of this.listeners) {
      listener(message);
    }
  }

  private shouldAccept(message: SharedStateMessage): boolean {
    const key = getOrderingKey(message);
    const latest = this.latestByKey.get(key);
    if (!latest) {
      this.recordMessageOrder(message);
      return true;
    }

    if (message.timestamp < latest.timestamp) return false;
    if (message.timestamp === latest.timestamp && message.id <= latest.id) {
      return false;
    }

    this.recordMessageOrder(message);
    return true;
  }

  private recordMessageOrder(message: SharedStateMessage): void {
    this.latestByKey.set(getOrderingKey(message), {
      timestamp: message.timestamp,
      id: message.id,
    });
  }

  private assertMessageSize(message: SharedStateMessage): void {
    const encoded = JSON.stringify(message);
    const size = byteLength(encoded);
    if (size > SHARED_STATE_MAX_BYTES) {
      throw new Error(
        `Shared state message exceeds ${SHARED_STATE_MAX_BYTES} bytes (${size})`,
      );
    }
  }
}

type PayloadFor<T extends SharedStateMessageType> = Extract<
  SharedStateMessage,
  { type: T }
>["payload"];

let singleton: SharedStateSync | null = null;

export function getSharedStateSync(): SharedStateSync {
  if (!singleton) singleton = new SharedStateSync();
  singleton.start();
  return singleton;
}

export function resetSharedStateSyncForTests(): void {
  singleton?.stop();
  singleton = null;
}

function getBrowserEnvironment(): SharedStateEnvironment {
  if (typeof window === "undefined") return {};
  return {
    BroadcastChannel: window.BroadcastChannel,
    localStorage: window.localStorage,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    crypto: window.crypto,
  };
}

function isSharedStateMessage(message: unknown): message is SharedStateMessage {
  if (!message || typeof message !== "object") return false;
  const candidate = message as Partial<SharedStateMessage>;
  if (typeof candidate.id !== "string") return false;
  if (typeof candidate.timestamp !== "number") return false;
  if (typeof candidate.sourceTabId !== "string") return false;
  if (!candidate.payload || typeof candidate.payload !== "object") return false;
  return (
    candidate.type === "wallet_change" ||
    candidate.type === "cache_invalidate" ||
    candidate.type === "operation_complete" ||
    candidate.type === "auth_expire"
  );
}

function getOrderingKey(message: SharedStateMessage): string {
  switch (message.type) {
    case "wallet_change":
      return "wallet";
    case "auth_expire":
      return "auth";
    case "cache_invalidate":
      return `cache:${JSON.stringify(message.payload.queryKey ?? [])}`;
    case "operation_complete":
      return `operation:${message.payload.operationId}`;
  }
}

function createTabId(crypto: SharedStateEnvironment["crypto"]): string {
  return `tab-${createRandomId(crypto)}`;
}

function createMessageId(crypto: SharedStateEnvironment["crypto"]): string {
  return `msg-${createRandomId(crypto)}`;
}

function createRandomId(crypto: SharedStateEnvironment["crypto"]): string {
  if (crypto?.randomUUID) return crypto.randomUUID();

  if (crypto?.getRandomValues) {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${values[0].toString(36)}${values[1].toString(36)}`;
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
}

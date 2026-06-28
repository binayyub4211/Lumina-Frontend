/**
 * signalingClient.ts – Lightweight WebSocket signaling client for WebRTC
 *
 * Connects to wss://<host>/signaling/, emits join/leave events, and forwards
 * SDP offers, answers, and ICE candidates between peers in a facility cluster.
 *
 * Invariants:
 * - Single connection per clusterId
 * - Reconnection backoff: 1 s, 2 s, 4 s, max 30 s
 * - Message size limit enforced before send
 */

'use client'

export type SignalingEventType =
  | 'join'
  | 'leave'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'error'
  | 'close'

export interface SignalingMessage {
  type: SignalingEventType
  from?: string
  to?: string
  clusterId: string
  payload?: unknown
}

export type SignalingEventHandler = (msg: SignalingMessage) => void

export interface SignalingClientConfig {
  /** Base WebSocket URL (e.g. wss://example.com) */
  baseUrl: string
  /** Cluster identifier shared by all peers in the facility group */
  clusterId: string
  /** Maximum message size in bytes (default 16 KB) */
  maxMessageSize?: number
}

export class SignalingClient {
  private ws: WebSocket | null = null
  private readonly baseUrl: string
  private readonly clusterId: string
  private readonly maxMessageSize: number
  private readonly listeners = new Set<SignalingEventHandler>()
  private reconnectAttempts = 0
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private intentionalClose = false
  private destroyed = false

  constructor(config: SignalingClientConfig) {
    this.baseUrl = config.baseUrl
    this.clusterId = config.clusterId
    this.maxMessageSize = config.maxMessageSize ?? 16_384
  }

  // ── Public API ──────────────────────────────────────────────────────────

  connect(): void {
    if (this.destroyed || this.ws?.readyState === WebSocket.OPEN) return
    this.intentionalClose = false

    const url = `${this.baseUrl}/signaling/?cluster=${encodeURIComponent(this.clusterId)}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.send({ type: 'join', clusterId: this.clusterId })
    }

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: SignalingMessage =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        this.dispatch(msg)
      } catch {
        // Ignore malformed messages from signaling server
      }
    }

    this.ws.onerror = () => {
      this.dispatch({ type: 'error', clusterId: this.clusterId })
    }

    this.ws.onclose = () => {
      if (!this.intentionalClose && !this.destroyed) {
        this.scheduleReconnect()
      }
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    this.cancelReconnect()
    if (this.ws) {
      try {
        this.send({ type: 'leave', clusterId: this.clusterId })
      } catch {
        // Best effort
      }
      this.ws.close()
      this.ws = null
    }
  }

  destroy(): void {
    this.destroyed = true
    this.disconnect()
    this.listeners.clear()
  }

  /** Relay an SDP offer to a specific peer */
  sendOffer(to: string, sdp: RTCSessionDescriptionInit): void {
    this.send({
      type: 'offer',
      to,
      clusterId: this.clusterId,
      payload: sdp,
    })
  }

  /** Relay an SDP answer to a specific peer */
  sendAnswer(to: string, sdp: RTCSessionDescriptionInit): void {
    this.send({
      type: 'answer',
      to,
      clusterId: this.clusterId,
      payload: sdp,
    })
  }

  /** Relay an ICE candidate to a specific peer */
  sendIceCandidate(to: string, candidate: RTCIceCandidateInit): void {
    this.send({
      type: 'ice-candidate',
      to,
      clusterId: this.clusterId,
      payload: candidate,
    })
  }

  on(handler: SignalingEventHandler): () => void {
    this.listeners.add(handler)
    return () => {
      this.listeners.delete(handler)
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private send(msg: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return

    const payload = JSON.stringify(msg)
    if (payload.length > this.maxMessageSize) {
      console.warn(
        `[SignalingClient] Message exceeds ${this.maxMessageSize} byte limit; dropped`
      )
      return
    }

    this.ws.send(payload)
  }

  private dispatch(msg: SignalingMessage): void {
    for (const handler of this.listeners) {
      try {
        handler(msg)
      } catch {
        // Isolate listener failures
      }
    }
  }

  private scheduleReconnect(): void {
    const delays = [1_000, 2_000, 4_000, 30_000]
    const delay = delays[Math.min(this.reconnectAttempts, delays.length - 1)]

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++
      this.connect()
    }, delay)
  }

  private cancelReconnect(): void {
    if (this.reconnectTimeout !== null) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
  }
}

/**
 * peerConnectionPool.ts – WebRTC peer connection pool manager
 *
 * Maintains a Map<peerId, RTCPeerConnection> for a facility cluster mesh.
 * On peer join (from signaling), creates a new RTCPeerConnection with STUN
 * config, adds one real-time data channel (ordered:true, maxRetransmits:0)
 * and one reliable bulk channel, then exchanges SDP offers/answers.
 *
 * Invariants:
 * - Max 10 peers per pool
 * - STUN only (no TURN); bail to server-polling if ICE fails
 * - ICE timeout: 5 s per peer → marks peer as fallback
 */

'use client'

export interface PeerMeta {
  peerId: string
  connection: RTCPeerConnection
  realtimeChannel: RTCDataChannel | null
  reliableChannel: RTCDataChannel | null
  state: 'connecting' | 'connected' | 'failed'
  iceTimeout: ReturnType<typeof setTimeout> | null
}

export type PeerConnectionState = PeerMeta['state']

export interface PoolConfig {
  /** STUN server URLs (no TURN) */
  iceServers?: RTCIceServer[]
  /** Milliseconds before ICE is considered failed (default 5000) */
  iceTimeoutMs?: number
  /** Maximum number of peers in the pool (default 10) */
  maxPeers?: number
}

export type PeerEventType = 'peer-connected' | 'peer-failed' | 'peer-removed' | 'realtime-message' | 'reliable-message'

export interface PeerEvent {
  type: PeerEventType
  peerId: string
  data?: unknown
}

export type PeerEventHandler = (event: PeerEvent) => void

const REALTIME_LABEL = 'lumina-realtime'
const RELIABLE_LABEL = 'lumina-reliable'

export class PeerConnectionPool {
  private readonly peers = new Map<string, PeerMeta>()
  private readonly iceServers: RTCIceServer[]
  private readonly iceTimeoutMs: number
  private readonly maxPeers: number
  private readonly listeners = new Set<PeerEventHandler>()

  constructor(config: PoolConfig = {}) {
    this.iceServers = config.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }]
    this.iceTimeoutMs = config.iceTimeoutMs ?? 5_000
    this.maxPeers = config.maxPeers ?? 10
  }

  // ── Public API ──────────────────────────────────────────────────────────

  get peerCount(): number {
    return this.peers.size
  }

  get connectedPeers(): string[] {
    const ids: string[] = []
    for (const [id, meta] of this.peers) {
      if (meta.state === 'connected') ids.push(id)
    }
    return ids
  }

  get failedPeers(): string[] {
    const ids: string[] = []
    for (const [id, meta] of this.peers) {
      if (meta.state === 'failed') ids.push(id)
    }
    return ids
  }

  /**
   * Create a peer connection (as the offerer) when a new peer joins the
   * cluster. Returns the created RTCPeerConnection so the caller can create
   * an SDP offer to relay via signaling.
   */
  async addPeerAsOfferer(peerId: string): Promise<{
    connection: RTCPeerConnection
    offer: RTCSessionDescriptionInit
  }> {
    if (this.peers.size >= this.maxPeers) {
      throw new Error(`Peer pool full (max ${this.maxPeers})`)
    }
    if (this.peers.has(peerId)) {
      throw new Error(`Peer ${peerId} already in pool`)
    }

    const pc = this.createConnection(peerId)

    // Create data channels (only the offerer creates them)
    const realtimeChannel = pc.createDataChannel(REALTIME_LABEL, {
      ordered: true,
      maxRetransmits: 0,
    })
    const reliableChannel = pc.createDataChannel(RELIABLE_LABEL, {
      ordered: true,
    })

    this.setupDataChannels(peerId, realtimeChannel, reliableChannel)

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    return { connection: pc, offer: pc.localDescription! }
  }

  /**
   * Accept an incoming peer by creating an RTCPeerConnection and setting the
   * remote offer. Returns the answer to relay via signaling.
   */
  async addPeerAsAnswerer(
    peerId: string,
    remoteOffer: RTCSessionDescriptionInit
  ): Promise<{
    connection: RTCPeerConnection
    answer: RTCSessionDescriptionInit
  }> {
    if (this.peers.size >= this.maxPeers) {
      throw new Error(`Peer pool full (max ${this.maxPeers})`)
    }
    if (this.peers.has(peerId)) {
      throw new Error(`Peer ${peerId} already in pool`)
    }

    const pc = this.createConnection(peerId)

    // Data channels arrive from the offerer side
    pc.ondatachannel = (event) => {
      const channel = event.channel
      if (channel.label === REALTIME_LABEL) {
        const meta = this.peers.get(peerId)
        if (meta) {
          meta.realtimeChannel = channel
          this.hookChannel(peerId, channel, 'realtime-message')
        }
      } else if (channel.label === RELIABLE_LABEL) {
        const meta = this.peers.get(peerId)
        if (meta) {
          meta.reliableChannel = channel
          this.hookChannel(peerId, channel, 'reliable-message')
        }
      }
    }

    await pc.setRemoteDescription(remoteOffer)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return { connection: pc, answer: pc.localDescription! }
  }

  /** Apply a remote SDP answer to an existing peer connection */
  async applyAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const meta = this.peers.get(peerId)
    if (!meta) throw new Error(`Peer ${peerId} not found`)
    await meta.connection.setRemoteDescription(answer)
  }

  /** Add a remote ICE candidate */
  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const meta = this.peers.get(peerId)
    if (!meta) return // Silently ignore for peers not in pool
    try {
      await meta.connection.addIceCandidate(new RTCIceCandidate(candidate))
    } catch {
      // Ignore invalid candidates
    }
  }

  /** Broadcast a payload to all connected peers via the realtime channel */
  broadcastRealtime(payload: unknown): void {
    const data = JSON.stringify(payload)
    for (const peerId of this.connectedPeers) {
      const meta = this.peers.get(peerId)
      if (meta?.realtimeChannel?.readyState === 'open') {
        try {
          meta.realtimeChannel.send(data)
        } catch {
          // Channel may have closed between check and send
        }
      }
    }
  }

  /** Send to a specific peer via the reliable channel */
  sendReliable(peerId: string, payload: unknown): void {
    const meta = this.peers.get(peerId)
    if (!meta || meta.state !== 'connected' || meta.reliableChannel?.readyState !== 'open') {
      return
    }
    try {
      meta.reliableChannel.send(JSON.stringify(payload))
    } catch {
      // Channel may have closed
    }
  }

  /** Remove and close a peer connection */
  removePeer(peerId: string): void {
    const meta = this.peers.get(peerId)
    if (!meta) return

    if (meta.iceTimeout !== null) clearTimeout(meta.iceTimeout)
    meta.realtimeChannel?.close()
    meta.reliableChannel?.close()
    meta.connection.close()
    this.peers.delete(peerId)

    this.emit({ type: 'peer-removed', peerId })
  }

  /** Close all connections and clean up */
  destroy(): void {
    for (const peerId of Array.from(this.peers.keys())) {
      this.removePeer(peerId)
    }
    this.listeners.clear()
  }

  on(handler: PeerEventHandler): () => void {
    this.listeners.add(handler)
    return () => {
      this.listeners.delete(handler)
    }
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private createConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers })

    const iceTimeout = setTimeout(() => {
      const meta = this.peers.get(peerId)
      if (meta && meta.state === 'connecting') {
        meta.state = 'failed'
        this.emit({ type: 'peer-failed', peerId })
      }
    }, this.iceTimeoutMs)

    pc.oniceconnectionstatechange = () => {
      const meta = this.peers.get(peerId)
      if (!meta) return

      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (meta.iceTimeout !== null) {
          clearTimeout(meta.iceTimeout)
          meta.iceTimeout = null
        }
        if (meta.state !== 'connected') {
          meta.state = 'connected'
          this.emit({ type: 'peer-connected', peerId })
        }
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        if (meta.iceTimeout !== null) {
          clearTimeout(meta.iceTimeout)
          meta.iceTimeout = null
        }
        meta.state = 'failed'
        this.emit({ type: 'peer-failed', peerId })
      }
    }

    pc.onicecandidate = () => {
      // Candidate relay is handled externally via signalingClient
    }

    this.peers.set(peerId, {
      peerId,
      connection: pc,
      realtimeChannel: null,
      reliableChannel: null,
      state: 'connecting',
      iceTimeout,
    })

    return pc
  }

  private setupDataChannels(
    peerId: string,
    realtime: RTCDataChannel,
    reliable: RTCDataChannel
  ): void {
    const meta = this.peers.get(peerId)
    if (!meta) return

    meta.realtimeChannel = realtime
    meta.reliableChannel = reliable

    this.hookChannel(peerId, realtime, 'realtime-message')
    this.hookChannel(peerId, reliable, 'reliable-message')
  }

  private hookChannel(
    peerId: string,
    channel: RTCDataChannel,
    eventType: 'realtime-message' | 'reliable-message'
  ): void {
    channel.onmessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
        this.emit({ type: eventType, peerId, data })
      } catch {
        // Ignore unparseable messages
      }
    }

    channel.onerror = () => {
      // Channel errors are expected for real-time mode
    }
  }

  private emit(event: PeerEvent): void {
    for (const handler of this.listeners) {
      try {
        handler(event)
      } catch {
        // Isolate listener failures
      }
    }
  }
}

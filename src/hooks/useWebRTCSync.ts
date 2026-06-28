/**
 * useWebRTCSync – WebRTC Peer-to-Peer Relay Hook
 *
 * Connects a signaling client, manages a peer connection pool, and provides
 * sendStatusUpdate() / onStatusUpdate() for facility node state propagation.
 *
 * Fallback: if after 5 s no ICE connection succeeds for a peer, that peer is
 * marked as failed and the hook falls back to server polling every 2 s.
 *
 * Invariants:
 * - Mesh size: <= 10 peers per sync group (enforced by pool)
 * - Data channel: ordered unreliable for real-time status; reliable for bulk sync
 * - Message size limit: 16 KB per SCTP message (enforced by signaling client)
 */

'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { SignalingClient } from '@/src/lib/webrtc/signalingClient'
import { PeerConnectionPool, type PeerEvent } from '@/src/lib/webrtc/peerConnectionPool'
import { useNetworkSyncStore } from '@/src/store/networkSyncStore'

export type NodeStatusUpdate = {
  nodeId: string
  timestamp: number
  powerSource: 'grid' | 'solar' | 'battery'
  // Additional node metadata that may change
  metadata?: Record<string, string | number | boolean | null>
}

export type WebRTCSyncConfig = {
  /** WebSocket signaling base URL */
  signalingUrl: string
  /** Facility cluster identifier */
  clusterId: string
  /** STUN server URLs (no TURN) */
  iceServers?: RTCIceServer[]
  /** ICE timeout in ms per peer (default 5000) */
  iceTimeoutMs?: number
  /** Max peers in the mesh (default 10) */
  maxPeers?: number
  /** Polling interval in ms when WebRTC fails (default 2000) */
  pollingIntervalMs?: number
  /** Called at the polling interval when WebRTC is not active */
  onPoll?: () => void
}

export interface UseWebRTCSyncReturn {
  /** Send a node status update to all connected peers in the cluster */
  sendStatusUpdate: (update: NodeStatusUpdate) => void
  /** Register a callback for incoming remote status updates */
  onStatusUpdate: (callback: (update: NodeStatusUpdate) => void) => () => void
  /** True when at least one peer is connected via WebRTC */
  isWebRTCActive: boolean
  /** Number of peers connected via WebRTC */
  connectedPeerCount: number
}

const DEFAULT_STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' }

/**
 * Subscribe to external store changes via a callback pattern.
 * useSyncExternalStore is used to safely bridge the signaling/pool event
 * streams into React without stale closures.
 */
function createExternalStore<T>(initial: T) {
  let state = initial
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set: (next: T) => {
      state = next
      for (const fn of listeners) fn()
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => { listeners.delete(fn) }
    },
  }
}

export function useWebRTCSync(config: WebRTCSyncConfig): UseWebRTCSyncReturn {
  const {
    signalingUrl,
    clusterId,
    iceServers = [DEFAULT_STUN],
    iceTimeoutMs = 5_000,
    maxPeers = 10,
    pollingIntervalMs = 2_000,
    onPoll,
  } = config

  const store = useNetworkSyncStore()

  // Stable refs to avoid re-creating clients on every render
  const signalingRef = useRef<SignalingClient | null>(null)
  const poolRef = useRef<PeerConnectionPool | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onPollRef = useRef<(() => void) | undefined>(onPoll)
  onPollRef.current = onPoll

  // External stores to bridge non-React state into React
  const connectedCountStore = useRef(createExternalStore(0)).current
  const webrtcActiveStore = useRef(createExternalStore(false)).current

  const connectedPeerCount = useSyncExternalStore(
    connectedCountStore.subscribe,
    connectedCountStore.get,
    connectedCountStore.get,
  )

  const isWebRTCActive = useSyncExternalStore(
    webrtcActiveStore.subscribe,
    webrtcActiveStore.get,
    webrtcActiveStore.get,
  )

  // ── Polling fallback ────────────────────────────────────────────────────

  const startPolling = useCallback(() => {
    if (pollingRef.current !== null) return

    store.setPollingInterval(pollingIntervalMs)
    pollingRef.current = setInterval(() => {
      onPollRef.current?.()
    }, pollingIntervalMs)
  }, [pollingIntervalMs, store])

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    store.setPollingInterval(0)
  }, [store])

  // ── Peer event handler ──────────────────────────────────────────────────

  const handlePeerEvent = useCallback(
    (event: PeerEvent) => {
      switch (event.type) {
        case 'peer-connected': {
          store.updatePeerMode(event.peerId, 'webrtc')
          store.updatePeerStatus(event.peerId, 0)
          const count = poolRef.current?.connectedPeers.length ?? 0
          connectedCountStore.set(count)
          if (count > 0) {
            webrtcActiveStore.set(true)
            store.setWebrtcActive(true)
            stopPolling()
          }
          break
        }
        case 'peer-failed': {
          store.updatePeerMode(event.peerId, 'polling')
          const count = poolRef.current?.connectedPeers.length ?? 0
          connectedCountStore.set(count)
          if (count === 0) {
            webrtcActiveStore.set(false)
            store.setWebrtcActive(false)
            startPolling()
          }
          break
        }
        case 'peer-removed': {
          store.removePeer(event.peerId)
          const count = poolRef.current?.connectedPeers.length ?? 0
          connectedCountStore.set(count)
          if (count === 0) {
            webrtcActiveStore.set(false)
            store.setWebrtcActive(false)
            startPolling()
          }
          break
        }
        default:
          break
      }
    },
    [store, connectedCountStore, webrtcActiveStore, startPolling, stopPolling],
  )

  // ── Signaling event handler ─────────────────────────────────────────────

  const handleSignaling = useCallback(
    async (msg: { type: string; from?: string; to?: string; clusterId: string; payload?: unknown }) => {
      if (msg.clusterId !== clusterId) return
      const pool = poolRef.current
      const signaling = signalingRef.current
      if (!pool || !signaling) return

      switch (msg.type) {
        case 'join': {
          const fromPeer = msg.from
          if (!fromPeer) break

          store.addPeer(fromPeer, 'webrtc')

          try {
            const { offer } = await pool.addPeerAsOfferer(fromPeer)
            signaling.sendOffer(fromPeer, offer)
          } catch {
            store.updatePeerMode(fromPeer, 'polling')
          }
          break
        }

        case 'leave': {
          const fromPeer = msg.from
          if (fromPeer) {
            pool.removePeer(fromPeer)
          }
          break
        }

        case 'offer': {
          const fromPeer = msg.from
          if (!fromPeer || !msg.payload) break

          store.addPeer(fromPeer, 'webrtc')

          try {
            const { answer } = await pool.addPeerAsAnswerer(
              fromPeer,
              msg.payload as RTCSessionDescriptionInit,
            )
            signaling.sendAnswer(fromPeer, answer)
          } catch {
            store.updatePeerMode(fromPeer, 'polling')
          }
          break
        }

        case 'answer': {
          const fromPeer = msg.from
          if (!fromPeer || !msg.payload) break

          try {
            await pool.applyAnswer(fromPeer, msg.payload as RTCSessionDescriptionInit)
          } catch {
            store.updatePeerMode(fromPeer, 'polling')
          }
          break
        }

        case 'ice-candidate': {
          const fromPeer = msg.from
          if (!fromPeer || !msg.payload) break

          await pool.addIceCandidate(fromPeer, msg.payload as RTCIceCandidateInit)
          break
        }

        default:
          break
      }
    },
    [clusterId, store],
  )

  // ── Lifecycle ───────────────────────────────────────────────────────────

  const statusCallbacksRef = useRef<Set<(update: NodeStatusUpdate) => void>>(new Set())

  useEffect(() => {
    store.setClusterId(clusterId)

    const signaling = new SignalingClient({
      baseUrl: signalingUrl,
      clusterId,
    })

    const pool = new PeerConnectionPool({
      iceServers,
      iceTimeoutMs,
      maxPeers,
    })

    signalingRef.current = signaling
    poolRef.current = pool

    const unsubSignaling = signaling.on(handleSignaling)
    const unsubPool = pool.on(handlePeerEvent)

    // Wire incoming real-time messages to status callbacks
    const unsubRealtime = pool.on((event: PeerEvent) => {
      if (event.type === 'realtime-message' && event.data) {
        const update = event.data as NodeStatusUpdate
        for (const cb of statusCallbacksRef.current) {
          try {
            cb(update)
          } catch {
            // Isolate callback failures
          }
        }
      }
    })

    signaling.connect()

    return () => {
      unsubSignaling()
      unsubPool()
      unsubRealtime()
      signaling.destroy()
      pool.destroy()
      signalingRef.current = null
      poolRef.current = null
      stopPolling()
      store.setClusterId(null)
      store.setWebrtcActive(false)
    }
  }, [signalingUrl, clusterId, iceServers, iceTimeoutMs, maxPeers, store, handleSignaling, handlePeerEvent, stopPolling])

  // ── Incoming status callback management ─────────────────────────────────

  const onStatusUpdate = useCallback(
    (callback: (update: NodeStatusUpdate) => void): (() => void) => {
      statusCallbacksRef.current.add(callback)
      return () => {
        statusCallbacksRef.current.delete(callback)
      }
    },
    [],
  )

  // ── Public API ──────────────────────────────────────────────────────────

  const sendStatusUpdate = useCallback(
    (update: NodeStatusUpdate) => {
      poolRef.current?.broadcastRealtime(update)
    },
    [],
  )

  return {
    sendStatusUpdate,
    onStatusUpdate,
    isWebRTCActive,
    connectedPeerCount,
  }
}

'use client'

import { create } from 'zustand'

export type SyncConnectionMode = 'webrtc' | 'polling' | 'disconnected'

export interface PeerSyncState {
  peerId: string
  mode: SyncConnectionMode
  lastStatusAt: string | null
  latencyMs: number | null
}

export interface NetworkSyncState {
  /** Cluster ID this client belongs to */
  clusterId: string | null
  /** Map of peerId → sync state */
  peers: Record<string, PeerSyncState>
  /** Whether WebRTC is active for this cluster */
  webrtcActive: boolean
  /** Polling interval in ms (0 = no polling) */
  pollingIntervalMs: number

  // Actions
  setClusterId: (clusterId: string | null) => void
  addPeer: (peerId: string, mode: SyncConnectionMode) => void
  updatePeerMode: (peerId: string, mode: SyncConnectionMode) => void
  updatePeerStatus: (peerId: string, latencyMs: number) => void
  removePeer: (peerId: string) => void
  setWebrtcActive: (active: boolean) => void
  setPollingInterval: (ms: number) => void
}

export const useNetworkSyncStore = create<NetworkSyncState>((set) => ({
  clusterId: null,
  peers: {},
  webrtcActive: false,
  pollingIntervalMs: 0,

  setClusterId: (clusterId) => set({ clusterId }),

  addPeer: (peerId, mode) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [peerId]: {
          peerId,
          mode,
          lastStatusAt: null,
          latencyMs: null,
        },
      },
    })),

  updatePeerMode: (peerId, mode) =>
    set((state) => {
      const existing = state.peers[peerId]
      if (!existing) return state
      return {
        peers: {
          ...state.peers,
          [peerId]: { ...existing, mode },
        },
      }
    }),

  updatePeerStatus: (peerId, latencyMs) =>
    set((state) => {
      const existing = state.peers[peerId]
      if (!existing) return state
      return {
        peers: {
          ...state.peers,
          [peerId]: {
            ...existing,
            lastStatusAt: new Date().toISOString(),
            latencyMs,
          },
        },
      }
    }),

  removePeer: (peerId) =>
    set((state) => {
      if (!(peerId in state.peers)) return state
      const next = { ...state.peers }
      delete next[peerId]
      return { peers: next }
    }),

  setWebrtcActive: (active) => set({ webrtcActive: active }),

  setPollingInterval: (ms) => set({ pollingIntervalMs: ms }),
}))

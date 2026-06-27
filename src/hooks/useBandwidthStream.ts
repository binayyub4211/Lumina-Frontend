'use client'

import { useCallback, useEffect } from 'react'
import { useWebSocket } from './useWebSocket'

export interface BandwidthDataPoint {
  timestamp: number
  value: number
}

export interface UseBandwidthStreamProps {
  wsUrl: string
  onMessage: (data: BandwidthDataPoint) => void
  enabled?: boolean
}

export function useBandwidthStream({
  wsUrl,
  onMessage,
  enabled = true,
}: UseBandwidthStreamProps) {
  const handleMessage = useCallback(
    (data: any) => {
      if (!enabled) return
      // Support nested value/timestamp or direct format
      if (data && typeof data.value === 'number' && typeof data.timestamp === 'number') {
        onMessage({
          timestamp: data.timestamp,
          value: data.value,
        })
      } else if (data && typeof data.bandwidth === 'number') {
        onMessage({
          timestamp: data.timestamp || Date.now(),
          value: data.bandwidth,
        })
      }
    },
    [onMessage, enabled]
  )

  const isMock = typeof window !== 'undefined' && (wsUrl.includes('mock') || wsUrl.includes('localhost'))
  const wsConfig = isMock
    ? { url: 'ws://mock', reconnect: false }
    : { url: wsUrl, reconnect: true }

  const ws = useWebSocket<any>(wsConfig, isMock ? () => {} : handleMessage)

  // Listen for simulated/mock messages
  useEffect(() => {
    if (!isMock) return

    const handleMockEvent = (e: Event) => {
      const customEvent = e as CustomEvent<any>
      if (Array.isArray(customEvent.detail)) {
        // Handle burst of points
        customEvent.detail.forEach((pt) => handleMessage(pt))
      } else {
        handleMessage(customEvent.detail)
      }
    }

    window.addEventListener('mock-bandwidth-message', handleMockEvent)
    return () => {
      window.removeEventListener('mock-bandwidth-message', handleMockEvent)
    }
  }, [isMock, handleMessage])

  return ws
}

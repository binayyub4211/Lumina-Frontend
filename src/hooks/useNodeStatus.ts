'use client'

import { useEffect, useMemo, useRef } from 'react'
import type { NodePosition } from '@/src/types/network'

export type NodePowerSource = 'grid' | 'solar' | 'battery'

export interface NodeStatus {
  nodeId: string
  powerSource: NodePowerSource
}

export interface UseNodeStatusOptions {
  /** Optional callback to send status updates to WebRTC peers */
  sendStatusUpdate?: (update: {
    nodeId: string
    timestamp: number
    powerSource: NodePowerSource
    metadata?: Record<string, string | number | boolean | null>
  }) => void
}

function isPowerSource(value: unknown): value is NodePowerSource {
  return value === 'grid' || value === 'solar' || value === 'battery'
}

export function getNodePowerSource(node: NodePosition): NodePowerSource {
  const value = node.metadata?.powerSource
  return isPowerSource(value) ? value : 'grid'
}

export function useNodeStatus(
  node: NodePosition,
  options?: UseNodeStatusOptions,
): NodeStatus {
  const prevSourceRef = useRef<NodePowerSource | null>(null)

  const status = useMemo(
    () => ({
      nodeId: node.id,
      powerSource: getNodePowerSource(node),
    }),
    [node],
  )

  // Propagate status changes to WebRTC peers when sendStatusUpdate is provided
  useEffect(() => {
    const sendStatusUpdate = options?.sendStatusUpdate
    if (!sendStatusUpdate) return

    const currentSource = status.powerSource
    if (prevSourceRef.current !== null && prevSourceRef.current !== currentSource) {
      sendStatusUpdate({
        nodeId: status.nodeId,
        timestamp: Date.now(),
        powerSource: currentSource,
        metadata: node.metadata,
      })
    }
    prevSourceRef.current = currentSource
  }, [status.powerSource, status.nodeId, node.metadata, options?.sendStatusUpdate])

  return status
}

'use client'

import { useMemo } from 'react'
import type { NodePosition } from '@/src/types/network'

export type NodePowerSource = 'grid' | 'solar' | 'battery'

export interface NodeStatus {
  nodeId: string
  powerSource: NodePowerSource
}

function isPowerSource(value: unknown): value is NodePowerSource {
  return value === 'grid' || value === 'solar' || value === 'battery'
}

export function getNodePowerSource(node: NodePosition): NodePowerSource {
  const value = node.metadata?.powerSource
  return isPowerSource(value) ? value : 'grid'
}

export function useNodeStatus(node: NodePosition): NodeStatus {
  return useMemo(
    () => ({
      nodeId: node.id,
      powerSource: getNodePowerSource(node),
    }),
    [node],
  )
}
